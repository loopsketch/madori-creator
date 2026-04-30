// AlvaAR が findCameraPoseWithIMU() に渡す IMU データを生成するユーティリティ。
// 元実装: AlvaAR/examples/public/assets/imu.js (GPL-3.0、alanross/AlvaAR)
// を TypeScript に移植したもの。本ファイル全体も GPL-3.0 で配布される。

const DEG2RAD = Math.PI / 180

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

export interface MotionSample {
  timestamp: number
  gx: number
  gy: number
  gz: number
  ax: number
  ay: number
  az: number
}

function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const half = angle / 2
  const s = Math.sin(half)
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(half) }
}

function quatFromEulerZXY(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return {
    x: s1 * c2 * c3 - c1 * s2 * s3,
    y: c1 * s2 * c3 + s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  }
}

function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y,
    y: a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z,
    z: a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function quatDot(a: Quat, b: Quat): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

const EPS = 0.000001

export class AlvaIMU {
  motion: MotionSample[] = []
  orientation: Quat = { x: 1, y: 0, z: 0, w: 1 }

  private readonly worldTransform: Quat
  private readonly boundMotion: (e: DeviceMotionEvent) => void
  private readonly boundOrientation: (e: DeviceOrientationEvent) => void
  private listening = false

  constructor() {
    // iOS では DeviceOrientation の基準が他端末と異なるため、世界変換を 1 段挟んで
    // AlvaAR の SLAM が前提とする座標系に揃える (元実装と同じ補正)。
    this.worldTransform = isIOS()
      ? quatFromAxisAngle(1, 0, 0, -Math.PI / 2)
      : quatFromAxisAngle(0, 1, 0, Math.PI / 2)
    this.boundMotion = this.handleMotion.bind(this)
    this.boundOrientation = this.handleOrientation.bind(this)
  }

  start(): void {
    if (this.listening) return
    window.addEventListener('devicemotion', this.boundMotion, false)
    window.addEventListener('deviceorientation', this.boundOrientation, false)
    this.listening = true
  }

  stop(): void {
    if (!this.listening) return
    window.removeEventListener('devicemotion', this.boundMotion)
    window.removeEventListener('deviceorientation', this.boundOrientation)
    this.listening = false
    this.motion.length = 0
  }

  // 次の findCameraPoseWithIMU 呼び出し前に呼ぶことで、既消費の motion サンプルを破棄する。
  clear(): void {
    this.motion.length = 0
  }

  private handleMotion(event: DeviceMotionEvent): void {
    const rate = event.rotationRate
    const acc = event.acceleration
    if (!rate || !acc) return
    const gx = (rate.beta ?? 0) * DEG2RAD
    const gy = (rate.gamma ?? 0) * DEG2RAD
    const gz = (rate.alpha ?? 0) * DEG2RAD
    const ax = acc.x ?? 0
    const ay = acc.y ?? 0
    const az = acc.z ?? 0
    this.motion.push({ timestamp: Date.now(), gx, gy, gz, ax, ay, az })
  }

  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha === null || event.beta === null || event.gamma === null) return
    const x = event.beta * DEG2RAD
    const y = event.gamma * DEG2RAD
    const z = event.alpha * DEG2RAD
    const next = quatMultiply(this.worldTransform, quatFromEulerZXY(x, y, z))
    if (8 * (1 - quatDot(this.orientation, next)) > EPS) {
      this.orientation = next
    }
  }
}
