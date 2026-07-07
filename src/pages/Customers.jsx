import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiPhone, FiMail } from 'react-icons/fi'
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
import { customerService, saleService } from '../services'
import { CUSTOMER_TYPES } from '../constants'
import { formatDate } from '../utils/helpers'

export default function Customers() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { items, loading, setItems, reload } = useAsyncList(() => customerService.getAll())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  const openCreate = () => {
    setEditing(null)
    reset({
      name: '',
      phone: '',
      idNumber: '',
      customerType: 'Passenger',
      email: '',
      address: '',
      notes: '',
      salesAgent: profile?.name || '',
      autoLead: true,
    })
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    reset(c)
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    try {
      if (editing) {
        await customerService.update(editing.id, data)
        setItems((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...data } : c)))
        toast.success('Customer updated')
      } else {
        const payload = { ...data, createdBy: profile.uid }
        const customerId = await customerService.create(payload)
        // A customer walking in to inquire starts a sale lead (status Inquiry).
        if (data.autoLead) {
          const saleId = await saleService.createLead({
            customerId,
            salesAgent: data.salesAgent || profile?.name || '',
            salesAgentId: profile.uid,
          })
          toast.success('Customer registered. Sale lead created.')
          setModalOpen(false)
          reload()
          navigate(`/sales/${saleId}`)
          return
        }
        toast.success('Customer created')
        reload()
      }
      setModalOpen(false)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    try {
      await customerService.remove(deleteId)
      setItems((prev) => prev.filter((c) => c.id !== deleteId))
      toast.success('Customer deleted')
      setDeleteId(null)
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Customers" />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Customers"
        subtitle={`${items.length} customer${items.length !== 1 ? 's' : ''} registered`}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <FiPlus /> Add Customer
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No customers yet"
            subtitle="Add your first customer to get started."
            action={
              <button className="btn-primary" onClick={openCreate}>
                <FiPlus /> Add Customer
              </button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Contact' },
            { key: 'customerType', label: 'Type' },
            { key: 'idNumber', label: 'ID Number' },
            { key: 'createdAt', label: 'Registered' },
            { key: 'actions', label: '' },
          ]}
          data={items}
          searchKeys={['name', 'phone', 'email', 'idNumber']}
          searchPlaceholder="Search customers…"
          renderRow={(c) => (
            <tr key={c.id}>
              <td>
                <Link to={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                  {c.name}
                </Link>
                {c.email && (
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <FiMail size={11} /> {c.email}
                  </p>
                )}
              </td>
              <td>
                <span className="flex items-center gap-1 text-slate-600">
                  <FiPhone size={13} className="text-slate-400" /> {c.phone || '-'}
                </span>
              </td>
              <td>
                <Badge variant={c.customerType === 'Cargo' ? 'blue' : 'secondary'}>{c.customerType}</Badge>
              </td>
              <td>{c.idNumber || '-'}</td>
              <td className="text-slate-500">{formatDate(c.createdAt)}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <Link to={`/customers/${c.id}`} className="btn-ghost p-2" title="View">
                    <FiEye size={16} />
                  </Link>
                  <button className="btn-ghost p-2" onClick={() => openEdit(c)} title="Edit">
                    <FiEdit2 size={16} />
                  </button>
                  <button className="btn-ghost p-2 text-red-500" onClick={() => setDeleteId(c.id)} title="Delete">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="customer-form" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <ButtonLoader />}
              {editing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full Name</label>
            <input className="input" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" {...register('phone', { required: 'Phone is required' })} />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="label">ID Number</label>
            <input className="input" {...register('idNumber')} />
          </div>
          <div>
            <label className="label">Customer Type</label>
            <select className="input" {...register('customerType')}>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" {...register('email')} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" {...register('address')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea rows={3} className="input" {...register('notes')} />
          </div>

          {!editing && (
            <>
              <div className="mt-2 flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="autoLead"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  {...register('autoLead')}
                  defaultChecked
                />
                <label htmlFor="autoLead" className="text-sm text-slate-600">
                  Start a sale lead automatically (customer walked in to inquire)
                </label>
              </div>

              {watch('autoLead') && (
                <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                  <label className="label">Sales Agent</label>
                  <input className="input" {...register('salesAgent')} placeholder="Assigned agent" />
                  <p className="mt-2 text-xs text-slate-400">
                    A sale will be created with status <b>Inquiry</b>. You can then agree to proceed and capture payment.
                  </p>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Customer"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this customer? This action cannot be undone.</p>
      </Modal>
    </AppLayout>
  )
}
