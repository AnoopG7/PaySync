import { lazy, Suspense, type ComponentType } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { RootLayout, AuthLayout } from '@/layouts'
import { ProtectedRoute } from '@/components/auth'
import PageSkeleton from '@/components/common/PageSkeleton'

const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Reports = lazy(() => import('@/pages/Reports'))
const Workflows = lazy(() => import('@/pages/Workflows'))
const Monitoring = lazy(() => import('@/pages/Monitoring'))
const Executive = lazy(() => import('@/pages/Executive'))
const Regions = lazy(() => import('@/pages/Regions'))
const Pricing = lazy(() => import('@/pages/Pricing'))
const Admin = lazy(() => import('@/pages/Admin'))

function LazyRoute({ element: Component }: { element: ComponentType<unknown> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  )
}

function ProtectedLazyRoute({ element: Component, roles }: { element: ComponentType<unknown>; roles?: string[] }) {
  return (
    <ProtectedRoute requiredRole={roles}>
      <LazyRoute element={Component} />
    </ProtectedRoute>
  )
}

function AuthLazyRoute({ element: Component }: { element: ComponentType<unknown> }) {
  return (
    <ProtectedRoute requireAuth={false}>
      <LazyRoute element={Component} />
    </ProtectedRoute>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<AuthLazyRoute element={Login} />} />
        <Route path={ROUTES.REGISTER} element={<AuthLazyRoute element={Register} />} />
      </Route>

      <Route element={<RootLayout />}>
        <Route path={ROUTES.DASHBOARD} element={<ProtectedLazyRoute element={Dashboard} />} />
        <Route path={ROUTES.REPORTS} element={<ProtectedLazyRoute element={Reports} roles={['admin', 'manager']} />} />
        <Route path={ROUTES.WORKFLOWS} element={<ProtectedLazyRoute element={Workflows} />} />
        <Route path={ROUTES.MONITORING} element={<ProtectedLazyRoute element={Monitoring} roles={['admin', 'manager']} />} />
        <Route path={ROUTES.EXECUTIVE} element={<ProtectedLazyRoute element={Executive} roles={['admin', 'manager']} />} />
        <Route path={ROUTES.REGIONS} element={<ProtectedLazyRoute element={Regions} roles={['admin', 'manager']} />} />
        <Route path={ROUTES.PRICING} element={<ProtectedLazyRoute element={Pricing} />} />
        <Route path={ROUTES.ADMIN} element={<ProtectedLazyRoute element={Admin} roles={['admin']} />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  )
}
