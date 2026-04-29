import { Point3D, Plane, Wall, Vector3, ColmapOptions, OpenMVSOpts, OutputFormat } from '../types'
import fs from 'fs'
import path from 'path'

// 3D 点群から床面・壁線を抽出するサービス

export class ReconstructionService {
  private points: Point3D[] = []
  private colmap: ColmapOptions | null = null
  private openmvs: OpenMVSOpts | null = null
  private outputFormat: OutputFormat | null = null

  async loadPoints3D(path: string): Promise<void> {
    // COLMAP から 3D 点群を読み込む
    this.points = await this.readPointsFrom(path)
  }

  async extractFloorPlanes(): Promise<Plane[]> {
    // RANSAC アルゴリズムで床面を抽出
    return this.findPlanes(this.points)
  }

  async extractWalls(floors: Plane[]): Promise<Wall[]> {
    // 床面の边缘から壁線を抽出
    const walls: Wall[] = []

    for (const floor of floors) {
      const edges = this.findEdges(floor.points)
      for (const edge of edges) {
        walls.push({
          start: edge.start,
          end: edge.end,
          height: this.estimateHeight(edge)
        })
      }
    }

    return walls
  }

  private findPlanes(points: Point3D[]): Plane[] {
    // RANSAC で平面拟合
    const planes: Plane[] = []
    const visited = new Set<number>()

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue

      const plane = this.fitPlaneRANSAC(points, i)
      if (plane) {
        planes.push(plane)
        for (const p of plane.points) {
          visited.add(points.indexOf(p))
        }
      }
    }

