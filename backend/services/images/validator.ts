import type { Express } from 'express'
import { InputValidationError } from '../../errors/reconstruction'

// アップロードファイルの形式・サイズ・枚数を検証する。
// multer の limits だけでは MIME や枚数のメッセージを細かく出せないため、
// 受信後に追加チェックを行う。

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MIN_FILE_BYTES = 10 * 1024 // 10 KB
export const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024 // 100 MB
export const MIN_FILE_COUNT = 1
export const MAX_FILE_COUNT = 100

export interface ValidationResult {
  valid: boolean
  errors: InputValidationError[]
}

export function validateUploadedFiles(files: Express.Multer.File[]): ValidationResult {
  const errors: InputValidationError[] = []

  if (files.length < MIN_FILE_COUNT) {
    errors.push(
      new InputValidationError(
        '画像が1枚以上必要です',
        'images',
        `最小 ${MIN_FILE_COUNT} 枚`
      )
    )
    return { valid: false, errors }
  }

  if (files.length > MAX_FILE_COUNT) {
    errors.push(
      new InputValidationError(
        `画像の枚数が上限を超えています (${files.length} 枚)`,
        'images',
        `最大 ${MAX_FILE_COUNT} 枚`
      )
    )
  }

  let totalBytes = 0
  for (const file of files) {
    totalBytes += file.size

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      errors.push(
        new InputValidationError(
          `対応していない画像形式です (${file.mimetype})`,
          'images',
          `対応形式: ${ALLOWED_MIME_TYPES.join(', ')}`
        )
      )
    }

    if (file.size < MIN_FILE_BYTES) {
      errors.push(
        new InputValidationError(
          `画像サイズが小さすぎます: ${file.originalname} (${file.size} バイト)`,
          'images',
          `最小 ${MIN_FILE_BYTES} バイト`
        )
      )
    }

    if (file.size > MAX_FILE_BYTES) {
      errors.push(
        new InputValidationError(
          `画像サイズが大きすぎます: ${file.originalname} (${file.size} バイト)`,
          'images',
          `最大 ${MAX_FILE_BYTES} バイト`
        )
      )
    }
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    errors.push(
      new InputValidationError(
        `画像の合計サイズが上限を超えています (${totalBytes} バイト)`,
        'images',
        `合計上限 ${MAX_TOTAL_BYTES} バイト`
      )
    )
  }

  return { valid: errors.length === 0, errors }
}
