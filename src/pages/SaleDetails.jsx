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
  const [uploading, setUploading] = useState(false)

  // Each modal gets its own useForm instance so fields from one modal can
  // never interfere with another modal's validation.
  const agreeForm = useForm()
  const payForm = useForm()
  const creditForm = useForm()
  const assignForm = useForm()
  const dispatchForm = useForm()
  const invoiceForm = useForm()

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
  const isCash = sale.paymentMethod === 'Cash'
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
      await saleService.confirmCashPayment(id)
      toast.success('Payment confirmed. Ready to assign a unit.')
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
    })
    setDispatchOpen(true)
  }

  const doDispatch = async (formData) => {
    try {
      await saleService.dispatch(id, sale.vehicleId, {
        deliveryDate: formData.deliveryDate,
        receivedBy: formData.receivedBy,
        dispatchRemarks: formData.remarks,
      })
      toast.success('Tuk-tuk dispatched!')
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

  const printInvoice = () => {
    const price = Number(sale.price || 0)
    const rate = sale.vatRate ?? VAT_RATE
    const vat = computeVat(price, rate)
    const total = price + vat
    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(`
      <html><head><title>Invoice ${sale.invoiceNumber || ''}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#0f172a}
        h1{color:#0B6E4F;margin:0}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #0B6E4F;padding-bottom:12px;margin-bottom:16px}
        .muted{color:#64748b;font-size:13px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:8px 6px;text-align:left;font-size:13px;border-bottom:1px solid #e2e8f0}
        th{background:#f1f5f9}
        .tot{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}
        .grand{font-weight:bold;font-size:16px;border-top:2px solid #0B6E4F;padding-top:8px;margin-top:8px}
      </style></head><body>
      <div class="head">
        <div><h1>Tuk-Tuk e-Mobility</h1><p class="muted">${sale.branch || '-'} Branch</p></div>
        <div style="text-align:right"><p style="font-size:18px;font-weight:bold">INVOICE</p><p class="muted">${sale.invoiceNumber || '-'}</p><p class="muted">Date: ${sale.invoicedAt ? formatDate(sale.invoicedAt) : formatDate(Date.now())}</p></div>
      </div>
      <div style="margin-bottom:16px"><p class="muted">Bill To</p><p style="font-weight:bold">${customer?.name || '-'}</p><p class="muted">${customer?.phone || ''}</p></div>
      <table><thead><tr><th>Description</th><th>Reg. No.</th><th>Chassis No.</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody><tr><td>${vehicle?.model || '-'} (${vehicle?.color || ''})</td><td>${sale.registrationNo || vehicle?.registrationNo || '-'}</td><td>${vehicle?.chassisNumber || '-'}</td><td style="text-align:right">${formatCurrency(price)}</td></tr></tbody></table>
      <div style="max-width:300px;margin-left:auto;margin-top:16px">
        <div class="tot"><span>Subtotal</span><span>${formatCurrency(price)}</span></div>
        <div class="tot"><span>VAT (${(rate * 100).toFixed(0)}%)</span><span>${formatCurrency(vat)}</span></div>
        <div class="tot grand"><span>Total</span><span>${formatCurrency(total)}</span></div>
      </div>
      <p class="muted" style="margin-top:30px">Payment method: ${sale.paymentMethod}</p>
      </body></html>`)
    w.document.close()
    w.print()
  }

  const printDeliveryNote = () => {
    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(`
      <html><head><title>Delivery Note ${sale.deliveryNoteNumber || deliveryNoteNumber()}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#0f172a}
        h1{color:#0B6E4F;margin:0}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #0B6E4F;padding-bottom:12px;margin-bottom:16px}
        .muted{color:#64748b;font-size:13px}
        .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
        .box{border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0}
        .sign{display:flex;justify-content:space-between;margin-top:60px;font-size:13px}
        .sign div{border-top:1px solid #475569;padding-top:4px;width:40%}
      </style></head><body>
      <div class="head">
        <div><h1>Tuk-Tuk e-Mobility</h1><p class="muted">${sale.branch || '-'} Branch</p></div>
        <div style="text-align:right"><p style="font-size:18px;font-weight:bold">DELIVERY NOTE</p><p class="muted">${sale.deliveryNoteNumber || deliveryNoteNumber()}</p><p class="muted">Date: ${formatDate(Date.now())}</p></div>
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
        <div class="row"><span>Color:</span><span>${vehicle?.color || '-'}</span></div>
      </div>
      <div class="sign"><div>Received By (Customer)</div><div>Authorised By (Tuk-Tuk e-Mobility)</div></div>
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
    { label: 'NTSA Transfer', status: sale.status === 'NTSA Transfer' ? 'active' : sale.status === 'Dispatched' ? 'done' : currentIdx > flow.indexOf('Unit Assigned') ? 'done' : 'pending' },
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

          {/* 2. Cash: payment pending → record & confirm */}
          {isCash && sale.status === 'Payment Pending' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Cash Payment</p>
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

          {/* Credit flow */}
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

              {/* Documents */}
              <div>
                <p className="mb-3 text-sm font-medium text-slate-600">Supporting Documents</p>
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

          {/* 4. Unit assigned → NTSA transfer */}
          {sale.status === 'Unit Assigned' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Unit assigned. Transfer ownership at NTSA.</p>
              <button className="btn-primary mt-4" onClick={transferNtsa}><FiFileText /> Record NTSA Transfer</button>
            </div>
          )}

          {/* 5. NTSA transfer → dispatch */}
          {sale.status === 'NTSA Transfer' && canManage && (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">Ownership transferred. Dispatch the tuk-tuk to the customer.</p>
              <button className="btn-primary mt-4" onClick={openDispatch}><FiTruck /> Dispatch</button>
            </div>
          )}

          {/* 6. Dispatched */}
          {sale.status === 'Dispatched' && (
            <div className="rounded-xl bg-green-50 p-6 text-center">
              <FiCheckCircle size={32} className="mx-auto text-green-500" />
              <p className="mt-2 text-sm text-green-700">Tuk-tuk dispatched. Sale complete!</p>
              {sale.dispatchedAt && <p className="text-xs text-green-600">Dispatched {formatDate(sale.dispatchedAt)}</p>}
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
          <div>
            <label className="label">Price (KES)</label>
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
        <form onSubmit={handleSubmit(recordPayment)} className="space-y-4">
          <div><label className="label">Amount (KES)</label><input type="number" className="input" {...register('amount', { required: 'Required', min: 1 })} /></div>
          <div><label className="label">Payment Method</label><select className="input" {...register('paymentMethod')}><option>Cash</option><option>Bank Transfer</option><option>M-Pesa</option><option>Cheque</option></select></div>
          <div><label className="label">Reference</label><input className="input" {...register('reference')} /></div>
          <div><label className="label">Payment Date</label><input type="date" className="input" {...register('paymentDate', { required: 'Required' })} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setPayOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <ButtonLoader />} Record</button>
          </div>
        </form>
      </Modal>

      {/* Credit / Loan Modal */}
      <Modal open={creditOpen} onClose={() => setCreditOpen(false)} title="Loan Application">
        <form onSubmit={handleSubmit(saveCredit)} className="space-y-4">
          <div><label className="label">Financier</label><select className="input" {...register('financier', { required: 'Required' })}><option value="">Select financier</option>{financiers.map((f) => <option key={f}>{f}</option>)}</select></div>
          <div><label className="label">Loan Status</label><select className="input" {...register('status')}>{CREDIT_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setCreditOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <ButtonLoader />} Save</button>
          </div>
        </form>
      </Modal>

      {/* Assign Unit Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Unit">
        <form onSubmit={handleSubmit(doAssign)} className="space-y-4">
          <div>
            <label className="label">Available Units (NTSA Cleared)</label>
            <select className="input" {...register('vehicleId', { required: 'Required' })}>
              <option value="">Select unit</option>
              {assignableVehicles.map((v) => <option key={v.id} value={v.id}>{v.model} — {v.color} ({v.chassisNumber || v.id?.slice(-4)})</option>)}
            </select>
            {assignableVehicles.length === 0 && <p className="mt-1 text-xs text-amber-600">No NTSA-cleared units available.</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setAssignOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <ButtonLoader />} Assign</button>
          </div>
        </form>
      </Modal>

      {/* Dispatch Modal */}
      <Modal open={dispatchOpen} onClose={() => setDispatchOpen(false)} title="Dispatch Tuk-Tuk">
        <form onSubmit={handleSubmit(doDispatch)} className="space-y-4">
          <div><label className="label">Delivery Date</label><input type="date" className="input" {...register('deliveryDate', { required: 'Required' })} /></div>
          <div><label className="label">Received By</label><input className="input" {...register('receivedBy', { required: 'Required' })} /></div>
          <div><label className="label">Remarks</label><textarea rows={3} className="input" {...register('remarks')} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setDispatchOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <ButtonLoader />} Confirm Dispatch</button>
          </div>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="Generate Invoice">
        <form onSubmit={handleSubmit(saveInvoice)} className="space-y-4">
          <div><label className="label">Customer Name</label><input className="input" value={customer?.name || ''} disabled /></div>
          <div><label className="label">Chassis Number</label><input className="input" value={vehicle?.chassisNumber || ''} disabled /></div>
          <div><label className="label">Registration No.</label><input className="input" {...register('registrationNo')} placeholder="e.g. KMEA 123A" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Total Amount (KES)</label><input className="input" value={formatCurrency(sale.price)} disabled /></div>
            <div><label className="label">VAT Rate</label><select className="input" {...register('vatRate')}><option value="0.16">16%</option><option value="0.08">8%</option><option value="0">0% (Exempt)</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Invoice No.</label><input className="input" {...register('invoiceNumber')} /></div>
            <div><label className="label">Invoice Date</label><input type="date" className="input" {...register('invoiceDate')} /></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(sale.price)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT</span><span>{formatCurrency(computeVat(sale.price, Number(sale.vatRate ?? VAT_RATE)))}</span></div>
            <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{formatCurrency(Number(sale.price || 0) + computeVat(sale.price, Number(sale.vatRate ?? VAT_RATE)))}</span></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={() => setInvoiceOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <ButtonLoader />} Save Invoice</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
