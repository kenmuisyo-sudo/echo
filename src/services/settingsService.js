import { ref, get, set } from 'firebase/database'
import { db } from '../firebase/config'
import { DB_ROOT, DEFAULT_FINANCIERS, DEFAULT_BRANCHES } from '../constants'

const NODE = `${DB_ROOT}/settings`

/**
 * Reads the financiers and branches lists from the database. If the settings
 * node does not exist yet, the default seed values are written back so the
 * dashboard always has something to display.
 */
export const settingsService = {
  getAll: async () => {
    const snap = await get(ref(db, NODE))
    if (!snap.exists()) {
      const seed = { financiers: DEFAULT_FINANCIERS, branches: DEFAULT_BRANCHES }
      await set(ref(db, NODE), seed)
      return seed
    }
    const val = snap.val() || {}
    return {
      financiers: val.financiers || DEFAULT_FINANCIERS,
      branches: val.branches || DEFAULT_BRANCHES,
    }
  },

  getFinanciers: async () => (await settingsService.getAll()).financiers,
  getBranches: async () => (await settingsService.getAll()).branches,

  saveFinanciers: async (financiers) => {
    const current = await settingsService.getAll()
    await set(ref(db, NODE), { ...current, financiers })
    return financiers
  },

  saveBranches: async (branches) => {
    const current = await settingsService.getAll()
    await set(ref(db, NODE), { ...current, branches })
    return branches
  },

  addFinancier: async (name) => {
    const list = await settingsService.getFinanciers()
    const trimmed = String(name).trim()
    if (!trimmed) return list
    if (list.includes(trimmed)) return list
    const updated = [...list, trimmed]
    await settingsService.saveFinanciers(updated)
    return updated
  },

  removeFinancier: async (name) => {
    const list = await settingsService.getFinanciers()
    const updated = list.filter((f) => f !== name)
    await settingsService.saveFinanciers(updated)
    return updated
  },

  addBranch: async (name) => {
    const list = await settingsService.getBranches()
    const trimmed = String(name).trim()
    if (!trimmed) return list
    if (list.includes(trimmed)) return list
    const updated = [...list, trimmed]
    await settingsService.saveBranches(updated)
    return updated
  },

  removeBranch: async (name) => {
    const list = await settingsService.getBranches()
    const updated = list.filter((b) => b !== name)
    await settingsService.saveBranches(updated)
    return updated
  },

  getNextSerial: async (type) => {
    const counterRef = ref(db, `${NODE}/counters/${type}`)
    const snap = await get(counterRef)
    const current = Number(snap.val() || 0)
    let nextVal = current + 1
    if (nextVal > 9999) {
      nextVal = 1
    }
    await set(counterRef, nextVal)
    return String(nextVal).padStart(4, '0')
  },
}
