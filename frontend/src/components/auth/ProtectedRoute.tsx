import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { ROUTES } from '@/constants/routes'
import { PageSkeleton } from '@/components/common'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requiredRole?: string[]
}

export default function ProtectedRoute({ children, requireAuth = true, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return <PageSkeleton />
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!requireAuth && isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  if (requiredRole && user && !requiredRole.includes(user.role)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return <>{children}</>
}
