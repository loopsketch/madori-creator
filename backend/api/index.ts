import { Router } from 'express'
import { reconstructionRouter } from './reconstruction'

// API ルータ集約

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

apiRouter.use('/reconstruction', reconstructionRouter)
