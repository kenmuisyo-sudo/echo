import { create, getAll, getById, updateById, removeById, setById } from './dataService'

const PATH = 'accessories'

const DEFAULT_ACCESSORIES = [
  { id: 'acc_canvas', name: 'Canvas', price: 4000, stock: 100 },
  { id: 'acc_doors', name: 'Doors', price: 3000, stock: 100 },
  { id: 'acc_seatbelt', name: 'Safety Belt (4 Pcs)', price: 2000, stock: 100 },
  { id: 'acc_firstaid', name: 'First Aid Kit', price: 500, stock: 100 },
  { id: 'acc_fire_ext', name: 'Fire Extinguisher', price: 450, stock: 100 },
  { id: 'acc_lifesaver', name: 'Life Saver', price: 450, stock: 100 },
]

export const accessoryService = {
  getAll: async () => {
    const list = await getAll(PATH)
    if (list.length === 0) {
      // Seed default items
      for (const item of DEFAULT_ACCESSORIES) {
        await setById(PATH, item.id, {
          name: item.name,
          price: item.price,
          stock: item.stock,
          createdAt: Date.now()
        })
      }
      return await getAll(PATH)
    }
    return list
  },
  getById: (id) => getById(PATH, id),
  create: (data) => create(PATH, { ...data, createdAt: Date.now() }),
  update: (id, data) => updateById(PATH, id, data),
  remove: (id) => removeById(PATH, id),
}
