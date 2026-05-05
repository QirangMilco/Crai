/**
 * Session 管理器（runtime 内部实现，不对外暴露）。
 *
 * 职责：内存中创建、查找、更新 Session。
 * 扩展不应直接依赖此类，而应通过 hooks / events / StorageAdapter 介入 session 生命周期。
 * 参见 bootstrap-strategy.md §2.4。
 */
import type { Session } from '../../core/src'

export class SessionManager {
  private readonly sessions = new Map<string, Session>()

  async create(input?: Record<string, unknown>): Promise<Session> {
    const now = Date.now()
    const session: Session = {
      id: `session_${now}`,
      createdAt: now,
      updatedAt: now,
      metadata: input as Record<string, unknown> | undefined,
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

  // TODO: 委托 StorageAdapter 读取消息，当前为 stub
  async listMessages(_sessionId: string) {
    return []
  }
}
