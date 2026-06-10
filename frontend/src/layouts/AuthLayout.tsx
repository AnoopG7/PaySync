import { Outlet, Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4">
      <div className="w-full max-w-md">
        <Link to={ROUTES.HOME} className="mb-8 block text-center text-2xl font-bold">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Pay</span>
          Sync
        </Link>
        <Outlet />
      </div>
    </div>
  )
}
