import { collectInliers, fitPlaneRansac } from './ransac'
import type { DetectionOptions, Floor, Point3D, Wall } from './types'

// 壁面検出: 床面のインライアを除外した点群から、法線が水平な平面を
// 累積 RANSAC で複数取り出す。各平面を XY 平面に射影し、主軸 (PCA) で
// 線分の端点 (始点・終点) を決定する。

export function detectWalls(
  points: Point3D[],
  floor: Floor | undefined,
  options: Required<
    Pick<
      DetectionOptions,
      | 'iterations'
      | 'inlierThresholdM'
      | 'minWallInliers'
      | 'maxWalls'
      | 'wallNormalZThreshold'
    >
  >
): Wall[] {
  // 床より明らかに低い点 (床面の inliers) は除外する
  const remaining = floor
    ? excludeFloorPoints(points, floor)
    : points.slice()

  const walls: Wall[] = []
  let working = remaining

  for (let i = 0; i < options.maxWalls; i++) {
    if (working.length < options.minWallInliers) break

    const plane = fitPlaneRansac(working, {
      iterations: options.iterations,
      inlierThreshold: options.inlierThresholdM,
      predicate: (p) => Math.abs(p.normal.z) <= options.wallNormalZThreshold,
    })
    if (!plane || plane.inliers.length < options.minWallInliers) break

    const wall = buildWallFromPlane(plane.inliers, plane.normal)
    walls.push(wall)

    // インライアを集合的に除外して次の壁を探す
    const inlierSet = new Set(plane.inliers)
    working = working.filter((p) => !inlierSet.has(p))
  }

  return walls
}

function excludeFloorPoints(points: Point3D[], floor: Floor): Point3D[] {
  // 床面方程式 normal·x = distance、threshold 内の点を除外する。
  // 床のインライア集合をそのまま除く方が確実だが、Set による比較で十分。
  const set = new Set(floor.inliers)
  return points.filter((p) => !set.has(p))
}

function buildWallFromPlane(inliers: Point3D[], planeNormal: { x: number; y: number; z: number }): Wall {
  // XY 平面に射影し、PCA の第一主成分を主軸として 2D 線分にまとめる。
  const projected = inliers.map((p) => ({ x: p.x, y: p.y }))
  const meanX = avg(projected.map((p) => p.x))
  const meanY = avg(projected.map((p) => p.y))

  // 2x2 共分散行列の固有ベクトル (主軸) を解析的に求める。
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of projected) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const n = projected.length
  sxx /= n
  syy /= n
  sxy /= n

  const trace = sxx + syy
  const det = sxx * syy - sxy * sxy
  const halfTrace = trace / 2
  const discriminant = Math.max(0, halfTrace * halfTrace - det)
  const lambda1 = halfTrace + Math.sqrt(discriminant)

  let axis: { x: number; y: number }
  if (Math.abs(sxy) > 1e-9) {
    axis = { x: lambda1 - syy, y: sxy }
  } else {
    axis = sxx >= syy ? { x: 1, y: 0 } : { x: 0, y: 1 }
  }
  const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y) || 1
  axis = { x: axis.x / axisLen, y: axis.y / axisLen }

  // 主軸への射影座標から線分の両端を決定
  let tMin = Number.POSITIVE_INFINITY
  let tMax = Number.NEGATIVE_INFINITY
  for (const p of projected) {
    const t = (p.x - meanX) * axis.x + (p.y - meanY) * axis.y
    if (t < tMin) tMin = t
    if (t > tMax) tMax = t
  }
  const start = { x: meanX + axis.x * tMin, y: meanY + axis.y * tMin }
  const end = { x: meanX + axis.x * tMax, y: meanY + axis.y * tMax }

  // z レンジは inliers の z 範囲をそのまま使う
  let zMin = Number.POSITIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY
  for (const p of inliers) {
    if (p.z < zMin) zMin = p.z
    if (p.z > zMax) zMax = p.z
  }

  // 壁の水平法線 (XY のみ正規化)
  const horizLen = Math.sqrt(planeNormal.x * planeNormal.x + planeNormal.y * planeNormal.y) || 1
  const normal2d = { x: planeNormal.x / horizLen, y: planeNormal.y / horizLen }

  return {
    start,
    end,
    zRange: { min: zMin, max: zMax },
    normal: normal2d,
    inlierCount: inliers.length,
  }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}
