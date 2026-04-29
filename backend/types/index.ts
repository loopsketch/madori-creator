// API/サービス層で共有する型定義
// 詳細な 3D 再構築用の型 (Point3D, Plane, Wall 等) は #12 以降で再追加する。

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
  // 撮影開始時に確定する世界座標系への回転行列 (camera → world)
  worldOrientation?: RotationMatrix3
  // 疑似スケールパラメータ
  scaleHint?: ScaleHint
}
