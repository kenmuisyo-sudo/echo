import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus, FiEye } from 'react-icons/fi'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge, { statusVariant } from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { useAsyncList } from '../hooks/useAsync'
import { saleService, customerService, inventoryService } from '../services'
import { SALE_STATUS } from '../constants'
import { formatCurrency, formatDate } from '../utils/helpers'

export default function Sales() {
  const { items, loading } = useAsyncList(() => saleService.getAll())
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    Promise.all([customerService.getAll(), inventoryService.getAll()]).then(([c, v]) => {
      setCustomers(c)
      setVehicles(v)
    })
  }, [])

  const customerName = (id) => customers.find((c) => c.id === id)?.name || '—'
  const vehicleModel = (id) => {
    const v = vehicles.find((x) => x.id === id)
    return v ? `${v.model} (${v.color})` : '—'
  }

  const statuses = ['All', ...SALE_STATUS]
  const filtered = filter === 'All' ? items : items.filter((s) => s.status === filter)

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Sales" />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader title="Sales" subtitle={`${items.length} sale${items.length !== 1 ? 's' : ''}`} />

      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === s ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No sales found"
            subtitle="Register a customer to start a sale lead."
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'id', label: 'Sale' },
            { key: 'customerId', label: 'Customer' },
            { key: 'vehicleId', label: 'Vehicle' },
            { key: 'price', label: 'Price' },
            { key: 'paymentMethod', label: 'Method' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Date' },
            { key: 'actions', label: '' },
          ]}
          data={filtered}
          searchKeys={['salesAgent', 'paymentMethod', 'status']}
          searchPlaceholder="Search sales…"
          renderRow={(s) => (
            <tr key={s.id}>
              <td className="font-mono text-xs text-slate-500">#{s.id?.slice(-6)}</td>
              <td>
                <Link to={`/customers/${s.customerId}`} className="font-medium text-primary hover:underline">
                  {customerName(s.customerId)}
                </Link>
              </td>
              <td className="text-slate-600">{vehicleModel(s.vehicleId)}</td>
              <td className="font-medium text-slate-700">{formatCurrency(s.price)}</td>
              <td>
                <Badge variant={s.paymentMethod === 'Cash' ? 'green' : 'blue'}>{s.paymentMethod}</Badge>
              </td>
              <td>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </td>
              <td className="text-slate-500">{formatDate(s.createdAt)}</td>
              <td>
                <div className="flex justify-end">
                  <Link to={`/sales/${s.id}`} className="btn-ghost p-2" title="View">
                    <FiEye size={16} />
                  </Link>
                </div>
              </td>
            </tr>
          )}
        />
      )}
    </AppLayout>
  )
}
