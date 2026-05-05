import type { Metadata, Session } from '../../core/src'

/**
 * 内存级 session 管理器，runtime 内部实现。
 * 不作为 extension public API，持久化能力由 StorageAdapter 提供。
 */
export class SessionManager {
  private readonly sessions = new Map<string, Session>()

  async create(input?: Metadata): Promise<Session> {
    // session id 使用时间戳前缀，后续可替换为更健壮的生成策略
    const now = Date.now()
    const session: Session = {
      id: `session_${now}`,
      createdAt: now,
      updatedAt: now,
      metadata: input,
    }

    this.sessions.set(session.id, session)
    return session
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  async update(session: Session): Promise<void> {
    this.sessions.set(session.id, session)
  }

  async listMessages(_sessionId: string) {
    return []
  }
}
