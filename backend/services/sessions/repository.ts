import type { SessionState } from '../../types'

// セッション状態の永続層を抽象化する。in-memory と Redis の 2 実装を持つ。

export interface SessionRepository {
  // 新規セッションを作成して保存する
  create(state: SessionState): Promise<SessionState>

  // 既存セッションを取得する。無ければ undefined
  get(sessionId: string): Promise<SessionState | undefined>

  // セッション全体を置き換える (楽観的、最後勝ち)
  update(state: SessionState): Promise<void>

  // セッションを削除する。削除した場合 true
  delete(sessionId: string): Promise<boolean>

  // テスト用: 全セッションを破棄
  clearAll(): Promise<void>
}
