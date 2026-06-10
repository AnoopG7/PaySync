import { create } from 'zustand'

export type UserRole = 'admin' | 'manager' | 'staff'

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  region: string
  avatar?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { firstName: string; lastName: string; email: string; password: string; role?: UserRole }) => Promise<void>
  logout: () => void
  updateUser: (data: Partial<User>) => void
}

const MOCK_USERS: Array<User & { password: string }> = [
  { id: '1', firstName: 'Admin', lastName: 'User', email: 'admin@paysync.cloud', password: 'admin123', role: 'admin', region: 'us-east-1' },
  { id: '2', firstName: 'Jane', lastName: 'Manager', email: 'manager@paysync.cloud', password: 'manager123', role: 'manager', region: 'us-east-1' },
  { id: '3', firstName: 'John', lastName: 'Staff', email: 'staff@paysync.cloud', password: 'staff123', role: 'staff', region: 'us-west-1' },
]

function getInitialUser(): { user: User | null; isAuthenticated: boolean } {
  try {
    const stored = localStorage.getItem('paysync_user')
    if (stored) {
      const user = JSON.parse(stored) as User
      return { user, isAuthenticated: true }
    }
  } catch {
    localStorage.removeItem('paysync_user')
  }
  return { user: null, isAuthenticated: false }
}

const initial = getInitialUser()

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  isAuthenticated: initial.isAuthenticated,
  isLoading: false,

  initialize: () => {
    const { user, isAuthenticated } = getInitialUser()
    set({ user, isAuthenticated })
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    await new Promise((r) => setTimeout(r, 600))
    const found = MOCK_USERS.find((u) => u.email === email && u.password === password)
    if (!found) {
      set({ isLoading: false })
      throw new Error('Invalid email or password')
    }
    const { password: _, ...user } = found
    localStorage.setItem('paysync_user', JSON.stringify(user))
    set({ user: user as User, isAuthenticated: true, isLoading: false })
  },

  register: async (data) => {
    set({ isLoading: true })
    await new Promise((r) => setTimeout(r, 600))
    const newUser: User = {
      id: String(Date.now()),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      role: data.role || 'staff',
      region: 'us-east-1',
    }
    localStorage.setItem('paysync_user', JSON.stringify(newUser))
    set({ user: newUser, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem('paysync_user')
    set({ user: null, isAuthenticated: false })
  },

  updateUser: (data) => {
    set((state) => {
      if (!state.user) return state
      const updated = { ...state.user, ...data }
      localStorage.setItem('paysync_user', JSON.stringify(updated))
      return { user: updated }
    })
  },
}))
