import type { Metadata, Session } from '@crai/core'
import { createId } from '@crai/core'

/**
 * 内存级 session 管理器，runtime 内部实现。
 * 不作为 extension public API，持久化能力由 StorageAdapter 提供。
 */
export class SessionManager {
  private readonly sessions = new Map<string, Session>()

  async create(input?: Metadata, sessionId?: string): Promise<Session> {
    const now = Date.now()
    const session: Session = {
      id: sessionId ?? createId('session'),
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

  /** 从内存中删除 session。 */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
