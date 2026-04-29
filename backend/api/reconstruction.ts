import { Request, Response } from 'express'
import { ReconstructionRequest, ReconstructionResult } from '../types'
import { ColmapContainer } from '../docker/colmap'
import { OpenMVSContainer } from '../docker/openmvs'
import { ReconstructionService } from '../services/reconstruction'
import { ExportService } from '../services/export'

// 3D再構築のAPIエンドポイント

export async function reconstruct(req: Request, res: Response) {
  const { images, options } = req.body as ReconstructionRequest

  // 1. COLMAPで3D点群を再構築
  const colmap = new ColmapContainer()
  await colmap.start()
  for (const image of images) {
    await colmap.captureImage(image)
  }

  // 2. OpenMVSでメッシュ生成
  const openmvs = new OpenMVSContainer()
  await openmvs.start()
  const points3d = await openmvs.reconstruct()

  // 3. 床面・壁線の抽出
  const reconstructionService = new ReconstructionService()
  await reconstructionService.loadPoints3D(points3d)
  const planes = await reconstructionService.extractFloorPlanes()
  const walls = await reconstructionService.extractWalls(planes)

  // 4. エクスポート
  const exportService = new ExportService()
  const result: ReconstructionResult = {
    points3D: points3d,
    planes,
    walls,
    exportFormats: await exportService.exportSVG(planes, walls)
  }

  res.json(result)
}