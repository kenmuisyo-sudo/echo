import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FiPlus, FiEdit2, FiTrash2, FiPackage } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { ButtonLoader } from '../components/ui/Spinner'
import { useAsyncList } from '../hooks/useAsync'
import { useAuth } from '../contexts/AuthContext'
import { accessoryService } from '../services'
import { formatCurrency, formatDate } from '../utils/helpers'
import { can } from '../utils/permissions'

export default function Accessories() {
  const { profile } = useAuth()
  const { items, loading, setItems, reload } = useAsyncList(() => accessoryService.getAll())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  const canManage = can.manageInventory(profile?.role)

  const openCreate = () => {
    setEditing(null)
    reset({ name: '', price: '', stock: '' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    reset({ name: item.name, price: item.price, stock: item.stock })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock),
      }
      if (editing) {
        await accessoryService.update(editing.id, payload)
        toast.success('Accessory updated')
      } else {
        await accessoryService.create(payload)
        toast.success('Accessory added')
      }
      setModalOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDelete = async () => {
    try {
      await accessoryService.remove(deleteId)
      toast.success('Accessory deleted')
      setDeleteId(null)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Accessories" />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Accessories & Parts"
        subtitle={`${items.length} product${items.length !== 1 ? 's' : ''}`}
        actions={
          canManage && (
            <button className="btn-primary" onClick={openCreate}>
              <FiPlus /> Add Accessory
            </button>
          )
        }
      />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState title="No accessories" subtitle="Create accessories to offer during pre-delivery." />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Accessory / Part' },
            { key: 'price', label: 'Price (KSH)' },
            { key: 'stock', label: 'In Stock' },
            { key: 'createdAt', label: 'Added On' },
            { key: 'actions', label: '' },
          ]}
          data={items}
          searchKeys={['name']}
          searchPlaceholder="Search accessories…"
          renderRow={(item) => (
            <tr key={item.id}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FiPackage size={18} />
                  </div>
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
              </td>
              <td className="font-medium text-slate-700">{formatCurrency(item.price)}</td>
              <td>
                <span className={`font-bold ${item.stock < 10 ? 'text-red-500' : 'text-slate-700'}`}>
                  {item.stock}
                </span>
              </td>
              <td className="text-slate-500">{formatDate(item.createdAt)}</td>
              <td>
                <div className="flex justify-end gap-1">
                  {canManage && (
                    <>
                      <button className="btn-ghost p-2" title="Edit" onClick={() => openEdit(item)}>
                        <FiEdit2 size={16} />
                      </button>
                      <button className="btn-ghost p-2 text-red-500" title="Delete" onClick={() => setDeleteId(item.id)}>
                        <FiTrash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Accessory' : 'Add Accessory'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="accessory-form" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <ButtonLoader />} {editing ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form id="accessory-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Accessory Name</label>
            <input className="input" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (KSH)</label>
              <input type="number" className="input" {...register('price', { required: 'Price is required', min: 0 })} />
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
            </div>
            <div>
              <label className="label">Stock Level</label>
              <input type="number" className="input" {...register('stock', { required: 'Stock is required', min: 0 })} />
              {errors.stock && <p className="mt-1 text-xs text-red-500">{errors.stock.message}</p>}
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Accessory"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this accessory? This will remove it from the catalog.</p>
      </Modal>
    </AppLayout>
  )
}
