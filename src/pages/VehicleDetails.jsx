import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { FiArrowLeft, FiEdit2, FiUpload, FiTrash2, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import toast from 'react-hot-toast'
import AppLayout from '../components/layouts/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge, { statusVariant } from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { ButtonLoader, SectionLoader } from '../components/ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../contexts/AuthContext'
import { inventoryService, MAX_VEHICLE_IMAGES, MIN_VEHICLE_IMAGES } from '../services'
import { VEHICLE_MODELS, VEHICLE_COLORS, VEHICLE_STATUS } from '../constants'
import { formatCurrency, formatDate } from '../utils/helpers'
import { can } from '../utils/permissions'

export default function VehicleDetails() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data, loading, reload } = useAsync(() => inventoryService.getById(id), [id])
  const [editOpen, setEditOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [lightbox, setLightbox] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm()

  if (loading || !data) {
    return (
      <AppLayout>
        <SectionLoader label="Loading vehicle…" />
      </AppLayout>
    )
  }

  const vehicle = data
  const canManage = can.manageInventory(profile?.role)
  const images = vehicle.images || (vehicle.image ? [vehicle.image] : [])

  const openEdit = () => {
    reset(vehicle)
    setEditOpen(true)
  }

  const onSubmit = async (formData) => {
    try {
      await inventoryService.update(id, { ...formData, price: Number(formData.price) })
      toast.success('Vehicle updated')
      setEditOpen(false)
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (images.length + files.length > MAX_VEHICLE_IMAGES) {
      toast.error(`Maximum ${MAX_VEHICLE_IMAGES} images allowed. You currently have ${images.length}.`)
      return
    }
    setUploading(true)
    try {
      const urls = await inventoryService.uploadImages(id, files, images)
      const updated = [...images, ...urls]
      await inventoryService.setImages(id, updated)
      toast.success(`${urls.length} image(s) uploaded`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = async (index) => {
    try {
      const updated = await inventoryService.removeImage(id, index, images)
      toast.success('Image removed')
      if (activeImage >= updated.length) setActiveImage(0)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const prevImage = () => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))
  const nextImage = () => setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1))

  return (
    <AppLayout>
      <Link to="/inventory" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary">
        <FiArrowLeft /> Back to Inventory
      </Link>
      <PageHeader
        title={vehicle.model}
        subtitle={`Added ${formatDate(vehicle.createdAt)}`}
        actions={canManage && (
          <button className="btn-outline" onClick={openEdit}>
            <FiEdit2 /> Edit
          </button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Image Gallery */}
        <Card>
          <div className="relative overflow-hidden rounded-xl bg-slate-50">
            {images.length > 0 ? (
              <>
                <img
                  src={images[activeImage]}
                  alt={`${vehicle.model} ${activeImage + 1}`}
                  className="h-72 w-full cursor-pointer object-cover"
                  onClick={() => setLightbox(images[activeImage])}
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
                    >
                      <FiChevronLeft size={18} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
                    >
                      <FiChevronRight size={18} />
                    </button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-white">
                      {activeImage + 1} / {images.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-72 w-full flex-col items-center justify-center gap-2 text-slate-400">
                <FiUpload size={32} />
                <p className="text-sm">No images yet</p>
                {canManage && MIN_VEHICLE_IMAGES > 0 && (
                  <p className="text-xs">At least {MIN_VEHICLE_IMAGES} image required</p>
                )}
              </div>
            )}
          </div>

          {/* Thumbnails + Upload */}
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="group relative h-16 w-16">
                <img
                  src={img}
                  alt={`thumb ${i + 1}`}
                  className={`h-16 w-16 cursor-pointer rounded-lg object-cover border-2 ${
                    i === activeImage ? 'border-primary' : 'border-transparent'
                  }`}
                  onClick={() => setActiveImage(i)}
                />
                {canManage && (
                  <button
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
                    title="Remove image"
                  >
                    <FiTrash2 size={11} />
                  </button>
                )}
              </div>
            ))}

            {canManage && images.length < MAX_VEHICLE_IMAGES && (
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary">
                {uploading ? (
                  <span className="text-xs">…</span>
                ) : (
                  <>
                    <FiUpload size={18} />
                    <span className="text-[10px]">Add</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            )}
          </div>

          {canManage && (
            <p className="mt-2 text-xs text-slate-400">
              {images.length} of {MAX_VEHICLE_IMAGES} images {MIN_VEHICLE_IMAGES > 0 ? `(min ${MIN_VEHICLE_IMAGES})` : '(optional)'}
            </p>
          )}
        </Card>

        {/* Specifications */}
        <Card>
          <h3 className="mb-4 font-semibold text-slate-700">Specifications</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Price</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(vehicle.price)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <Badge variant={statusVariant(vehicle.status)}>{vehicle.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400">Color</p>
              <p className="text-slate-700">{vehicle.color}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Chassis Number</p>
              <p className="font-mono text-xs text-slate-600">{vehicle.chassisNumber || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Battery Serial</p>
              <p className="font-mono text-xs text-slate-600">{vehicle.batterySerial || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Motor Serial</p>
              <p className="font-mono text-xs text-slate-600">{vehicle.motorSerial || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Engine Number</p>
              <p className="font-mono text-xs text-slate-600">{vehicle.engineNumber || '-'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="full" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Vehicle"
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" form="edit-vehicle" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <ButtonLoader />} Update
            </button>
          </>
        }
      >
        <form id="edit-vehicle" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Model</label>
            <select className="input" {...register('model', { required: 'Required' })}>
              {VEHICLE_MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Price (KES)</label>
            <input type="number" className="input" {...register('price', { required: 'Required' })} />
          </div>
          <div>
            <label className="label">Color</label>
            <select className="input" {...register('color')}>
              {VEHICLE_COLORS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" {...register('status')}>
              {VEHICLE_STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Chassis Number</label>
            <input className="input" {...register('chassisNumber')} />
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
        </form>
      </Modal>
    </AppLayout>
  )
}
