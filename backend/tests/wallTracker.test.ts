import { describe, it, expect } from 'vitest'
import {
  createWallTrackerState,
  ingestWalls,
} from '../services/reconstruction/wallTracker'
import type { Wall } from '../services/reconstruction/types'

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return {
    start: { x: 0, y: 0 },
    end: { x: 4, y: 0 },
    zRange: { min: 0, max: 2.4 },
    normal: { x: 0, y: 1 },
    inlierCount: 200,
    ...overrides,
  }
}

describe('ingestWalls', () => {
  it('同じ壁を 3 回与えると 1 つのトラックにまとまる', () => {
    let state = createWallTrackerState()
    for (let i = 0; i < 3; i++) {
      const result = ingestWalls(state, i, [makeWall()])
      state = result.next
    }
    expect(state.tracks).toHaveLength(1)
  })

  it('直交する壁は別トラックになる', () => {
    let state = createWallTrackerState()
    state = ingestWalls(state, 0, [makeWall()]).next
    const orthogonal = makeWall({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 4 },
      normal: { x: 1, y: 0 },
    })
    state = ingestWalls(state, 1, [orthogonal]).next
    expect(state.tracks).toHaveLength(2)
  })

  it('微小ノイズの観測は同じトラックに集約される', () => {
    let state = createWallTrackerState()
    const observations: Wall[] = [
      makeWall(),
      makeWall({
        start: { x: 0.05, y: 0.02 },
        end: { x: 4.02, y: -0.03 },
        normal: { x: 0.02, y: 0.999 },
      }),
      makeWall({
        start: { x: -0.04, y: -0.01 },
        end: { x: 4.01, y: 0.02 },
        normal: { x: -0.01, y: 0.9999 },
      }),
    ]
    for (let i = 0; i < observations.length; i++) {
      state = ingestWalls(state, i, [observations[i]]).next
    }
    expect(state.tracks).toHaveLength(1)
  })

  it('法線の符号が反転していても同じトラックに集約される', () => {
    let state = createWallTrackerState()
    state = ingestWalls(state, 0, [makeWall()]).next
    const flipped = makeWall({ normal: { x: 0, y: -1 } })
    state = ingestWalls(state, 1, [flipped]).next
    expect(state.tracks).toHaveLength(1)
  })

  it('minObservations 未満のトラックは安定壁に含めない', () => {
    let state = createWallTrackerState()
    let result = ingestWalls(state, 0, [makeWall()], { minObservations: 2 })
    state = result.next
    expect(result.stable).toHaveLength(0)
    result = ingestWalls(state, 1, [makeWall()], { minObservations: 2 })
    expect(result.stable).toHaveLength(1)
  })

  it('staleFrames を超えて未観測のトラックは破棄される', () => {
    let state = createWallTrackerState()
    state = ingestWalls(state, 0, [makeWall()], { staleFrames: 3 }).next
    state = ingestWalls(state, 5, [], { staleFrames: 3 }).next
    expect(state.tracks).toHaveLength(0)
  })

  it('historyLimit を超える観測は古いものから破棄される', () => {
    let state = createWallTrackerState()
    for (let i = 0; i < 7; i++) {
      state = ingestWalls(state, i, [makeWall()], { historyLimit: 3 }).next
    }
    expect(state.tracks).toHaveLength(1)
    expect(state.tracks[0].observations).toHaveLength(3)
    expect(state.tracks[0].observations[0].frameIndex).toBe(4)
  })

  it('入力 state を破壊しない (immutable)', () => {
    const before = createWallTrackerState()
    const snapshot = JSON.stringify(before)
    ingestWalls(before, 0, [makeWall()])
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('安定壁の代表値はノイズ観測の中央付近に収束する', () => {
    let state = createWallTrackerState()
    const observations: Wall[] = [
      makeWall({
        start: { x: 0.1, y: 0.05 },
        end: { x: 3.9, y: -0.05 },
        normal: { x: 0.01, y: 0.9999 },
      }),
      makeWall({
        start: { x: -0.05, y: -0.04 },
        end: { x: 4.1, y: 0.06 },
        normal: { x: -0.02, y: 0.9998 },
      }),
      makeWall({
        start: { x: 0.02, y: 0.03 },
        end: { x: 4.02, y: -0.02 },
        normal: { x: 0.005, y: 0.99998 },
      }),
    ]
    let result = ingestWalls(state, 0, [observations[0]])
    state = result.next
    result = ingestWalls(state, 1, [observations[1]])
    state = result.next
    result = ingestWalls(state, 2, [observations[2]])
    expect(result.stable).toHaveLength(1)
    const stable = result.stable[0]
    // 期待値: y ≒ 0、x の幅は元線分のレンジに収まる
    expect(Math.abs(stable.start.y)).toBeLessThan(0.1)
    expect(Math.abs(stable.end.y)).toBeLessThan(0.1)
    const length = Math.hypot(stable.end.x - stable.start.x, stable.end.y - stable.start.y)
    expect(length).toBeGreaterThan(3.5)
    expect(length).toBeLessThan(4.5)
  })
})
