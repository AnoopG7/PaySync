import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db/connection.js'
import { signToken, authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' })
      return
    }

    const user = await db('users').where({ email }).first()
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const authUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      region: user.region,
    }

    const token = signToken(authUser)
    res.json({ user: authUser, token })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, role, region } = req.body
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const existing = await db('users').where({ email }).first()
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const hash = await bcrypt.hash(password, 10)
    const ids = await db('users').insert({
      first_name: firstName,
      last_name: lastName,
      email,
      password_hash: hash,
      role: role || 'staff',
      region: region || 'us-east-1',
    })

    const authUser = { id: ids[0], firstName, lastName, email, role: role || 'staff', region: region || 'us-east-1' }
    const token = signToken(authUser)
    res.status(201).json({ user: authUser, token })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user })
})

export default router
