import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import db from './db/connection.js'
import authRoutes from './routes/auth.js'
import kpiRoutes from './routes/kpis.js'
import transactionRoutes from './routes/transactions.js'
import taskRoutes from './routes/tasks.js'
import alertRoutes from './routes/alerts.js'
import metricRoutes from './routes/metrics.js'
import regionRoutes from './routes/regions.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/kpis', kpiRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/metrics', metricRoutes)
app.use('/api/regions', regionRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PaySync Cloud API' })
})

async function start() {
  try {
    await db.migrate.latest()
    console.log('Migrations complete')

    await db.seed.run()
    console.log('Seeds complete')

    app.listen(PORT, () => {
      console.log(`PaySync API running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
