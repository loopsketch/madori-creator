// backend と共有する API の型 (手書き同期。将来は OpenAPI 等で自動生成検討)

export type ReconstructionStatus = 'received' | 'processing' | 'done' | 'failed'

export interface ExportArtifact {
  type: 'svg' | 'dxf'
  content: string
}

export interface ReconstructionResult {
  taskId: string
  status: ReconstructionStatus
  imageCount: number
  exports?: ExportArtifact[]
  message?: string
}

export type SessionStatus = 'active' | 'closed'

export interface SessionMetrics {
  pointCount: number
  wallCount: number
}

export interface ScaleHint {
  handHeldHeightM: number
  gravityMagnitudeRatio?: number
}

export interface SessionCreateResult {
  sessionId: string
  createdAt: string
  status: SessionStatus
}

export interface FramePostResult {
  sessionId: string
  frameIndex: number
  totalFrames: number
  svg: string
  metrics: SessionMetrics
  worldOrientation?: number[]
  scaleHint?: ScaleHint
}

export interface SessionCloseResult {
  sessionId: string
  totalFrames: number
  finalSvg: string
  finalDxf: string
}
