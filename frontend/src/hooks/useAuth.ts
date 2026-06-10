import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, register, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const loginAndRedirect = async (email: string, password: string, redirect = '/dashboard') => {
    await login(email, password)
    navigate(redirect)
  }

  const registerAndRedirect = async (data: { firstName: string; lastName: string; email: string; password: string }, redirect = '/dashboard') => {
    await register(data)
    navigate(redirect)
  }

  const logoutAndRedirect = () => {
    logout()
    navigate('/login')
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginAndRedirect,
    register: registerAndRedirect,
    logout: logoutAndRedirect,
    updateUser,
  }
}
