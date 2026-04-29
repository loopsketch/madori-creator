import type { MotionSnapshot, RotationMatrix3, ScaleHint } from '../../types'

// 重力ベクトルから世界座標系への回転行列を組み立てる。
// 持ち手 150cm 仮定をスケールヒントとして提供する。
//
// 世界座標系の取り方:
//   X 軸: 水平 (撮影開始時のカメラ右方向の射影)
//   Y 軸: 水平 (右手系で X × Z)
//   Z 軸: 鉛直上方向 (重力反対)
//
// 単眼カメラでは絶対スケールは出せないため、深度マップの正規化に
// 「持ち手の高さ ≒ 1.5 m」を使う。これが計測値ではなく仮定であることに注意。
// 校正 UI による上書きは将来対応 (issue 未起票)。

export const HAND_HELD_HEIGHT_M = 1.5
export const EARTH_GRAVITY_MS2 = 9.80665

// 9.8 m/s^2 から逸脱しすぎている重力ベクトルは無視する判定閾値
const GRAVITY_VALID_MIN_RATIO = 0.7
const GRAVITY_VALID_MAX_RATIO = 1.3

export interface CalibrationResult {
  worldOrientation?: RotationMatrix3
  scaleHint: ScaleHint
}

export function calibrateFromMotion(motion: MotionSnapshot | undefined): CalibrationResult {
  const scaleHint: ScaleHint = { handHeldHeightM: HAND_HELD_HEIGHT_M }
  if (!motion?.gravity) return { scaleHint }

  const { x, y, z } = motion.gravity
  const magnitude = Math.sqrt(x * x + y * y + z * z)
  if (magnitude < 1e-3) return { scaleHint }

  const ratio = magnitude / EARTH_GRAVITY_MS2
  scaleHint.gravityMagnitudeRatio = ratio
  if (ratio < GRAVITY_VALID_MIN_RATIO || ratio > GRAVITY_VALID_MAX_RATIO) {
    return { scaleHint }
  }

  return {
    worldOrientation: buildWorldOrientation(x / magnitude, y / magnitude, z / magnitude),
    scaleHint,
  }
}

// カメラ座標における重力方向 (単位ベクトル) から、camera → world の回転行列を組む。
// 世界座標の Z 軸 (上) は -gravity に対応。X/Y 軸はカメラのロール除去で決定する。
function buildWorldOrientation(gx: number, gy: number, gz: number): RotationMatrix3 {
  // 世界 Z 軸 (上) の camera 表現
  const zCam = { x: -gx, y: -gy, z: -gz }

  // カメラのおおよその右方向 (camera +X) を初期候補にし、Z 成分を抜いて水平にする。
  // それが世界 X 軸 (camera 表現) になる。
  let xCam = orthogonalize({ x: 1, y: 0, z: 0 }, zCam)
  // 退化ケース (カメラが完全に横倒しで右が上を向いた場合) → 別軸を使う
  if (length(xCam) < 1e-6) {
    xCam = orthogonalize({ x: 0, y: 1, z: 0 }, zCam)
  }
  xCam = normalize(xCam)
  const yCam = cross(zCam, xCam)

  // camera → world の回転行列 R は、行が世界軸を camera 座標で表したベクトル。
  // R * v_camera = v_world と取りたいので、行に worldX/worldY/worldZ を camera 表現で置く。
  return [
    xCam.x, xCam.y, xCam.z,
    yCam.x, yCam.y, yCam.z,
    zCam.x, zCam.y, zCam.z,
  ]
}

interface Vec3 { x: number; y: number; z: number }

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

function normalize(v: Vec3): Vec3 {
  const l = length(v)
  return l > 0 ? { x: v.x / l, y: v.y / l, z: v.z / l } : v
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

// b 方向の成分を a から除去する (Gram-Schmidt の 1 ステップ)
function orthogonalize(a: Vec3, b: Vec3): Vec3 {
  const k = dot(a, b)
  return { x: a.x - k * b.x, y: a.y - k * b.y, z: a.z - k * b.z }
}
