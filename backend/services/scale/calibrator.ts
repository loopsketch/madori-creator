import type { MotionSnapshot, RotationMatrix3, ScaleHint } from '../../types'

// issue #23: 撮影中の姿勢追従。
// computeFrameOrientation は各フレームの gravity と alpha (任意) から、
// 「そのフレームのカメラ座標系 → 初期確定済みの世界座標系」回転行列を作る。
// 平行移動はゼロ仮定 (issue #26 で別途扱う)。

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

// 各フレームの motion から、そのフレームのカメラ → 世界座標系の回転を構築する。
// 世界座標系の基準は初期フレームで確定済みの baseOrientation を引き継ぐ。
// alpha (DeviceOrientation) が取れていれば yaw 差分を反映し、撮影者が
// 体ごと回ったケースにも追従する。alpha 不在時は yaw=0 仮定で pitch/roll のみ追従。
export function computeFrameOrientation(
  motion: MotionSnapshot | undefined,
  baseOrientation: RotationMatrix3,
  baseAlphaDeg?: number
): RotationMatrix3 | undefined {
  if (!motion?.gravity) return undefined
  const { x: gx, y: gy, z: gz } = motion.gravity
  const magnitude = Math.sqrt(gx * gx + gy * gy + gz * gz)
  if (magnitude < 1e-3) return undefined
  const ratio = magnitude / EARTH_GRAVITY_MS2
  if (ratio < GRAVITY_VALID_MIN_RATIO || ratio > GRAVITY_VALID_MAX_RATIO) return undefined

  // 現フレームの camera 座標における world Z (重力の反対方向)
  const zCam: Vec3 = {
    x: -gx / magnitude,
    y: -gy / magnitude,
    z: -gz / magnitude,
  }

  // 初期フレームでの worldX を camera 座標で取得 (baseOrientation の row 0)
  let worldXInCam: Vec3 = {
    x: baseOrientation[0],
    y: baseOrientation[1],
    z: baseOrientation[2],
  }

  // alpha が両方取れている場合、yaw 差分を world Z 軸周りに加える。
  // alpha は時計回り正 (北 → 東)。世界座標系は右手系・worldZ が上向きなので、
  // 上から見ると反時計回りに正となる → 符号反転して適用。
  const currentAlpha = motion.orientation?.alpha
  if (baseAlphaDeg !== undefined && currentAlpha !== undefined) {
    const yawDiffRad = ((currentAlpha - baseAlphaDeg) * Math.PI) / 180
    worldXInCam = rotateAroundAxis(worldXInCam, zCam, -yawDiffRad)
  }

  // 現フレームの zCam に直交化して xCam を作る (= yaw 仮定の維持)
  const xCamRaw = orthogonalize(worldXInCam, zCam)
  if (length(xCamRaw) < 1e-6) return undefined
  const xCam = normalize(xCamRaw)
  const yCam = cross(zCam, xCam)

  return [
    xCam.x, xCam.y, xCam.z,
    yCam.x, yCam.y, yCam.z,
    zCam.x, zCam.y, zCam.z,
  ]
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

// Rodrigues 回転公式: ベクトル v を単位軸 axis 周りに angleRad 回転する。
function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const k = dot(axis, v)
  const c = cross(axis, v)
  return {
    x: v.x * cos + c.x * sin + axis.x * k * (1 - cos),
    y: v.y * cos + c.y * sin + axis.y * k * (1 - cos),
    z: v.z * cos + c.z * sin + axis.z * k * (1 - cos),
  }
}

// issue #26: AlvaAR pose を madori 世界座標系の (rotation, translation) に変換する。
//
// 入力:
//   currentPose      : フレーム F の AlvaAR pose (4x4 列優先, camera-to-world, OpenCV 系)
//   basePose         : 撮影開始時の AlvaAR pose (= 初期 camera_0 の AR_world 位置)
//   baseOrientation  : camera_0 → madori_world の 3x3 回転 (calibrator から取得済み)
//
// AlvaAR の AR_world は camera_0 のローカル座標系と一致するため、相対 pose
// (basePose^-1 × currentPose) は「camera_F → camera_0」を表す。これに baseOrientation
// を掛けると madori 世界座標系での camera_F の rotation と translation が得られる。
export interface FramePose {
  rotation: RotationMatrix3
  translation: Vec3
}

export function transformAlvaPose(
  currentPose: number[],
  basePose: number[],
  baseOrientation: RotationMatrix3
): FramePose | undefined {
  if (currentPose.length < 16 || basePose.length < 16) return undefined

  const baseInv = invertRigidMat4(basePose)
  if (!baseInv) return undefined
  const rel = multiplyMat4(baseInv, currentPose)

  const relRot: RotationMatrix3 = [
    rel[0], rel[1], rel[2],
    rel[4], rel[5], rel[6],
    rel[8], rel[9], rel[10],
  ]
  const relT: Vec3 = { x: rel[12], y: rel[13], z: rel[14] }

  return {
    rotation: multiplyRotMat3(baseOrientation, relRot),
    translation: applyRotMat3(baseOrientation, relT),
  }
}

// 4x4 列優先で rigid (回転 + 並進のみ) を仮定した逆変換。
function invertRigidMat4(m: number[]): number[] | undefined {
  // rigid なので回転は転置で逆。並進は -R^T t。
  const r = [
    m[0], m[1], m[2],
    m[4], m[5], m[6],
    m[8], m[9], m[10],
  ]
  const t = { x: m[12], y: m[13], z: m[14] }
  // 転置回転 (= 逆回転)
  const rT = [
    r[0], r[3], r[6],
    r[1], r[4], r[7],
    r[2], r[5], r[8],
  ]
  const tInv = {
    x: -(rT[0] * t.x + rT[1] * t.y + rT[2] * t.z),
    y: -(rT[3] * t.x + rT[4] * t.y + rT[5] * t.z),
    z: -(rT[6] * t.x + rT[7] * t.y + rT[8] * t.z),
  }
  return [
    rT[0], rT[1], rT[2], 0,
    rT[3], rT[4], rT[5], 0,
    rT[6], rT[7], rT[8], 0,
    tInv.x, tInv.y, tInv.z, 1,
  ]
}

// 4x4 列優先行列の積 (a × b)。
function multiplyMat4(a: number[], b: number[]): number[] {
  const out: number[] = new Array(16).fill(0)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0
      for (let k = 0; k < 4; k++) {
        s += a[k * 4 + i] * b[j * 4 + k]
      }
      out[j * 4 + i] = s
    }
  }
  return out
}

// 3x3 行列の積 (row-major、a × b)。
function multiplyRotMat3(a: RotationMatrix3, b: RotationMatrix3): RotationMatrix3 {
  const out: number[] = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[j + 3] + a[i * 3 + 2] * b[j + 6]
    }
  }
  return out as RotationMatrix3
}

// 3x3 行列 × vec3 (row-major)
function applyRotMat3(r: RotationMatrix3, v: Vec3): Vec3 {
  return {
    x: r[0] * v.x + r[1] * v.y + r[2] * v.z,
    y: r[3] * v.x + r[4] * v.y + r[5] * v.z,
    z: r[6] * v.x + r[7] * v.y + r[8] * v.z,
  }
}
