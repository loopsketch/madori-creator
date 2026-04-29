import fs from 'fs'
import crypto from 'crypto'

const CACHE_DIR = '/tmp/reconstruction-cache'

export async function computeInputHash(images: string[]): Promise<string> {
  const hashes = await Promise.all(
    images.map((path) => fs.promises.readFile(path))
  )

  const combinedHash = crypto.createHash('sha256')
  for (const hash of hashes) {
    combinedHash.update(hash)
  }

  return combinedHash.digest('hex')
}

export function getCachePath(hash: string): string {
  return `${CACHE_DIR}/${hash}.json`
}
