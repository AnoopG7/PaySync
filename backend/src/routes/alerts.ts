import { Router, Request, Response } from 'express'
import db from '../db/connection.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db('alerts').orderBy('timestamp', 'desc')
    res.json(rows.map((a: any) => ({
      id: a.alert_id,
      type: a.type,
      severity: a.severity,
      message: a.message,
      region: a.region,
      timestamp: a.timestamp,
      acknowledged: Boolean(a.acknowledged),
    })))
  } catch (err) {
    console.error('Alerts error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
