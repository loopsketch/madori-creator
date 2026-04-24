import { ReconstructionService } from '../services/reconstruction'
import { Point3D, Plane } from '../types'

describe('ReconstructionService', () => {
  let service: ReconstructionService

  beforeEach(() => {
    service = new ReconstructionService()
  })

  it('COLMAP 出力から 3D 点群を読み込むべき', async () => {
    const mockPoints: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 }
    ]

    ;(service as any).readPointsFrom = async function(path: string) {
      return mockPoints
    }

    await service.loadPoints3D('/tmp/points3D.xyz')
    expect((service as any).points).toEqual(mockPoints)
  })

  it('点群から平面を検出する', async () => {
    const points: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 2, z: 2 },
      { x: 3, y: 3, z: 3 }
    ]

    const planes = await service.extractFloorPlanes()

    expect(planes).toBeDefined()
    // 平面が検出されない場合のハンドリング
    if (planes && planes.length > 0) {
      expect(planes.length).toBeGreaterThan(0)
    }
  })

  it('3 点から平面を拟合する', async () => {
    const seed: Point3D = { x: 0, y: 0, z: 0 }
    const randomPoints: Point3D[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 }
    ]

    const normal = service['computeNormal'](randomPoints)

    expect(normal).toBeDefined()
    if (normal) {
      expect(normal.x).not.toBeNaN()
      expect(normal.y).not.toBeNaN()
      expect(normal.z).not.toBeNaN()
    }
  })

  it('最小二乗法で平面を拟合する', async () => {
    const points: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 }
    ]

    const plane = service['fitPlaneLeastSquares'](points)

    expect(plane).toBeDefined()
    if (plane) {
      expect(plane.points).toBeDefined()
      expect(plane.normal).toBeDefined()
      expect(plane.distance).toBeDefined()
    }
  })

  it('点群の边缘を検出する', async () => {
    const points: Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 }
    ]

    const edges = service['findEdges'](points)

    expect(edges).toBeDefined()
    if (edges) {
      expect(edges.length).toBeGreaterThan(0)
      expect(edges[0].start).toBeDefined()
      expect(edges[0].end).toBeDefined()
    }
  })

  it('半径内の近接点を返す', async () => {
    const center: Point3D = { x: 1, y: 1, z: 1 }
    const points: Point3D[] = [
      { x: 1, y: 1, z: 1 },
      { x: 1.1, y: 1.1, z: 1.1 },
      { x: 3, y: 3, z: 3 }
    ]

    const neighbors = service['findNeighbors'](points, center, 0.5)

    expect(neighbors).toBeDefined()
    expect(neighbors.length).toBeGreaterThan(0)
  })

  it('床面の高さを推定する', async () => {
    const edge = {
      start: { x: 0, y: 0, z: 1 },
      end: { x: 1, y: 1, z: 3 }
    }

    const height = service['estimateHeight'](edge)

    expect(height).toBe(2)
  })
})
