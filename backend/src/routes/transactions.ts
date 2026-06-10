import { Router, Request, Response } from 'express'
import db from '../db/connection.js'

const router = Router()

function mapTx(t: any) {
  return {
    id: t.txn_id,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    type: t.type,
    merchant: t.merchant,
    region: t.region,
    timestamp: t.timestamp,
  }
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db('transactions').orderBy('timestamp', 'desc').limit(100)
    res.json(rows.map(mapTx))
  } catch (err) {
    console.error('Transactions error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/report', async (_req: Request, res: Response) => {
  try {
    const rows = await db('transactions').orderBy('timestamp', 'desc')
    res.json(rows.map((t: any) => ({
      id: t.txn_id,
      amount: Number(t.amount),
      status: t.status,
      type: t.type,
      merchant: t.merchant,
      region: t.region,
    })))
  } catch (err) {
    console.error('Report error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
