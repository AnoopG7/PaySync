import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'

export async function seed(knex: Knex) {
  const existing = await knex('users').first()
  if (existing) {
    console.log('Database already seeded, skipping')
    return
  }

  console.log('Seeding database...')

  const hash = await bcrypt.hash('admin123', 10)
  const mHash = await bcrypt.hash('manager123', 10)
  const sHash = await bcrypt.hash('staff123', 10)

  await knex('users').insert([
    { first_name: 'Admin', last_name: 'User', email: 'admin@paysync.cloud', password_hash: hash, role: 'admin', region: 'us-east-1' },
    { first_name: 'Jane', last_name: 'Manager', email: 'manager@paysync.cloud', password_hash: mHash, role: 'manager', region: 'us-east-1' },
    { first_name: 'John', last_name: 'Staff', email: 'staff@paysync.cloud', password_hash: sHash, role: 'staff', region: 'us-west-1' },
    { first_name: 'Sarah', last_name: 'Chen', email: 'sarah@paysync.cloud', password_hash: mHash, role: 'manager', region: 'eu-west-1' },
    { first_name: 'Mike', last_name: 'Johnson', email: 'mike@paysync.cloud', password_hash: sHash, role: 'staff', region: 'us-east-1' },
    { first_name: 'Priya', last_name: 'Patel', email: 'priya@paysync.cloud', password_hash: sHash, role: 'staff', region: 'ap-southeast-1' },
  ])

  await knex('transactions').insert([
    { txn_id: 'TXN-1001', amount: 1500.00, status: 'completed', type: 'payment', merchant: 'TechStore Inc', region: 'us-east-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1002', amount: 250.00, status: 'completed', type: 'refund', merchant: 'GlobalShop', region: 'us-west-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1003', amount: 8200.00, status: 'pending', type: 'transfer', merchant: 'FinanceHub LLC', region: 'eu-west-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1004', amount: 430.00, status: 'completed', type: 'payment', merchant: 'MegaMart', region: 'us-east-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1005', amount: 12000.00, status: 'processing', type: 'payout', merchant: 'PayFast', region: 'ap-southeast-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1006', amount: 780.00, status: 'failed', type: 'payment', merchant: 'QuickCart', region: 'us-east-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1007', amount: 3400.00, status: 'completed', type: 'transfer', merchant: 'BizPay Solutions', region: 'eu-west-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1008', amount: 950.00, status: 'pending', type: 'refund', merchant: 'ShopEasy', region: 'us-west-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1009', amount: 5600.00, status: 'completed', type: 'payment', merchant: 'DataFlow Systems', region: 'ap-southeast-1', timestamp: knex.fn.now() },
    { txn_id: 'TXN-1010', amount: 2100.00, status: 'completed', type: 'payout', merchant: 'CloudPay', region: 'us-east-1', timestamp: knex.fn.now() },
  ])

  await knex('tasks').insert([
    { task_id: 'TASK-201', title: 'Approve pending transactions batch', description: 'Review and approve batch of 50 pending transactions', assignee: 'Jane Manager', priority: 'high', status: 'pending', due_date: knex.fn.now(), created_by: 'Admin User' },
    { task_id: 'TASK-202', title: 'Review monthly compliance report', description: 'Review regulatory compliance report for Q2', assignee: 'Jane Manager', priority: 'critical', status: 'in_progress', due_date: knex.fn.now(), created_by: 'Admin User' },
    { task_id: 'TASK-203', title: 'Update firewall rules for new region', description: 'Configure security groups for ap-southeast-1 expansion', assignee: 'Admin User', priority: 'high', status: 'in_progress', due_date: knex.fn.now(), created_by: 'Admin User' },
    { task_id: 'TASK-204', title: 'Deploy database backup to DR site', description: 'Execute cross-region DB snapshot replication', assignee: 'John Staff', priority: 'medium', status: 'pending', due_date: knex.fn.now(), created_by: 'Jane Manager' },
    { task_id: 'TASK-205', title: 'Audit user access permissions', description: 'Quarterly review of all user roles and permissions', assignee: 'Admin User', priority: 'medium', status: 'completed', due_date: knex.fn.now(), created_by: 'System' },
    { task_id: 'TASK-206', title: 'Verify SSL certificate renewal', description: 'Check SSL certs expiring next month across all regions', assignee: 'Mike Johnson', priority: 'low', status: 'pending', due_date: knex.fn.now(), created_by: 'Admin User' },
    { task_id: 'TASK-207', title: 'Review cost optimization recommendations', description: 'Analyze reserved instance recommendations', assignee: 'Sarah Chen', priority: 'medium', status: 'in_progress', due_date: knex.fn.now(), created_by: 'Jane Manager' },
    { task_id: 'TASK-208', title: 'Approve new merchant onboarding', description: 'Verify KYC docs for new merchant application', assignee: 'Jane Manager', priority: 'high', status: 'pending', due_date: knex.fn.now(), created_by: 'Admin User' },
  ])

  await knex('alerts').insert([
    { alert_id: 'ALT-51', type: 'cpu', severity: 'critical', message: 'CPU utilization exceeded 85% threshold', region: 'us-east-1', timestamp: knex.fn.now(), acknowledged: false },
    { alert_id: 'ALT-52', type: 'memory', severity: 'warning', message: 'Memory usage above 90% on primary instance', region: 'ap-southeast-1', timestamp: knex.fn.now(), acknowledged: false },
    { alert_id: 'ALT-53', type: 'disk', severity: 'warning', message: 'Disk space running low on /data volume', region: 'us-east-1', timestamp: knex.fn.now(), acknowledged: true },
    { alert_id: 'ALT-54', type: 'network', severity: 'info', message: 'Unusual network traffic detected', region: 'eu-west-1', timestamp: knex.fn.now(), acknowledged: false },
    { alert_id: 'ALT-55', type: 'application', severity: 'warning', message: 'Application response time degraded', region: 'us-west-1', timestamp: knex.fn.now(), acknowledged: true },
    { alert_id: 'ALT-56', type: 'security', severity: 'critical', message: 'Failed login attempts exceeding threshold', region: 'us-east-1', timestamp: knex.fn.now(), acknowledged: false },
    { alert_id: 'ALT-57', type: 'cpu', severity: 'info', message: 'SSL certificate expiring in 7 days', region: 'eu-west-1', timestamp: knex.fn.now(), acknowledged: true },
    { alert_id: 'ALT-58', type: 'memory', severity: 'warning', message: 'Database connection pool exhausted', region: 'ap-southeast-1', timestamp: knex.fn.now(), acknowledged: false },
  ])

  await knex('regions').insert([
    { id: 'us-east-1', name: 'US East (N. Virginia)', status: 'healthy', instances: 24, load_pct: 62, latency_ms: 12 },
    { id: 'us-west-1', name: 'US West (Oregon)', status: 'healthy', instances: 18, load_pct: 45, latency_ms: 18 },
    { id: 'eu-west-1', name: 'EU West (Ireland)', status: 'healthy', instances: 15, load_pct: 38, latency_ms: 45 },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', status: 'degraded', instances: 10, load_pct: 78, latency_ms: 120 },
  ])

  console.log('Database seeded successfully')
}
