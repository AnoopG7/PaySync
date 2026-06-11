import { Router, Request, Response } from 'express'
import db from '../db/connection.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { total } = await db('transactions').count('* as total').first() || { total: 0 }
    const { success } = await db('transactions').where({ status: 'completed' }).count('* as success').first() || { success: 0 }
    const { failed } = await db('transactions').where({ status: 'failed' }).count('* as failed').first() || { failed: 0 }
    const { volume } = await db('transactions').sum('amount as volume').first() || { volume: 0 }

    const t = Number(total)
    const s = Number(success)

    res.json({
      totalTransactions: t,
      successRate: t > 0 ? Number(((s / t) * 100).toFixed(1)) : 100,
      activeUsers: 450,
      pendingApprovals: 12,
      systemUptime: 99.95,
      avgResponseTime: 85,
      revenueToday: Number(volume) * 0.15,
      activeRegions: 4,
    })
  } catch (err) {
    console.error('KPIs error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
