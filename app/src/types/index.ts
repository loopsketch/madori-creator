// 基本的な型定義

export interface Point {
  x: number
  y: number
}

export type PointList = Point[]

export interface Line {
  start: Point
  end: Point
}

export interface Polygon {
  points: Point[]
}

export interface DrawingData {
  name: string
  timestamp: number
  data: any
}

// カプチャ・SfM関連型

export interface CaptureResponse {
  frameId: string
  timestamp: number
  status: 'queued' | 'processing' | 'completed'
}

export interface SfMResult {
  frameId: string
  cameraPose: {
    position: [number, number, number]
    rotation: [number, number, number]
  }
  points2D: Point[]
}
