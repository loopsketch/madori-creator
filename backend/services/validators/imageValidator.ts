import fs from 'fs'
import { InputValidationError } from '../../errors/reconstruction'

export const MIN_IMAGE_SIZE = 1024 * 1024 // 1MB
export const MAX_IMAGE_SIZE = 100 * 1024 * 1024 // 100MB

export const ALLOWED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp']

export interface ValidationResult {
  valid: boolean
  errors: InputValidationError[]
}

export async function validateImages(
  images: string[]
): Promise<ValidationResult> {
  const errors: InputValidationError[] = []

  for (const imagePath of images) {
    const result = await validateSingleImage(imagePath)
    if (result.valid) continue
    errors.push(...result.errors)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

async function validateSingleImage(
  imagePath: string
): Promise<ValidationResult> {
  const errors: InputValidationError[] = []

  try {
    const stats = await fs.promises.stat(imagePath)

    // Size validation
    if (stats.size < MIN_IMAGE_SIZE) {
      errors.push(
        new InputValidationError(
          `画像が大きすぎません：${imagePath}`,
          'size',
          `最小 ${MIN_IMAGE_SIZE} バイト`
        )
      )
    }
    if (stats.size > MAX_IMAGE_SIZE) {
      errors.push(
        new InputValidationError(
          `画像が大きすぎます：${imagePath}`,
          'size',
          `最大 ${MAX_IMAGE_SIZE} バイト`
        )
      )
    }

    // Format validation
    const ext = imagePath.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_FORMATS.includes(ext)) {
      errors.push(
        new InputValidationError(
          `無効な画像形式：${imagePath}`,
          'format',
          `許可された形式：${ALLOWED_FORMATS.join(', ')}`
        )
      )
    }
  } catch (error) {
    errors.push(
      new InputValidationError(
        `画像の検証に失敗しました：${imagePath}`,
        'access',
        '画像へのアクセス権限を確認してください'
      )
    )
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
