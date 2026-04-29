import type { CameraIntrinsics } from '../../types'

// iPhone メインカメラ (広角 26mm 換算) の概算 FoV。
// 機種特定はブラウザでは困難なため、デフォルト値で疑似的に運用する (issue #16 注釈参照)。

export const DEFAULT_HORIZONTAL_FOV_DEG = 77

export function getDefaultIntrinsics(width: number, height: number): CameraIntrinsics {
  const fovRad = (DEFAULT_HORIZONTAL_FOV_DEG * Math.PI) / 180
  const fx = width / 2 / Math.tan(fovRad / 2)
  // 正方画素を仮定 (fy = fx)
  const fy = fx
  return { fx, fy, cx: width / 2, cy: height / 2, width, height }
}
