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
  beforeEach(() => clearSessionsForTesting())

  it('createSession で active 状態のセッションを作る', () => {
    const s = createSession('s1', '/tmp/madori/s1')
    expect(s.status).toBe('active')
    expect(s.frames).toHaveLength(0)
    expect(getSession('s1')).toBe(s)
  })

  it('appendFrame でフレームを追加し SVG が更新される', () => {
    createSession('s1', '/tmp/madori/s1')
    const state = appendFrame('s1', { image: makeImage() })
    expect(state?.frames).toHaveLength(1)
    expect(state?.frames[0].index).toBe(0)
    expect(state?.currentSvg).toContain('frames: 1')

    appendFrame('s1', { image: makeImage(), motion: { timestamp: 123 } })
    const after = getSession('s1')
    expect(after?.frames).toHaveLength(2)
    expect(after?.frames[1].motion?.timestamp).toBe(123)
  })

  it('未知のセッションへの appendFrame は undefined を返す', () => {
    const result = appendFrame('unknown', { image: makeImage() })
    expect(result).toBeUndefined()
  })

  it('closed 状態のセッションには appendFrame できない', () => {
    createSession('s1', '/tmp/madori/s1')
    closeSession('s1')
    const result = appendFrame('s1', { image: makeImage() })
    expect(result).toBeUndefined()
  })

  it('deleteSession でストアから消える', () => {
    createSession('s1', '/tmp/madori/s1')
    expect(deleteSession('s1')).toBe(true)
    expect(getSession('s1')).toBeUndefined()
  })
})
