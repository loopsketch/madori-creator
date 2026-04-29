import { getHealth, postReconstruction } from '../lib/client'

// fetch をモックして API クライアントの最小検証を行う

describe('getHealth', () => {
  it('GET /api/health を呼び出し JSON をパースする', async () => {
    let calledUrl: string | undefined
    const fetchMock = async (url: string | URL | Request) => {
      calledUrl = String(url)
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    vi.stubGlobal('fetch', fetchMock)

    const result = await getHealth()
    expect(result).toEqual({ status: 'ok' })
    expect(calledUrl).toBe('/api/health')

    vi.unstubAllGlobals()
  })
})

describe('postReconstruction', () => {
  it('FormData として画像を送信する', async () => {
    let receivedBody: BodyInit | null | undefined
    const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
      receivedBody = init?.body
      return new Response(
        JSON.stringify({ taskId: 'tid', status: 'received', imageCount: 1 }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      )
    }
    vi.stubGlobal('fetch', fetchMock)

    const file = new File([new Uint8Array([1, 2, 3])], 'test.jpg', { type: 'image/jpeg' })
    const result = await postReconstruction([file])
    expect(result.taskId).toBe('tid')
    expect(result.status).toBe('received')
    expect(receivedBody).toBeInstanceOf(FormData)

    vi.unstubAllGlobals()
  })
})
