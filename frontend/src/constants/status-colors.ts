export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  active: 'bg-emerald-500',
  approved: 'bg-blue-500',
  rejected: 'bg-red-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  processing: 'bg-cyan-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
  healthy: 'bg-emerald-500',
  degraded: 'bg-yellow-500',
  offline: 'bg-gray-500',
}

export const statusBadgeVariant: Record<string, string> = {
  pending: 'warning',
  active: 'success',
  approved: 'info',
  rejected: 'destructive',
  completed: 'success',
  failed: 'destructive',
  processing: 'info',
  warning: 'warning',
  critical: 'destructive',
  healthy: 'success',
  degraded: 'warning',
  offline: 'secondary',
}
