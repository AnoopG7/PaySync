import { ROUTES } from './routes'

export const SITE_CONFIG = {
  name: 'PaySync',
  tagline: 'Digital Payments Cloud Platform',
  description:
    'Centralized operational management, analytics, reporting, secure access control, and monitoring for PaySync Digital Payments & FinTech operations.',
  url: 'https://paysync.cloud',
  contact: {
    email: 'ops@paysync.cloud',
    phone: '+1 (555) 789-0123',
    address: '100 Financial District, Suite 800, San Francisco, CA 94105',
  },
  navLinks: [
    { label: 'Dashboard', href: ROUTES.DASHBOARD, roles: ['admin', 'manager', 'staff'] },
    { label: 'Reports', href: ROUTES.REPORTS, roles: ['admin', 'manager'] },
    { label: 'Workflows', href: ROUTES.WORKFLOWS, roles: ['admin', 'manager', 'staff'] },
    { label: 'Monitoring', href: ROUTES.MONITORING, roles: ['admin', 'manager'] },
    { label: 'Executive', href: ROUTES.EXECUTIVE, roles: ['admin', 'manager'] },
    { label: 'Regions', href: ROUTES.REGIONS, roles: ['admin', 'manager'] },
    { label: 'Pricing', href: ROUTES.PRICING, roles: ['admin', 'manager', 'staff'] },
  ],
  adminLinks: [
    { label: 'Admin Panel', href: ROUTES.ADMIN },
  ],
} as const
