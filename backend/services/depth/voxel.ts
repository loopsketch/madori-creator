import type { Point3D } from '../../types'

// 3D voxel grid によるダウンサンプル。各ボクセルに属する点を 1 点に集約する
// (代表点はボクセル内の重心)。real-time ループで点群が爆発しないようにする。

export interface VoxelDownsampleOptions {
  voxelSizeM: number
  // 上限を超えたらランダム間引き (近似) で更に削る
  maxPoints?: number
}

export function voxelDownsample(
  points: Point3D[],
  options: VoxelDownsampleOptions
): Point3D[] {
  const size = options.voxelSizeM
  if (points.length === 0 || size <= 0) return points.slice()

  const buckets = new Map<string, { sx: number; sy: number; sz: number; n: number }>()
  for (const p of points) {
    const ix = Math.floor(p.x / size)
    const iy = Math.floor(p.y / size)
    const iz = Math.floor(p.z / size)
    const key = `${ix}|${iy}|${iz}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.sx += p.x
      bucket.sy += p.y
      bucket.sz += p.z
      bucket.n += 1
    } else {
      buckets.set(key, { sx: p.x, sy: p.y, sz: p.z, n: 1 })
    }
  }

  const out: Point3D[] = []
  for (const b of buckets.values()) {
    out.push({ x: b.sx / b.n, y: b.sy / b.n, z: b.sz / b.n })
  }

  if (options.maxPoints && out.length > options.maxPoints) {
    return reservoirSample(out, options.maxPoints)
  }
  return out
}

// 簡易な reservoir sampling (Math.random ベース)
function reservoirSample<T>(items: T[], k: number): T[] {
  const out = items.slice(0, k)
  for (let i = k; i < items.length; i++) {
    const j = Math.floor(Math.random() * (i + 1))
    if (j < k) out[j] = items[i]
  }
  return out
}
