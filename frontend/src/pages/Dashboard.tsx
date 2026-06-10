import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Users, CheckCircle2, Clock, DollarSign, TrendingUp } from 'lucide-react'
import { PageMeta, StatCard } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store'

interface KPI {
  totalTransactions: number
  successRate: number
  activeUsers: number
  pendingApprovals: number
  systemUptime: number
  avgResponseTime: number
  revenueToday: number
  activeRegions: number
}

interface Transaction {
  id: string
  amount: number
  status: string
  type: string
  merchant: string
  region: string
}

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  requestsPerMin: number
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  useEffect(() => {
    api.getKPIs().then(setKpi)
    api.getRecentTransactions(8).then(setTransactions)
    api.getSystemMetrics().then(setMetrics)
  }, [])

  const statCards = kpi ? [
    { title: 'Total Transactions', value: kpi.totalTransactions.toLocaleString(), icon: Activity, change: '+12.5%', changeType: 'up' as const },
    { title: 'Success Rate', value: `${kpi.successRate}%`, icon: TrendingUp, change: '+0.8%', changeType: 'up' as const },
    { title: 'Active Users', value: kpi.activeUsers.toString(), icon: Users, change: '+5.2%', changeType: 'up' as const },
    { title: 'Revenue Today', value: `$${kpi.revenueToday.toLocaleString()}`, icon: DollarSign, change: '+8.3%', changeType: 'up' as const },
    { title: 'System Uptime', value: `${kpi.systemUptime}%`, icon: CheckCircle2, change: '99.9% SLA', changeType: 'up' as const },
    { title: 'Avg Response Time', value: `${kpi.avgResponseTime}ms`, icon: Clock, change: '-15ms', changeType: 'up' as const },
  ] : []

  return (
    <>
      <PageMeta title="Dashboard — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Operational Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.firstName} · {user?.region}
            </p>
          </div>
          <Badge variant="outline" className="capitalize text-sm px-3 py-1.5">
            {user?.role} Access
          </Badge>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          {statCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="space-y-4">
                  {[
                    { label: 'CPU', value: metrics.cpu, color: metrics.cpu > 80 ? 'bg-red-500' : metrics.cpu > 60 ? 'bg-yellow-500' : 'bg-emerald-500' },
                    { label: 'Memory', value: metrics.memory, color: metrics.memory > 80 ? 'bg-red-500' : metrics.memory > 60 ? 'bg-yellow-500' : 'bg-emerald-500' },
                    { label: 'Disk', value: metrics.disk, color: metrics.disk > 80 ? 'bg-red-500' : metrics.disk > 60 ? 'bg-yellow-500' : 'bg-emerald-500' },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{m.label}</span>
                        <span className="font-medium">{m.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-all duration-500 ${m.color}`} style={{ width: `${m.value}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-sm text-muted-foreground">
                    Requests/min: <span className="font-medium text-foreground">{metrics.requestsPerMin.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="h-32 animate-pulse rounded-lg bg-muted" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{tx.merchant}</p>
                      <p className="text-xs text-muted-foreground">{tx.id} · {tx.type}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-medium">${tx.amount.toLocaleString()}</p>
                      <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} className="text-xs capitalize">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
