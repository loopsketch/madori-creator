import { fitPlaneRansac } from './ransac'
import type { DetectionOptions, Floor, Point3D } from './types'

// 床面検出: 法線が +Z 寄りで、最も z が低い (最も多くのインライアを持つ) 平面を採用する。
// RANSAC の述語で +Z 寄りに絞り、点群密度の高さで床を選び出す。

export function detectFloor(
  points: Point3D[],
  options: Required<Pick<DetectionOptions, 'iterations' | 'inlierThresholdM' | 'minFloorInlierRatio' | 'floorNormalZThreshold'>>
): Floor | undefined {
  if (points.length < 3) return undefined

  const plane = fitPlaneRansac(points, {
    iterations: options.iterations,
    inlierThreshold: options.inlierThresholdM,
    earlyAcceptRatio: 0.5,
    predicate: (p) => Math.abs(p.normal.z) >= options.floorNormalZThreshold,
  })

  if (!plane) return undefined

  const requiredCount = Math.ceil(points.length * options.minFloorInlierRatio)
  if (plane.inliers.length < requiredCount) return undefined

  // 法線を +Z 向きに正規化
  let { normal, distance, inliers } = plane
  if (normal.z < 0) {
    normal = { x: -normal.x, y: -normal.y, z: -normal.z }
    distance = -distance
  }

  // 床の高さ: インライアの z 平均 (最小二乗 refine の代替)
  const z = inliers.reduce((acc, p) => acc + p.z, 0) / inliers.length

  return { normal, distance, inliers, z }
}
