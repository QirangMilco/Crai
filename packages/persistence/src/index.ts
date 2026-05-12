/**
 * @crai/persistence — 会话持久化 extension。
 *
 * 保存：每个 turn 结束后将消息写入已注册的 StorageAdapter。
 * 加载：由 runtime 内部的 buildContext 自动完成（listMessages）。
 *
 * 依赖：运行时必须注册至少一个 StorageAdapter（如 @crai/storage-fs）。
 */
import type { Extension } from '@crai/core'
import { HOOKS } from '@crai/core'

/** 创建持久化 extension。 */
export function createPersistenceExtension(): Extension {
  return {
    name: 'persistence',
    setup(ctx) {
      // 每个 turn 后保存消息
      ctx.hooks.on(HOOKS.TURN_AFTER, async (payload) => {
        const { session, messages } = payload as { session: any; messages: any[] }
        const storage = ctx.registry.storages.list()[0]?.value
        if (!storage) return { continue: true }

        await storage.updateSession(session)
        for (const msg of messages) {
          await storage.appendMessage(session.id, msg)
        }
        return { continue: true }
      })

      // session 停止时更新 session 元数据
      ctx.hooks.on(HOOKS.SESSION_AFTER_STOP, async (payload) => {
        const { session } = payload as { session: any }
        const storage = ctx.registry.storages.list()[0]?.value
        if (!storage) return { continue: true }

        session.updatedAt = Date.now()
        await storage.updateSession(session)
        return { continue: true }
      })
    },
  }
}
