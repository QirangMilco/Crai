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

  async listMessages(_sessionId: string) {
    return []
  }
}
