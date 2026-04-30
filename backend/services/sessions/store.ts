import {
  calibrateFromMotion,
  computeFrameOrientation,
  HAND_HELD_HEIGHT_M,
  transformAlvaPose,
} from '../scale/calibrator'
import { getDefaultIntrinsics } from '../depth/intrinsics'
import {
  applyDepthScale,
  calculateMedianDepthScale,
  projectToCamera,
  transformToWorld,
} from '../depth/pointcloud'
import { voxelDownsample } from '../depth/voxel'
import { detectFloorAndWalls } from '../reconstruction'
import {
  createWallTrackerState,
  ingestWalls,
} from '../reconstruction/wallTracker'
import { renderTopdownSvg } from '../render'
import { InMemoryRepository } from './memory-repository'
import type { SessionRepository } from './repository'
import type {
  DepthMap,
  FrameRecord,
  MotionSnapshot,
  Point3D,
  ProcessedImage,
  SessionState,
} from '../../types'

// ストリーミング撮影セッションの永続層。
// SessionRepository の差し替えで in-memory / Redis を切り替えられる。

// 累積点群の上限。これを超えると voxel ダウンサンプル後にもサンプリングで間引く。
const MAX_POINT_CLOUD_SIZE = 50_000
const VOXEL_SIZE_M = 0.05
const POINT_PROJECTION_STRIDE = 2
const RANSAC_MIN_POINTS = 200

let repository: SessionRepository = new InMemoryRepository()

export function setSessionRepository(repo: SessionRepository): void {
  repository = repo
}

export function getSessionRepository(): SessionRepository {
  return repository
}

export async function createSession(
  sessionId: string,
  imageDir: string
): Promise<SessionState> {
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
    wallTracker: createWallTrackerState(),
  }
  return await repository.create(state)
}

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  return await repository.get(sessionId)
}

export interface AppendFrameInput {
  image: ProcessedImage
  motion?: MotionSnapshot
  depthMap?: DepthMap
}

export async function appendFrame(
  sessionId: string,
  input: AppendFrameInput
): Promise<SessionState | undefined> {
  const state = await repository.get(sessionId)
  if (!state || state.status !== 'active') return undefined

  const record: FrameRecord = {
    index: state.frames.length,
    receivedAt: new Date().toISOString(),
    image: input.image,
    motion: input.motion,
  }
  state.frames.push(record)

  // 最初の有効な motion で世界座標系を確定する (DeviceMotion フォールバック用の初期値)。
  if (!state.worldOrientation && input.motion?.gravity) {
    const calib = calibrateFromMotion(input.motion)
    if (calib.worldOrientation) {
      state.worldOrientation = calib.worldOrientation
      state.baseAlphaDeg = input.motion.orientation?.alpha
    }
    state.scaleHint = calib.scaleHint
  }

  // AlvaAR が tracking に入った最初のフレームで、worldOrientation と baseAlvaPose を
  // **同時に再確定**する (issue #26)。両者が異なるタイミングで決まっていると
  // 「camera_0 → madori_world」と「camera_N → AR_world」の対応が取れず、点群が
  // 世界座標で整合しない。同期したフレーム以降は AlvaAR pose を信頼して統合する。
  // それまでに蓄積された点群は異なる基準で投影されているのでリセットする。
  if (
    !state.baseAlvaPose &&
    input.motion?.poseTracking === 'tracking' &&
    input.motion.gravity &&
    input.motion.cameraPose &&
    input.motion.cameraPose.length >= 16
  ) {
    const calib = calibrateFromMotion(input.motion)
    if (calib.worldOrientation) {
      state.worldOrientation = calib.worldOrientation
      state.baseAlphaDeg = input.motion.orientation?.alpha
      state.baseAlvaPose = input.motion.cameraPose.slice()
      state.scaleHint = calib.scaleHint
      // 同期前に DeviceMotion ベースで投影された点群はリセットする。
      // depthScale も再確定させる (基準フレームが変わるため)。
      state.pointCloud = []
      state.walls = []
      state.wallTracker = createWallTrackerState()
      state.floor = undefined
      state.depthScale = undefined
    }
  }

  if (input.depthMap) {
    integrateDepth(state, input.depthMap, input.motion)
  }

  state.currentSvg = renderTopdownSvg(state.floor, state.walls)
  await repository.update(state)
  return state
}

function integrateDepth(
  state: SessionState,
  depthMap: DepthMap,
  motion?: MotionSnapshot
): void {
  const handHeight = state.scaleHint?.handHeldHeightM ?? HAND_HELD_HEIGHT_M
  // 相対深度 → 絶対深度。スケールは初回フレームで決め、以降は固定する
  // (毎フレーム再計算すると同じ壁が違う距離に投影され、AlvaAR pose 採用しても
  //  点群が世界座標で整合しなくなる)。
  if (state.depthScale === undefined) {
    state.depthScale = calculateMedianDepthScale(depthMap, handHeight)
  }
  const normalized = applyDepthScale(depthMap, state.depthScale)
  const intrinsics = getDefaultIntrinsics(normalized.width, normalized.height)
  const camPoints = projectToCamera(normalized, intrinsics, { stride: POINT_PROJECTION_STRIDE })

  // 姿勢の選択 (優先順):
  //   1. AlvaAR の pose (issue #26): tracking 中で初期 pose 確定済みなら、平行移動も含む
  //   2. DeviceMotion から計算したフレーム姿勢 (issue #23): pitch/roll/yaw のみ反映
  //   3. 初期 worldOrientation (フォールバック)
  let frameRotation = state.worldOrientation
  let frameTranslation: { x: number; y: number; z: number } | undefined
  if (
    state.worldOrientation &&
    state.baseAlvaPose &&
    motion?.poseTracking === 'tracking' &&
    motion.cameraPose
  ) {
    const transformed = transformAlvaPose(
      motion.cameraPose,
      state.baseAlvaPose,
      state.worldOrientation
    )
    if (transformed) {
      frameRotation = transformed.rotation
      frameTranslation = transformed.translation
    }
  }
  if (!frameTranslation && state.worldOrientation) {
    // AlvaAR が使えないフレームでは姿勢のみ更新する
    frameRotation =
      computeFrameOrientation(motion, state.worldOrientation, state.baseAlphaDeg) ??
      state.worldOrientation
  }
  const worldPoints = transformToWorld(camPoints, frameRotation, frameTranslation)

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
    const tracked = ingestWalls(
      state.wallTracker,
      state.frames.length - 1,
      detection.walls
    )
    state.wallTracker = tracked.next
    state.walls = tracked.stable
    state.metrics = {
      pointCount: state.pointCloud.length,
      wallCount: state.walls.length,
    }
  } else {
    state.metrics = {
      pointCount: state.pointCloud.length,
      wallCount: state.walls.length,
    }
  }
}

export async function closeSession(sessionId: string): Promise<SessionState | undefined> {
  const state = await repository.get(sessionId)
  if (!state) return undefined
  state.status = 'closed'
  await repository.update(state)
  return state
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  return await repository.delete(sessionId)
}

// テスト用
export async function clearSessionsForTesting(): Promise<void> {
  await repository.clearAll()
}
