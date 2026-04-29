import type {
  CameraIntrinsics,
  DepthMap,
  Point3D,
  RotationMatrix3,
} from '../../types'

// 深度マップ → カメラ座標点群 → 世界座標点群 へ変換するユーティリティ。
//
// 深度マップは ONNX 推論の生出力では相対値 (任意スケール) のことが多いので、
// scale hint (持ち手 150cm 仮定) で中央値を揃える正規化を別途行う。

export interface ProjectOptions {
  // 全画素ではなく stride ピクセルおきにサンプリングして点群サイズを抑える
  stride?: number
  // 異常値カット (この値以下や以上はスキップ)
  minDepth?: number
  maxDepth?: number
}

export function projectToCamera(
  depthMap: DepthMap,
  intrinsics: CameraIntrinsics,
  options: ProjectOptions = {}
): Point3D[] {
  const stride = Math.max(1, options.stride ?? 4)
  const minDepth = options.minDepth ?? 0.1
  const maxDepth = options.maxDepth ?? 20
  const { width, height, data } = depthMap
  const { fx, fy, cx, cy } = intrinsics

  const points: Point3D[] = []
  for (let v = 0; v < height; v += stride) {
    for (let u = 0; u < width; u += stride) {
      const z = data[v * width + u]
      if (!Number.isFinite(z) || z < minDepth || z > maxDepth) continue
      // ピンホールカメラの逆投影
      const x = ((u - cx) * z) / fx
      const y = ((v - cy) * z) / fy
      points.push({ x, y, z })
    }
  }
  return points
}

// camera → world の回転行列 (3x3、行=世界軸の camera 表現) を点群に適用する。
// worldOrientation が未確定なら点群をそのまま返す (姿勢未設定のフレーム想定)。
export function transformToWorld(
  camPoints: Point3D[],
  worldOrientation?: RotationMatrix3
): Point3D[] {
  if (!worldOrientation) return camPoints.slice()
  const R = worldOrientation
  const out: Point3D[] = new Array(camPoints.length)
  for (let i = 0; i < camPoints.length; i++) {
    const p = camPoints[i]
    out[i] = {
      x: R[0] * p.x + R[1] * p.y + R[2] * p.z,
      y: R[3] * p.x + R[4] * p.y + R[5] * p.z,
      z: R[6] * p.x + R[7] * p.y + R[8] * p.z,
    }
  }
  return out
}

// 相対深度マップを「中央値が targetCenterDepthM になる」ように一様スケール正規化する。
// 単眼深度の絶対スケールは原理的に出ないため、ここで持ち手 150cm 仮定を使う。
export function normalizeDepthByMedian(
  depthMap: DepthMap,
  targetCenterDepthM: number
): DepthMap {
  if (depthMap.data.length === 0) return depthMap
  const median = quickMedian(depthMap.data)
  if (median <= 0 || !Number.isFinite(median)) return depthMap

  const scale = targetCenterDepthM / median
  const data = new Float32Array(depthMap.data.length)
  for (let i = 0; i < data.length; i++) data[i] = depthMap.data[i] * scale
  return { width: depthMap.width, height: depthMap.height, data }
}

// Float32Array をコピーしてソート → 中央値。点数が多いほどコストが上がるが、
// width*height = 192*144 = ~27K 程度なら許容範囲。
function quickMedian(values: Float32Array): number {
  const arr = new Float32Array(values)
  arr.sort()
  const n = arr.length
  return n % 2 === 1 ? arr[(n - 1) / 2] : (arr[n / 2 - 1] + arr[n / 2]) / 2
}
