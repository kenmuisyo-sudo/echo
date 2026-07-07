// All Tuk-Tuk Sales data is namespaced under this root node in the shared
// Realtime Database so it never touches data from other apps.
export const DB_ROOT = 'tuktukSales'

export const ROLES = {
  ADMIN: 'Admin',
  SALES_AGENT: 'Sales Agent',
  FINANCE_OFFICER: 'Finance Officer',
  WORKSHOP_OFFICER: 'Workshop Officer',
  NTSA_OFFICER: 'NTSA Officer',
  DISPATCH_OFFICER: 'Dispatch Officer',
}

export const DEPARTMENTS = {
  ADMINISTRATION: 'Administration',
  SALES: 'Sales',
  FINANCE: 'Finance',
  WORKSHOP: 'Workshop',
  NTSA: 'NTSA',
  DISPATCH: 'Dispatch',
}

export const ROLE_OPTIONS = Object.values(ROLES)
export const DEPARTMENT_OPTIONS = Object.values(DEPARTMENTS)

export const ROLE_DEPARTMENT = {
  [ROLES.ADMIN]: DEPARTMENTS.ADMINISTRATION,
  [ROLES.SALES_AGENT]: DEPARTMENTS.SALES,
  [ROLES.FINANCE_OFFICER]: DEPARTMENTS.FINANCE,
  [ROLES.WORKSHOP_OFFICER]: DEPARTMENTS.WORKSHOP,
  [ROLES.NTSA_OFFICER]: DEPARTMENTS.NTSA,
  [ROLES.DISPATCH_OFFICER]: DEPARTMENTS.DISPATCH,
}

export const INQUIRY_STATUS = ['New', 'Contacted', 'Negotiating', 'Converted', 'Cancelled']

// ---------------------------------------------------------------------------
// Vehicle (inventory) lifecycle.
// A tuk-tuk moves through the procurement stages first (factory → branch →
// NTSA clearance), then through the sale stages once a customer is involved.
//   Procurement: Ordered → Order Received → Released → Received →
//                NTSA Booking → NTSA Cleared
//   Sale:        Reserved → Sold → Delivered
// A vehicle can only be assigned to a customer once it is "NTSA Cleared".
// ---------------------------------------------------------------------------
export const VEHICLE_PROCUREMENT_STAGES = [
  'Ordered',
  'Order Received',
  'Released',
  'Received',
  'NTSA Booking',
  'NTSA Cleared',
]

export const VEHICLE_SALE_STAGES = ['Reserved', 'Sold', 'Delivered']

export const VEHICLE_STATUS = [...VEHICLE_PROCUREMENT_STAGES, ...VEHICLE_SALE_STAGES]

// Vehicles in these statuses are available to be assigned to a customer.
export const VEHICLE_ASSIGNABLE_STATUS = ['NTSA Cleared']

export const VEHICLE_MODELS = ['EcoRider Pro', 'CargoMax X1', 'CityCab Deluxe', 'FleetRunner S', 'Hauler HD']

export const VEHICLE_COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Black', 'Orange', 'Silver']

export const CUSTOMER_TYPES = ['Passenger', 'Cargo']

// ---------------------------------------------------------------------------
// Sale (customer journey) statuses.
// Cash path:
//   Inquiry → Agreed → Payment Pending → Payment Confirmed → Unit Assigned →
//   NTSA Transfer → Dispatched
// Credit path:
//   Inquiry → Agreed → Loan Requested → Loan Submitted → Loan Accepted →
//   Unit Assigned → NTSA Transfer → Dispatched
//   (or → Loan Rejected, terminal)
// ---------------------------------------------------------------------------
export const SALE_FLOW_CASH = [
  'Inquiry',
  'Agreed',
  'Payment Pending',
  'Payment Confirmed',
  'Unit Assigned',
  'NTSA Transfer',
  'Dispatched',
]

export const SALE_FLOW_CREDIT = [
  'Inquiry',
  'Agreed',
  'Loan Requested',
  'Loan Submitted',
  'Loan Accepted',
  'Unit Assigned',
  'NTSA Transfer',
  'Dispatched',
]

// Every status a sale can be in at any point (union of both paths + rejected).
export const SALE_STATUS = [
  'Inquiry',
  'Agreed',
  'Payment Pending',
  'Payment Confirmed',
  'Loan Requested',
  'Loan Submitted',
  'Loan Accepted',
  'Loan Rejected',
  'Unit Assigned',
  'NTSA Transfer',
  'Dispatched',
]

// Statuses that mark the sale as finished (no further action).
export const SALE_TERMINAL_STATUSES = ['Dispatched', 'Loan Rejected']

export const PAYMENT_METHODS = ['Cash', 'Credit']

export const PAYMENT_STATUS = ['Pending', 'Confirmed']

// Credit / loan application statuses (mirror the credit leg of the sale flow).
export const CREDIT_STATUS = ['Loan Requested', 'Loan Submitted', 'Loan Accepted', 'Loan Rejected']

// Default financiers seeded into the dashboard Settings. Admins can add or
// remove entries from the Settings page; these are only the starting values.
export const DEFAULT_FINANCIERS = [
  'Watu Credit Ltd',
  'Rafiki Bank',
  'M-Kopa Credit Ltd',
  'Fortune Credit',
]

// Default branches seeded into the dashboard Settings. A branch is attached to
// each sale when it is created.
export const DEFAULT_BRANCHES = [
  'Mombasa',
  'Bungoma',
  'Malindi',
  'Nairobi',
  'Kisumu',
  'Eldoret',
  'Nakuru',
  'Thika',
]

// Document categories required for a credit application. Each applicant must
// upload at least one file per category. `guarantors` may hold multiple files
// (one or more guarantors).
export const CREDIT_DOCUMENT_TYPES = [
  { key: 'id', label: 'National ID' },
  { key: 'kraPin', label: 'KRA PIN Certificate' },
  { key: 'drivingLicense', label: 'Driving License' },
  { key: 'guarantors', label: "Guarantor's Documents" },
]

// Standard VAT rate applied on the vehicle price (Kenya 16%).
export const VAT_RATE = 0.16

export const WORKSHOP_STATUS = ['Pending', 'In Progress', 'Completed']

export const DISPATCH_STATUS = ['Pending', 'Completed']