    return planes
  }

  private fitPlaneRANSAC(points: Point3D[], seedIndex: number): Plane | null {
    // RANSAC: 3 点で平面拟合、外れ値を除去して再拟合
    const seed = points[seedIndex]
    const randomPoints = this.selectRandomPoints(points, 3)

    // 3 点で平面方程式を求める
    const normal = this.computeNormal(randomPoints)
    if (!normal) return null

    // 平面方程式：n・(x - p0) = 0
    const distance = this.computeDistance(normal, seed)

    // 内点（inliers）を選択
    const inliers = points.filter(p =>
      Math.abs(this.computeDistance(normal, p) - distance) < 0.1
    )

    // 内点から再拟合
    if (inliers.length < 3) return null

    const refinedPlane = this.fitPlaneLeastSquares(inliers)
    if (!refinedPlane) return null

    return {
      points: inliers,
      normal: refinedPlane.normal,
      distance: refinedPlane.distance
    }
  }

  private fitPlaneLeastSquares(points: Point3D[]): Plane | null {
    // 最小二乗法で平面拟合
    let cx = 0, cy = 0, cz = 0
    for (const p of points) {
      cx += p.x
      cy += p.y
      cz += p.z
    }
    cx /= points.length
    cy /= points.length
    cz /= points.length

    // 共分散行列を計算
    let covXX = 0, covXY = 0, covXZ = 0, covYY = 0, covYZ = 0, covZZ = 0
    for (const p of points) {
      const dx = p.x - cx
      const dy = p.y - cy
      const dz = p.z - cz
      covXX += dx * dx
      covXY += dx * dy
      covXZ += dx * dz
      covYY += dy * dy
      covYZ += dy * dz
      covZZ += dz * dz
    }

    // 固有値分解で法向量を求める（簡易的な実装）
    const normal = this.computeEigenvector([
      [covXX, covXY, covXZ],
      [covXY, covYY, covYZ],
      [covXZ, covYZ, covZZ]
    ])

    if (!normal) return null

    // 平面方程式の定数項
    const distance = normal.x * cx + normal.y * cy + normal.z * cz

    return {
      points,
      normal,
      distance
    }
  }

  private selectRandomPoints(points: Point3D[], n: number): Point3D[] {
    // ランダムなポイントを返す
    const shuffled = [...points].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  private computeNormal(points: Point3D[]): Vector3 | null {
    // 3 点から法向量を計算
    if (points.length < 3) return null

    const p1 = points[0]
    const p2 = points[1]
    const p3 = points[2]

    const edge1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z }
    const edge2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z }

    const nx = edge1.y * edge2.z - edge1.z * edge2.y
    const ny = edge1.z * edge2.x - edge1.x * edge2.z
    const nz = edge1.x * edge2.y - edge1.y * edge2.x

    // 正規化
    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (mag === 0) return null

    return { x: nx / mag, y: ny / mag, z: nz / mag }
  }

  private computeDistance(normal: Vector3, point: Point3D): number {
    // 平面と点の距離：n・(x - p0)
    return normal.x * point.x + normal.y * point.y + normal.z * point.z
  }

  private computeEigenvector(matrix: number[][]): Vector3 | null {
    // 固有値分解の簡易実装
    // 3x3 行列の場合、固有値方程式の解を計算
    const a = matrix[0][0]
    const b = matrix[0][1]
    const c = matrix[0][2]
    const d = matrix[1][0]
    const e = matrix[1][1]
    const f = matrix[1][2]
    const g = matrix[2][0]
    const h = matrix[2][1]
    const i = matrix[2][2]

    // 固有値方程式
    const trace = a + e + i
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)

    // 固有値の近似解
    const eigenvalues = this.solveCubic([trace, -this.c2(matrix), det])

    // 最大固有値に対応する固有ベクトル
    return this.computeEigenvectorFromMatrix(matrix, eigenvalues[0])
  }

  private c2(matrix: number[][]) {
    const a = matrix[0][0]
    const b = matrix[0][1]
    const c = matrix[0][2]
    const d = matrix[1][0]
    const e = matrix[1][1]
    const f = matrix[1][2]
    const g = matrix[2][0]
    const h = matrix[2][1]
    const i = matrix[2][2]
    return a * e - b * d - b * f + c * d - c * h + e * i
  }

  private solveCubic(coeff: number[]): number[] {
    // 3 次方程式 ax^3 + bx^2 + cx + d = 0 の解を返す
    const [a, b, c, d] = coeff
    if (a === 0) {
      // 2 次方程式
      const disc = b * b - 4 * c * d
      if (disc < 0) return [0, 0, 0]
      const sqrtDisc = Math.sqrt(disc)
      return [(-b + sqrtDisc) / (2 * c), (-b - sqrtDisc) / (2 * c)]
    }

    // 転移して x = t - b/(3a) で簡約化
    const p = (3 * c - b * b) / (3 * a)
    const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a)

    // 判別式
    const disc = q * q / 4 + p * p * p / 27

    if (disc < 0) {
      // 3 つの実根
      const r = Math.sqrt(-p * p * p / 27)
      const theta = Math.acos(-q / (2 * r))
      const k1 = 2 * r * Math.cos(theta / 3)
      const k2 = 2 * r * Math.cos((theta + 2 * Math.PI) / 3)
      const k3 = 2 * r * Math.cos((theta + 4 * Math.PI) / 3)
      return [
        k1 - b / (3 * a),
        k2 - b / (3 * a),
        k3 - b / (3 * a)
      ]
    } else if (disc === 0) {
      // 重根
      const s1 = -q / 2
      const s2 = -2 * q / 2
      return [s1 - b / (3 * a), s2 - b / (3 * a)]
    } else {
      // 1 つの実根
      const u = Math.pow(-q / 2, 1 / 3)
      const v = Math.pow(q / 2, 1 / 3)
      return [(u + v) - b / (3 * a)]
    }
  }

  private computeEigenvectorFromMatrix(matrix: number[][], eigenvalue: number): Vector3 | null {
    // 固有ベクトルを計算
    const equations = [
      { x: matrix[0][0] - eigenvalue, y: matrix[0][1], z: matrix[0][2] },
      { x: matrix[1][0], y: matrix[1][1] - eigenvalue, z: matrix[1][2] },
      { x: matrix[2][0], y: matrix[2][1], z: matrix[2][2] - eigenvalue }
    ]

    // 連立方程式を解く
    const normal = this.computeNormalFromEquations(equations)
    return normal
  }

  private computeNormalFromEquations(equations: { x: number, y: number, z: number }[]): Vector3 | null {
    // クラメル則で連立方程式の解を求める
    if (equations.length < 3) return null

    const detA = equations[0].x * (equations[1].y * equations[2].z - equations[1].z * equations[2].y)
      - equations[0].y * (equations[1].x * equations[2].z - equations[1].z * equations[2].x)
      + equations[0].z * (equations[1].x * equations[2].y - equations[1].y * equations[2].x)

    if (Math.abs(detA) < 1e-10) return null

    // 固有ベクトルを求めるため、右辺を [1, 1, 1] とする
    const detX = 1 * (equations[1].y * equations[2].z - equations[1].z * equations[2].y)
      - equations[0].y * (equations[1].z * equations[2].x - equations[1].x * equations[2].z)
      + equations[0].z * (equations[1].x * equations[2].y - equations[1].y * equations[2].x)

    const detY = equations[0].x * (equations[2].z * equations[1].y - equations[2].y * equations[1].z)
      - 1 * (equations[0].z * equations[2].x - equations[0].x * equations[2].z)
      + equations[0].y * (equations[1].x * equations[2].z - equations[1].z * equations[2].x)

    const detZ = equations[0].x * (equations[1].y * equations[2].x - equations[1].x * equations[2].y)
      - equations[0].y * (equations[1].z * equations[2].x - equations[1].x * equations[2].z)
      + 1 * (equations[0].x * equations[1].z - equations[0].z * equations[1].x)

    const x = detX / detA
    const y = detY / detA
    const z = detZ / detA

    // 正規化
    const mag = Math.sqrt(x * x + y * y + z * z)
    if (mag < 1e-10) return null

    return { x: x / mag, y: y / mag, z: z / mag }
  }

  private findEdges(points: Point3D[]): { start: Point3D, end: Point3D }[] {
    // 点群の边缘を検出
    const edges: { start: Point3D, end: Point3D }[] = []

    // 平面の边缘から壁線を抽出
    for (const point of points) {
      const neighbors = this.findNeighbors(points, point, 0.1)
      if (neighbors.length > 0) {
        const edge = { start: point, end: neighbors[0] }
        if (!edges.some(e => e.start === edge.start && e.end === edge.end)) {
          edges.push(edge)
        }
      }
    }

    return edges
  }

  private findNeighbors(points: Point3D[], center: Point3D, radius: number): Point3D[] {
    // 半径内の近接点を返す
    const neighbors: Point3D[] = []
    for (const point of points) {
      const dist = Math.sqrt(
        (point.x - center.x) ** 2 +
        (point.y - center.y) ** 2 +
        (point.z - center.z) ** 2
      )
      if (dist <= radius) {
        neighbors.push(point)
      }
    }
    return neighbors
  }

  private estimateHeight(edge: { start: Point3D, end: Point3D }): number {
    // 床面の高さを推定
    return (edge.start.z + edge.end.z) / 2
  }

  private readPointsFrom(path: string): Promise<Point3D[]> {
    // ファイルから 3D 点群を読み込む
    // COLMAP 出力形式：points3D.bin または points3D.xyz
    const ext = path.extname(path)

    try {
      if (ext === '.bin') {
        // 二進形式の読み込み
        const buffer = fs.readFileSync(path)
        const points: Point3D[] = []
        let offset = 0
        const floatSize = 4

        while (offset + floatSize <= buffer.length) {
          const x = buffer.readFloatLE(offset)
          offset += floatSize
          const y = buffer.readFloatLE(offset)
          offset += floatSize
          const z = buffer.readFloatLE(offset)
          offset += floatSize

          points.push({ x, y, z })
        }

        return Promise.resolve(points)
      } else if (ext === '.xyz') {
        // テキスト形式の読み込み
        const content = fs.readFileSync(path, 'utf-8')
        const lines = content.trim().split('\n')
        const points: Point3D[] = []

        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 3) {
            points.push({
              x: parseFloat(parts[0]),
              y: parseFloat(parts[1]),
              z: parseFloat(parts[2])
            })
          }
        }

        return Promise.resolve(points)
      }
    } catch (error) {
      return Promise.resolve([])
    }

    return Promise.resolve([])
  }
}
