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
import { sanitizeParts } from '@crai/base'

/** 创建持久化 extension。 */
export function createPersistenceExtension(): Extension {
  return {
    name: 'persistence',
    setup(ctx) {
      // 已持久化的消息 ID（防止增量保存和最终保存之间重复）
      const persistedIds = new Set<string>()

      async function persistMessages(session: any, messages: any[]) {
        const storage = ctx.registry.storages.list()[0]?.value
        if (!storage) return

        await storage.updateSession(session)
        for (const msg of messages) {
          const { parts, hits } = sanitizeParts(msg.parts ?? [])
          if (hits.length > 0) {
            ;(ctx as any).logger?.info?.(
              `[pii-guard] 已脱敏 ${hits.length} 类敏感信息: ${hits.join(', ')}`
            )
          }
          // 允许更新：如果消息已存在（如 stopReason 被后处理修改），追加新版本
          if (persistedIds.has(msg.id)) {
            // 只追加有额外数据的版本（stopReason 从 undefined 变为 'aborted'）
            await storage.appendMessage(session.id, { ...msg, parts })
          } else {
            persistedIds.add(msg.id)
            await storage.appendMessage(session.id, { ...msg, parts })
          }
        }
      }

      // 每轮完成后立即保存（防止后续轮次失败时本轮消息丢失）
      ctx.hooks.on(HOOKS.TURN_AFTER_TOOL_EXEC, async (payload) => {
        await persistMessages(payload.session, payload.messages)
        return { continue: true }
      })

      // 整体 turn 结束后保存（兜底，含用户消息和最终文本）
      ctx.hooks.on(HOOKS.TURN_AFTER, async (payload) => {
        await persistMessages(payload.session, payload.messages)
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
