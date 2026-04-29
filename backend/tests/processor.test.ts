import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import type { Express } from 'express'
import { processAndSaveImages } from '../services/images/processor'
import { ImageProcessingError } from '../errors/reconstruction'

async function makeFile(buffer: Buffer, name = 'sample.jpg'): Promise<Express.Multer.File> {
  return {
    fieldname: 'images',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
  } as Express.Multer.File
}

describe('processAndSaveImages', () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'madori-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('画像を JPEG として保存し長辺リサイズする', async () => {
    const big = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer()

    const file = await makeFile(big, 'photo.jpg')
    const { outputDir, images } = await processAndSaveImages('task-1', [file], {
      outputDir: path.join(tmpRoot, 'task-1'),
      maxLongEdge: 1024,
    })

    expect(images).toHaveLength(1)
    expect(images[0].width).toBeLessThanOrEqual(1024)
    expect(images[0].height).toBeLessThanOrEqual(1024)
    expect(images[0].originalName).toBe('photo.jpg')

    const written = await fs.readFile(images[0].path)
    expect(written.length).toBeGreaterThan(0)
    expect(outputDir).toContain('task-1')
  })

  it('壊れた画像で ImageProcessingError を投げる', async () => {
    const file = await makeFile(Buffer.from('not an image'), 'bad.jpg')
    await expect(
      processAndSaveImages('task-2', [file], { outputDir: path.join(tmpRoot, 'task-2') })
    ).rejects.toBeInstanceOf(ImageProcessingError)
  })

  it('小さい画像は拡大しない (withoutEnlargement)', async () => {
    const small = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .jpeg()
      .toBuffer()

    const file = await makeFile(small)
    const { images } = await processAndSaveImages('task-3', [file], {
      outputDir: path.join(tmpRoot, 'task-3'),
      maxLongEdge: 1024,
    })

    expect(images[0].width).toBe(100)
    expect(images[0].height).toBe(80)
  })
})
