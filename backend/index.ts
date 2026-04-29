import express from 'express'
import { createClient, type RedisClientType } from 'redis'
import { apiRouter } from './api'
import { setSessionRepository } from './services/sessions/store'
import { RedisRepository } from './services/sessions/redis-repository'

// バックエンドのエントリポイント

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(express.json({ limit: '20mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', apiRouter)

await initSessionStore()

app.listen(port, '0.0.0.0', () => {
  console.log(`backend listening on http://0.0.0.0:${port}`)
})

// セッションストアを環境変数 SESSION_STORE で選択する。
// 'redis' なら REDIS_URL に接続を試みる。失敗時は in-memory のままフォールバック。
async function initSessionStore(): Promise<void> {
  if (process.env.SESSION_STORE !== 'redis') {
    console.log('[sessions] in-memory ストアを使用します')
    return
  }
  const url = process.env.REDIS_URL ?? 'redis://redis:6379'
  try {
    const client = createClient({ url })
    client.on('error', (err) => {
      console.error('[sessions] Redis 接続エラー:', err)
    })
    await client.connect()
    setSessionRepository(new RedisRepository(client as RedisClientType))
    console.log(`[sessions] Redis ストアに接続しました (${url})`)
  } catch (err) {
    console.error('[sessions] Redis 接続失敗、in-memory にフォールバックします:', err)
  }
}
