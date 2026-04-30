import {
  estimateDepthMock,
  MOCK_DEPTH_HEIGHT,
  MOCK_DEPTH_WIDTH,
} from '../services/depth/estimator.mock'
import { getDefaultIntrinsics } from '../services/depth/intrinsics'
import {
  normalizeDepthByMedian,
  projectToCamera,
  transformToWorld,
} from '../services/depth/pointcloud'
import { voxelDownsample } from '../services/depth/voxel'
import type { RotationMatrix3 } from '../types'

describe('estimateDepthMock', () => {
  it('指定サイズの深度マップを返す', async () => {
    const dm = await estimateDepthMock(Buffer.alloc(0))
    expect(dm.width).toBe(MOCK_DEPTH_WIDTH)
    expect(dm.height).toBe(MOCK_DEPTH_HEIGHT)
    expect(dm.data.length).toBe(MOCK_DEPTH_WIDTH * MOCK_DEPTH_HEIGHT)
  })

  it('中央が周辺より浅い (近い) 値になる', async () => {
    const dm = await estimateDepthMock(Buffer.alloc(0))
    const center = dm.data[Math.floor(dm.height / 2) * dm.width + Math.floor(dm.width / 2)]
    const corner = dm.data[0]
    expect(center).toBeLessThan(corner)
  })
})

describe('getDefaultIntrinsics', () => {
  it('画像中心が cx, cy に置かれ、fx > 0', () => {
    const intr = getDefaultIntrinsics(384, 288)
    expect(intr.cx).toBe(192)
    expect(intr.cy).toBe(144)
    expect(intr.fx).toBeGreaterThan(0)
    expect(intr.fy).toBeCloseTo(intr.fx, 6)
  })
})

describe('normalizeDepthByMedian', () => {
  it('中央値が targetCenterDepthM に揃う', () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const dm = { width: 3, height: 3, data }
    const out = normalizeDepthByMedian(dm, 1.5)
    // 元の中央値 = 5、スケール = 1.5/5 = 0.3 → 中央値 = 1.5
    const sorted = Array.from(out.data).sort((a, b) => a - b)
    expect(sorted[4]).toBeCloseTo(1.5, 5)
  })
})

describe('projectToCamera + transformToWorld', () => {
  it('深度一定 (1m) で camera 座標が計算され、世界座標へ変換できる', () => {
    const width = 4
    const height = 4
    const data = new Float32Array(width * height).fill(1)
    const intr = getDefaultIntrinsics(width, height)
    const cam = projectToCamera({ width, height, data }, intr, { stride: 1 })
    expect(cam.length).toBe(width * height)
    // すべての点で z = 1
    for (const p of cam) expect(p.z).toBeCloseTo(1, 6)

    // 単位行列で world に変換 (= 同じ値)
    const I: RotationMatrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const world = transformToWorld(cam, I)
    expect(world).toHaveLength(cam.length)
    expect(world[0]).toEqual(cam[0])
  })

  it('worldOrientation 未指定なら入力をそのまま返す', () => {
    const cam = [{ x: 1, y: 2, z: 3 }]
    const out = transformToWorld(cam)
    expect(out).toEqual(cam)
    expect(out).not.toBe(cam) // コピーされていることを期待
  })

  it('translation を併せて指定すると回転後に並進が加わる (issue #26)', () => {
    const cam = [{ x: 0, y: 0, z: 0 }]
    const I: RotationMatrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    const out = transformToWorld(cam, I, { x: 1, y: 2, z: 3 })
    expect(out[0]).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('voxelDownsample', () => {
  it('同じボクセルの点は重心に集約される', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 0.01, y: 0, z: 0 },
      { x: 0.02, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]
    const down = voxelDownsample(points, { voxelSizeM: 0.05 })
    // 0.05m ボクセルなら、最初の 3 点は同じセル → 1 点に集約。1 番目の (1,0,0) は別セル。
    expect(down).toHaveLength(2)
  })

  it('voxel size が 0 以下なら入力をそのまま返す', () => {
    const points = [{ x: 1, y: 2, z: 3 }]
    const down = voxelDownsample(points, { voxelSizeM: 0 })
    expect(down).toEqual(points)
  })
})
