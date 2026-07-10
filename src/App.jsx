import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import { ROLES } from './constants'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetails from './pages/CustomerDetails'
import Sales from './pages/Sales'
import SaleDetails from './pages/SaleDetails'
import Inventory from './pages/Inventory'
import VehicleDetails from './pages/VehicleDetails'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Accessories from './pages/Accessories'
import NotFound from './pages/NotFound'

const ALL = Object.values(ROLES)

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      <Route path="/customers" element={<ProtectedRoute allowedRoles={ALL}><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute allowedRoles={ALL}><CustomerDetails /></ProtectedRoute>} />

      <Route path="/sales" element={<ProtectedRoute allowedRoles={ALL}><Sales /></ProtectedRoute>} />
      <Route path="/sales/:id" element={<ProtectedRoute allowedRoles={ALL}><SaleDetails /></ProtectedRoute>} />

      <Route path="/inventory" element={<ProtectedRoute allowedRoles={ALL}><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/:id" element={<ProtectedRoute allowedRoles={ALL}><VehicleDetails /></ProtectedRoute>} />
      <Route path="/accessories" element={<ProtectedRoute allowedRoles={ALL}><Accessories /></ProtectedRoute>} />

      <Route path="/reports" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.FINANCE_OFFICER]}><Reports /></ProtectedRoute>} />

      <Route path="/users" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]}><Settings /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
