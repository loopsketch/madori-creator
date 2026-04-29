import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  MAX_FILE_BYTES,
  validateUploadedFiles,
} from '../services/images/validator'
import { getTaskDirBase, processAndSaveImages } from '../services/images/processor'
import {
  appendFrame,
  closeSession,
  createSession,
  deleteSession,
  getSession,
} from '../services/sessions/store'
import { ImageProcessingError, InputValidationError } from '../errors/reconstruction'
import type { MotionSnapshot } from '../types'

// ストリーミング撮影セッションの API。
// 1 リクエスト = 1 フレーム + DeviceMotion スナップショット。
// 深度推定 (#16) や RANSAC (#12) はまだ繋がっていないため、
// レスポンスの SVG は store 内のプレースホルダー。

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
})

export const sessionsRouter = Router()

// POST /api/sessions
sessionsRouter.post('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = randomUUID()
    const imageDir = path.join(getTaskDirBase(), sessionId)
    await fs.mkdir(imageDir, { recursive: true })
    const state = createSession(sessionId, imageDir)
    res.status(201).json({
      sessionId: state.sessionId,
      createdAt: state.createdAt,
      status: state.status,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/sessions/:id
sessionsRouter.get('/:id', (req: Request, res: Response) => {
  const state = getSession(req.params.id)
  if (!state) return res.status(404).json({ error: 'SessionNotFound', sessionId: req.params.id })
  res.json({
    sessionId: state.sessionId,
    status: state.status,
    createdAt: state.createdAt,
    totalFrames: state.frames.length,
    currentSvg: state.currentSvg,
    metrics: state.metrics,
  })
})

// POST /api/sessions/:id/frames
sessionsRouter.post(
  '/:id/frames',
  upload.single('frame'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = getSession(req.params.id)
      if (!state) {
        return res.status(404).json({ error: 'SessionNotFound', sessionId: req.params.id })
      }
      if (state.status !== 'active') {
        return res.status(409).json({ error: 'SessionClosed', sessionId: req.params.id })
      }

      const file = req.file
      if (!file) {
        return res.status(400).json({
          error: 'InputValidationError',
          messages: [{ message: 'frame フィールドが必要です', field: 'frame' }],
        })
      }

      const fileValidation = validateUploadedFiles([file])
      if (!fileValidation.valid) {
        return res.status(400).json({
          error: 'InputValidationError',
          messages: fileValidation.errors.map((e) => ({
            message: e.message,
            field: e.field,
            constraint: e.constraint,
          })),
        })
      }

      const motion = parseMotion(req.body?.motion)
      if (motion === 'invalid') {
        return res.status(400).json({
          error: 'InputValidationError',
          messages: [{ message: 'motion フィールドが不正な JSON です', field: 'motion' }],
        })
      }

      // 既存の processor を再利用してフレームを保存する (出力先はセッションディレクトリ)。
      const { images } = await processAndSaveImages(state.sessionId, [file], {
        outputDir: path.join(state.imageDir, `frame-${state.frames.length.toString().padStart(4, '0')}`),
      })

      const updated = appendFrame(state.sessionId, { image: images[0], motion })
      if (!updated) {
        // 直前に閉じられた等のレース。
        return res.status(409).json({ error: 'SessionClosed', sessionId: state.sessionId })
      }

      res.status(200).json({
        sessionId: updated.sessionId,
        frameIndex: updated.frames.length - 1,
        totalFrames: updated.frames.length,
        svg: updated.currentSvg,
        metrics: updated.metrics,
      })
    } catch (err) {
      if (err instanceof ImageProcessingError) {
        return res.status(422).json({
          error: 'ImageProcessingError',
          message: err.message,
          originalName: err.originalName,
        })
      }
      next(err)
    }
  }
)

// DELETE /api/sessions/:id
sessionsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = getSession(req.params.id)
    if (!state) {
      return res.status(404).json({ error: 'SessionNotFound', sessionId: req.params.id })
    }
    closeSession(state.sessionId)
    const finalSvg = state.currentSvg
    const totalFrames = state.frames.length

    // セッションディレクトリのクリーンアップ。失敗してもレスポンスには影響させない。
    fs.rm(state.imageDir, { recursive: true, force: true }).catch(() => {
      /* ignore */
    })
    deleteSession(state.sessionId)

    res.json({
      sessionId: state.sessionId,
      totalFrames,
      finalSvg,
    })
  } catch (err) {
    next(err)
  }
})

// multer や validation のミドルウェアエラー処理
sessionsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'MulterError', code: err.code, message: err.message })
  }
  if (err instanceof InputValidationError) {
    return res.status(400).json({
      error: 'InputValidationError',
      message: err.message,
      field: err.field,
      constraint: err.constraint,
    })
  }
  next(err)
})

function parseMotion(raw: unknown): MotionSnapshot | undefined | 'invalid' {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string') return 'invalid'
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    return obj as MotionSnapshot
  } catch {
    return 'invalid'
  }
}
