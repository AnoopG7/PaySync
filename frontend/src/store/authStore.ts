import { create } from 'zustand'

export type UserRole = 'admin' | 'manager' | 'staff'

export interface User {
  id: number | string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  region: string
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

const API_BASE = 'http://localhost:3001/api'

function getInitialUser(): { user: User | null; isAuthenticated: boolean } {
  try {
    const stored = localStorage.getItem('paysync_user')
    const token = localStorage.getItem('paysync_token')
    if (stored && token) {
      return { user: JSON.parse(stored) as User, isAuthenticated: true }
    }
  } catch {
    localStorage.removeItem('paysync_user')
    localStorage.removeItem('paysync_token')
  }
  return { user: null, isAuthenticated: false }
}

const initial = getInitialUser()

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  isAuthenticated: initial.isAuthenticated,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Invalid credentials' }))
        throw new Error(err.error)
      }
      const data = await res.json()
      localStorage.setItem('paysync_user', JSON.stringify(data.user))
      localStorage.setItem('paysync_token', data.token)
      set({ user: data.user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' }))
        throw new Error(err.error)
      }
      const result = await res.json()
      localStorage.setItem('paysync_user', JSON.stringify(result.user))
      localStorage.setItem('paysync_token', result.token)
      set({ user: result.user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('paysync_user')
    localStorage.removeItem('paysync_token')
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
