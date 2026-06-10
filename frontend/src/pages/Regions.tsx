import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Plus, Server, Activity, Clock } from 'lucide-react'
import { ComingSoon, PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { REGIONS } from '@/lib/fake-data'

export default function Regions() {
  const [regions] = useState(REGIONS)

  const statusBadge = (status: string) => {
    const map: Record<string, 'default' | 'secondary' | 'destructive'> = {
      healthy: 'default',
      degraded: 'secondary',
      offline: 'destructive',
    }
    return map[status] || 'secondary'
  }

  return (
    <>
      <PageMeta title="Regions & Scalability — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Regions & Scalability</h1>
            <p className="text-muted-foreground">Multi-region deployment and expansion management</p>
          </div>
          <ComingSoon><Button><Plus className="mr-2 h-4 w-4" /> Add Region</Button></ComingSoon>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Regions</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{regions.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Instances</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{regions.reduce((s, r) => s + r.instances, 0)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Load</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{Math.round(regions.reduce((s, r) => s + r.load, 0) / regions.length)}%</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Latency</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{Math.round(regions.reduce((s, r) => s + r.latency, 0) / regions.length)}ms</p></CardContent></Card>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {regions.map((region, i) => (
            <motion.div key={region.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={region.status === 'degraded' ? 'border-yellow-500/50' : ''}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><Globe className="h-5 w-5 text-primary" /></div>
                    <div>
                      <CardTitle className="text-lg">{region.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{region.id}</p>
                    </div>
                  </div>
                  <Badge variant={statusBadge(region.status) as 'default' | 'secondary' | 'destructive'} className="capitalize">{region.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <Server className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-lg font-bold">{region.instances}</p>
                      <p className="text-xs text-muted-foreground">Instances</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <Activity className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-lg font-bold">{region.load}%</p>
                      <p className="text-xs text-muted-foreground">Load</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-lg font-bold">{region.latency}ms</p>
                      <p className="text-xs text-muted-foreground">Latency</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Expansion Planning</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { region: 'EU Central (Frankfurt)', eta: 'Q3 2026', priority: 'High' },
                { region: 'South America (São Paulo)', eta: 'Q4 2026', priority: 'Medium' },
                { region: 'Middle East (Bahrain)', eta: 'Q1 2027', priority: 'Low' },
              ].map((p) => (
                <div key={p.region} className="rounded-lg border p-4">
                  <h4 className="font-medium">{p.region}</h4>
                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>ETA: {p.eta}</span>
                    <Badge variant="outline">{p.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
