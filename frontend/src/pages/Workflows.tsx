import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import { ComingSoon, PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

interface Task {
  id: string
  title: string
  description: string
  assignee: string
  priority: string
  status: string
  dueDate: Date
}

export default function Workflows() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    api.getTasks().then(setTasks)
  }, [])

  const filtered = activeTab === 'all' ? tasks : tasks.filter((t) => t.status === activeTab)

  return (
    <>
      <PageMeta title="Workflows — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflow Management</h1>
            <p className="text-muted-foreground">Approval chains, task assignments, and process automation</p>
          </div>
          <ComingSoon><Button><Plus className="mr-2 h-4 w-4" /> New Task</Button></ComingSoon>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Tasks</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{tasks.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-500">{tasks.filter((t) => t.status === 'in_progress').length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-500">{tasks.filter((t) => t.status === 'pending').length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-500">{tasks.filter((t) => t.status === 'completed').length}</p></CardContent></Card>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader><CardTitle>Tasks & Approvals</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filtered.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No tasks found</p>
                  )}
                  {filtered.map((task) => (
                    <div key={task.id} className="flex items-start justify-between rounded-lg border p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge variant="outline" className="text-xs">{task.id}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Assignee: <span className="font-medium text-foreground">{task.assignee}</span></span>
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'} className="capitalize">
                          {task.status.replace('_', ' ')}
                        </Badge>
                        {task.status === 'pending' && (
                          <div className="flex gap-1">
                            <ComingSoon><Button size="sm" variant="outline" className="h-7 px-2"><CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />Approve</Button></ComingSoon>
                            <ComingSoon><Button size="sm" variant="outline" className="h-7 px-2"><XCircle className="mr-1 h-3 w-3 text-red-500" />Reject</Button></ComingSoon>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
