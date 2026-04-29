import { detectFloor } from './floor'
import { detectWalls } from './walls'
import type { DetectionOptions, Point3D, ReconstructionOutput } from './types'

// 床面・壁線抽出の公開エントリポイント。
// 入力点群は世界座標系 (Z 軸 = 鉛直上) を前提とする。

const DEFAULTS: Required<DetectionOptions> = {
  iterations: 200,
  inlierThresholdM: 0.05,
  minFloorInlierRatio: 0.05,
  minWallInliers: 50,
  maxWalls: 8,
  floorNormalZThreshold: 0.85,
  wallNormalZThreshold: 0.3,
}

export function detectFloorAndWalls(
  points: Point3D[],
  options: DetectionOptions = {}
): ReconstructionOutput {
  const opts: Required<DetectionOptions> = { ...DEFAULTS, ...options }

  const floor = detectFloor(points, {
    iterations: opts.iterations,
    inlierThresholdM: opts.inlierThresholdM,
    minFloorInlierRatio: opts.minFloorInlierRatio,
    floorNormalZThreshold: opts.floorNormalZThreshold,
  })

  const walls = detectWalls(points, floor, {
    iterations: opts.iterations,
    inlierThresholdM: opts.inlierThresholdM,
    minWallInliers: opts.minWallInliers,
    maxWalls: opts.maxWalls,
    wallNormalZThreshold: opts.wallNormalZThreshold,
  })

  return { floor, walls }
}

export type { ReconstructionOutput, Floor, Wall, Point3D, Vec3, Plane, DetectionOptions } from './types'
