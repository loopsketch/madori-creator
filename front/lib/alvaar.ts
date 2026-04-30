// AlvaAR (WASM 単眼 SLAM) のラッパ。
// 同梱モジュールは GPL-3.0。詳細はリポジトリ root の LICENSE / README を参照。
//
// AlvaAR の出力 pose は 4x4 列優先の camera-to-world (model matrix) で、
// 座標系は OpenCV 系 (+X 右 / +Y 下 / +Z 前)。
// 公式 Three.js コネクタ (alva_ar_three.js) では Three.js (OpenGL 系: +Y 上 / +Z 後ろ)
// へ渡す際に Y/Z 方向の translation 反転と quaternion.x 反転を行っている。

import { AlvaIMU, type Quat, type MotionSample } from './alva-imu'

interface AlvaARInstance {
  findCameraPose: (imageData: ImageData) => Float32Array | null
  findCameraPoseWithIMU?: (
    imageData: ImageData,
    orientation: Quat,
    motion: MotionSample[]
  ) => Float32Array | null
  getFramePoints?: () => Array<{ x: number; y: number }>
  reset?: () => void
}

interface AlvaARConstructor {
  Initialize: (width: number, height: number) => Promise<AlvaARInstance>
}

let instance: AlvaARInstance | null = null
let trackingHandle: ReturnType<typeof setTimeout> | null = null
let lastPose: number[] | null = null
let lastStatus: PoseTracking = 'unavailable'
let lastImageData: ImageData | null = null
let lastFramePoints: Array<{ x: number; y: number }> = []
let imu: AlvaIMU | null = null

export type PoseTracking = 'tracking' | 'lost' | 'unavailable'

export interface PoseResult {
  pose: number[] | null
  status: PoseTracking
}

export type ImageDataProvider = () => ImageData | null

// 初回呼び出しでモジュールを動的 import し、AlvaAR を初期化する。
// 失敗時は status='unavailable' のフォールバックモードに入る (推定なし)。
//
// 実装メモ: AlvaAR は public/poc/lib/ に静的配信されており、Vite のバンドル対象
// 外として扱う必要がある。文字列リテラルでの dynamic import は Vite が静的解析
// しようとして失敗するため、URL を実行時に組み立てて回避する。
export async function initialize(width: number, height: number): Promise<boolean> {
  if (instance) return true
  try {
    const path = '/poc/lib/alva_ar.js'
    const url = `${window.location.origin}${path}`
    const mod = (await import(/* @vite-ignore */ url)) as { AlvaAR?: AlvaARConstructor }
    if (!mod.AlvaAR) throw new Error('AlvaAR エクスポートが見つからない')
    instance = await mod.AlvaAR.Initialize(width, height)
    return true
  } catch (err) {
    console.warn('[alvaar] 初期化に失敗:', err)
    instance = null
    return false
  }
}

export function isInitialized(): boolean {
  return instance !== null
}

// imageData からカメラ pose を計算して返す。
// 失敗 (tracking lost) 時は status='lost'、未初期化なら 'unavailable'。
export function findPose(imageData: ImageData): PoseResult {
  if (!instance) return { pose: null, status: 'unavailable' }
  try {
    const raw = instance.findCameraPose(imageData)
    if (!raw) return { pose: null, status: 'lost' }
    return { pose: Array.from(raw), status: 'tracking' }
  } catch (err) {
    console.warn('[alvaar] findCameraPose 例外:', err)
    return { pose: null, status: 'lost' }
  }
}

// AlvaAR は連続フレームから動きを推定するため、backend 送信ループ
// (~1Hz) では間隔が空きすぎて頻繁に tracking lost する。本関数で
// 独立した高頻度ループを起動し、毎回 latest pose を更新する。
// backend 送信側は getLatestPose() で最新値を読むだけ。
//
// 視点が大きく変わったときの SLAM の不安定さを抑えるため、AlvaAR が
// IMU 連携の findCameraPoseWithIMU を露出している場合はこちらを優先。
// IMU は DeviceMotion + DeviceOrientation を内部で取得・整形して渡す。
export function startContinuousTracking(
  provide: ImageDataProvider,
  intervalMs = 33
): void {
  if (trackingHandle !== null) return
  if (!imu) {
    imu = new AlvaIMU()
    imu.start()
  }
  const useImu = !!instance?.findCameraPoseWithIMU
  const tick = () => {
    if (!instance) {
      trackingHandle = null
      return
    }
    const data = provide()
    if (data) {
      lastImageData = data
      try {
        let raw: Float32Array | null = null
        if (useImu && instance.findCameraPoseWithIMU && imu) {
          raw = instance.findCameraPoseWithIMU(data, imu.orientation, imu.motion)
          imu.clear()
        } else {
          raw = instance.findCameraPose(data)
        }
        if (raw) {
          lastPose = Array.from(raw)
          lastStatus = 'tracking'
        } else {
          lastStatus = 'lost'
        }
      } catch (err) {
        console.warn('[alvaar] 継続 tracking で例外:', err)
        lastStatus = 'lost'
      }
      // 特徴点 (ORB feature points) を保存。デバッグ表示用。
      if (instance.getFramePoints) {
        try {
          const pts = instance.getFramePoints()
          if (Array.isArray(pts)) lastFramePoints = pts
        } catch {
          /* ignore */
        }
      }
    }
    trackingHandle = setTimeout(tick, intervalMs)
  }
  lastStatus = 'lost'
  tick()
}

export function stopContinuousTracking(): void {
  if (trackingHandle !== null) {
    clearTimeout(trackingHandle)
    trackingHandle = null
  }
  if (imu) {
    imu.stop()
    imu = null
  }
  lastPose = null
  lastStatus = 'unavailable'
  lastImageData = null
  lastFramePoints = []
}

// 現在 IMU 連携モードで動作中か (UI 表示用)。
export function isUsingImu(): boolean {
  return !!instance?.findCameraPoseWithIMU
}

export function getLatestPose(): PoseResult {
  return { pose: lastPose, status: lastStatus }
}

export function getLatestImageData(): ImageData | null {
  return lastImageData
}

export function getLatestFramePoints(): Array<{ x: number; y: number }> {
  return lastFramePoints
}

export function dispose(): void {
  stopContinuousTracking()
  instance = null
}
