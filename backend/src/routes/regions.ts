import { Router, Request, Response } from 'express'
import db from '../db/connection.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db('regions')
    res.json(rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      instances: r.instances,
      load: r.load_pct,
      latency: r.latency_ms,
    })))
  } catch (err) {
    console.error('Regions error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
