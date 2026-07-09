import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  FiArrowLeft,
  FiDollarSign,
  FiCheckCircle,
  FiUpload,
  FiFileText,
  FiPrinter,
  FiTrash2,
  FiUser,
  FiMapPin,
  FiTruck,
  FiArrowRight,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import StatusSteps from '../components/ui/StatusSteps'
import Modal from '../components/ui/Modal'
import { ButtonLoader, SectionLoader } from '../components/ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../contexts/AuthContext'
import {
  saleService,
  customerService,
  inventoryService,
  paymentService,
  creditService,
  settingsService,
  uploadMany,
} from '../services'
import {
  PAYMENT_METHODS,
  CREDIT_STATUS,
  CREDIT_DOCUMENT_TYPES,
  CUSTOMER_DOCUMENT_TYPES,
  PRE_DELIVERY_CHECKLIST,
  WARRANTY_PERIOD_MONTHS,
  VAT_RATE,
  SALE_FLOW_CASH,
  SALE_FLOW_CREDIT,
  VEHICLE_ASSIGNABLE_STATUS,
} from '../constants'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  receiptNumber,
  invoiceNumber,
  deliveryNoteNumber,
  computeVat,
} from '../utils/helpers'
import { can } from '../utils/permissions'

export default function SaleDetails() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data, loading, reload } = useAsync(async () => {
    const [sale, customers, vehicles, payments, credit, settings] = await Promise.all([
      saleService.getById(id),
      customerService.getAll(),
      inventoryService.getAll(),
      paymentService.getBySale(id),
      creditService.getBySale(id),
      settingsService.getAll(),
    ])
    return {
      sale,
      customer: customers.find((c) => c.id === sale?.customerId),
      vehicle: vehicles.find((v) => v.id === sale?.vehicleId),
      assignableVehicles: vehicles.filter((v) => VEHICLE_ASSIGNABLE_STATUS.includes(v.status)),
      payments,
      credit,
      settings,
    }
  }, [id])

  const [agreeOpen, setAgreeOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [preDeliveryOpen, setPreDeliveryOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Each modal gets its own useForm instance so fields from one modal can
  // never interfere with another modal's validation.
  const agreeForm = useForm()
  const payForm = useForm()
  const creditForm = useForm()
  const assignForm = useForm()
  const dispatchForm = useForm()
  const invoiceForm = useForm()
  const preDeliveryForm = useForm()

  if (loading || !data) {
    return (
      <AppLayout>
        <SectionLoader label="Loading sale…" />
      </AppLayout>
    )
  }

  const { sale, customer, vehicle, assignableVehicles, payments, credit, settings } = data
  if (!sale) {
    return (
      <AppLayout>
        <PageHeader title="Sale Not Found" />
        <Link to="/sales" className="btn-outline">Back</Link>
      </AppLayout>
    )
  }

  const canManage = can.manageSales(profile?.role)
  const financiers = settings?.financiers || []
  const branches = settings?.branches || []
  const isCash = sale.paymentMethod === 'Cash' || sale.paymentMethod === 'Installments'
  const isCredit = sale.paymentMethod === 'Credit'
  const paymentConfirmed = payments.some((p) => p.confirmed)
  const creditDocs = credit?.documents || {}

  // ----- Agree to proceed -----
  const openAgree = () => {
    agreeForm.reset({
      paymentMethod: sale.paymentMethod || 'Cash',
      price: sale.price > 0 ? sale.price : '',
      branch: sale.branch || branches[0] || '',
    })
    setAgreeOpen(true)
  }

  const doAgree = async (formData) => {
    try {
      await saleService.agreeToProceed(id, {
        paymentMethod: formData.paymentMethod,
        price: formData.price,
        branch: formData.branch,
      })
      // If credit, create the credit application record so documents can be uploaded.
      if (formData.paymentMethod === 'Credit' && !credit) {
        await creditService.create({
          saleId: id,
          customerId: sale.customerId,
          financier: '',
          status: 'Loan Requested',
        })
      }
      toast.success('Payment method captured')
      setAgreeOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Cash payment -----
  const openPayment = () => {
    payForm.reset({
      amount: sale.price,
      paymentMethod: 'Cash',
      reference: '',
      paymentDate: dayjs().format('YYYY-MM-DD'),
    })
    setPayOpen(true)
  }

  const recordPayment = async (formData) => {
    try {
      const rcp = receiptNumber()
      await paymentService.create({
        saleId: id,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        reference: formData.reference,
        paymentDate: formData.paymentDate,
        receiptNumber: rcp,
        confirmed: false,
        recordedBy: profile.uid,
      })
      toast.success('Payment recorded')
      setPayOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const confirmPayment = async (payment) => {
    try {
      await paymentService.confirm(payment.id)
      const updatedPayments = payments.map(p => p.id === payment.id ? { ...p, confirmed: true } : p)
      const totalConfirmed = updatedPayments.filter(p => p.confirmed).reduce((sum, p) => sum + p.amount, 0)
      if (isCash && totalConfirmed >= sale.price) {
        await saleService.confirmCashPayment(id)
        toast.success('Full payment confirmed. Ready to assign a unit.')
      } else {
        toast.success(`Payment confirmed. Paid: ${formatCurrency(totalConfirmed)}`)
      }
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const printReceipt = (payment) => {
    const w = window.open('', '_blank', 'width=400,height=600')
    w.document.write(`
      <html><head><title>Receipt ${payment.receiptNumber}</title>
      <style>
        body{font-family:monospace;padding:20px;font-size:12px}
        h2{margin:0;text-align:center;color:#0B6E4F}
        hr{border:none;border-top:1px dashed #999;margin:10px 0}
        .row{display:flex;justify-content:space-between;margin:4px 0}
      </style></head><body>
      <h2>Tuk-Tuk e-Mobility</h2>
      <p style="text-align:center">Official Receipt</p>
      <hr>
      <div class="row"><span>Receipt No:</span><b>${payment.receiptNumber}</b></div>
      <div class="row"><span>Date:</span><b>${formatDate(payment.paymentDate)}</b></div>
      <div class="row"><span>Customer:</span><b>${customer?.name || '-'}</b></div>
      <div class="row"><span>Vehicle:</span><b>${vehicle?.model || '-'}</b></div>
      <hr>
      <div class="row"><span>Amount Paid:</span><b>${formatCurrency(payment.amount)}</b></div>
      <div class="row"><span>Method:</span><b>${payment.paymentMethod}</b></div>
      <div class="row"><span>Reference:</span><b>${payment.reference || '-'}</b></div>
      <hr>
      <p style="text-align:center">Thank you for your business!</p>
      </body></html>`)
    w.document.close()
    w.print()
  }

  // ----- Credit / loan flow -----
  const openCredit = () => {
    creditForm.reset({
      financier: credit?.financier || '',
      status: credit?.status || 'Loan Requested',
    })
    setCreditOpen(true)
  }

  const saveCredit = async (formData) => {
    try {
      const payload = {
        saleId: id,
        customerId: sale.customerId,
        financier: formData.financier,
        status: formData.status,
      }
      if (credit) {
        await creditService.update(credit.id, payload)
      } else {
        await creditService.create(payload)
      }
      // Keep the sale status in sync with the loan stage.
      await saleService.setLoanStage(id, formData.status)
      toast.success('Loan application updated')
      setCreditOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Categorized document upload -----
  const uploadDocs = async (category, e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !credit) return
    setUploading(true)
    try {
      const uploaded = await uploadMany(`credit/${id}/${category}`, files)
      await creditService.addDocuments(credit.id, category, uploaded)
      toast.success('Documents uploaded')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeDoc = async (category, index) => {
    try {
      await creditService.removeDocument(credit.id, category, index)
      toast.success('Document removed')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ----- Customer document upload (all customers, any stage) -----
  const uploadCustomerDocs = async (category, e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !customer) return
    setUploading(true)
    try {
      const uploaded = await uploadMany(`customers/${customer.id}/${category}`, files)
      await customerService.addDocuments(customer.id, category, uploaded)
      toast.success('Documents uploaded')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeCustomerDoc = async (category, index) => {
    try {
      await customerService.removeDocument(customer.id, category, index)
      toast.success('Document removed')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ----- Assign unit -----
  const openAssign = () => {
    assignForm.reset({ vehicleId: sale.vehicleId || '' })
    setAssignOpen(true)
  }

  const doAssign = async (formData) => {
    try {
      await saleService.assignUnit(id, formData.vehicleId)
      toast.success('Unit assigned to customer')
      setAssignOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- NTSA transfer -----
  const transferNtsa = async () => {
    try {
      await saleService.transferNtsa(id)
      toast.success('NTSA ownership transfer recorded')
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Dispatch -----
  const openDispatch = () => {
    dispatchForm.reset({
      deliveryDate: dayjs().format('YYYY-MM-DD'),
      receivedBy: customer?.name || '',
      remarks: '',
      warrantyNumber: sale.warrantyNumber || '',
      warrantyPeriod: WARRANTY_PERIOD_MONTHS,
    })
    setDispatchOpen(true)
  }

  const doDispatch = async (formData) => {
    try {
      await saleService.dispatch(id, sale.vehicleId, {
        deliveryDate: formData.deliveryDate,
        receivedBy: formData.receivedBy,
        dispatchRemarks: formData.remarks,
        warrantyNumber: formData.warrantyNumber,
        warrantyPeriod: Number(formData.warrantyPeriod) || WARRANTY_PERIOD_MONTHS,
        warrantyCreatedAt: Date.now(),
      })
      toast.success('Tuk-tuk dispatched! Warranty forwarded to spares department.')
      setDispatchOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Invoice -----
  const openInvoice = () => {
    invoiceForm.reset({
      registrationNo: sale.registrationNo || vehicle?.registrationNo || '',
      vatRate: VAT_RATE,
      invoiceNumber: sale.invoiceNumber || invoiceNumber(),
      invoiceDate: sale.invoicedAt ? dayjs(sale.invoicedAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    })
    setInvoiceOpen(true)
  }

  const saveInvoice = async (formData) => {
    try {
      await saleService.saveInvoice(id, {
        registrationNo: formData.registrationNo,
        invoiceNumber: formData.invoiceNumber,
        vatRate: Number(formData.vatRate),
      })
      if (vehicle) {
        await inventoryService.update(vehicle.id, { registrationNo: formData.registrationNo })
      }
      toast.success('Invoice generated')
      setInvoiceOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Pre-delivery service -----
  const openPreDelivery = () => {
    const existing = sale.preDeliveryChecklist || {}
    preDeliveryForm.reset({
      canvas: existing.canvas || false,
      doors: existing.doors || false,
      ntsaYellowLine: existing.ntsaYellowLine || false,
    })
    setPreDeliveryOpen(true)
  }

  const completePreDelivery = async (formData) => {
    try {
      const checklist = {}
      PRE_DELIVERY_CHECKLIST.forEach((item) => {
        checklist[item.key] = formData[item.key] || false
      })
      await saleService.completePreDelivery(id, checklist)
      toast.success('Pre-delivery service completed')
      setPreDeliveryOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  // ----- Document verification -----
  const verifyDocuments = async () => {
    try {
      await saleService.verifyDocuments(id)
      toast.success('Documents verified. Ready for NTSA transfer.')
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const printInvoice = () => {
    const price = Number(sale.price || 0)
    const rate = sale.vatRate ?? VAT_RATE
    const vat = computeVat(price, rate)
    const total = price + vat
    // Sum all confirmed payments (installments or down payment)
    const totalConfirmed = payments.filter((p) => p.confirmed).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    // Balance = full total (price + vat) minus what has already been paid
    const balance = Math.max(total - totalConfirmed, 0)
    
    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(`
      <html><head><title>Invoice ${sale.invoiceNumber || ''}</title>
      <style>
        @page { margin: 10mm; }
        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 14px; color: #000; padding: 20px; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        
        .header { display: flex; align-items: center; margin-bottom: 5px; }
        .logo-box { width: 180px; height: 140px; background-color: #5cb85c; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; margin-right: 20px; }
        .logo-d { font-size: 60px; font-weight: bold; color: #ff3333; line-height: 1; margin-bottom: 5px; }
        .logo-text { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
        .logo-sub { font-size: 11px; font-weight: bold; }
        
        .company-info { flex: 1; text-align: center; color: #00B050; }
        .company-info h1 { font-size: 28px; margin: 0 0 10px 0; font-weight: bold; }
        .company-info p { margin: 5px 0; font-size: 16px; font-weight: bold; }
        .company-info .email { font-style: italic; text-decoration: underline; }
        
        .green-line { height: 4px; background-color: #00B050; margin-bottom: 20px; }
        
        .top-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .top-col p { margin: 8px 0; font-size: 14px; }
        .bold { font-weight: bold; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #000; color: #fff; padding: 8px; text-align: center; font-size: 14px; }
        td { border-bottom: 1px solid #e0e0e0; padding: 12px 8px; vertical-align: top; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .item-details p { margin: 4px 0; font-size: 13px; }
        .item-title { font-weight: bold; margin-bottom: 8px; font-size: 14px; }
        .bold-desc { font-weight: bold; margin-top: 10px; margin-bottom: 4px; }
        
        .summary-container { display: flex; justify-content: space-between; align-items: flex-start; }
        .amount-box { background-color: #8C8C8C; color: #000; padding: 6px 12px; font-weight: bold; font-size: 14px; margin-top: 80px; display: inline-block; width: 300px; }
        
        .summary-table { width: 350px; border-collapse: collapse; margin-top: -20px; }
        .summary-table td { padding: 6px 8px; border: none; font-size: 14px; }
        .summary-table .bold { font-weight: bold; }
        .summary-table .total-row { background-color: #8C8C8C; font-weight: bold; border-top: 1px solid #fff; }
        
        .notes-section { margin-top: 40px; font-size: 14px; line-height: 1.6; }
        .notes-section p { margin: 4px 0; }
      </style></head><body>
      
      <div class="header">
        <div class="logo-box">
          <div class="logo-d">D</div>
          <div class="logo-text">DONPAV</div>
          <div class="logo-sub">ELECTRIC LTD</div>
        </div>
        <div class="company-info">
          <h1>DONPAV ELECTRIC LIMITED</h1>
          <p>Authorised Dealers of Rhinggo electric tuk tuk and motorbikes</p>
          <p>Location: Kisauni-Majengo-Diani-Kisumu</p>
          <p>Tel: 0721 904 506 – 0720 320 233 – 0719 403 028</p>
          <p class="email">Email: donrhinggo@gmail.com</p>
        </div>
      </div>
      <div class="green-line"></div>
      
      <div class="flex justify-between" style="margin-bottom: 40px;">
        <div>INVOICE</div>
        <div class="bold">KRA:P052482064D</div>
      </div>
      
      <div class="top-row">
        <div class="top-col">
          <p><span class="bold">BILL TO:</span> ${customer?.name || '-'}</p>
          <p><span class="bold">ID:</span> ${customer?.idNumber || '-'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Quote Date ${formatDate(sale.invoicedAt || Date.now()).toUpperCase()}</p>
          <p><span class="bold">KRA PIN:</span> ${customer?.kraPin || 'N/A'}</p>
        </div>
        <div class="top-col text-right">
          <p>${sale.invoiceNumber ? '#' + sale.invoiceNumber : ''}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 45%; text-align: left;">Item & Description</th>
            <th style="width: 10%">Qty</th>
            <th style="width: 15%">Rate</th>
            <th style="width: 10%">VAT%</th>
            <th style="width: 15%">Vatable Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center">1</td>
            <td class="item-details">
              <div class="item-title">${vehicle?.model || '-'} With solar</div>
              <div class="bold-desc">LOGBOOK TRANSFER</div>
              <p>Peak power-kw 6</p>
              <p>Maximum speed; 45km/h</p>
              <p>Brake system; Hydraulic brake</p>
              <p>Registration number: ${sale.registrationNo || vehicle?.registrationNo || '-'}</p>
              <p>Chassis number; ${vehicle?.chassisNumber || '-'}</p>
              <p>Engine number; ${vehicle?.engineNumber || '-'}</p>
            </td>
            <td class="text-center">1</td>
            <td class="text-right">${formatCurrency(price).replace('KSH ', '')}</td>
            <td class="text-center">${(rate * 100).toFixed(2)}</td>
            <td class="text-right">${formatCurrency(price).replace('KSH ', '')}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="summary-container">
        <div>
          <div class="amount-box">AMOUNT: ${formatCurrency(balance).replace('KSH ', '')} KSH</div>
        </div>
        <div>
          <table class="summary-table">
            <tr>
              <td class="bold">Sub total</td>
              <td class="text-right bold">${formatCurrency(price).replace('KSH ', '')}</td>
            </tr>
            <tr>
              <td class="bold">${sale.paymentMethod === 'Installments' ? 'Installments Paid' : 'Downpayment'}</td>
              <td class="text-right bold">- ${formatCurrency(totalConfirmed).replace('KSH ', '')}</td>
            </tr>
            <tr>
              <td class="bold">${rate === 0 ? 'Zero Rate (0 %)' : 'VAT (' + (rate * 100) + ' %)'}</td>
              <td class="text-right bold">${formatCurrency(vat).replace('KSH ', '')}</td>
            </tr>
            <tr class="total-row">
              <td>Balance Due</td>
              <td class="text-right">KSH ${formatCurrency(balance).replace('KSH ', '')}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <div class="notes-section">
        <p>Notes</p>
        <p>Looking forward for your business</p>
        <p><span class="bold">ACCOUNT NAME:</span> DONPAV ELECTRIC LTD-MANAGEMENT ACCOUNT</p>
        <p><span class="bold">ACCOUNT NO:</span> 092000034340</p>
        <p><span class="bold">BANK CODE:</span> 70</p>
        <p><span class="bold">BRANCH CODE:</span> 092</p>
        <p style="margin-top: 15px;"><span class="bold">SWIFT CODE:</span> FABLKENA</p>
      </div>
      
      <div style="page-break-before: always; margin-top: 40px;">
        <p>Terms & Conditions</p>
      </div>
      
      </body></html>`)
    w.document.close()
    w.print()
  }

  const printDeliveryNote = () => {
    const price = Number(sale.price || 0)
    const rate = sale.vatRate ?? VAT_RATE
    const vat = computeVat(price, rate)
    const total = price + vat
    const totalConfirmed = payments.filter((p) => p.confirmed).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const balance = Math.max(total - totalConfirmed, 0)
    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(`
      <html><head><title>Delivery Note ${sale.deliveryNoteNumber || deliveryNoteNumber()}</title>
      <style>
        @page { margin: 10mm; }
        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 14px; color: #000; padding: 20px; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .text-right { text-align: right; }
        
        .header { display: flex; align-items: center; margin-bottom: 5px; }
        .logo-box { width: 180px; height: 140px; background-color: #5cb85c; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; margin-right: 20px; }
        .logo-d { font-size: 60px; font-weight: bold; color: #ff3333; line-height: 1; margin-bottom: 5px; }
        .logo-text { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
        .logo-sub { font-size: 11px; font-weight: bold; }
        
        .company-info { flex: 1; text-align: center; color: #00B050; }
        .company-info h1 { font-size: 28px; margin: 0 0 10px 0; font-weight: bold; }
        .company-info p { margin: 5px 0; font-size: 16px; font-weight: bold; }
        .company-info .email { font-style: italic; text-decoration: underline; }
        
        .green-line { height: 4px; background-color: #00B050; margin-bottom: 20px; }
        
        .bold { font-weight: bold; }
        .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
        .box{border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0}
        .sign{display:flex;justify-content:space-between;margin-top:60px;font-size:13px}
        .sign div{border-top:1px solid #475569;padding-top:4px;width:40%}
      </style></head><body>
      
      <div class="header">
        <div class="logo-box">
          <div class="logo-d">D</div>
          <div class="logo-text">DONPAV</div>
          <div class="logo-sub">ELECTRIC LTD</div>
        </div>
        <div class="company-info">
          <h1>DONPAV ELECTRIC LIMITED</h1>
          <p>Authorised Dealers of Rhinggo electric tuk tuk and motorbikes</p>
          <p>Location: Kisauni-Majengo-Diani-Kisumu</p>
          <p>Tel: 0721 904 506 – 0720 320 233 – 0719 403 028</p>
          <p class="email">Email: donrhinggo@gmail.com</p>
        </div>
      </div>
      <div class="green-line"></div>
      
      <div class="flex justify-between" style="margin-bottom: 40px;">
        <div style="font-size:18px;font-weight:bold">DELIVERY NOTE</div>
        <div class="text-right" style="color:#64748b">
          <p>${sale.deliveryNoteNumber || deliveryNoteNumber()}</p>
          <p>Date: ${formatDate(Date.now())}</p>
        </div>
      </div>
      
      <div class="box">
        <div class="row"><span>Delivered To:</span><b>${customer?.name || '-'}</b></div>
        <div class="row"><span>Phone:</span><span>${customer?.phone || '-'}</span></div>
        <div class="row"><span>ID Number:</span><span>${customer?.idNumber || '-'}</span></div>
      </div>
      <div class="box">
        <div class="row"><span>Vehicle Model:</span><b>${vehicle?.model || '-'}</b></div>
        <div class="row"><span>Registration No.:</span><span>${sale.registrationNo || vehicle?.registrationNo || '-'}</span></div>
        <div class="row"><span>Chassis No.:</span><span>${vehicle?.chassisNumber || '-'}</span></div>
        <div class="row"><span>Engine No.:</span><span>${vehicle?.engineNumber || '-'}</span></div>
        <div class="row"><span>Color:</span><span>${vehicle?.color || '-'}</span></div>
      </div>
      <div class="box">
        <div class="row" style="font-weight:bold;font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px">
          <span>Payment Summary</span>
        </div>
        <div class="row"><span>Vehicle Price</span><span>${formatCurrency(price)}</span></div>
        ${vat > 0 ? `<div class="row"><span>VAT (${(rate * 100).toFixed(0)}%)</span><span>${formatCurrency(vat)}</span></div>` : ''}
        <div class="row"><span>Total Amount</span><span style="font-weight:bold">${formatCurrency(total)}</span></div>
        <div class="row" style="color:#16a34a"><span>${sale.paymentMethod === 'Installments' ? 'Installments Paid' : 'Amount Paid'}</span><span>- ${formatCurrency(totalConfirmed)}</span></div>
        <div class="row" style="font-weight:bold;font-size:15px;border-top:2px solid #000;margin-top:6px;padding-top:6px">
          <span>Balance Due</span><span>${formatCurrency(balance)}</span>
        </div>
      </div>
      <div class="sign"><div>Received By (Customer)</div><div>Authorised By (DONPAV ELECTRIC LTD)</div></div>
      </body></html>`)
    w.document.close()
    w.print()
  }

  // ----- Stage indicators -----
  const flow = isCredit ? SALE_FLOW_CREDIT : SALE_FLOW_CASH
  const currentIdx = Math.max(flow.indexOf(sale.status), 0)
  const stageSteps = [
    { label: 'Inquiry', status: currentIdx >= 1 ? 'done' : 'active' },
    {
      label: 'Payment',
      status: isCredit
        ? currentIdx >= flow.indexOf('Loan Accepted') ? 'done' : 'active'
        : currentIdx >= flow.indexOf('Payment Confirmed') ? 'done' : 'active',
    },
    { label: 'Unit Assigned', status: currentIdx >= flow.indexOf('Unit Assigned') ? 'done' : currentIdx >= flow.indexOf('Payment Confirmed') || currentIdx >= flow.indexOf('Loan Accepted') ? 'active' : 'pending' },
    { label: 'Invoice', status: currentIdx >= flow.indexOf('Invoice Raised') ? 'done' : currentIdx >= flow.indexOf('Unit Assigned') ? 'active' : 'pending' },
    { label: 'Pre-Delivery', status: currentIdx >= flow.indexOf('Pre-Delivery Service') ? 'done' : currentIdx >= flow.indexOf('Invoice Raised') ? 'active' : 'pending' },
    { label: 'Doc Verification', status: currentIdx >= flow.indexOf('Document Verification') ? 'done' : currentIdx >= flow.indexOf('Pre-Delivery Service') ? 'active' : 'pending' },
    { label: 'NTSA Transfer', status: sale.status === 'NTSA Transfer' ? 'active' : sale.status === 'Dispatched' ? 'done' : currentIdx > flow.indexOf('Document Verification') ? 'done' : 'pending' },
    { label: 'Dispatch', status: sale.status === 'Dispatched' ? 'done' : sale.status === 'NTSA Transfer' ? 'active' : 'pending' },
  ]
  return (
    <AppLayout>
      <Link to="/sales" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary">
        <FiArrowLeft /> Back to Sales
      </Link>
      <PageHeader
        title={`Sale #${sale.id?.slice(-6)}`}
        subtitle={`Created ${formatDateTime(sale.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <button className="btn-outline" onClick={openInvoice}>
                <FiFileText /> Invoice
              </button>
            )}
            <button className="btn-outline" onClick={printDeliveryNote}>
              <FiPrinter /> Delivery Note
            </button>
            {sale.invoiceNumber && (
              <button className="btn-outline" onClick={printInvoice}>
                <FiPrinter /> Print Invoice
              </button>
            )}
            <Badge variant={statusVariant(sale.status)}>{sale.status}</Badge>
          </div>
        }
      />

      {/* Stage progress */}
      <Card className="mb-4">
        <StatusSteps steps={stageSteps} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-1">
          <h3 className="mb-4 font-semibold text-slate-700">Sale Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Customer</span>
              {customer && (
                <Link to={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                  {customer.name}
                </Link>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vehicle</span>
              <span className="font-medium text-slate-700">{vehicle ? `${vehicle.model} (${vehicle.color})` : 'Not assigned'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price</span>
              <span className="font-bold text-primary">{formatCurrency(sale.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">VAT ({((sale.vatRate ?? VAT_RATE) * 100).toFixed(0)}%)</span>
              <span className="text-slate-700">{formatCurrency(computeVat(sale.price, sale.vatRate ?? VAT_RATE))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total</span>
              <span className="font-bold text-slate-700">
                {formatCurrency(Number(sale.price || 0) + computeVat(sale.price, sale.vatRate ?? VAT_RATE))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Method</span>
              <Badge variant={isCash ? 'green' : 'blue'}>{sale.paymentMethod || '—'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Branch</span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <FiMapPin size={13} /> {sale.branch || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Agent</span>
              <span className="text-slate-700">{sale.salesAgent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reg. No.</span>
              <span className="text-slate-700">{sale.registrationNo || vehicle?.registrationNo || '-'}</span>
            </div>
            {sale.invoiceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice</span>
                <span className="font-mono text-xs text-slate-700">{sale.invoiceNumber}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Action panel */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 font-semibold text-slate-700">Workflow</h3>

          {/* 1. Inquiry → Agree to proceed */}
          {sale.status === 'Inquiry' && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <FiUser size={32} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Customer inquired. Capture payment method to proceed.</p>
              {canManage && (
                <button className="btn-primary mt-4" onClick={openAgree}>
                  <FiArrowRight /> Agree to Proceed
                </button>
              )}
            </div>
          )}

          {/* Payments for Cash, Installments, or Credit Deposit */}
          {(isCash || isCredit) && sale.status !== 'Inquiry' && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  {isCredit ? 'Down Payment / Deposit' : sale.paymentMethod + ' Payment'}
                </p>
                {canManage && <button className="btn-primary" onClick={openPayment}><FiDollarSign /> Record Payment</button>}
              </div>
              {payments.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No payment recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                      <div>
                        <p className="font-medium text-slate-700">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-slate-400">{p.paymentMethod} · {p.reference || 'No ref'} · {formatDate(p.paymentDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.confirmed ? 'green' : 'amber'}>{p.confirmed ? 'Confirmed' : 'Pending'}</Badge>
                        <button className="btn-ghost p-2" onClick={() => printReceipt(p)}><FiPrinter size={16} /></button>
                        {canManage && !p.confirmed && (
                          <button className="btn-primary px-3 py-1.5" onClick={() => confirmPayment(p)}><FiCheckCircle size={14} /> Confirm</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Payment confirmed → assign unit */}
          {isCash && sale.status === 'Payment Confirmed' && (
            <div className="rounded-xl bg-green-50 p-6 text-center">
              <FiCheckCircle size={32} className="mx-auto text-green-500" />
              <p className="mt-2 text-sm text-green-700">Payment confirmed. Assign a unit to the customer.</p>
              {canManage && <button className="btn-primary mt-4" onClick={openAssign}><FiTruck /> Assign Unit</button>}
            </div>
          )}

          {/* Credit flow — loan status & updates */}
          {isCredit && ['Loan Requested', 'Loan Submitted', 'Loan Accepted', 'Loan Rejected'].includes(sale.status) && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="font-medium text-slate-700">{credit?.financier || 'No financier'}</p>
                  <p className="text-xs text-slate-400">Submitted {credit ? formatDate(credit.submittedAt) : '-'}</p>
                </div>
                <Badge variant={statusVariant(sale.status)}>{sale.status}</Badge>
                {canManage && <button className="btn-outline" onClick={openCredit}><FiFileText /> Update Loan</button>}
              </div>

              {/* Accepted → assign unit */}
              {sale.status === 'Loan Accepted' && canManage && (
                <div className="rounded-xl bg-green-50 p-4 text-center">
                  <p className="text-sm text-green-700">Loan accepted. Assign a unit to the customer.</p>
                  <button className="btn-primary mt-3" onClick={openAssign}><FiTruck /> Assign Unit</button>
                </div>
              )}
              {sale.status === 'Loan Rejected' && (
                <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-600">Loan rejected. This sale cannot proceed.</div>
              )}
            </div>
          )}

          {/* Credit documents — visible for ALL credit sales at any stage */}
          {isCredit && sale.status !== 'Inquiry' && (
            <div className="mb-4">
              <div className="mb-3 flex items-center gap-2">
                <FiFileText className="text-primary" />
                <p className="text-sm font-medium text-slate-600">Credit Application Documents</p>
              </div>
              <div className="space-y-3">
                {CREDIT_DOCUMENT_TYPES.map((doc) => {
                  const files = creditDocs[doc.key] || []
                  return (
                    <div key={doc.key} className="rounded-xl border border-slate-100 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">{doc.label} <span className="text-xs text-slate-400">({files.length})</span></p>
                        {canManage && (
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                            {uploading ? 'Uploading…' : (<><FiUpload size={13} /> Upload</>)}
                            <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadDocs(doc.key, e)} disabled={uploading} />
                          </label>
                        )}
                      </div>
                      {files.length > 0 ? (
                        <div className="space-y-1">
                          {files.map((d, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                              <a href={d.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">📄 {d.name}</a>
                              {canManage && <button className="btn-ghost p-1 text-red-500" onClick={() => removeDoc(doc.key, i)}><FiTrash2 size={14} /></button>}
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400">No file uploaded</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Unit assigned → raise invoice */}
          {sale.status === 'Unit Assigned' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              {isCredit && !paymentConfirmed ? (
                <>
                  <p className="mb-3 text-sm text-red-500 font-medium">A down payment must be recorded and confirmed before you can raise an invoice.</p>
                  <button className="btn-primary" disabled><FiFileText /> Raise Invoice</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">Unit assigned. Raise an invoice for the customer.</p>
                  <button className="btn-primary mt-4" onClick={openInvoice}><FiFileText /> Raise Invoice</button>
                </>
              )}
            </div>
          )}

          {/* 5. Invoice raised → pre-delivery service */}
          {sale.status === 'Invoice Raised' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Invoice raised. Send the tuk-tuk to the spare parts shop for pre-delivery service.</p>
              <button className="btn-primary mt-4" onClick={openPreDelivery}><FiTruck /> Start Pre-Delivery Service</button>
            </div>
          )}

          {/* 6. Pre-delivery service → document verification */}
          {sale.status === 'Pre-Delivery Service' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="mb-3 text-sm font-medium text-slate-600">Pre-Delivery Checklist</p>
                <div className="space-y-2">
                  {PRE_DELIVERY_CHECKLIST.map((item) => {
                    const done = sale.preDeliveryChecklist?.[item.key]
                    return (
                      <div key={item.key} className="flex items-center gap-2 text-sm">
                        <FiCheckCircle className={done ? 'text-green-500' : 'text-slate-300'} size={16} />
                        <span className={done ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {canManage && (
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-sm text-slate-500">Pre-delivery service complete. Verify customer documents next.</p>
                  <button className="btn-primary mt-3" onClick={verifyDocuments}><FiCheckCircle /> Verify Documents</button>
                </div>
              )}
            </div>
          )}

          {/* 7. Document verification → NTSA transfer */}
          {sale.status === 'Document Verification' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Documents verified. Initiate NTSA ownership transfer or dispatch unit directly.</p>
              <div className="mt-4 flex justify-center gap-4">
                <button className="btn-primary" onClick={transferNtsa}><FiFileText /> Record NTSA Transfer</button>
                <button className="btn-outline" onClick={openDispatch}><FiTruck /> Dispatch Unit</button>
              </div>
            </div>
          )}

          {/* 8. NTSA transfer → dispatch */}
          {sale.status === 'NTSA Transfer' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Ownership transferred. Dispatch the tuk-tuk and raise warranty.</p>
              <button className="btn-primary mt-4" onClick={openDispatch}><FiTruck /> Dispatch</button>
            </div>
          )}

          {/* 9. Dispatched */}
          {sale.status === 'Dispatched' && (
            <div className="rounded-xl bg-green-50 p-6 text-center">
              <FiCheckCircle size={32} className="mx-auto text-green-500" />
              <p className="mt-2 text-sm text-green-700">Tuk-tuk dispatched. Sale complete!</p>
              {sale.dispatchedAt && <p className="text-xs text-green-600">Dispatched {formatDate(sale.dispatchedAt)}</p>}
              {sale.warrantyNumber && (
                <p className="mt-1 text-xs text-green-600">Warranty: {sale.warrantyNumber} ({sale.warrantyPeriod || WARRANTY_PERIOD_MONTHS} months) — forwarded to spares department</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Customer Documents (available for ALL customers at any stage) */}
      <Card className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Customer Documents</h3>
          {customer && (
            <Link to={`/customers/${customer.id}`} className="text-sm text-primary hover:underline">
              View customer profile
            </Link>
          )}
        </div>
        <div className="space-y-3">
          {CUSTOMER_DOCUMENT_TYPES.map((doc) => {
            const customerDocs = customer?.documents || {}
            const files = customerDocs[doc.key] || []
            return (
              <div key={doc.key} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{doc.label} <span className="text-xs text-slate-400">({files.length})</span></p>
                  {canManage && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                      {uploading ? 'Uploading…' : (<><FiUpload size={13} /> Upload</>)}
                      <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadCustomerDocs(doc.key, e)} disabled={uploading} />
                    </label>
                  )}
                </div>
                {files.length > 0 ? (
                  <div className="space-y-1">
                    {files.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">📄 {d.name}</a>
                        {canManage && <button className="btn-ghost p-1 text-red-500" onClick={() => removeCustomerDoc(doc.key, i)}><FiTrash2 size={14} /></button>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400">No file uploaded</p>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Agree to Proceed Modal */}
      <Modal open={agreeOpen} onClose={() => setAgreeOpen(false)} title="Agree to Proceed">
        <form onSubmit={agreeForm.handleSubmit(doAgree)} className="space-y-4">
          <div>
            <label className="label">Payment Method</label>
            <select className="input" {...agreeForm.register('paymentMethod', { required: 'Required' })}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
            {agreeForm.formState.errors.paymentMethod && <p className="mt-1 text-xs text-red-500">{agreeForm.formState.errors.paymentMethod.message}</p>}
          </div>
          {agreeForm.watch('paymentMethod') === 'Credit' && (
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
              <FiFileText className="mr-1 inline" size={14} />
              Credit applications require supporting documents (National ID, KRA PIN, Driving License, Guarantor's Documents). You will be prompted to upload them after proceeding.
            </div>
          )}
          <div>
            <label className="label">Price (KSH)</label>
            <input type="number" className="input" {...agreeForm.register('price', { required: 'Price is required', min: { value: 1, message: 'Price must be greater than 0' } })} placeholder="Enter sale price" />
            {agreeForm.formState.errors.price && <p className="mt-1 text-xs text-red-500">{agreeForm.formState.errors.price.message}</p>}
          </div>
          <div>
            <label className="label">Branch</label>
            <select className="input" {...agreeForm.register('branch', { required: 'Branch is required' })}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b}>{b}</option>)}
            </select>
            {agreeForm.formState.errors.branch && <p className="mt-1 text-xs text-red-500">{agreeForm.formState.errors.branch.message}</p>}
            {branches.length === 0 && <p className="mt-1 text-xs text-amber-600">No branches configured. Add them in Settings.</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setAgreeOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={agreeForm.formState.isSubmitting}>{agreeForm.formState.isSubmitting && <ButtonLoader />} Proceed</button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <form onSubmit={payForm.handleSubmit(recordPayment)} className="space-y-4">
          <div><label className="label">Amount (KSH)</label><input type="number" className="input" {...payForm.register('amount', { required: 'Required', min: 1 })} /></div>
          <div><label className="label">Payment Method</label><select className="input" {...payForm.register('paymentMethod')}><option>Cash</option><option>Bank Transfer</option><option>M-Pesa</option><option>Cheque</option></select></div>
          <div><label className="label">Reference</label><input className="input" {...payForm.register('reference')} /></div>
          <div><label className="label">Payment Date</label><input type="date" className="input" {...payForm.register('paymentDate', { required: 'Required' })} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setPayOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={payForm.formState.isSubmitting}>{payForm.formState.isSubmitting && <ButtonLoader />} Record</button>
          </div>
        </form>
      </Modal>

      {/* Credit / Loan Modal */}
      <Modal open={creditOpen} onClose={() => setCreditOpen(false)} title="Loan Application">
        <form onSubmit={creditForm.handleSubmit(saveCredit)} className="space-y-4">
          <div><label className="label">Financier</label><select className="input" {...creditForm.register('financier', { required: 'Required' })}><option value="">Select financier</option>{financiers.map((f) => <option key={f}>{f}</option>)}</select></div>
          <div><label className="label">Loan Status</label><select className="input" {...creditForm.register('status')}>{CREDIT_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setCreditOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={creditForm.formState.isSubmitting}>{creditForm.formState.isSubmitting && <ButtonLoader />} Save</button>
          </div>
        </form>
      </Modal>

      {/* Assign Unit Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Unit">
        <form onSubmit={assignForm.handleSubmit(doAssign)} className="space-y-4">
          <div>
            <label className="label">Available Units (NTSA Cleared)</label>
            <select className="input" {...assignForm.register('vehicleId', { required: 'Required' })}>
              <option value="">Select unit</option>
              {assignableVehicles.map((v) => <option key={v.id} value={v.id}>{v.model} — {v.color} ({v.chassisNumber || v.id?.slice(-4)})</option>)}
            </select>
            {assignableVehicles.length === 0 && <p className="mt-1 text-xs text-amber-600">No NTSA-cleared units available.</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setAssignOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={assignForm.formState.isSubmitting}>{assignForm.formState.isSubmitting && <ButtonLoader />} Assign</button>
          </div>
        </form>
      </Modal>

      {/* Dispatch Modal */}
      <Modal open={dispatchOpen} onClose={() => setDispatchOpen(false)} title="Dispatch Tuk-Tuk" size="lg">
        <form onSubmit={dispatchForm.handleSubmit(doDispatch)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">Delivery Date</label><input type="date" className="input" {...dispatchForm.register('deliveryDate', { required: 'Required' })} /></div>
            <div><label className="label">Received By</label><input className="input" {...dispatchForm.register('receivedBy', { required: 'Required' })} /></div>
          </div>
          <div><label className="label">Remarks</label><textarea rows={2} className="input" {...dispatchForm.register('remarks')} /></div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="mb-3 text-sm font-medium text-amber-800">Warranty (forwarded to spares department for future claims)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label">Warranty Number</label><input className="input" {...dispatchForm.register('warrantyNumber', { required: 'Required' })} placeholder="e.g. WR-2026-001" /></div>
              <div><label className="label">Warranty Period (months)</label><input type="number" className="input" {...dispatchForm.register('warrantyPeriod')} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setDispatchOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={dispatchForm.formState.isSubmitting}>{dispatchForm.formState.isSubmitting && <ButtonLoader />} Confirm Dispatch</button>
          </div>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="Generate Invoice">
        <form onSubmit={invoiceForm.handleSubmit(saveInvoice)} className="space-y-4">
          <div><label className="label">Customer Name</label><input className="input" value={customer?.name || ''} disabled /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Chassis Number</label><input className="input" value={vehicle?.chassisNumber || ''} disabled /></div>
            <div><label className="label">Engine Number</label><input className="input" value={vehicle?.engineNumber || ''} disabled /></div>
          </div>
          <div><label className="label">Registration No.</label><input className="input" {...invoiceForm.register('registrationNo')} placeholder="e.g. KMEA 123A" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Total Amount (KSH)</label><input className="input" value={formatCurrency(sale.price)} disabled /></div>
            <div><label className="label">VAT Rate</label><select className="input" {...invoiceForm.register('vatRate')}><option value="0.16">16%</option><option value="0.08">8%</option><option value="0">0% (Exempt)</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Invoice No.</label><input className="input" {...invoiceForm.register('invoiceNumber')} /></div>
            <div><label className="label">Invoice Date</label><input type="date" className="input" {...invoiceForm.register('invoiceDate')} /></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(sale.price)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT</span><span>{formatCurrency(computeVat(sale.price, Number(sale.vatRate ?? VAT_RATE)))}</span></div>
            <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{formatCurrency(Number(sale.price || 0) + computeVat(sale.price, Number(sale.vatRate ?? VAT_RATE)))}</span></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setInvoiceOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={invoiceForm.formState.isSubmitting}>{invoiceForm.formState.isSubmitting && <ButtonLoader />} Save Invoice</button>
          </div>
        </form>
      </Modal>

      {/* Pre-Delivery Service Modal */}
      <Modal open={preDeliveryOpen} onClose={() => setPreDeliveryOpen(false)} title="Pre-Delivery Service">
        <form onSubmit={preDeliveryForm.handleSubmit(completePreDelivery)} className="space-y-4">
          <p className="text-sm text-slate-500">Confirm the following have been completed at the spare parts shop:</p>
          <div className="space-y-3">
            {PRE_DELIVERY_CHECKLIST.map((item) => (
              <div key={item.key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <input
                  type="checkbox"
                  id={item.key}
                  className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                  {...preDeliveryForm.register(item.key)}
                />
                <label htmlFor={item.key} className="text-sm font-medium text-slate-700">{item.label}</label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setPreDeliveryOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={preDeliveryForm.formState.isSubmitting}>{preDeliveryForm.formState.isSubmitting && <ButtonLoader />} Complete</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
