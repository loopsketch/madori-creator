// backend と共有する API の型 (手書き同期。将来は OpenAPI 等で自動生成検討)

export type ReconstructionStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ExportArtifact {
  type: 'svg' | 'dxf'
  content: string
}

export interface ReconstructionResult {
  status: ReconstructionStatus
  exports: ExportArtifact[]
  message?: string
}

export interface ReconstructionRequest {
  images: string[]
  options?: Record<string, never>
}
