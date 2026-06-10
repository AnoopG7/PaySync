import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Filter } from 'lucide-react'
import { ComingSoon, PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

interface Transaction {
  id: string
  amount: number
  status: string
  type: string
  merchant: string
  region: string
}

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    api.getTransactionReport().then(setTransactions)
  }, [])

  const totals = {
    completed: transactions.filter((t) => t.status === 'completed').length,
    pending: transactions.filter((t) => t.status === 'pending').length,
    failed: transactions.filter((t) => t.status === 'failed').length,
    volume: transactions.reduce((sum, t) => sum + t.amount, 0),
  }

  return (
    <>
      <PageMeta title="Reports & Analytics — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">Data-driven insights across all PaySync operations</p>
          </div>
          <div className="flex gap-2">
            <ComingSoon><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button></ComingSoon>
            <ComingSoon><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Export</Button></ComingSoon>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Volume</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">${totals.volume.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-500">{totals.completed}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-500">{totals.pending}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-500">{totals.failed}</p></CardContent></Card>
        </motion.div>

        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transaction Report</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">ID</th>
                        <th className="px-4 py-3 text-left font-medium">Merchant</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Amount</th>
                        <th className="px-4 py-3 text-left font-medium">Region</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 15).map((tx) => (
                        <tr key={tx.id} className="border-b transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{tx.id}</td>
                          <td className="px-4 py-3">{tx.merchant}</td>
                          <td className="px-4 py-3 capitalize">{tx.type}</td>
                          <td className="px-4 py-3 font-medium">${tx.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">{tx.region}</td>
                          <td className="px-4 py-3">
                            <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">
                              {tx.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card><CardHeader><CardTitle>User Activity Log</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Activity tracking and audit trail for all platform operations. Select a date range to filter.</p></CardContent></Card>
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <Card><CardHeader><CardTitle>System Health Report</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Historical system health metrics and performance trends across all regions.</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
