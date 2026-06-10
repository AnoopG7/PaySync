// ── Simulated API client (all data is fake/random) ─────────────────────────

import {
  generateKPIs,
  generateSystemMetrics,
  generateTransactions,
  generateTasks,
  generateAlerts,
  generateTimeSeriesData,
} from './fake-data'

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

export const api = {
  // Dashboard
  getKPIs: async () => { await delay(); return generateKPIs() },
  getSystemMetrics: async () => { await delay(); return generateSystemMetrics() },
  getRecentTransactions: async (count = 10) => { await delay(); return generateTransactions(count) },
  getTimeSeries: async (_metric: string, points = 24) => { await delay(); return generateTimeSeriesData(points) },

  // Reports
  getTransactionReport: async (_from?: string, _to?: string) => { await delay(600); return generateTransactions(30) },
  getActivityLog: async () => { await delay(600); return generateTransactions(15) },

  // Workflows
  getTasks: async () => { await delay(); return generateTasks(8) },
  createTask: async (_data: unknown) => { await delay(); return { id: `TASK-${Date.now()}`, ..._data as object } },
  approveTask: async (_id: string) => { await delay(); return { success: true } },

  // Monitoring
  getMetrics: async () => { await delay(); return generateSystemMetrics() },
  getAlerts: async () => { await delay(); return generateAlerts(10) },
  acknowledgeAlert: async (_id: string) => { await delay(); return { success: true } },

  // Pricing
  getPricingEstimate: async (_params: unknown) => { await delay(600); return { total: 4850, breakdown: { compute: 2400, storage: 850, network: 600, backup: 500, monitoring: 500 } } },
}
