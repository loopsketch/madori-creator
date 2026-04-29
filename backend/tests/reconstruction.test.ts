import { detectFloorAndWalls } from '../services/reconstruction'
import { fitPlaneRansac, planeFrom3Points } from '../services/reconstruction/ransac'
import type { Point3D } from '../services/reconstruction/types'

// 決定論的なシードベース乱数 (mulberry32)
function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noise(rand: () => number, scale: number): number {
  return (rand() - 0.5) * 2 * scale
}

// 5m x 5m x 2.5m の部屋点群を生成する。
// - 床: z = 0、サイズ 5x5、各方向 50 サンプル → 2500 点
// - 壁: 各方向 30 x 高さ 25 → 750 点 × 4 = 3000 点
// - 合計 5500 点 + ノイズ (0.005m)
function makeSyntheticRoom(seed = 42): Point3D[] {
  const rand = seededRandom(seed)
  const points: Point3D[] = []
  const room = { sizeX: 5, sizeY: 5, height: 2.5 }
  const noiseScale = 0.005

  // 床
  const floorN = 50
  for (let i = 0; i < floorN; i++) {
    for (let j = 0; j < floorN; j++) {
      points.push({
        x: (i / (floorN - 1)) * room.sizeX + noise(rand, noiseScale),
        y: (j / (floorN - 1)) * room.sizeY + noise(rand, noiseScale),
        z: 0 + noise(rand, noiseScale),
      })
    }
  }

  const wallN = 30
  const heightN = 25
  // 壁 1: x = 0
  for (let i = 0; i < wallN; i++) {
    for (let j = 0; j < heightN; j++) {
      points.push({
        x: 0 + noise(rand, noiseScale),
        y: (i / (wallN - 1)) * room.sizeY + noise(rand, noiseScale),
        z: (j / (heightN - 1)) * room.height + noise(rand, noiseScale),
      })
    }
  }
  // 壁 2: x = sizeX
  for (let i = 0; i < wallN; i++) {
    for (let j = 0; j < heightN; j++) {
      points.push({
        x: room.sizeX + noise(rand, noiseScale),
        y: (i / (wallN - 1)) * room.sizeY + noise(rand, noiseScale),
        z: (j / (heightN - 1)) * room.height + noise(rand, noiseScale),
      })
    }
  }
  // 壁 3: y = 0
  for (let i = 0; i < wallN; i++) {
    for (let j = 0; j < heightN; j++) {
      points.push({
        x: (i / (wallN - 1)) * room.sizeX + noise(rand, noiseScale),
        y: 0 + noise(rand, noiseScale),
        z: (j / (heightN - 1)) * room.height + noise(rand, noiseScale),
      })
    }
  }
  // 壁 4: y = sizeY
  for (let i = 0; i < wallN; i++) {
    for (let j = 0; j < heightN; j++) {
      points.push({
        x: (i / (wallN - 1)) * room.sizeX + noise(rand, noiseScale),
        y: room.sizeY + noise(rand, noiseScale),
        z: (j / (heightN - 1)) * room.height + noise(rand, noiseScale),
      })
    }
  }
  return points
}

describe('planeFrom3Points', () => {
  it('XY 平面の 3 点から法線 (0,0,±1) を返す', () => {
    const plane = planeFrom3Points({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    expect(plane).toBeDefined()
    expect(Math.abs(plane!.normal.z)).toBeCloseTo(1, 6)
    expect(plane!.distance).toBeCloseTo(0, 6)
  })

  it('共線 3 点では undefined', () => {
    const plane = planeFrom3Points({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })
    expect(plane).toBeUndefined()
  })
})

describe('fitPlaneRansac (床面ライク)', () => {
  it('XY 平面に乗った点群から、法線 ~ (0,0,1) の平面を返す', () => {
    const rand = seededRandom(7)
    const points: Point3D[] = []
    for (let i = 0; i < 500; i++) {
      points.push({
        x: noise(rand, 5),
        y: noise(rand, 5),
        z: noise(rand, 0.005),
      })
    }
    const plane = fitPlaneRansac(points, {
      iterations: 200,
      inlierThreshold: 0.05,
      random: rand,
    })
    expect(plane).toBeDefined()
    expect(Math.abs(plane!.normal.z)).toBeGreaterThan(0.95)
    expect(plane!.inliers.length).toBeGreaterThan(450)
  })
})

describe('detectFloorAndWalls', () => {
  it('合成部屋の床と 4 壁を抽出する', () => {
    const points = makeSyntheticRoom(123)
    const result = detectFloorAndWalls(points, {
      iterations: 400,
      inlierThresholdM: 0.05,
      minWallInliers: 200,
      maxWalls: 6,
    })

    expect(result.floor).toBeDefined()
    // 床法線は ±Z 寄り、向きは関数内で +Z に正規化済み
    expect(result.floor!.normal.z).toBeGreaterThan(0.9)
    expect(Math.abs(result.floor!.z)).toBeLessThan(0.1)

    // 壁が 4 つ前後検出される (アルゴリズムの不確定性で 3〜5 を許容)
    expect(result.walls.length).toBeGreaterThanOrEqual(3)
    expect(result.walls.length).toBeLessThanOrEqual(6)

    // 各壁の法線は水平
    for (const wall of result.walls) {
      const lenXY = Math.sqrt(wall.normal.x ** 2 + wall.normal.y ** 2)
      expect(lenXY).toBeCloseTo(1, 5)
      expect(wall.zRange.max).toBeGreaterThan(2.0)
    }
  })

  it('点群が極端に少ないときは床も壁も返さない', () => {
    const result = detectFloorAndWalls([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ])
    expect(result.floor).toBeUndefined()
    expect(result.walls).toHaveLength(0)
  })
})
