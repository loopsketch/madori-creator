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
