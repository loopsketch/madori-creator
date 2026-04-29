import type { SessionState } from '../../types'
import type { SessionRepository } from './repository'

// プロセスローカルの Map ベース実装。テストや単体起動向け。

export class InMemoryRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionState>()

  async create(state: SessionState): Promise<SessionState> {
    this.sessions.set(state.sessionId, state)
    return state
  }

  async get(sessionId: string): Promise<SessionState | undefined> {
    return this.sessions.get(sessionId)
  }

  async update(state: SessionState): Promise<void> {
    this.sessions.set(state.sessionId, state)
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId)
  }

  async clearAll(): Promise<void> {
    this.sessions.clear()
  }
}
