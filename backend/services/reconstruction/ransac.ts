import type { Plane, Point3D, Vec3 } from './types'

// 軽量な平面 RANSAC。3 点ランダム選択で平面方程式を作り、
// インライア数が最大となる平面を返す。最小二乗 refinement は
// パフォーマンス優先で省略している。

export interface RansacOptions {
  iterations: number
  inlierThreshold: number
  // インライア比がこの値を超えたら早期打ち切り
  earlyAcceptRatio?: number
  // 平面が満たすべき条件 (例: 法線が +Z 寄り)
  predicate?: (plane: { normal: Vec3; distance: number }) => boolean
  // 乱数生成器 (テストで決定論的にしたい場合)
  random?: () => number
}

export function fitPlaneRansac(
  points: Point3D[],
  options: RansacOptions
): Plane | undefined {
  if (points.length < 3) return undefined

  const rand = options.random ?? Math.random
  const earlyAcceptCount = options.earlyAcceptRatio
    ? Math.ceil(points.length * options.earlyAcceptRatio)
    : Number.POSITIVE_INFINITY

  let best: Plane | undefined
  let bestCount = 0

  for (let i = 0; i < options.iterations; i++) {
    const sample = pick3Distinct(points, rand)
    if (!sample) continue
    const candidate = planeFrom3Points(sample[0], sample[1], sample[2])
    if (!candidate) continue
    if (options.predicate && !options.predicate(candidate)) continue

    const inliers = collectInliers(points, candidate, options.inlierThreshold)
    if (inliers.length > bestCount) {
      best = { ...candidate, inliers }
      bestCount = inliers.length
      if (bestCount >= earlyAcceptCount) break
    }
  }

  return best
}

function pick3Distinct(
  points: Point3D[],
  rand: () => number
): [Point3D, Point3D, Point3D] | undefined {
  if (points.length < 3) return undefined
  const a = Math.floor(rand() * points.length)
  let b = Math.floor(rand() * points.length)
  if (b === a) b = (b + 1) % points.length
  let c = Math.floor(rand() * points.length)
  if (c === a || c === b) c = (c + 2) % points.length
  return [points[a], points[b], points[c]]
}

export function planeFrom3Points(
  p1: Point3D,
  p2: Point3D,
  p3: Point3D
): { normal: Vec3; distance: number } | undefined {
  const e1: Vec3 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z }
  const e2: Vec3 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z }
  const n: Vec3 = {
    x: e1.y * e2.z - e1.z * e2.y,
    y: e1.z * e2.x - e1.x * e2.z,
    z: e1.x * e2.y - e1.y * e2.x,
  }
  const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
  if (len < 1e-9) return undefined
  const normal: Vec3 = { x: n.x / len, y: n.y / len, z: n.z / len }
  const distance = normal.x * p1.x + normal.y * p1.y + normal.z * p1.z
  return { normal, distance }
}

export function collectInliers(
  points: Point3D[],
  plane: { normal: Vec3; distance: number },
  threshold: number
): Point3D[] {
  const inliers: Point3D[] = []
  for (const p of points) {
    const d = Math.abs(plane.normal.x * p.x + plane.normal.y * p.y + plane.normal.z * p.z - plane.distance)
    if (d <= threshold) inliers.push(p)
  }
  return inliers
}
