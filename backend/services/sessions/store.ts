import type {
  FrameRecord,
  MotionSnapshot,
  ProcessedImage,
  SessionState,
} from '../../types'

// ストリーミング撮影セッションの in-memory ストア。
// 永続化と分散対応は #14 で Redis ベースに置き換える。

const sessions = new Map<string, SessionState>()

export function createSession(sessionId: string, imageDir: string): SessionState {
  const state: SessionState = {
    sessionId,
    status: 'active',
    createdAt: new Date().toISOString(),
    imageDir,
    frames: [],
    currentSvg: emptySvg(),
    metrics: { pointCount: 0, wallCount: 0 },
  }
  sessions.set(sessionId, state)
  return state
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)
}

export interface AppendFrameInput {
  image: ProcessedImage
  motion?: MotionSnapshot
}

export function appendFrame(
  sessionId: string,
  input: AppendFrameInput
): SessionState | undefined {
  const state = sessions.get(sessionId)
  if (!state || state.status !== 'active') return undefined

  const record: FrameRecord = {
    index: state.frames.length,
    receivedAt: new Date().toISOString(),
    image: input.image,
    motion: input.motion,
  }
  state.frames.push(record)
  // SVG / metrics の本実装は #12, #13, #16 で。現段階はプレースホルダー。
  state.currentSvg = placeholderSvg(state.frames.length)
  return state
}

export function closeSession(sessionId: string): SessionState | undefined {
  const state = sessions.get(sessionId)
  if (!state) return undefined
  state.status = 'closed'
  return state
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}

// テスト用
export function clearSessionsForTesting(): void {
  sessions.clear()
}

function emptySvg(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>'
}

function placeholderSvg(frameCount: number): string {
  // 本実装は #13 (SVG/DXF 出力整備) で行う。現段階はフレーム数のみ表示。
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">\n' +
    '  <rect x="0" y="0" width="200" height="100" fill="#fafafa" stroke="#ccc"/>\n' +
    `  <text x="100" y="55" text-anchor="middle" font-size="14" fill="#333">frames: ${frameCount}</text>\n` +
    '</svg>'
  )
}
