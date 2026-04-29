import express from 'express'

// バックエンドのエントリポイント (最小構成)
// 既存のサービス層 (services/, api/) は段階的に統合する。

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`backend listening on http://0.0.0.0:${port}`)
})
