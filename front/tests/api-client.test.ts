import { postReconstruction } from '../api/client'
import type { ReconstructionResult } from '../api/types'

// fetch をモックして API クライアントの最小検証を行う

describe('postReconstruction', () => {
  it('リクエスト本文を JSON で送信し結果をパースする', async () => {
    const mockResult: ReconstructionResult = {
      status: 'done',
      exports: [{ type: 'svg', content: '<svg/>' }],
      message: 'mock: 0 枚の画像を受信しました',
    }

    let receivedBody: string | undefined
    const fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
      receivedBody = init?.body as string
      return new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    vi.stubGlobal('fetch', fetchMock)

    const result = await postReconstruction({ images: [] })
    expect(result).toEqual(mockResult)
    expect(JSON.parse(receivedBody!)).toEqual({ images: [] })

    vi.unstubAllGlobals()
  })
})
