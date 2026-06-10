import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Activity, Users, Globe, DollarSign } from 'lucide-react'
import { PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

interface KPI {
  totalTransactions: number
  successRate: number
  activeUsers: number
  systemUptime: number
  revenueToday: number
  activeRegions: number
}

export default function Executive() {
  const [kpi, setKpi] = useState<KPI | null>(null)

  useEffect(() => {
    api.getKPIs().then(setKpi)
  }, [])

  const regionData = kpi ? [
    { region: 'US East', txns: Math.round(kpi.totalTransactions * 0.42), revenue: Math.round(kpi.revenueToday * 0.45), growth: 12.3, health: 'healthy' as const },
    { region: 'US West', txns: Math.round(kpi.totalTransactions * 0.28), revenue: Math.round(kpi.revenueToday * 0.25), growth: 8.7, health: 'healthy' as const },
    { region: 'EU West', txns: Math.round(kpi.totalTransactions * 0.18), revenue: Math.round(kpi.revenueToday * 0.18), growth: 15.2, health: 'healthy' as const },
    { region: 'Asia Pacific', txns: Math.round(kpi.totalTransactions * 0.12), revenue: Math.round(kpi.revenueToday * 0.12), growth: 22.1, health: 'degraded' as const },
  ] : []

  return (
    <>
      <PageMeta title="Executive Portal — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executive Portal</h1>
            <p className="text-muted-foreground">Aggregated performance insights for leadership</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Badge>
        </div>

        {kpi && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenue Today</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">${kpi.revenueToday.toLocaleString()}</p><p className="flex items-center gap-1 text-xs text-emerald-500"><TrendingUp className="h-3 w-3" /> +12.3% vs last week</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Transactions</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{kpi.totalTransactions.toLocaleString()}</p><p className="flex items-center gap-1 text-xs text-emerald-500"><TrendingUp className="h-3 w-3" /> +8.5% MoM</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Users</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{kpi.activeUsers}</p><p className="flex items-center gap-1 text-xs text-emerald-500"><TrendingUp className="h-3 w-3" /> +5.2% MoM</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">System Uptime</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{kpi.systemUptime}%</p><p className="flex items-center gap-1 text-xs text-emerald-500"><TrendingUp className="h-3 w-3" /> 99.9% SLA met</p></CardContent>
              </Card>
            </motion.div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="regions">Regional Performance</TabsTrigger>
                <TabsTrigger value="growth">Growth Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {regionData.map((r) => (
                          <div key={r.region}>
                            <div className="mb-1 flex justify-between text-sm">
                              <span>{r.region}</span>
                              <span className="font-medium">${r.revenue.toLocaleString()}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.revenue / kpi.revenueToday) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Key Metrics</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { label: 'Success Rate', value: `${kpi.successRate}%`, trend: '+0.8%', icon: Activity },
                          { label: 'Active Regions', value: String(kpi.activeRegions), trend: '+1 this quarter', icon: Globe },
                          { label: 'Avg Transaction Value', value: `$${(kpi.revenueToday / kpi.totalTransactions).toFixed(2)}`, trend: '+3.2%', icon: DollarSign },
                          { label: 'User Growth', value: '+15.4%', trend: 'MoM increase', icon: Users },
                        ].map((m) => (
                          <div key={m.label} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="rounded-md bg-primary/10 p-2"><m.icon className="h-4 w-4 text-primary" /></div>
                              <div><p className="text-sm font-medium">{m.label}</p><p className="text-xs text-muted-foreground">{m.trend}</p></div>
                            </div>
                            <p className="text-lg font-bold">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="regions" className="mt-4">
                <Card>
                  <CardHeader><CardTitle>Regional Performance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left font-medium">Region</th>
                            <th className="px-4 py-3 text-left font-medium">Transactions</th>
                            <th className="px-4 py-3 text-left font-medium">Revenue Share</th>
                            <th className="px-4 py-3 text-left font-medium">Growth</th>
                            <th className="px-4 py-3 text-left font-medium">Health</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regionData.map((r) => (
                            <tr key={r.region} className="border-b transition-colors hover:bg-muted/30">
                              <td className="px-4 py-3 font-medium">{r.region}</td>
                              <td className="px-4 py-3">{r.txns.toLocaleString()}</td>
                              <td className="px-4 py-3">{((r.revenue / kpi.revenueToday) * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-1 text-emerald-500">
                                  <TrendingUp className="h-3 w-3" /> {r.growth}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="capitalize">{r.health}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="growth" className="mt-4">
                <Card><CardHeader><CardTitle>Growth Metrics</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Month-over-month and quarter-over-quarter growth analysis across all metrics. Revenue is projected to increase 18% next quarter based on current trends.</p></CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  )
}
