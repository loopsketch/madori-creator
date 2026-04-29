// サーバー処理用の型定義

export interface ReconstructionRequest {
  images: string[]
  options: ReconstructionOptions
}

export interface ReconstructionOptions {
  colmap: ColmapOptions
  openmvs: OpenMVSOpts
  output: OutputFormat
}

export interface ColmapOptions {
  minMatches: number
  maxMatches: number
  reprojectionThreshold: number
}

export interface OpenMVSOpts {
  subpixelThreshold: number
  sigma: number
  lambda: number
}

export interface OutputFormat {
  svg: boolean
  dxr: boolean
  floor: boolean
  walls: boolean
}

export interface ReconstructionResult {
  points3D: Point3D[]
  planes: Plane[]
  walls: Wall[]
  exportFormats: ExportFormat[]
}

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface Plane {
  points: Point3D[]
  normal: Vector3
  distance: number
}

export interface Wall {
  start: Point3D
  end: Point3D
  height: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface ExportFormat {
  type: 'svg' | 'dxf'
  content: string
}