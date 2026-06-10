const API_BASE = 'http://localhost:3001/api'

function getToken(): string | null {
  try {
    return localStorage.getItem('paysync_token')
  } catch {
    return null
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  getKPIs: () => request<any>('/kpis'),
  getSystemMetrics: () => request<any>('/metrics'),
  getRecentTransactions: (count = 10) =>
    request<any[]>('/transactions').then((txns) => txns.slice(0, count)),
  getTimeSeries: (_metric: string, _points = 24) =>
    request<any[]>('/kpis'),

  getTransactionReport: () => request<any[]>('/transactions'),
  getActivityLog: () => request<any[]>('/transactions').then((txns) => txns.slice(0, 15)),

  getTasks: () => request<any[]>('/tasks'),
  createTask: (_data: unknown) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(_data) }),
  approveTask: (_id: string) => request<any>(`/tasks/${_id}/approve`, { method: 'POST' }),

  getMetrics: () => request<any>('/metrics'),
  getAlerts: () => request<any[]>('/alerts'),
  acknowledgeAlert: (_id: string) => request<any>(`/alerts/${_id}/ack`, { method: 'POST' }),
}
