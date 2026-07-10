import { getAll, getById, updateById, removeById } from './dataService'
import { db, secondaryAuth } from '../firebase/config'
import { ref, set } from 'firebase/database'
import { DB_ROOT } from '../constants'
import { createUserWithEmailAndPassword } from 'firebase/auth'

const PATH = 'users'
const userRef = (uid) => ref(db, `${DB_ROOT}/${PATH}/${uid}`)

export const userService = {
  create: async (uid, data) => {
    await set(userRef(uid), data)
    return uid
  },
  createWithAuth: async (email, password, profileData) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const uid = cred.user.uid
    await set(userRef(uid), {
      ...profileData,
      uid,
      email,
      active: true,
      createdAt: Date.now()
    })
    // Sign out secondary auth so it doesn't persist the new user session
    await secondaryAuth.signOut()
    return uid
  },
  getAll: () => getAll(PATH),
  getById: (uid) => getById(PATH, uid),
  update: (uid, data) => updateById(PATH, uid, data),
  remove: (uid) => removeById(PATH, uid),
  toggleActive: async (uid, active) => updateById(PATH, uid, { active }),
}
