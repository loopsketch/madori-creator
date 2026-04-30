// DeviceMotion / DeviceOrientation のラッパ。
// iOS 13+ では DeviceMotionEvent.requestPermission() の明示許可が必要で、
// この呼び出しはユーザージェスチャ (タップ等) からしか動かないことに注意。

export interface MotionSnapshot {
  gravity?: { x: number; y: number; z: number }
  orientation?: { alpha: number; beta: number; gamma: number }
  timestamp: number
  // AlvaAR (issue #26) で取得したカメラ pose。4x4 列優先 (camera-to-world、OpenCV 系)。
  // tracking lost や未初期化時は cameraPose は省略され、poseTracking で状態を伝える。
  cameraPose?: number[]
  poseTracking?: 'tracking' | 'lost' | 'unavailable'
}

interface DeviceMotionEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

let latest: MotionSnapshot = { timestamp: Date.now() }
let listening = false

const handleMotion = (event: DeviceMotionEvent) => {
  // accelerationIncludingGravity から重力ベクトルを取り出す。
  // 静止時はほぼ重力ベクトルそのもの。動きが大きいときはノイズが乗るが、
  // 平面検出側で複数フレーム平均化する想定。
  //
  // DeviceMotion の端末座標系 (+X 右, +Y 上, +Z 手前) と、backend の
  // 深度投影や AlvaAR が前提とする OpenCV カメラ座標系 (+X 右, +Y 下,
  // +Z 前=レンズ方向) は Y/Z 軸が反転しているため、ここで変換する。
  // backend 側はすべての座標系を OpenCV camera 系に揃える。
  const ag = event.accelerationIncludingGravity
  const g = ag && ag.x !== null && ag.y !== null && ag.z !== null
    ? { x: ag.x as number, y: -(ag.y as number), z: -(ag.z as number) }
    : undefined
  latest = { ...latest, gravity: g, timestamp: Date.now() }
}

const handleOrientation = (event: DeviceOrientationEvent) => {
  if (event.alpha === null || event.beta === null || event.gamma === null) return
  latest = {
    ...latest,
    orientation: { alpha: event.alpha, beta: event.beta, gamma: event.gamma },
    timestamp: Date.now(),
  }
}

export async function requestMotionPermission(): Promise<boolean> {
  // iOS 13+ では DeviceMotionEvent.requestPermission が存在し、明示許可が必要。
  // それ以外 (Android Chrome や macOS Safari など) では許可不要。
  const DM = (typeof DeviceMotionEvent !== 'undefined'
    ? (DeviceMotionEvent as unknown as DeviceMotionEventStatic)
    : undefined)
  const DO = (typeof DeviceOrientationEvent !== 'undefined'
    ? (DeviceOrientationEvent as unknown as DeviceOrientationEventStatic)
    : undefined)

  const motionGranted = DM?.requestPermission
    ? (await DM.requestPermission()) === 'granted'
    : true
  const orientationGranted = DO?.requestPermission
    ? (await DO.requestPermission()) === 'granted'
    : true

  return motionGranted && orientationGranted
}

export function startTracking(): void {
  if (listening) return
  window.addEventListener('devicemotion', handleMotion)
  window.addEventListener('deviceorientation', handleOrientation)
  listening = true
}

export function stopTracking(): void {
  if (!listening) return
  window.removeEventListener('devicemotion', handleMotion)
  window.removeEventListener('deviceorientation', handleOrientation)
  listening = false
}

export function getSnapshot(): MotionSnapshot {
  return { ...latest, timestamp: Date.now() }
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
}
