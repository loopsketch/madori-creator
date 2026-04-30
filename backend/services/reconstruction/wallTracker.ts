import type { Wall } from './types'

// 壁線の時系列マージ (issue #22)。
// フレームごとの RANSAC 結果は揺らぎが大きいため、
// 観測を「トラック」へクラスタリングして安定化する。

export interface WallObservation {
  frameIndex: number
  wall: Wall
}

export interface WallTrack {
  id: number
  observations: WallObservation[]
  lastSeenFrame: number
}

export interface WallTrackerState {
  tracks: WallTrack[]
  nextId: number
}

export interface WallTrackerOptions {
  // 同一壁面とみなす法線角度差の上限 (degree)
  angleThresholdDeg?: number
  // 同一壁面とみなす法線方向距離の上限 (m)
  distanceThresholdM?: number
  // 各トラックが保持する観測数の上限
  historyLimit?: number
  // この回数連続で観測されないトラックは破棄
  staleFrames?: number
  // 安定壁として採用する最小観測回数
  minObservations?: number
}

const DEFAULT_OPTIONS: Required<WallTrackerOptions> = {
  angleThresholdDeg: 15,
  distanceThresholdM: 0.3,
  historyLimit: 5,
  staleFrames: 10,
  minObservations: 1,
}

export function createWallTrackerState(): WallTrackerState {
  return { tracks: [], nextId: 1 }
}

// 既存状態 + 新観測 → 新状態 + 安定壁。純関数として実装し、prev は破壊しない。
export function ingestWalls(
  prev: WallTrackerState,
  frameIndex: number,
  observed: Wall[],
  options: WallTrackerOptions = {}
): { next: WallTrackerState; stable: Wall[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const tracks: WallTrack[] = prev.tracks.map((t) => ({
    id: t.id,
    observations: t.observations.slice(),
    lastSeenFrame: t.lastSeenFrame,
  }))
  let nextId = prev.nextId

  for (const wall of observed) {
    const idx = findMatchingTrack(tracks, wall, opts)
    if (idx >= 0) {
      const t = tracks[idx]
      t.observations.push({ frameIndex, wall })
      if (t.observations.length > opts.historyLimit) {
        t.observations.splice(0, t.observations.length - opts.historyLimit)
      }
      t.lastSeenFrame = frameIndex
    } else {
      tracks.push({
        id: nextId++,
        observations: [{ frameIndex, wall }],
        lastSeenFrame: frameIndex,
      })
    }
  }

  const alive = tracks.filter((t) => frameIndex - t.lastSeenFrame <= opts.staleFrames)

  const stable = alive
    .filter((t) => t.observations.length >= opts.minObservations)
    .map((t) => mergeObservations(t))

  return {
    next: { tracks: alive, nextId },
    stable,
  }
}

function findMatchingTrack(
  tracks: WallTrack[],
  wall: Wall,
  opts: Required<WallTrackerOptions>
): number {
  let bestIdx = -1
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i < tracks.length; i++) {
    const rep = mergeObservations(tracks[i])
    const angleDiff = wallAngleDifferenceDeg(rep.normal, wall.normal)
    if (angleDiff > opts.angleThresholdDeg) continue
    const distDiff = wallDistanceDifference(rep, wall)
    if (distDiff > opts.distanceThresholdM) continue
    const score =
      distDiff / opts.distanceThresholdM + angleDiff / opts.angleThresholdDeg
    if (score < bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  return bestIdx
}

// トラックの代表壁を観測の重み付き平均から組み立てる。
function mergeObservations(track: WallTrack): Wall {
  const obs = track.observations
  if (obs.length === 0) {
    throw new Error('wallTracker: track without observations')
  }
  const ref = obs[0].wall.normal

  let totalWeight = 0
  let nx = 0
  let ny = 0
  let cx = 0
  let cy = 0
  let zMin = Number.POSITIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY
  let inlierSum = 0

  for (const { wall } of obs) {
    const w = Math.max(1, wall.inlierCount)
    // 法線の符号を最初の観測に揃える
    const sign = wall.normal.x * ref.x + wall.normal.y * ref.y >= 0 ? 1 : -1
    nx += wall.normal.x * sign * w
    ny += wall.normal.y * sign * w
    const midX = (wall.start.x + wall.end.x) / 2
    const midY = (wall.start.y + wall.end.y) / 2
    cx += midX * w
    cy += midY * w
    if (wall.zRange.min < zMin) zMin = wall.zRange.min
    if (wall.zRange.max > zMax) zMax = wall.zRange.max
    inlierSum += wall.inlierCount
    totalWeight += w
  }

  nx /= totalWeight
  ny /= totalWeight
  const nlen = Math.sqrt(nx * nx + ny * ny) || 1
  const normal = { x: nx / nlen, y: ny / nlen }
  cx /= totalWeight
  cy /= totalWeight

  // 主軸は法線に直交
  const axis = { x: -normal.y, y: normal.x }

  let tMin = Number.POSITIVE_INFINITY
  let tMax = Number.NEGATIVE_INFINITY
  for (const { wall } of obs) {
    for (const p of [wall.start, wall.end]) {
      const t = (p.x - cx) * axis.x + (p.y - cy) * axis.y
      if (t < tMin) tMin = t
      if (t > tMax) tMax = t
    }
  }

  return {
    start: { x: cx + axis.x * tMin, y: cy + axis.y * tMin },
    end: { x: cx + axis.x * tMax, y: cy + axis.y * tMax },
    zRange: { min: zMin, max: zMax },
    normal,
    inlierCount: Math.round(inlierSum / obs.length),
  }
}

function wallAngleDifferenceDeg(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const aLen = Math.sqrt(a.x * a.x + a.y * a.y) || 1
  const bLen = Math.sqrt(b.x * b.x + b.y * b.y) || 1
  const dot = (a.x * b.x + a.y * b.y) / (aLen * bLen)
  const absDot = Math.min(1, Math.abs(dot))
  const rad = Math.acos(absDot)
  return (rad * 180) / Math.PI
}

function wallDistanceDifference(a: Wall, b: Wall): number {
  // 平面方程式の符号付き距離を法線符号を揃えて比較する
  const sign = a.normal.x * b.normal.x + a.normal.y * b.normal.y >= 0 ? 1 : -1
  const ma = midpoint(a)
  const mb = midpoint(b)
  const da = ma.x * a.normal.x + ma.y * a.normal.y
  const db = mb.x * (b.normal.x * sign) + mb.y * (b.normal.y * sign)
  return Math.abs(da - db)
}

function midpoint(w: Wall): { x: number; y: number } {
  return { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 }
}
