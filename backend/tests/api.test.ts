import express from 'express'
import { apiRouter } from '../api'
import type { ReconstructionResult } from '../types'

// API ルータの基本疎通テスト
// Express を直接呼び出して supertest を使わずに最小検証する。

describe('apiRouter', () => {
  const app = express()
  app.use(express.json())
  app.use('/api', apiRouter)

  it('GET /api/health がヘルスチェックを返す', async () => {
    const res = await fetch(await listen(app, '/api/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('POST /api/reconstruction がモックの再構築結果を返す', async () => {
    const url = await listen(app, '/api/reconstruction')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: ['data:image/png;base64,AAA'] }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ReconstructionResult
    expect(body.status).toBe('done')
    expect(body.exports).toHaveLength(1)
    expect(body.exports[0].type).toBe('svg')
    expect(body.message).toContain('1 枚')
  })
})

async function listen(app: express.Express, path: string): Promise<string> {
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(`http://127.0.0.1:${port}${path}`)
    })
  })
}
