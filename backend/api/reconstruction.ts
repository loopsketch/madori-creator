import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { validateUploadedFiles, MAX_FILE_BYTES, MAX_FILE_COUNT } from '../services/images/validator'
import { processAndSaveImages } from '../services/images/processor'
import { createTask } from '../services/tasks/store'
import { ImageProcessingError, InputValidationError } from '../errors/reconstruction'

// 3D 再構築の受信エンドポイント。
// multipart/form-data の "images" フィールドで複数ファイルを受け付け、
// バリデーション → Sharp で前処理 → ディスク保存 → タスクID 返却 を行う。
// 実際の COLMAP/OpenMVS 連携は #10 以降で実装する。

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILE_COUNT,
  },
})

export const reconstructionRouter = Router()

reconstructionRouter.post(
  '/',
  upload.array('images', MAX_FILE_COUNT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? []
      const validation = validateUploadedFiles(files)
      if (!validation.valid) {
        return res.status(400).json({
          error: 'InputValidationError',
          messages: validation.errors.map((e) => ({
            message: e.message,
            field: e.field,
            constraint: e.constraint,
          })),
        })
      }

      const taskId = randomUUID()
      const { outputDir, images } = await processAndSaveImages(taskId, files)
      const meta = createTask({ taskId, imageDir: outputDir, images })

      res.status(202).json({
        taskId: meta.taskId,
        status: meta.status,
        imageCount: meta.imageCount,
        message: '画像を受信しました',
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

// multer の limits 違反など、middleware が投げるエラーを 400 に変換する。
reconstructionRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'MulterError',
      code: err.code,
      message: err.message,
    })
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
