import { calibrateFromMotion, HAND_HELD_HEIGHT_M } from '../scale/calibrator'
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
    scaleHint: { handHeldHeightM: HAND_HELD_HEIGHT_M },
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

  // 最初の有効な motion で世界座標系を確定する。以降のフレームでは
  // 累積 SLAM 等で更新する想定だが、本 issue では初期姿勢の固定までで十分。
  if (!state.worldOrientation && input.motion?.gravity) {
    const calib = calibrateFromMotion(input.motion)
    if (calib.worldOrientation) {
      state.worldOrientation = calib.worldOrientation
    }
    state.scaleHint = calib.scaleHint
  }

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
