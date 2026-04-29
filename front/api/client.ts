import type { ReconstructionRequest, ReconstructionResult } from './types'

// API 通信用の最小ラッパ

const API_BASE = '/api'

export async function postReconstruction(
  body: ReconstructionRequest
): Promise<ReconstructionResult> {
  const res = await fetch(`${API_BASE}/reconstruction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`POST /api/reconstruction failed: ${res.status}`)
  }

  return (await res.json()) as ReconstructionResult
}

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) {
    throw new Error(`GET /api/health failed: ${res.status}`)
  }
  return (await res.json()) as { status: string }
}
