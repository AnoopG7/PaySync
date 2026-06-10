import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, UserCog, Users, Activity } from 'lucide-react'
import { ComingSoon, PageMeta } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  region: string
}

const MOCK_USERS: User[] = [
  { id: '1', firstName: 'Admin', lastName: 'User', email: 'admin@paysync.cloud', role: 'admin', region: 'us-east-1' },
  { id: '2', firstName: 'Jane', lastName: 'Manager', email: 'manager@paysync.cloud', role: 'manager', region: 'us-east-1' },
  { id: '3', firstName: 'John', lastName: 'Staff', email: 'staff@paysync.cloud', role: 'staff', region: 'us-west-1' },
  { id: '4', firstName: 'Sarah', lastName: 'Chen', email: 'sarah@paysync.cloud', role: 'manager', region: 'eu-west-1' },
  { id: '5', firstName: 'Mike', lastName: 'Johnson', email: 'mike@paysync.cloud', role: 'staff', region: 'us-east-1' },
  { id: '6', firstName: 'Priya', lastName: 'Patel', email: 'priya@paysync.cloud', role: 'staff', region: 'ap-southeast-1' },
]

export default function Admin() {
  const [users] = useState(MOCK_USERS)

  return (
    <>
      <PageMeta title="Admin Panel — PaySync Cloud" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-muted-foreground">User management, RBAC, and system configuration</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1.5"><Shield className="mr-1 h-4 w-4" /> Admin Access</Badge>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admins</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-500">{users.filter((u) => u.role === 'admin').length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Managers</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-500">{users.filter((u) => u.role === 'manager').length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Staff</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-muted-foreground">{users.filter((u) => u.role === 'staff').length}</p></CardContent></Card>
        </motion.div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> User Management</TabsTrigger>
            <TabsTrigger value="roles"><UserCog className="mr-2 h-4 w-4" /> Role-Based Access</TabsTrigger>
            <TabsTrigger value="audit"><Activity className="mr-2 h-4 w-4" /> Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Email</th>
                        <th className="px-4 py-3 text-left font-medium">Role</th>
                        <th className="px-4 py-3 text-left font-medium">Region</th>
                        <th className="px-4 py-3 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3"><Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'manager' ? 'default' : 'secondary'} className="capitalize">{u.role}</Badge></td>
                          <td className="px-4 py-3 font-mono text-xs">{u.region}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <ComingSoon><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Edit</Button></ComingSoon>
                              <ComingSoon><Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive">Disable</Button></ComingSoon>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { role: 'Admin', users: 1, permissions: ['Full system access', 'User management', 'Billing & pricing', 'Infrastructure config', 'All reports'], color: 'border-red-500/50 bg-red-500/5' },
                { role: 'Manager', users: 2, permissions: ['Dashboard & KPIs', 'Reports & analytics', 'Workflow approvals', 'Monitoring view', 'Regional management'], color: 'border-blue-500/50 bg-blue-500/5' },
                { role: 'Staff', users: 3, permissions: ['Dashboard view', 'Task management', 'Basic reports', 'Profile management', 'Alert acknowledgments'], color: 'border-muted bg-muted/30' },
              ].map((r) => (
                <Card key={r.role} className={r.color}>
                  <CardHeader><CardTitle className="capitalize">{r.role}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="mb-3 text-sm text-muted-foreground">{r.users} user{r.users > 1 ? 's' : ''}</p>
                    <ul className="space-y-2">
                      {r.permissions.map((p) => (
                        <li key={p} className="flex items-center gap-2 text-sm"><Shield className="h-3.5 w-3.5 text-primary" /> {p}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardHeader><CardTitle>Audit Log</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Complete audit trail of all administrative actions, user access changes, and system configuration modifications for compliance and data integrity.</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
