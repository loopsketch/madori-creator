// Reconstruction task types

export interface ReconstructionTask {
  id: string
  images: string[]
  options?: ReconstructionOptions
}

export interface TaskResult {
  taskId: string
  result: ReconstructionResult
  duration: number
}

export interface ReconstructionOptions {
  minMatches: number
  maxMatches: number
  reprojectionThreshold: number
  subpixelThreshold: number
}
