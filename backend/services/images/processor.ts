import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { Express } from 'express'
import { ImageProcessingError } from '../../errors/reconstruction'
import type { ProcessedImage } from '../../types'

// Sharp で EXIF 自動回転 + 長辺リサイズ + JPEG 統一を行い、ディスクへ書き出す。

export const MAX_LONG_EDGE_PX = 2048
export const JPEG_QUALITY = 85

export function getTaskDirBase(): string {
  return process.env.TASK_DIR_BASE ?? '/tmp/madori'
}

export interface ProcessOptions {
  maxLongEdge?: number
  jpegQuality?: number
  outputDir?: string
}

export async function processAndSaveImages(
  taskId: string,
  files: Express.Multer.File[],
  options: ProcessOptions = {}
): Promise<{ outputDir: string; images: ProcessedImage[] }> {
  const maxLongEdge = options.maxLongEdge ?? MAX_LONG_EDGE_PX
  const jpegQuality = options.jpegQuality ?? JPEG_QUALITY
  const outputDir = options.outputDir ?? path.join(getTaskDirBase(), taskId)

  await fs.mkdir(outputDir, { recursive: true })

  const images: ProcessedImage[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const outName = `${String(i).padStart(3, '0')}.jpg`
    const outPath = path.join(outputDir, outName)

    try {
      const { data, info } = await sharp(file.buffer)
        .rotate()
        .resize({ width: maxLongEdge, height: maxLongEdge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: jpegQuality })
        .toBuffer({ resolveWithObject: true })

      await fs.writeFile(outPath, data)

      images.push({
        path: outPath,
        width: info.width,
        height: info.height,
        byteSize: data.length,
        originalName: file.originalname,
      })
    } catch (cause) {
      throw new ImageProcessingError(
        `画像の処理に失敗しました: ${file.originalname}`,
        file.originalname,
        cause
      )
    }
  }

  return { outputDir, images }
}
