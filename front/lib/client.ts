import type { ReconstructionResult } from './types'

// API 通信用の最小ラッパ

const API_BASE = '/api'

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) {
    throw new Error(`GET /api/health failed: ${res.status}`)
  }
  return (await res.json()) as { status: string }
}

export async function postReconstruction(images: File[]): Promise<ReconstructionResult> {
  const fd = new FormData()
  for (const image of images) {
    fd.append('images', image, image.name)
  }
  const res = await fetch(`${API_BASE}/reconstruction`, {
    method: 'POST',
    body: fd,
  })

  if (!res.ok) {
    throw new Error(`POST /api/reconstruction failed: ${res.status}`)
  }

  return (await res.json()) as ReconstructionResult
}
