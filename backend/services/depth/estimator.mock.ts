import type { DepthMap } from '../../types'

// ONNX 実装 (#16 第2段) を導入する前のモック深度推定。
// 入力画像の内容には依存せず、中央が近く周辺が遠い半球状の相対深度マップを返す。
// 累積点群と RANSAC のパイプラインを通すことを目的としており、ここで返る値の絶対値は
// scaleHint で正規化される前提。

export const MOCK_DEPTH_WIDTH = 192
export const MOCK_DEPTH_HEIGHT = 144

export interface MockOptions {
  width?: number
  height?: number
}

export async function estimateDepthMock(
  _imageBuffer: Buffer,
  options: MockOptions = {}
): Promise<DepthMap> {
  const width = options.width ?? MOCK_DEPTH_WIDTH
  const height = options.height ?? MOCK_DEPTH_HEIGHT
  const data = new Float32Array(width * height)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const maxDist = Math.hypot(cx, cy)

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const r = Math.hypot(u - cx, v - cy) / maxDist
      // 0.6 (中央) 〜 1.6 (隅) の範囲。後段で中央値が scaleHint.handHeldHeightM に
      // 揃うように正規化されるため、絶対値の意味は薄い。
      data[v * width + u] = 0.6 + r * 1.0
    }
  }

  return { width, height, data }
}
