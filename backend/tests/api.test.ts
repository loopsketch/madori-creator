import express from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { apiRouter } from '../api'
import { clearTasksForTesting } from '../services/tasks/store'

// supertest を入れず、ローカル listen + fetch + FormData で multipart を組み立てる。

interface AppHandle {
  url: string
  close: () => Promise<void>
}

async function startApp(taskDirBase: string): Promise<AppHandle> {
  process.env.TASK_DIR_BASE = taskDirBase
  const app = express()
  app.use(express.json())
  app.use('/api', apiRouter)
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      })
    })
  })
}

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  // 単色だと圧縮されすぎて MIN_FILE_BYTES を下回るため、ランダムノイズ画像を生成する。
  const channels = 3
  const raw = Buffer.alloc(width * height * channels)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 1103515245 + 12345) & 0xff
  return await sharp(raw, { raw: { width, height, channels } }).jpeg().toBuffer()
}

describe('apiRouter', () => {
  let tmpRoot: string
  let app: AppHandle

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'madori-api-'))
    app = await startApp(tmpRoot)
    clearTasksForTesting()
  })

  afterEach(async () => {
    await app.close()
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('GET /api/health がヘルスチェックを返す', async () => {
    const res = await fetch(`${app.url}/api/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('POST /api/reconstruction が複数画像を受け付け taskId を返す', async () => {
    const fd = new FormData()
    fd.append('images', new Blob([await makeJpeg(800, 600)], { type: 'image/jpeg' }), 'a.jpg')
    fd.append('images', new Blob([await makeJpeg(1200, 900)], { type: 'image/jpeg' }), 'b.jpg')

    const res = await fetch(`${app.url}/api/reconstruction`, { method: 'POST', body: fd })
    expect(res.status).toBe(202)
    const body = (await res.json()) as {
      taskId: string
      status: string
      imageCount: number
    }
    expect(body.taskId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.status).toBe('received')
    expect(body.imageCount).toBe(2)

    const savedDir = path.join(tmpRoot, body.taskId)
    const files = await fs.readdir(savedDir)
    expect(files).toHaveLength(2)
  })

  it('画像なしの POST は 400 を返す', async () => {
    const fd = new FormData()
    const res = await fetch(`${app.url}/api/reconstruction`, { method: 'POST', body: fd })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('InputValidationError')
  })

  it('対応外の MIME 型は 400', async () => {
    const fd = new FormData()
    fd.append('images', new Blob(['fake'], { type: 'image/heic' }), 'x.heic')
    const res = await fetch(`${app.url}/api/reconstruction`, { method: 'POST', body: fd })
    expect(res.status).toBe(400)
  })

  it('壊れた JPEG は 422', async () => {
    const fd = new FormData()
    // MIME は正しいがバイナリは壊れている
    const garbage = Buffer.alloc(50 * 1024, 0xff)
    fd.append('images', new Blob([garbage], { type: 'image/jpeg' }), 'broken.jpg')

    const res = await fetch(`${app.url}/api/reconstruction`, { method: 'POST', body: fd })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('ImageProcessingError')
  })
})
