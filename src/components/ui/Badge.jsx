import { classNames } from '../../utils/helpers'

const VARIANTS = {
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-secondary-50 text-secondary-700',
  accent: 'bg-accent-50 text-accent-600',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  slate: 'bg-slate-100 text-slate-600',
}

export default function Badge({ children, variant = 'slate', className }) {
  return <span className={classNames('badge', VARIANTS[variant] || VARIANTS.slate, className)}>{children}</span>
}

export const statusVariant = (status) => {
  const s = String(status || '').toLowerCase()
  if (
    [
      'completed',
      'confirmed',
      'approved',
      'delivered',
      'converted',
      'available',
      'disbursed',
      'dispatched',
      'ntsa cleared',
      'ntsa transfer',
      'payment confirmed',
      'loan accepted',
      'unit assigned',
    ].includes(s)
  )
    return 'green'
  if (
    [
      'pending',
      'new',
      'payment pending',
      'inquiry',
      'agreed',
      'loan requested',
      'loan submitted',
      'ordered',
      'order received',
      'released',
      'received',
      'ntsa booking',
    ].includes(s)
  )
    return 'amber'
  if (['cancelled', 'rejected', 'sold', 'inactive', 'loan rejected'].includes(s)) return 'red'
  if (['processing', 'in progress', 'workshop', 'reserved', 'contacted', 'negotiating'].includes(s))
    return 'blue'
  return 'slate'
}
