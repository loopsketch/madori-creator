import type {
  FramePostResult,
  ReconstructionResult,
  SessionCloseResult,
  SessionCreateResult,
} from './types'
import type { MotionSnapshot } from './motion'

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

export async function createSession(): Promise<SessionCreateResult> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' })
  if (!res.ok) throw new Error(`POST /api/sessions failed: ${res.status}`)
  return (await res.json()) as SessionCreateResult
}

export async function postFrameToSession(
  sessionId: string,
  frame: Blob,
  motion?: MotionSnapshot
): Promise<FramePostResult> {
  const fd = new FormData()
  fd.append('frame', frame, 'frame.jpg')
  if (motion) fd.append('motion', JSON.stringify(motion))
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/frames`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) throw new Error(`POST /api/sessions/${sessionId}/frames failed: ${res.status}`)
  return (await res.json()) as FramePostResult
}

export async function closeSession(sessionId: string): Promise<SessionCloseResult> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE /api/sessions/${sessionId} failed: ${res.status}`)
  return (await res.json()) as SessionCloseResult
}
