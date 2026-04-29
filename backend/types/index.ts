// API/サービス層で共有する型定義
// 詳細な 3D 再構築用の型 (Point3D, Plane, Wall 等) は #6-5 以降で再追加する。

export interface ReconstructionRequest {
  images: string[]
  options?: ReconstructionOptions
}

export interface ReconstructionOptions {
  // #6-3 以降で COLMAP/OpenMVS 用のオプションを段階的に追加する
}

export type ReconstructionStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ReconstructionResult {
  status: ReconstructionStatus
  exports: ExportArtifact[]
  message?: string
}

export interface ExportArtifact {
  type: 'svg' | 'dxf'
  content: string
}
