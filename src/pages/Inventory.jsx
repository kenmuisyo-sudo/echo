import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiUpload, FiX, FiArrowRight, FiPackage } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Badge, { statusVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import { ButtonLoader } from '../components/ui/Spinner'
import { useAsyncList } from '../hooks/useAsync'
import { useAuth } from '../contexts/AuthContext'
import { inventoryService, MAX_VEHICLE_IMAGES, MIN_VEHICLE_IMAGES } from '../services'
import { VEHICLE_MODELS, VEHICLE_COLORS, VEHICLE_PROCUREMENT_STAGES, VEHICLE_STATUS } from '../constants'
import { formatCurrency, formatDate } from '../utils/helpers'
import { can } from '../utils/permissions'

const vehicleImages = (v) => v.images || (v.image ? [v.image] : [])

export default function Inventory() {
  const { profile } = useAuth()
  const { items, loading, setItems, reload } = useAsyncList(() => inventoryService.getAll())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [filter, setFilter] = useState('All')
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [pendingPreviews, setPendingPreviews] = useState([])
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const canManage = can.manageInventory(profile?.role)

  const openCreate = () => {
    setEditing(null)
    reset({ model: '', price: '', color: '', batterySerial: '', motorSerial: '', engineNumber: '', chassisNumber: '', registrationNo: '', status: 'Received', dateReceivedFromFactory: '', ntsaBookingDate: '', quantity: 1 })
    setPendingFiles([])
    setPendingPreviews([])
    setModalOpen(true)
  }

  const openEdit = (v) => {
    setEditing(v)
    reset(v)
    setPendingFiles([])
    setPendingPreviews([])
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    pendingPreviews.forEach((p) => URL.revokeObjectURL(p))
    setPendingFiles([])
    setPendingPreviews([])
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const existingCount = editing ? vehicleImages(editing).length : 0
    const remaining = MAX_VEHICLE_IMAGES - existingCount - pendingFiles.length
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_VEHICLE_IMAGES} images allowed`)
      return
    }
    const toAdd = files.slice(0, remaining)
    if (toAdd.length < files.length) {
      toast.error(`Only ${toAdd.length} more image(s) can be added (max ${MAX_VEHICLE_IMAGES})`)
    }
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f))
    setPendingFiles((prev) => [...prev, ...toAdd])
    setPendingPreviews((prev) => [...prev, ...newPreviews])
    e.target.value = ''
  }

  const removePending = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const onSubmit = async (data) => {
    try {
      if (!editing && pendingFiles.length < MIN_VEHICLE_IMAGES) {
        toast.error(`At least ${MIN_VEHICLE_IMAGES} vehicle image is required`)
        return
      }
      setUploading(true)
      const payload = { ...data, price: Number(data.price), quantity: Number(data.quantity || 1) }
      if (editing) {
        const existing = vehicleImages(editing)
        let images = [...existing]
        if (pendingFiles.length > 0) {
          const urls = await inventoryService.uploadImages(editing.id, pendingFiles, existing)
          images = [...images, ...urls]
        }
        await inventoryService.update(editing.id, { ...payload, images })
        setItems((prev) => prev.map((v) => (v.id === editing.id ? { ...v, ...payload, images } : v)))
        toast.success('Vehicle updated')
      } else {
        const vehicleId = await inventoryService.create({ ...payload, images: [] })
        if (pendingFiles.length > 0) {
          const urls = await inventoryService.uploadImages(vehicleId, pendingFiles, [])
          await inventoryService.setImages(vehicleId, urls)
        }
        toast.success('Vehicle added')
        reload()
      }
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p))
      setPendingFiles([])
      setPendingPreviews([])
      setModalOpen(false)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await inventoryService.remove(deleteId)
      setItems((prev) => prev.filter((v) => v.id !== deleteId))
      toast.success('Vehicle deleted')
      setDeleteId(null)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const changeStatus = async (v, status) => {
    try {
      await inventoryService.update(v.id, { status })
      setItems((prev) => prev.map((x) => (x.id === v.id ? { ...x, status } : x)))
      toast.success(`Marked as ${status}`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const advanceStage = async (v) => {
    const idx = VEHICLE_PROCUREMENT_STAGES.indexOf(v.status)
    if (idx < 0 || idx >= VEHICLE_PROCUREMENT_STAGES.length - 1) return
    const next = VEHICLE_PROCUREMENT_STAGES[idx + 1]
    await changeStatus(v, next)
  }

  const filtered = filter === 'All' ? items : items.filter((v) => v.status === filter)
  const existingImages = editing ? vehicleImages(editing) : []
  const allPreviews = [...existingImages, ...pendingPreviews]

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Inventory" />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} vehicle${items.length !== 1 ? 's' : ''}`}
        actions={
          canManage && (
            <button className="btn-primary" onClick={openCreate}>
              <FiPlus /> Add Vehicle
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['All', ...VEHICLE_STATUS].map((s) => (
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
            title="No vehicles found"
            subtitle="Add vehicles to your inventory to begin sales."
            action={canManage && (
              <button className="btn-primary" onClick={openCreate}>
                <FiPlus /> Add Vehicle
              </button>
            )}
          />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'model', label: 'Batch / Vehicle' },
            { key: 'price', label: 'Price (KSH)' },
            { key: 'color', label: 'Color' },
            { key: 'quantity', label: 'Stock' },
            { key: 'status', label: 'Stage' },
            { key: 'chassisNumber', label: 'Chassis' },
            { key: 'createdAt', label: 'Received On' },
            { key: 'actions', label: '' },
          ]}
          data={filtered}
          searchKeys={['model', 'color', 'chassisNumber', 'batterySerial', 'motorSerial']}
          searchPlaceholder="Search vehicles…"
          renderRow={(v) => {
            const imgs = vehicleImages(v)
            return (
              <tr key={v.id}>
                <td>
                  <Link to={`/inventory/${v.id}`} className="flex items-center gap-3">
                    {imgs[0] ? (
                      <div className="relative h-10 w-10">
                        <img src={imgs[0]} alt={v.model} className="h-10 w-10 rounded-lg object-cover" />
                        {imgs.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                            {imgs.length}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <FiPackage size={16} />
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-primary hover:underline">{v.model}</span>
                      <p className="text-xs text-slate-400">{v.color} · Added {formatDate(v.createdAt)}</p>
                    </div>
                  </Link>
                </td>
                <td className="font-medium text-slate-700">{formatCurrency(v.price)}</td>
                <td>{v.color}</td>
                <td>
                  <span className="font-bold text-slate-700">{v.quantity ?? 1}</span>
                  <span className="ml-1 text-xs text-slate-400">
                    ({Math.max((v.quantity ?? 1) - (v.reservedQty || 0) - (v.soldQty || 0) - (v.deliveredQty || 0), 0)} avail)
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(v.status)}>{v.status || 'Received'}</Badge>
                    {canManage && v.status === 'Received' && (
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-primary px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/5"
                        title="Advance to NTSA Booking"
                        onClick={() => changeStatus(v, 'NTSA Booking')}
                      >
                        <FiArrowRight size={11} /> NTSA Booking
                      </button>
                    )}
                  </div>
                </td>
                <td className="font-mono text-xs text-slate-500">{v.chassisNumber || '-'}</td>
                <td className="text-slate-500">{formatDate(v.createdAt)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Link to={`/inventory/${v.id}`} className="btn-ghost p-2" title="View">
                      <FiEye size={16} />
                    </Link>
                    {canManage && (
                      <>
                        <button className="btn-ghost p-2" onClick={() => openEdit(v)} title="Edit">
                          <FiEdit2 size={16} />
                        </button>
                        <button className="btn-ghost p-2 text-red-500" onClick={() => setDeleteId(v.id)} title="Delete">
                          <FiTrash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          }}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" form="vehicle-form" className="btn-primary" disabled={isSubmitting || uploading}>
              {isSubmitting && <ButtonLoader />} {editing ? 'Update' : 'Add'}
            </button>
          </>
        }
      >
        <form id="vehicle-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Model</label>
            <select className="input" {...register('model', { required: 'Required' })}>
              <option value="">Select model</option>
              {VEHICLE_MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
            {errors.model && <p className="mt-1 text-xs text-red-500">{errors.model.message}</p>}
          </div>
          <div>
            <label className="label">Price (KSH)</label>
            <input type="number" className="input" {...register('price', { required: 'Required', min: 1 })} />
            {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
          </div>
          <div>
            <label className="label">Color</label>
            <select className="input" {...register('color')}>
              {VEHICLE_COLORS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity / Stock</label>
            <input type="number" className="input" {...register('quantity', { required: 'Required', min: 1 })} defaultValue={1} />
          </div>
          <div>
            <label className="label">Chassis Number</label>
            <input className="input" {...register('chassisNumber')} />
          </div>
          <div>
            <label className="label">Registration No.</label>
            <input className="input" {...register('registrationNo')} placeholder="e.g. KMEA 123A" />
          </div>
          <div>
            <label className="label">Battery Serial</label>
            <input className="input" {...register('batterySerial')} />
          </div>
          <div>
            <label className="label">Motor Serial</label>
            <input className="input" {...register('motorSerial')} />
          </div>
          <div>
            <label className="label">Engine Number</label>
            <input className="input" {...register('engineNumber')} />
          </div>
          <div>
            <label className="label">Date Received From Factory</label>
            <input type="date" className="input" {...register('dateReceivedFromFactory')} />
          </div>
          <div>
            <label className="label">Booked at NTSA for Inspection</label>
            <input type="date" className="input" {...register('ntsaBookingDate')} />
          </div>

          {/* Image Upload */}
          <div className="sm:col-span-2">
            <label className="label">
              Vehicle Images ({allPreviews.length}/{MAX_VEHICLE_IMAGES}){MIN_VEHICLE_IMAGES > 0 ? ` — min ${MIN_VEHICLE_IMAGES}` : ' (Optional)'}
            </label>
            <div className="flex flex-wrap gap-2">
              {allPreviews.map((src, i) => {
                const isExisting = i < existingImages.length
                return (
                  <div key={i} className="group relative h-20 w-20">
                    <img src={src} alt={`preview ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                    {!isExisting && (
                      <button
                        type="button"
                        onClick={() => removePending(i - existingImages.length)}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <FiX size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
              {allPreviews.length < MAX_VEHICLE_IMAGES && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary">
                  {uploading ? (
                    <span className="text-xs">Uploading…</span>
                  ) : (
                    <>
                      <FiUpload size={20} />
                      <span className="text-[10px]">Add Image</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>
            {!editing && MIN_VEHICLE_IMAGES > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                Upload {MIN_VEHICLE_IMAGES}-{MAX_VEHICLE_IMAGES} images of the vehicle.
              </p>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Vehicle"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this vehicle? This action cannot be undone.</p>
      </Modal>
    </AppLayout>
  )
}
