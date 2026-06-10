import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Bell, Cpu, HardDrive, MemoryStick, Network } from 'lucide-react'
import { ComingSoon, PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface Metrics {
  cpu: number
  memory: number
  disk: number
  networkIn: number
  networkOut: number
  dbConnections: number
  requestsPerMin: number
}

interface Alert {
  id: string
  type: string
  severity: string
  message: string
  region: string
  timestamp: Date
  acknowledged: boolean
}

export default function Monitoring() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    api.getMetrics().then(setMetrics)
    api.getAlerts().then(setAlerts)
  }, [])

  const metricColor = (val: number) => val > 80 ? 'text-red-500' : val > 60 ? 'text-yellow-500' : 'text-emerald-500'

  return (
    <>
      <PageMeta title="Monitoring & Alerts — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoring & Alerts</h1>
            <p className="text-muted-foreground">Real-time system metrics and proactive incident response</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1.5">
            {alerts.filter((a) => !a.acknowledged).length} unacknowledged
          </Badge>
        </div>

        {metrics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${metricColor(metrics.cpu)}`}>{metrics.cpu}%</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${metrics.cpu > 80 ? 'bg-red-500' : metrics.cpu > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.cpu}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${metricColor(metrics.memory)}`}>{metrics.memory}%</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${metrics.memory > 80 ? 'bg-red-500' : metrics.memory > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.memory}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Disk</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${metricColor(metrics.disk)}`}>{metrics.disk}%</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${metrics.disk > 80 ? 'bg-red-500' : metrics.disk > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.disk}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Network</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{metrics.networkIn.toFixed(0)} MB/s</p>
                <p className="text-xs text-muted-foreground">Out: {metrics.networkOut.toFixed(0)} MB/s</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Resource Usage</CardTitle></CardHeader>
            <CardContent>
              {metrics ? (
                <div className="space-y-4">
                  {[
                    { label: 'CPU Utilization', value: metrics.cpu },
                    { label: 'Memory Usage', value: metrics.memory },
                    { label: 'Disk Usage', value: metrics.disk },
                    { label: 'DB Connections', value: Math.min(metrics.dbConnections / 100 * 100, 100), display: `${metrics.dbConnections} connections` },
                    { label: 'Requests/min', value: Math.min(metrics.requestsPerMin / 4000 * 100, 100), display: `${metrics.requestsPerMin.toLocaleString()} req/min` },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{m.label}</span>
                        <span className="font-medium">{m.display || `${m.value.toFixed(1)}%`}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-all ${m.value > 80 ? 'bg-red-500' : m.value > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${m.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Active Alerts</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className={`mt-0.5 rounded-full border p-1.5 ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : alert.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                      {alert.severity === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{alert.region}</span>
                        <span>·</span>
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        {alert.acknowledged && <Badge variant="outline" className="text-xs">Acknowledged</Badge>}
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <ComingSoon message="Ack — Coming Soon"><Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs">
                        Ack
                      </Button></ComingSoon>
                    )}
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
