import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ROUTES } from '@/constants/routes'
import { SITE_CONFIG } from '@/constants/site-config'
import { useAuthStore } from '@/store'
import ThemeToggle from './ThemeToggle'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Menu, ArrowRight, LogOut } from 'lucide-react'

export default function MobileMenu() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuthStore()

  const handleNavigate = () => setOpen(false)

  const visibleLinks = user
    ? SITE_CONFIG.navLinks.filter((l) => !l.roles || l.roles.some((r) => r === user!.role))
    : []

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto p-0">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 px-6 pt-8 pb-6">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-2xl">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Pay</span>
              Sync
            </SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground">Digital Payments Cloud Platform</p>
        </div>

        <Separator />

        <nav className="flex flex-col gap-0.5 px-3 py-3">
          {visibleLinks.map((item, i) => {
            const isActive = location.pathname === item.href
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={item.href}
                  onClick={handleNavigate}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {item.label}
                  {isActive && <ArrowRight className="h-3.5 w-3.5" />}
                </Link>
              </motion.div>
            )
          })}
          {user?.role === 'admin' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: visibleLinks.length * 0.05 }}
            >
              <Link
                to={ROUTES.ADMIN}
                onClick={handleNavigate}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  location.pathname === ROUTES.ADMIN
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Admin Panel
                {location.pathname === ROUTES.ADMIN && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            </motion.div>
          )}
        </nav>

        <Separator className="mx-3" />

        {isAuthenticated && user ? (
          <div className="mx-3 mt-3 space-y-1">
            <button
              onClick={() => { logout(); handleNavigate() }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        ) : (
          <div className="mx-4 mt-4 flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full" onClick={handleNavigate}>
              <Link to={ROUTES.LOGIN}>Sign In</Link>
            </Button>
            <Button asChild className="w-full" onClick={handleNavigate}>
              <Link to={ROUTES.REGISTER}>Create Account</Link>
            </Button>
          </div>
        )}

        <div className="mt-4 border-t px-4 py-4">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">Toggle theme</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
