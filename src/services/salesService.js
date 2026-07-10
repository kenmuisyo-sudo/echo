import { create, getAll, getById, updateById, removeById, textSearch } from './dataService'
import { inventoryService } from './inventoryService'
import { settingsService } from './settingsService'
import { VAT_RATE } from '../constants'

const PATH = 'sales'
const SEARCH_FIELDS = ['customerId', 'vehicleId', 'salesAgent', 'status', 'paymentMethod', 'invoiceNumber', 'registrationNo', 'branch']

export const saleService = {
  create: (data) => create(PATH, { ...data, createdAt: Date.now() }),
  getAll: () => getAll(PATH),
  getById: (id) => getById(PATH, id),
  update: (id, data) => updateById(PATH, id, data),
  remove: (id) => removeById(PATH, id),
  search: (items, term) => textSearch(items, SEARCH_FIELDS, term),

  /**
   * A customer walks in to inquire. Create a lead sale with no vehicle and no
   * payment method yet — status "Inquiry".
   */
  createLead: ({ customerId, salesAgent, salesAgentId, branch }) =>
    create(PATH, {
      customerId,
      vehicleId: '',
      paymentMethod: '',
      price: 0,
      salesAgent: salesAgent || '',
      salesAgentId: salesAgentId || '',
      branch: branch || '',
      status: 'Inquiry',
      createdAt: Date.now(),
    }),

  /**
   * Customer agrees to proceed. Capture payment method + price + branch.
   * Cash → "Payment Pending". Credit → "Loan Requested".
   */
  agreeToProceed: async (saleId, { paymentMethod, price, branch, units = 1, accessories = {}, accessoriesTotal = 0, model = '', preselectedVehicleId = '' }) => {
    const status = paymentMethod === 'Cash' || paymentMethod === 'Installments' ? 'Payment Pending' : 'Loan Requested'
    await updateById(PATH, saleId, {
      paymentMethod,
      price: Number(price) || 0,
      branch: branch || '',
      units: Number(units) || 1,
      status,
      accessories,
      accessoriesTotal,
      model,
      preselectedVehicleId,
    })
    return status
  },

  /**
   * Cash path: a recorded payment has been confirmed. Move the sale to
   * "Payment Confirmed" so a unit can be assigned next.
   */
  confirmCashPayment: async (saleId) => {
    await updateById(PATH, saleId, { status: 'Payment Confirmed', paymentConfirmedAt: Date.now() })
  },

  /**
   * Credit path: advance the loan stage. Accepted → ready for unit assignment.
   * Rejected is terminal.
   */
  setLoanStage: async (saleId, loanStatus) => {
    const status = loanStatus === 'Loan Accepted' ? 'Loan Accepted' : loanStatus === 'Loan Rejected' ? 'Loan Rejected' : 'Loan Submitted'
    await updateById(PATH, saleId, { status })
  },

  /**
   * Assign a unit to the customer. Checks available stock and reserves it.
   * Moves the sale to "Unit Assigned".
   */
  assignUnit: async (saleId, vehicleId, extras = {}) => {
    const vehicle = await inventoryService.getById(vehicleId)
    if (!vehicle) throw new Error('Vehicle not found')
    // Get sale to find out how many units are purchased
    const sale = await getById(PATH, saleId)
    const units = Number(sale?.units || 1)
    
    // Reserve stock 'units' times
    for (let i = 0; i < units; i++) {
      await inventoryService.reserveUnit(vehicleId, vehicle)
    }

    const update = {
      vehicleId,
      status: 'Unit Assigned',
      unitAssignedAt: Date.now(),
    }
    if (extras.accessories) {
      update.accessories = extras.accessories
      update.accessoriesTotal = Number(extras.accessoriesTotal) || 0
    }
    await updateById(PATH, saleId, update)
  },

  /**
   * Unassign a unit from a sale. Returns the sale to previous status and releases the reserved stock.
   */
  unassignUnit: async (saleId, vehicleId, prevStatus = 'Payment Confirmed') => {
    if (vehicleId) {
      const vehicle = await inventoryService.getById(vehicleId)
      if (vehicle) {
        const sale = await getById(PATH, saleId)
        const units = Number(sale?.units || 1)
        for (let i = 0; i < units; i++) {
          await inventoryService.releaseUnit(vehicleId, vehicle)
        }
      }
    }
    await updateById(PATH, saleId, { vehicleId: '', status: prevStatus, unitAssignedAt: null })
  },

  /**
   * Ownership transferred to the customer at NTSA.
   */
  transferNtsa: async (saleId) => {
    await updateById(PATH, saleId, { status: 'NTSA Transfer', ntsaTransferredAt: Date.now() })
  },

  /**
   * Pre-delivery service completed at the spare parts shop.
   * Stores the checklist items that were completed.
   */
  completePreDelivery: async (saleId, checklist, extras = {}) => {
    await updateById(PATH, saleId, {
      status: 'Pre-Delivery Service',
      preDeliveryChecklist: checklist,
      preDeliveryAt: Date.now(),
      accessories: extras.accessories || {},
      accessoriesTotal: Number(extras.accessoriesTotal) || 0,
    })
  },

  /**
   * Documents verified — move to Document Verification stage.
   */
  moveToDocumentVerification: async (saleId) => {
    await updateById(PATH, saleId, { status: 'Document Verification', documentsVerifiedAt: Date.now() })
  },

  /**
   * Documents verified — move to NTSA Transfer stage.
   * Also marks the vehicle batch as NTSA Cleared automatically.
   */
  verifyDocuments: async (saleId, vehicleId) => {
    await updateById(PATH, saleId, { status: 'NTSA Transfer', documentsVerifiedAt: Date.now() })
    if (vehicleId) await inventoryService.clearNTSA(vehicleId)
  },

  /**
   * Tuk-tuk dispatched / delivered to the customer.
   * Moves one unit from Sold → Delivered in the vehicle batch.
   */
  dispatch: async (saleId, vehicleId, details = {}) => {
    let dnNum = details.deliveryNoteNumber || details.deliveryNoteNo
    if (!dnNum) {
      const serial = await settingsService.getNextSerial('delivery_note')
      dnNum = `DN-${serial}`
    }
    await updateById(PATH, saleId, { status: 'Dispatched', dispatchedAt: Date.now(), deliveryNoteNumber: dnNum, ...details })
    if (vehicleId) {
      const vehicle = await inventoryService.getById(vehicleId)
      if (vehicle) {
        const sale = await getById(PATH, saleId)
        const units = Number(sale?.units || 1)
        for (let i = 0; i < units; i++) {
          await inventoryService.markDeliveredUnit(vehicleId, vehicle)
        }
      }
    }
  },

  /**
   * Save the sale's invoice details (registration no, VAT, etc.) and stamp
   * an invoice number if one is not already present. Moves the sale to
   * "Invoice Raised" status.
   */
  saveInvoice: async (saleId, { registrationNo, vatRate = VAT_RATE, invoiceNumber }) => {
    const sale = await getById(PATH, saleId)
    if (!sale) throw new Error('Sale not found')
    const price = Number(sale.price || 0)
    const vatAmount = Math.round(price * vatRate)
    
    let invNum = invoiceNumber || sale.invoiceNumber
    if (!invNum) {
      const serial = await settingsService.getNextSerial('invoice')
      invNum = `INV-${serial}`
    }

    const payload = {
      registrationNo: registrationNo || sale.registrationNo || '',
      vatRate,
      vatAmount,
      totalAmount: price + vatAmount,
      invoiceNumber: invNum,
      invoicedAt: sale.invoicedAt || Date.now(),
      status: 'Invoice Raised',
    }
    await updateById(PATH, saleId, payload)
    // Invoice raised = unit is now Sold (move from Reserved → Sold in batch)
    if (sale.vehicleId) {
      const vehicle = await inventoryService.getById(sale.vehicleId)
      if (vehicle) await inventoryService.markSoldUnit(sale.vehicleId, vehicle)
    }
    return { ...sale, ...payload }
  },
}
