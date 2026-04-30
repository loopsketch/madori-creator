// AlvaAR (WASM 単眼 SLAM) のラッパ。
// 同梱モジュールは GPL-3.0。詳細はリポジトリ root の LICENSE / README を参照。
//
// AlvaAR の出力 pose は 4x4 列優先の camera-to-world (model matrix) で、
// 座標系は OpenCV 系 (+X 右 / +Y 下 / +Z 前)。
// 公式 Three.js コネクタ (alva_ar_three.js) では Three.js (OpenGL 系: +Y 上 / +Z 後ろ)
// へ渡す際に Y/Z 方向の translation 反転と quaternion.x 反転を行っている。

interface AlvaARInstance {
  findCameraPose: (imageData: ImageData) => Float32Array | null
}

interface AlvaARConstructor {
  Initialize: (width: number, height: number) => Promise<AlvaARInstance>
}

let instance: AlvaARInstance | null = null

export type PoseTracking = 'tracking' | 'lost' | 'unavailable'

export interface PoseResult {
  pose: number[] | null
  status: PoseTracking
}

// 初回呼び出しでモジュールを動的 import し、AlvaAR を初期化する。
// 失敗時は status='unavailable' のフォールバックモードに入る (推定なし)。
export async function initialize(width: number, height: number): Promise<boolean> {
  if (instance) return true
  try {
    const url = '/poc/lib/alva_ar.js'
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

export function dispose(): void {
  instance = null
}
