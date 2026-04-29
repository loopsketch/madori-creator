import { Router } from 'express'
import { reconstructionRouter } from './reconstruction'
import { sessionsRouter } from './sessions'

// API ルータ集約

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

apiRouter.use('/reconstruction', reconstructionRouter)
apiRouter.use('/sessions', sessionsRouter)
