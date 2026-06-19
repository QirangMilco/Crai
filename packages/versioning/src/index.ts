import type { Extension, Logger } from '@crai/core'
import { HOOKS, createId } from '@crai/core'

interface CallModelMessage {
  role: string
  content: string
}

export interface VersioningOptions {
  /** 用于标题生成的模型名称（格式 "provider/model"）。 */
  titleModel?: string
  /** 日志记录器。 */
  logger?: Logger
}

/**
 * 从消息 parts 中提取纯文本内容。
 */
function extractTextFromMsg(msg: { parts: Array<{ type: string; text?: string }> }): string {
  return (msg.parts ?? [])
    .filter((p): p is { type: string; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
}

/**
 * 从 turn 消息列表中找到 user 消息和最后一个 assistant 消息。
 */
function findTurnMessages(messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>) {
  const userMsg = messages.find((m) => m.role === 'user')
  const asstMsg = [...messages].reverse().find((m) => m.role === 'assistant')
  return { userText: userMsg ? extractTextFromMsg(userMsg) : '', asstText: asstMsg ? extractTextFromMsg(asstMsg) : '' }
}

/**
 * 创建版本管理 Extension。
 *
 * 注册 turn:after hook，每轮 turn 完成后调 tool model 生成标题和描述，
 * 写入 CheckpointManager。
 */
export function createVersioningExtension(options?: VersioningOptions): Extension {
  return {
    name: 'versioning',
    setup(ctx) {
      const log = options?.logger ?? ctx.logger
      const titleModel = options?.titleModel

      ctx.hooks.on(HOOKS.TURN_AFTER, async ({ session, turnId, messages }) => {
        const { userText, asstText } = findTurnMessages(messages)
        if (!userText || !asstText) return

        // 构建 callModel 消息
        const prompt: CallModelMessage[] = [
          {
            role: 'user',
            content: `Based on the conversation turn below, generate a concise title and description.\n\n## User\n${userText}\n\n## Assistant\n${asstText}\n\nOutput JSON only:\n{"title": "...", "description": "..."}`,
          },
        ]

        try {
          const responseText = await ctx.runtime.callModel(prompt, {
            model: titleModel,
            maxTokens: 150,
          })

          if (!responseText) return

          // 解析 JSON
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (!jsonMatch) return

          const parsed = JSON.parse(jsonMatch[0])
          const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 60) : undefined
          const description = typeof parsed.description === 'string' ? parsed.description.slice(0, 300) : undefined

          if (title || description) {
            const cm = ctx.runtime.getCheckpointManager?.()
            if (cm) {
              await cm.complete(session.id, turnId, { title, description })
              log?.info?.(`[versioning] 标题已生成: ${title}`)
            }
          }
        } catch (err) {
          log?.warn?.(`[versioning] 标题生成失败: ${err instanceof Error ? err.message : String(err)}`)
        }
      })
    },
  }
}
