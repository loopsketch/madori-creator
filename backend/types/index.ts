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
