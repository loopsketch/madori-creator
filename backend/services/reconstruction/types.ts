// 床面・壁線抽出 (#12) の入出力型。
// 入力点群は #17 で確定した世界座標系 (Z 軸 = 鉛直上) の前提。

export interface Vec3 {
  x: number
  y: number
  z: number
}

export type Point3D = Vec3

export interface Plane {
  // 単位法線
  normal: Vec3
  // 平面方程式 normal · x = distance
  distance: number
  // この平面に属する点 (世界座標)
  inliers: Point3D[]
}

export interface Floor extends Plane {
  // 床面の高さ (世界 Z 座標)
  z: number
}

// 上から見た 2D 線分として表現する壁。
export interface Wall {
  start: { x: number; y: number }
  end: { x: number; y: number }
  zRange: { min: number; max: number }
  // 壁面の水平法線 (XY 成分のみ、単位ベクトル)
  normal: { x: number; y: number }
  inlierCount: number
}

export interface ReconstructionOutput {
  floor?: Floor
  walls: Wall[]
}

export interface DetectionOptions {
  // RANSAC イテレーション数
  iterations?: number
  // インライア判定の距離閾値 (m)
  inlierThresholdM?: number
  // 床面に必要な最小インライア比 (0〜1)
  minFloorInlierRatio?: number
  // 壁面 1 つあたりの最小インライア数
  minWallInliers?: number
  // 検出する壁の最大数 (累積 RANSAC)
  maxWalls?: number
  // 床法線の z 成分がこれ以上であれば「床」扱い
  floorNormalZThreshold?: number
  // 壁法線の z 成分がこれ以下なら「壁」扱い
  wallNormalZThreshold?: number
}
