import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Calculator } from 'lucide-react'
import { PageMeta } from '@/components/common'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRICING_DATA } from '@/lib/fake-data'

export default function Pricing() {
  const [activeTab, setActiveTab] = useState('compute')
  const [estimate, setEstimate] = useState<{ instances: string; storage: string; region: string; monitoring: string }>({
    instances: '3',
    storage: '500',
    region: '1',
    monitoring: 'basic',
  })
  const [total, setTotal] = useState<number | null>(null)

  const calcEstimate = () => {
    const computeCost = PRICING_DATA.compute[1].monthly * Number(estimate.instances)
    const storageCost = PRICING_DATA.storage[0].pricePerGB * Number(estimate.storage)
    const regionMultiplier = Number(estimate.region)
    const monitoringCost = PRICING_DATA.monitoring.find((m) => m.tier.toLowerCase() === estimate.monitoring)?.monthly || 20
    const backupCost = PRICING_DATA.backup.standard.monthly * Number(estimate.storage)
    const base = (computeCost + storageCost + monitoringCost + backupCost) * regionMultiplier
    setTotal(Math.round(base))
  }

  return (
    <>
      <PageMeta title="Pricing — PaySync Cloud" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Infrastructure Pricing</h1>
          <p className="text-muted-foreground">Cost estimates covering compute, storage, networking, and DR</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="compute">Compute</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="backup">Backup & DR</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="compute" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PRICING_DATA.compute.map((item) => (
                <motion.div key={item.tier} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`relative ${item.tier === 'Gold' ? 'border-primary' : ''}`}>
                    {item.tier === 'Gold' && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge>Recommended</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{item.tier}</CardTitle>
                      <CardDescription>{item.instance}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">${item.monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="mt-4 space-y-2 text-sm">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.vCPU} vCPU</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.memory} Memory</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.sla} SLA</li>
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {PRICING_DATA.storage.map((item) => (
                <Card key={item.tier}>
                  <CardHeader><CardTitle>{item.tier} — {item.type}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">${item.pricePerGB}<span className="text-sm font-normal text-muted-foreground">/GB/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.iops.toLocaleString()} IOPS</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.throughput} Throughput</li>
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="network" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Network Transfer Costs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Intra-Region', cost: PRICING_DATA.network.intraRegion, desc: 'Data transfer within the same region' },
                    { label: 'Cross-Region', cost: PRICING_DATA.network.crossRegion, desc: 'Data transfer between different regions' },
                    { label: 'Internet Egress', cost: PRICING_DATA.network.internet, desc: 'Data transfer to internet' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <p className="text-2xl font-bold">${item.cost}<span className="text-sm font-normal text-muted-foreground">/GB</span></p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(PRICING_DATA.backup).map(([tier, data]) => (
                <Card key={tier}>
                  <CardHeader><CardTitle className="capitalize">{tier}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">${data.monthly}<span className="text-sm font-normal text-muted-foreground">/GB/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Retention: {data.retention}</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> RPO: {data.rpo}</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> RTO: {data.rto}</li>
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="monitoring" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {PRICING_DATA.monitoring.map((item) => (
                <Card key={item.tier}>
                  <CardHeader><CardTitle>{item.tier}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">${item.monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-sm">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.metrics} Metrics</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.retention} Retention</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {item.alerts} Alerts</li>
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="calculator" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle><Calculator className="mr-2 inline h-5 w-5" /> Cost Estimator</CardTitle><CardDescription>Estimate your monthly infrastructure costs</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Compute Instances</Label>
                    <Input type="number" value={estimate.instances} onChange={(e) => setEstimate((p) => ({ ...p, instances: e.target.value }))} min={1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage (GB)</Label>
                    <Input type="number" value={estimate.storage} onChange={(e) => setEstimate((p) => ({ ...p, storage: e.target.value }))} min={10} />
                  </div>
                  <div className="space-y-2">
                    <Label>Regions</Label>
                    <Select value={estimate.region} onValueChange={(v) => setEstimate((p) => ({ ...p, region: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Region</SelectItem>
                        <SelectItem value="2">2 Regions</SelectItem>
                        <SelectItem value="3">3 Regions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monitoring Tier</Label>
                    <Select value={estimate.monitoring} onValueChange={(v) => setEstimate((p) => ({ ...p, monitoring: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic — $15/mo</SelectItem>
                        <SelectItem value="standard">Standard — $45/mo</SelectItem>
                        <SelectItem value="enterprise">Enterprise — $100/mo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={calcEstimate}>Calculate Estimate</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {total !== null ? (
                    <div className="space-y-4">
                      <p className="text-4xl font-bold">${total.toLocaleString()}<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
                      <div className="space-y-3">
                        {[
                          { label: 'Compute', value: PRICING_DATA.compute[1].monthly * Number(estimate.instances), color: 'bg-blue-500' },
                          { label: 'Storage', value: PRICING_DATA.storage[0].pricePerGB * Number(estimate.storage), color: 'bg-emerald-500' },
                          { label: 'Monitoring', value: PRICING_DATA.monitoring.find((m) => m.tier.toLowerCase() === estimate.monitoring)?.monthly || 20, color: 'bg-purple-500' },
                          { label: 'Backup', value: PRICING_DATA.backup.standard.monthly * Number(estimate.storage), color: 'bg-orange-500' },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="mb-1 flex justify-between text-sm">
                              <span>{item.label}</span>
                              <span className="font-medium">${Math.round(item.value).toLocaleString()}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / total) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm">
                        <p className="font-medium text-primary">Optimization Tip</p>
                        <p className="text-muted-foreground">Switching to reserved instances could save ~30% on compute costs. Consider multi-year commitments for production workloads.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
                      <div className="text-center">
                        <Calculator className="mx-auto mb-2 h-8 w-8" />
                        <p>Enter your requirements and click</p>
                        <p className="font-medium">&quot;Calculate Estimate&quot;</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
