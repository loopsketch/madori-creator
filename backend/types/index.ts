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
  // DeviceMotion の重力ベクトル (m/s^2)。詳細は #17 で確定する
  gravity?: { x: number; y: number; z: number }
  // 姿勢 (クォータニオン or オイラー角)。詳細は #17 で確定する
  attitude?: Record<string, number>
  // フレーム取得時刻 (ms epoch)
  timestamp?: number
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
}
