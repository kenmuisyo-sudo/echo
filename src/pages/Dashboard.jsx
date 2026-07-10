import {
  FiUsers,
  FiShoppingCart,
  FiDollarSign,
  FiTruck,
  FiCheckCircle,
  FiFileText,
  FiAlertCircle,
} from 'react-icons/fi'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import dayjs from 'dayjs'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import { SectionLoader } from '../components/ui/Spinner'
import { useDashboardData } from '../hooks/useDashboardData'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, isToday, isThisMonth, timeAgo } from '../utils/helpers'
import { SALE_STATUS } from '../constants'

const COLORS = ['#0B6E4F', '#1C9A6D', '#F4B400', '#3b82f6', '#ef4444', '#94a3b8', '#a855f7', '#14b8a6']

export default function Dashboard() {
  const { profile } = useAuth()
  const { data, loading } = useDashboardData()

  if (loading || !data) {
    return (
      <AppLayout>
        <SectionLoader label="Loading dashboard…" />
      </AppLayout>
    )
  }

  const { customers, vehicles, sales, credit, payments } = data
  const activeLeads = sales.filter((s) => ['Inquiry', 'Agreed'].includes(s.status))
  const salesToday = sales.filter((s) => isToday(s.createdAt))
  const loansPending = sales.filter((s) => ['Loan Requested', 'Loan Submitted'].includes(s.status))
  const unitsAssigned = sales.filter((s) => s.status === 'Unit Assigned')
  const awaitingNtsa = sales.filter((s) => s.status === 'NTSA Transfer')
  const dispatched = sales.filter((s) => s.status === 'Dispatched')
  const readyStock = vehicles.filter((v) => v.status === 'NTSA Cleared')
  const inProcurement = vehicles.filter((v) =>
    ['Ordered', 'Order Received', 'Released', 'Received', 'NTSA Booking'].includes(v.status),
  )

  // Sales this month (by day)
  const monthSales = sales.filter((s) => isThisMonth(s.createdAt))
  const byDay = {}
  monthSales.forEach((s) => {
    const d = dayjs(s.createdAt).format('DD MMM')
    byDay[d] = (byDay[d] || 0) + 1
  })
  const salesChartData = Object.entries(byDay).map(([day, count]) => ({ day, sales: count }))

  // Sale status distribution
  const statusData = SALE_STATUS.map((st) => ({
    name: st,
    value: sales.filter((s) => s.status === st).length,
  })).filter((d) => d.value > 0)

  // Vehicle stock
  const stockData = ['Ordered', 'Order Received', 'Released', 'Received', 'NTSA Booking', 'NTSA Cleared', 'Reserved', 'Sold', 'Delivered'].map((st) => ({
    name: st,
    value: vehicles.filter((v) => v.status === st).length,
  }))

  // Recent activities
  const recent = [
    ...sales.map((s) => ({ type: 'Sale', text: `Sale ${s.status}`, time: s.createdAt })),
    ...customers.map((c) => ({ type: 'Customer', text: `${c.name} registered`, time: c.createdAt })),
  ]
    .sort((a, b) => (b.time || 0) - (a.time || 0))
    .slice(0, 8)

  // Revenue metrics
  const dispatchedSales = sales.filter((s) => s.status === 'Dispatched')
  const vehicleRevenue = dispatchedSales.reduce((sum, s) => sum + Number(s.price || 0) * Number(s.units || 1), 0)
  const accessoriesRevenue = sales.reduce((sum, s) => sum + Number(s.accessoriesTotal || 0), 0)
  const totalCollected = payments.filter((p) => p.confirmed).reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const stats = [
    { icon: FiUsers, label: 'Total Customers', value: customers.length, color: 'primary' },
    { icon: FiShoppingCart, label: 'Active Leads', value: activeLeads.length, color: 'blue' },
    { icon: FiDollarSign, label: 'Sales Today', value: salesToday.length, color: 'secondary' },
    { icon: FiFileText, label: 'Loans Pending', value: loansPending.length, color: 'amber' },
    { icon: FiTruck, label: 'Units Assigned', value: unitsAssigned.length, color: 'primary' },
    { icon: FiAlertCircle, label: 'Awaiting NTSA Transfer', value: awaitingNtsa.length, color: 'amber' },
    { icon: FiCheckCircle, label: 'Dispatched', value: dispatched.length, color: 'secondary' },
    { icon: FiTruck, label: 'Ready Stock (Cleared)', value: readyStock.length, color: 'primary' },
    { icon: FiDollarSign, label: 'In Procurement', value: inProcurement.length, color: 'blue' },
    { icon: FiDollarSign, label: 'Vehicle Revenue', value: formatCurrency(vehicleRevenue), color: 'secondary', isText: true },
    { icon: FiDollarSign, label: 'Accessories Revenue', value: formatCurrency(accessoriesRevenue), color: 'amber', isText: true },
    { icon: FiDollarSign, label: 'Total Collected (Payments)', value: formatCurrency(totalCollected), color: 'primary', isText: true },
  ]

  return (
    <AppLayout>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${profile?.name}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.05} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Sales This Month</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="#0B6E4F" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Sale Status Distribution</h3>
          {statusData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No sales data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Vehicle Stock by Stage</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="value" fill="#1C9A6D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Recent Activities</h3>
          <div className="space-y-3">
            {recent.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No activity yet</p>}
            {recent.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="badge bg-primary-50 text-primary">{a.type}</span>
                  <p className="text-sm text-slate-600">{a.text}</p>
                </div>
                <span className="text-xs text-slate-400">{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
