import { Link } from 'react-router-dom'
import { SITE_CONFIG } from '@/constants/site-config'
import { ROUTES } from '@/constants/routes'
import { Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Pay</span>
              Sync
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Centralized cloud platform for PaySync Digital Payments & FinTech operations — operational management, analytics, monitoring, and secure access control.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Platform</h4>
            <ul className="space-y-2.5">
              <li><Link to={ROUTES.DASHBOARD} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link></li>
              <li><Link to={ROUTES.REPORTS} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Reports</Link></li>
              <li><Link to={ROUTES.MONITORING} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Monitoring</Link></li>
              <li><Link to={ROUTES.PRICING} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Operations</h4>
            <ul className="space-y-2.5">
              <li><Link to={ROUTES.WORKFLOWS} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Workflows</Link></li>
              <li><Link to={ROUTES.EXECUTIVE} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Executive Portal</Link></li>
              <li><Link to={ROUTES.REGIONS} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Regions</Link></li>
              <li><Link to={ROUTES.ADMIN} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Admin</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Contact</h4>
            <div className="mb-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><span>{SITE_CONFIG.contact.email}</span></div>
              <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" /><span>{SITE_CONFIG.contact.phone}</span></div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{SITE_CONFIG.contact.address}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <p>&copy; {new Date().getFullYear()} PaySync Cloud. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
