import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FiPlus, FiPower, FiKey, FiShield } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { ButtonLoader } from '../components/ui/Spinner'
import { useAsyncList } from '../hooks/useAsync'
import { useAuth } from '../contexts/AuthContext'
import { userService } from '../services'
import { ROLE_OPTIONS, ROLES, ROLE_DEPARTMENT } from '../constants'
import { formatDate } from '../utils/helpers'

export default function Users() {
  const { profile, createUser, resetPassword, updateUserProfile } = useAuth()
  const { items, loading, setItems, reload } = useAsyncList(() => userService.getAll())
  const [createOpen, setCreateOpen] = useState(false)
  const [resetUser, setResetUser] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const openCreate = () => {
    reset({ name: '', email: '', password: '', phone: '', role: ROLES.SALES_AGENT })
    setCreateOpen(true)
  }

  const onSubmit = async (data) => {
    try {
      await userService.createWithAuth(data.email, data.password, {
        name: data.name,
        phone: data.phone,
        role: data.role,
        department: ROLE_DEPARTMENT[data.role] || '',
      })
      toast.success('User created')
      setCreateOpen(false)
      reload()
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? 'Email already in use' : e.message
      toast.error(msg)
    }
  }

  const toggleActive = async (u) => {
    try {
      await userService.toggleActive(u.id, !u.active)
      setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x)))
      toast.success(`User ${u.active ? 'deactivated' : 'activated'}`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleReset = async () => {
    try {
      await resetPassword(resetUser.email)
      toast.success('Password reset email sent')
      setResetUser(null)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const changeRole = async (u, role) => {
    try {
      const dept = ROLE_DEPARTMENT[role] || ''
      await userService.update(u.id, { role, department: dept })
      setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, role, department: dept } : x)))
      toast.success('Role updated')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Users" />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="User Management"
        subtitle={`${items.length} user${items.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <FiPlus /> Add User
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState title="No users" subtitle="Create users to grant system access." />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'department', label: 'Department' },
            { key: 'active', label: 'Status' },
            { key: 'createdAt', label: 'Joined' },
            { key: 'actions', label: '' },
          ]}
          data={items}
          searchKeys={['name', 'email', 'role', 'department']}
          searchPlaceholder="Search users…"
          renderRow={(u) => (
            <tr key={u.id}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-700">{u.name}</span>
                </div>
              </td>
              <td className="text-slate-600">{u.email}</td>
              <td className="text-slate-600">{u.phone || '-'}</td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u, e.target.value)}
                  disabled={u.id === profile?.uid}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td className="text-slate-600">{u.department || '-'}</td>
              <td>
                <Badge variant={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="text-slate-500">{formatDate(u.createdAt)}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <button className="btn-ghost p-2" title="Reset Password" onClick={() => setResetUser(u)}>
                    <FiKey size={16} />
                  </button>
                  <button
                    className="btn-ghost p-2 text-red-500"
                    title={u.active ? 'Deactivate' : 'Activate'}
                    onClick={() => toggleActive(u)}
                    disabled={u.id === profile?.uid}
                  >
                    <FiPower size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create User"
        size="md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" form="user-form" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <ButtonLoader />} Create
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register('email', { required: 'Email is required' })} />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" {...register('phone')} />
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <input type="password" className="input" {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })} />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" {...register('role')}>
              {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title="Reset Password"
        footer={
          <>
            <button className="btn-outline" onClick={() => setResetUser(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleReset}>Send Reset Email</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          A password reset email will be sent to <b>{resetUser?.email}</b>.
        </p>
      </Modal>
    </AppLayout>
  )
}
