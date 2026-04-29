import express from 'express'
import { apiRouter } from './api'

// バックエンドのエントリポイント

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(express.json({ limit: '20mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', apiRouter)

app.listen(port, '0.0.0.0', () => {
  console.log(`backend listening on http://0.0.0.0:${port}`)
})
