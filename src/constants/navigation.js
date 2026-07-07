import { ROLES } from './index'

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'FiGrid', roles: Object.values(ROLES) },
  { to: '/customers', label: 'Customers', icon: 'FiUsers', roles: Object.values(ROLES) },
  { to: '/sales', label: 'Sales', icon: 'FiShoppingCart', roles: Object.values(ROLES) },
  { to: '/inventory', label: 'Inventory', icon: 'FiTruck', roles: Object.values(ROLES) },
  { to: '/workshop', label: 'Workshop', icon: 'FiTool', roles: [ROLES.ADMIN, ROLES.WORKSHOP_OFFICER] },
  { to: '/reports', label: 'Reports', icon: 'FiBarChart2', roles: [ROLES.ADMIN, ROLES.FINANCE_OFFICER] },
  { to: '/users', label: 'Users', icon: 'FiUserPlus', roles: [ROLES.ADMIN] },
  { to: '/settings', label: 'Settings', icon: 'FiSettings', roles: [ROLES.ADMIN] },
]

export const ROLE_NAV = (role) => NAV_ITEMS.filter((item) => item.roles.includes(role))
