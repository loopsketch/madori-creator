import { calibrateFromMotion, HAND_HELD_HEIGHT_M } from '../scale/calibrator'
import { getDefaultIntrinsics } from '../depth/intrinsics'
import {
  normalizeDepthByMedian,
  projectToCamera,
  transformToWorld,
} from '../depth/pointcloud'
import { voxelDownsample } from '../depth/voxel'
import { detectFloorAndWalls } from '../reconstruction'
import { renderTopdownSvg } from '../render'
import type {
  DepthMap,
  FrameRecord,
  MotionSnapshot,
  Point3D,
  ProcessedImage,
  SessionState,
} from '../../types'

// ストリーミング撮影セッションの in-memory ストア。
// 永続化と分散対応は #14 で Redis ベースに置き換える。

const sessions = new Map<string, SessionState>()

// 累積点群の上限。これを超えると voxel ダウンサンプル後にもサンプリングで間引く。
const MAX_POINT_CLOUD_SIZE = 50_000
const VOXEL_SIZE_M = 0.05
const POINT_PROJECTION_STRIDE = 2
const RANSAC_MIN_POINTS = 200

export function createSession(sessionId: string, imageDir: string): SessionState {
  const state: SessionState = {
    sessionId,
    status: 'active',
    createdAt: new Date().toISOString(),
    imageDir,
    frames: [],
    currentSvg: renderTopdownSvg(undefined, []),
    metrics: { pointCount: 0, wallCount: 0 },
    scaleHint: { handHeldHeightM: HAND_HELD_HEIGHT_M },
    pointCloud: [],
    walls: [],
  }
  sessions.set(sessionId, state)
  return state
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)
}

export interface AppendFrameInput {
  image: ProcessedImage
  motion?: MotionSnapshot
  depthMap?: DepthMap
}

export function appendFrame(
  sessionId: string,
  input: AppendFrameInput
): SessionState | undefined {
  const state = sessions.get(sessionId)
  if (!state || state.status !== 'active') return undefined

  const record: FrameRecord = {
    index: state.frames.length,
    receivedAt: new Date().toISOString(),
    image: input.image,
    motion: input.motion,
  }
  state.frames.push(record)

  // 最初の有効な motion で世界座標系を確定する。
  if (!state.worldOrientation && input.motion?.gravity) {
    const calib = calibrateFromMotion(input.motion)
    if (calib.worldOrientation) {
      state.worldOrientation = calib.worldOrientation
    }
    state.scaleHint = calib.scaleHint
  }

  if (input.depthMap) {
    integrateDepth(state, input.depthMap)
  }

  state.currentSvg = renderTopdownSvg(state.floor, state.walls)
  return state
}

function integrateDepth(state: SessionState, depthMap: DepthMap): void {
  const handHeight = state.scaleHint?.handHeldHeightM ?? HAND_HELD_HEIGHT_M
  // 相対深度 → 絶対深度 (中央値が持ち手高さに対応すると仮定)
  const normalized = normalizeDepthByMedian(depthMap, handHeight)
  const intrinsics = getDefaultIntrinsics(normalized.width, normalized.height)
  const camPoints = projectToCamera(normalized, intrinsics, { stride: POINT_PROJECTION_STRIDE })
  const worldPoints = transformToWorld(camPoints, state.worldOrientation)

  const merged: Point3D[] = state.pointCloud.length === 0
    ? worldPoints
    : state.pointCloud.concat(worldPoints)
  state.pointCloud = voxelDownsample(merged, {
    voxelSizeM: VOXEL_SIZE_M,
    maxPoints: MAX_POINT_CLOUD_SIZE,
  })

  if (state.pointCloud.length >= RANSAC_MIN_POINTS) {
    const detection = detectFloorAndWalls(state.pointCloud)
    state.floor = detection.floor
    state.walls = detection.walls
    state.metrics = {
      pointCount: state.pointCloud.length,
      wallCount: detection.walls.length,
    }
  } else {
    state.metrics = {
      pointCount: state.pointCloud.length,
      wallCount: state.walls.length,
    }
  }
}

export function closeSession(sessionId: string): SessionState | undefined {
  const state = sessions.get(sessionId)
  if (!state) return undefined
  state.status = 'closed'
  return state
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}

// テスト用
export function clearSessionsForTesting(): void {
  sessions.clear()
}

