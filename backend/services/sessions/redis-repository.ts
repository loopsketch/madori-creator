import type { RedisClientType } from 'redis'
import type { SessionState } from '../../types'
import type { SessionRepository } from './repository'

// Redis 永続化実装。1 セッション = 1 key (`session:<id>`) に
// state 全体を JSON として保存する。pointCloud は object 配列なので
// JSON シリアライズ可能。サイズは数十 KB 〜 数 MB を想定。

const KEY_PREFIX = 'session:'
const TTL_SECONDS = 60 * 60 // 1 時間。update のたびにリセットされる

export class RedisRepository implements SessionRepository {
  constructor(private readonly client: RedisClientType) {}

  async create(state: SessionState): Promise<SessionState> {
    await this.client.set(this.key(state.sessionId), JSON.stringify(state), {
      EX: TTL_SECONDS,
    })
    return state
  }

  async get(sessionId: string): Promise<SessionState | undefined> {
    const json = await this.client.get(this.key(sessionId))
    if (!json) return undefined
    return JSON.parse(json) as SessionState
  }

  async update(state: SessionState): Promise<void> {
    await this.client.set(this.key(state.sessionId), JSON.stringify(state), {
      EX: TTL_SECONDS,
    })
  }

  async delete(sessionId: string): Promise<boolean> {
    const removed = await this.client.del(this.key(sessionId))
    return removed > 0
  }

  async clearAll(): Promise<void> {
    // テスト用。本番ではほぼ呼ばれない想定。
    let cursor = '0'
    do {
      const result = (await this.client.scan(cursor, {
        MATCH: `${KEY_PREFIX}*`,
        COUNT: 100,
      })) as { cursor: string; keys: string[] }
      cursor = result.cursor
      if (result.keys.length > 0) {
        await this.client.del(result.keys)
      }
    } while (cursor !== '0')
  }

  private key(id: string): string {
    return `${KEY_PREFIX}${id}`
  }
}
