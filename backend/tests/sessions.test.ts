import express from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { apiRouter } from '../api'
import { clearSessionsForTesting } from '../services/sessions/store'

// セッション API の E2E 寄り統合テスト。
// supertest を使わず、ローカル listen + fetch で multipart を組む。

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
  const channels = 3
  const raw = Buffer.alloc(width * height * channels)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 1103515245 + 12345) & 0xff
  return await sharp(raw, { raw: { width, height, channels } }).jpeg().toBuffer()
}

describe('sessionsRouter', () => {
  let tmpRoot: string
  let app: AppHandle

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'madori-sessions-'))
    app = await startApp(tmpRoot)
    clearSessionsForTesting()
  })

  afterEach(async () => {
    await app.close()
    await fs.rm(tmpRoot, { recursive: true, force: true })
  })

  it('POST /api/sessions が sessionId を発行する', async () => {
    const res = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { sessionId: string; status: string }
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.status).toBe('active')
  })

  it('複数フレームを順に送れる、SVG とフレーム数が更新される', async () => {
    const create = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    const { sessionId } = (await create.json()) as { sessionId: string }

    const sendFrame = async (motion?: object) => {
      const fd = new FormData()
      fd.append('frame', new Blob([await makeJpeg(640, 480)], { type: 'image/jpeg' }), 'f.jpg')
      if (motion) fd.append('motion', JSON.stringify(motion))
      const res = await fetch(`${app.url}/api/sessions/${sessionId}/frames`, {
        method: 'POST',
        body: fd,
      })
      return { status: res.status, body: (await res.json()) as { totalFrames: number; svg: string } }
    }

    const r1 = await sendFrame({ timestamp: 1 })
    expect(r1.status).toBe(200)
    expect(r1.body.totalFrames).toBe(1)
    expect(r1.body.svg).toContain('frames: 1')

    const r2 = await sendFrame()
    expect(r2.body.totalFrames).toBe(2)
    expect(r2.body.svg).toContain('frames: 2')
  })

  it('GET /api/sessions/:id で現在の状態を取得できる', async () => {
    const create = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    const { sessionId } = (await create.json()) as { sessionId: string }
    const fd = new FormData()
    fd.append('frame', new Blob([await makeJpeg(640, 480)], { type: 'image/jpeg' }), 'f.jpg')
    await fetch(`${app.url}/api/sessions/${sessionId}/frames`, { method: 'POST', body: fd })

    const res = await fetch(`${app.url}/api/sessions/${sessionId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; totalFrames: number }
    expect(body.status).toBe('active')
    expect(body.totalFrames).toBe(1)
  })

  it('DELETE /api/sessions/:id で finalSvg が返り、その後アクセスできない', async () => {
    const create = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    const { sessionId } = (await create.json()) as { sessionId: string }
    const fd = new FormData()
    fd.append('frame', new Blob([await makeJpeg(640, 480)], { type: 'image/jpeg' }), 'f.jpg')
    await fetch(`${app.url}/api/sessions/${sessionId}/frames`, { method: 'POST', body: fd })

    const res = await fetch(`${app.url}/api/sessions/${sessionId}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { totalFrames: number; finalSvg: string }
    expect(body.totalFrames).toBe(1)
    expect(body.finalSvg).toContain('frames: 1')

    const after = await fetch(`${app.url}/api/sessions/${sessionId}`)
    expect(after.status).toBe(404)
  })

  it('未知の sessionId への frames POST は 404', async () => {
    const fd = new FormData()
    fd.append('frame', new Blob([await makeJpeg(640, 480)], { type: 'image/jpeg' }), 'f.jpg')
    const res = await fetch(`${app.url}/api/sessions/unknown-id/frames`, {
      method: 'POST',
      body: fd,
    })
    expect(res.status).toBe(404)
  })

  it('frame フィールドなしの POST は 400', async () => {
    const create = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    const { sessionId } = (await create.json()) as { sessionId: string }
    const fd = new FormData()
    const res = await fetch(`${app.url}/api/sessions/${sessionId}/frames`, {
      method: 'POST',
      body: fd,
    })
    expect(res.status).toBe(400)
  })

  it('motion が不正な JSON の場合 400', async () => {
    const create = await fetch(`${app.url}/api/sessions`, { method: 'POST' })
    const { sessionId } = (await create.json()) as { sessionId: string }
    const fd = new FormData()
    fd.append('frame', new Blob([await makeJpeg(640, 480)], { type: 'image/jpeg' }), 'f.jpg')
    fd.append('motion', 'not-json{')
    const res = await fetch(`${app.url}/api/sessions/${sessionId}/frames`, {
      method: 'POST',
      body: fd,
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { messages?: { field?: string }[] }
    expect(body.messages?.[0].field).toBe('motion')
  })
})
