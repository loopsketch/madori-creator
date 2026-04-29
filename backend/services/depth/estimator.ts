import { estimateDepthMock } from './estimator.mock'
import { estimateDepthOnnx, isOnnxConfigured } from './estimator.onnx'
import type { DepthMap } from '../../types'

// 深度推定のエントリポイント。
// ONNX が利用できない環境 (モデル DL 失敗、ライブラリ初期化失敗等) では
// 自動的にモックへフォールバックして撮影パイプラインの停止を回避する。

let onnxFailed = false

export async function estimateDepth(imageBuffer: Buffer): Promise<DepthMap> {
  if (!isOnnxConfigured() || onnxFailed) {
    return estimateDepthMock(imageBuffer)
  }
  try {
    return await estimateDepthOnnx(imageBuffer)
  } catch (err) {
    console.error('[depth] ONNX 推論に失敗、以降はモックにフォールバックします:', err)
    onnxFailed = true
    return estimateDepthMock(imageBuffer)
  }
}

// テスト用
export function resetEstimatorForTesting(): void {
  onnxFailed = false
}
