import fs from 'fs'
import { getCachePath, computeInputHash } from './inputHash'
import { ReconstructionResult } from '../../types'

const CACHE_TTL_SECONDS = 86400 // 1 日

export interface CacheEntry {
  result: ReconstructionResult
  timestamp: string
  hash: string
}

export async function getCachedResult(
  images: string[]
): Promise<ReconstructionResult | null> {
  try {
    const hash = await computeInputHash(images)
    const cachePath = getCachePath(hash)

    if (!fs.existsSync(cachePath)) {
      return null
    }

    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheEntry

    // TTL チェック
    const age = Date.now() - new Date(cached.timestamp).getTime()
    if (age > CACHE_TTL_SECONDS * 1000) {
      fs.unlinkSync(cachePath)
      return null
    }

    return cached.result
  } catch {
    return null
  }
}

export async function setCachedResult(
  result: ReconstructionResult,
  images: string[]
): Promise<void> {
  const hash = await computeInputHash(images)
  const cacheEntry: CacheEntry = {
    result,
    timestamp: new Date().toISOString(),
    hash
  }

  const cachePath = getCachePath(hash)
  fs.writeFileSync(cachePath, JSON.stringify(cacheEntry))
}
