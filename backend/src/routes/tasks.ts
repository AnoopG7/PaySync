import { Router, Request, Response } from 'express'
import db from '../db/connection.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await db('tasks').orderBy('created_at', 'desc')
    res.json(rows.map((t: any) => ({
      id: t.task_id,
      title: t.title,
      description: t.description,
      assignee: t.assignee,
      priority: t.priority,
      status: t.status,
      dueDate: t.due_date,
      createdBy: t.created_by,
    })))
  } catch (err) {
    console.error('Tasks error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
