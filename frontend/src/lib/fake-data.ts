// ── Fake data generators for PaySync Digital Payments Cloud ────────────────

import { faker } from '@faker-js/faker'

let txCounter = 1000
let taskCounter = 200
let alertCounter = 50

export function generateTransaction() {
  return {
    id: `TXN-${++txCounter}`,
    amount: parseFloat(faker.finance.amount({ min: 10, max: 50000 })),
    currency: 'USD',
    status: faker.helpers.arrayElement(['completed', 'pending', 'processing', 'failed']),
    type: faker.helpers.arrayElement(['payment', 'refund', 'payout', 'transfer']),
    merchant: faker.company.name(),
    region: faker.helpers.arrayElement(['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1']),
    timestamp: faker.date.recent({ days: 7 }),
  }
}

export function generateKPIs() {
  return {
    totalTransactions: faker.number.int({ min: 15000, max: 50000 }),
    successRate: faker.number.float({ min: 95, max: 99.9, fractionDigits: 1 }),
    activeUsers: faker.number.int({ min: 120, max: 450 }),
    pendingApprovals: faker.number.int({ min: 3, max: 28 }),
    systemUptime: faker.number.float({ min: 99.5, max: 99.99, fractionDigits: 2 }),
    avgResponseTime: faker.number.int({ min: 45, max: 250 }),
    revenueToday: faker.number.float({ min: 25000, max: 180000 }),
    activeRegions: 4,
  }
}

export function generateSystemMetrics() {
  return {
    cpu: faker.number.float({ min: 15, max: 95, fractionDigits: 1 }),
    memory: faker.number.float({ min: 30, max: 92, fractionDigits: 1 }),
    disk: faker.number.float({ min: 25, max: 88, fractionDigits: 1 }),
    networkIn: faker.number.float({ min: 50, max: 950, fractionDigits: 1 }),
    networkOut: faker.number.float({ min: 20, max: 600, fractionDigits: 1 }),
    dbConnections: faker.number.int({ min: 12, max: 85 }),
    requestsPerMin: faker.number.int({ min: 200, max: 3500 }),
  }
}

export function generateTask() {
  return {
    id: `TASK-${++taskCounter}`,
    title: faker.helpers.arrayElement([
      'Approve pending transactions batch',
      'Review monthly compliance report',
      'Update firewall rules for new region',
      'Deploy database backup to DR site',
      'Audit user access permissions',
      'Verify SSL certificate renewal',
      'Review cost optimization recommendations',
      'Approve new merchant onboarding',
    ]),
    description: faker.lorem.sentence(),
    assignee: faker.person.fullName(),
    priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
    status: faker.helpers.arrayElement(['pending', 'in_progress', 'completed']),
    dueDate: faker.date.soon({ days: 14 }),
    createdBy: faker.person.fullName(),
  }
}

export function generateAlert() {
  return {
    id: `ALT-${++alertCounter}`,
    type: faker.helpers.arrayElement(['cpu', 'memory', 'disk', 'network', 'application', 'security']),
    severity: faker.helpers.arrayElement(['info', 'warning', 'critical']),
    message: faker.helpers.arrayElement([
      'CPU utilization exceeded 85% threshold',
      'Memory usage above 90% on primary instance',
      'Disk space running low on /data volume',
      'Unusual network traffic detected',
      'Application response time degraded',
      'Failed login attempts exceeding threshold',
      'SSL certificate expiring in 7 days',
      'Database connection pool exhausted',
    ]),
    region: faker.helpers.arrayElement(['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1']),
    timestamp: faker.date.recent({ days: 2 }),
    acknowledged: faker.datatype.boolean(0.4),
  }
}

export function generateTransactions(count = 20) {
  return Array.from({ length: count }, generateTransaction)
}

export function generateTasks(count = 10) {
  return Array.from({ length: count }, generateTask)
}

export function generateAlerts(count = 8) {
  return Array.from({ length: count }, generateAlert)
}

export function generateTimeSeriesData(points = 24) {
  return Array.from({ length: points }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    value: faker.number.float({ min: 30, max: 95, fractionDigits: 1 }),
  }))
}

export const REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)', status: 'healthy', instances: 24, load: 62, latency: 12 },
  { id: 'us-west-1', name: 'US West (Oregon)', status: 'healthy', instances: 18, load: 45, latency: 18 },
  { id: 'eu-west-1', name: 'EU West (Ireland)', status: 'healthy', instances: 15, load: 38, latency: 45 },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', status: 'degraded', instances: 10, load: 78, latency: 120 },
]

export const PRICING_DATA = {
  compute: [
    { tier: 'Bronze', instance: 't3.medium', vCPU: 2, memory: '4 GB', monthly: 30.0, hourly: 0.0416, sla: '99.9%' },
    { tier: 'Silver', instance: 't3.large', vCPU: 2, memory: '8 GB', monthly: 60.0, hourly: 0.0832, sla: '99.95%' },
    { tier: 'Gold', instance: 'm5.large', vCPU: 2, memory: '8 GB', monthly: 70.0, hourly: 0.096, sla: '99.99%' },
    { tier: 'Platinum', instance: 'm5.xlarge', vCPU: 4, memory: '16 GB', monthly: 140.0, hourly: 0.192, sla: '99.995%' },
  ],
  storage: [
    { tier: 'Standard', type: 'gp3', pricePerGB: 0.08, iops: 3000, throughput: '125 MB/s' },
    { tier: 'Performance', type: 'io2', pricePerGB: 0.125, iops: 10000, throughput: '500 MB/s' },
  ],
  network: {
    intraRegion: 0.01,
    crossRegion: 0.02,
    internet: 0.09,
  },
  backup: {
    standard: { monthly: 0.05, retention: '30 days', rpo: '1 hour', rto: '4 hours' },
    enhanced: { monthly: 0.10, retention: '90 days', rpo: '5 minutes', rto: '1 hour' },
    premium: { monthly: 0.20, retention: '365 days', rpo: '1 minute', rto: '15 minutes' },
  },
  monitoring: [
    { tier: 'Basic', metrics: '10', retention: '7 days', alerts: '5', monthly: 15 },
    { tier: 'Standard', metrics: '25', retention: '30 days', alerts: '20', monthly: 45 },
    { tier: 'Enterprise', metrics: 'Unlimited', retention: '90 days', alerts: 'Unlimited', monthly: 100 },
  ],
}
