import type { Express } from 'express'
import {
  validateUploadedFiles,
  MAX_FILE_COUNT,
  MAX_FILE_BYTES,
  MIN_FILE_BYTES,
} from '../services/images/validator'

// テスト用に最低限のフィールドを満たすダミーファイルを作るヘルパ
function makeFile(opts: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'images',
    originalname: 'sample.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 100 * 1024,
    buffer: Buffer.alloc(0),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
    ...opts,
  } as Express.Multer.File
}

describe('validateUploadedFiles', () => {
  it('正常な画像群は valid を返す', () => {
    const result = validateUploadedFiles([makeFile(), makeFile({ mimetype: 'image/png' })])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('ファイル0件は invalid', () => {
    const result = validateUploadedFiles([])
    expect(result.valid).toBe(false)
    expect(result.errors[0].field).toBe('images')
  })

  it('対応外の MIME 型は invalid', () => {
    const result = validateUploadedFiles([makeFile({ mimetype: 'image/heic' })])
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('対応していない')
  })

  it('小さすぎる画像は invalid', () => {
    const result = validateUploadedFiles([makeFile({ size: MIN_FILE_BYTES - 1 })])
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('小さすぎます')
  })

  it('大きすぎる単体画像は invalid', () => {
    const result = validateUploadedFiles([makeFile({ size: MAX_FILE_BYTES + 1 })])
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('大きすぎます')
  })

  it('枚数が上限を超えると invalid', () => {
    const files = Array.from({ length: MAX_FILE_COUNT + 1 }, () => makeFile())
    const result = validateUploadedFiles(files)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('枚数'))).toBe(true)
  })
})
