import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  change?: string
  changeType?: 'up' | 'down'
  className?: string
}

export default function StatCard({ title, value, icon: Icon, change, changeType, className }: StatCardProps) {
  return (
    <motion.div
      className={cn('rounded-xl border bg-card p-4 card-hover', className)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {change && (
        <p className={cn('mt-1 text-xs', changeType === 'up' ? 'text-emerald-500' : 'text-red-500')}>
          {changeType === 'up' ? '↑' : '↓'} {change}
        </p>
      )}
    </motion.div>
  )
}
