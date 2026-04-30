// API/サービス層で共有する型定義
//
// 3D 再構築用の型 (Point3D, Floor, Wall) は services/reconstruction/types.ts に
// 実装の詳細とともにあるが、ここから再 export して周辺コードからの参照を容易にする。

import type { Floor, Point3D, Wall } from '../services/reconstruction/types'
import type { WallTrackerState } from '../services/reconstruction/wallTracker'
export type { Floor, Plane, Point3D, Vec3, Wall } from '../services/reconstruction/types'
export type { WallTrackerState } from '../services/reconstruction/wallTracker'

export type ReconstructionStatus = 'received' | 'processing' | 'done' | 'failed'

export interface ReconstructionResult {
  taskId: string
  status: ReconstructionStatus
  imageCount: number
  exports: ExportArtifact[]
  message?: string
}

export interface ExportArtifact {
  type: 'svg' | 'dxf'
  content: string
}

export interface ProcessedImage {
  // 保存先の絶対パス
  path: string
  // Sharp 処理後のメタ情報
  width: number
  height: number
  byteSize: number
  // 元ファイルのフィールド名 (multer の originalname)
  originalName: string
}

export interface TaskMetadata {
  taskId: string
  status: ReconstructionStatus
  createdAt: string
  imageCount: number
  imageDir: string
  images: ProcessedImage[]
}

// ストリーミング撮影セッション (issue #15)

export type SessionStatus = 'active' | 'closed'

export interface MotionSnapshot {
  // DeviceMotion の重力ベクトル (m/s^2)
  gravity?: { x: number; y: number; z: number }
  // DeviceOrientation のオイラー角 (degree)
  orientation?: { alpha: number; beta: number; gamma: number }
  // フレーム取得時刻 (ms epoch)
  timestamp?: number
  // AlvaAR (issue #26) で取得したカメラ pose。4x4 列優先 camera-to-world、OpenCV 系。
  cameraPose?: number[]
  // AlvaAR の tracking 状態。'tracking' 以外は cameraPose を使わずフォールバックする。
  poseTracking?: 'tracking' | 'lost' | 'unavailable'
}

// 3x3 回転行列 (列優先表現を採るが、ここでは要素 9 個の配列として扱う)
export type RotationMatrix3 = [
  number, number, number,
  number, number, number,
  number, number, number,
]

export interface ScaleHint {
  // 持ち手の高さ仮定 (m)
  handHeldHeightM: number
  // 重力ベクトル長と 9.8 のずれ (デバッグ・有効性判定用)
  gravityMagnitudeRatio?: number
}

export interface FrameRecord {
  index: number
  receivedAt: string
  image: ProcessedImage
  motion?: MotionSnapshot
}

export interface SessionMetrics {
  pointCount: number
  wallCount: number
}

export interface SessionState {
  sessionId: string
  status: SessionStatus
  createdAt: string
  imageDir: string
  frames: FrameRecord[]
  currentSvg: string
  metrics: SessionMetrics
  // 撮影開始時に確定する世界座標系への回転行列 (camera → world)。
  // 各フレームの姿勢計算 (issue #23) では基準として参照される。
  worldOrientation?: RotationMatrix3
  // 撮影開始時の DeviceOrientation alpha (yaw 差分計算用、issue #23)
  baseAlphaDeg?: number
  // 撮影開始時の AlvaAR pose (4x4 列優先、issue #26)。これと worldOrientation の対応を
  // 使い、各フレームの cameraPose を madori 世界座標系の camera→world 行列に変換する。
  baseAlvaPose?: number[]
  // 撮影セッション内で固定する深度スケール (issue #26)。初回フレームで中央値から
  // 算出して以降は使い回し、各フレームの点群を同じ絶対距離スケールで世界座標化する。
  depthScale?: number
  // 疑似スケールパラメータ
  scaleHint?: ScaleHint
  // 累積点群 (世界座標、voxel ダウンサンプル済み)
  pointCloud: Point3D[]
  // 直近の RANSAC 結果
  floor?: Floor
  walls: Wall[]
  // 壁線の時系列マージ用トラッカー状態 (issue #22)
  wallTracker: WallTrackerState
}

// 深度推定 (#16)

export interface DepthMap {
  width: number
  height: number
  // 行優先 (row-major) の深度値配列。長さは width * height。
  // 単位は m を想定するが、生の出力は相対値 (0〜1) のことが多い。
  data: Float32Array
}

export interface CameraIntrinsics {
  fx: number
  fy: number
  cx: number
  cy: number
  width: number
  height: number
}
