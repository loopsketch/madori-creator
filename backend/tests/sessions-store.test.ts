import {
  appendFrame,
  clearSessionsForTesting,
  closeSession,
  createSession,
  deleteSession,
  getSession,
} from '../services/sessions/store'
import type { ProcessedImage } from '../types'

function makeImage(): ProcessedImage {
  return {
    path: '/tmp/dummy.jpg',
    width: 800,
    height: 600,
    byteSize: 1024,
    originalName: 'frame.jpg',
  }
}

describe('session store', () => {
  beforeEach(async () => {
    await clearSessionsForTesting()
  })

  it('createSession で active 状態のセッションを作る', async () => {
    const s = await createSession('s1', '/tmp/madori/s1')
    expect(s.status).toBe('active')
    expect(s.frames).toHaveLength(0)
    expect(await getSession('s1')).toEqual(s)
  })

  it('appendFrame でフレームを追加し SVG が更新される', async () => {
    await createSession('s1', '/tmp/madori/s1')
    const state = await appendFrame('s1', { image: makeImage() })
    expect(state?.frames).toHaveLength(1)
    expect(state?.frames[0].index).toBe(0)
    expect(state?.currentSvg).toContain('<svg')

    await appendFrame('s1', { image: makeImage(), motion: { timestamp: 123 } })
    const after = await getSession('s1')
    expect(after?.frames).toHaveLength(2)
    expect(after?.frames[1].motion?.timestamp).toBe(123)
  })

  it('未知のセッションへの appendFrame は undefined を返す', async () => {
    const result = await appendFrame('unknown', { image: makeImage() })
    expect(result).toBeUndefined()
  })

  it('closed 状態のセッションには appendFrame できない', async () => {
    await createSession('s1', '/tmp/madori/s1')
    await closeSession('s1')
    const result = await appendFrame('s1', { image: makeImage() })
    expect(result).toBeUndefined()
  })

  it('deleteSession でストアから消える', async () => {
    await createSession('s1', '/tmp/madori/s1')
    expect(await deleteSession('s1')).toBe(true)
    expect(await getSession('s1')).toBeUndefined()
  })
})
