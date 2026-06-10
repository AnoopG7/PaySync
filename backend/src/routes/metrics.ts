import { Router, Request, Response } from 'express'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json({
      cpu: Math.round((Math.random() * 40 + 30) * 10) / 10,
      memory: Math.round((Math.random() * 35 + 40) * 10) / 10,
      disk: Math.round((Math.random() * 30 + 35) * 10) / 10,
      networkIn: Math.round((Math.random() * 400 + 100) * 10) / 10,
      networkOut: Math.round((Math.random() * 200 + 50) * 10) / 10,
      dbConnections: Math.floor(Math.random() * 40 + 15),
      requestsPerMin: Math.floor(Math.random() * 1500 + 500),
    })
  } catch (err) {
    console.error('Metrics error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
