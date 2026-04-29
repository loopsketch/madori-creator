import { Router, type Request, type Response } from 'express'
import type { ReconstructionRequest, ReconstructionResult } from '../types'

// 3D 再構築 API のモック実装
// 実処理は #6-2 以降で段階的に実装する。

export const reconstructionRouter = Router()

reconstructionRouter.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<ReconstructionRequest>
  const imageCount = Array.isArray(body.images) ? body.images.length : 0

  const result: ReconstructionResult = {
    status: 'done',
    message: `mock: ${imageCount} 枚の画像を受信しました`,
    exports: [
      {
        type: 'svg',
        content:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n' +
          '  <rect x="10" y="10" width="80" height="80" fill="none" stroke="#333" stroke-width="2"/>\n' +
          '</svg>',
      },
    ],
  }

  res.json(result)
})
