/**
 * todo-write 工具 — 会话 TODO 列表管理。
 *
 * 替换式协议：每次调用传入完整列表，覆盖当前 TODO。
 * 三态状态机：pending → in_progress → completed。
 * 约定：同时最多一条 in_progress。
 */
import type { ToolDefinition, ToolHandler } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'

export function createTodoWriteTool(): ToolHandler {
  const definition: ToolDefinition = {
    name: 'todo-write',
    description: `管理当前会话的 TODO 列表。替换式：每次传入完整 todos 列表，覆盖之前。
三态：pending（待做）| in_progress（进行中）| completed（已完成）。
约定：同时最多一条 in_progress。`,
    safetyLevel: TOOL_SAFETY_LEVELS.SAFE,
    inputSchema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string', description: '静态描述文本' },
              activeForm: { type: 'string', description: '进行中态的描述文本' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed'],
                description: '三态',
              },
            },
            required: ['content', 'status'],
          },
        },
      },
      required: ['todos'],
    },
  }

  return {
    definition,
    execute: async (request) => {
      const params = request.toolCall.arguments ?? {}
      const rawTodos = (params as Record<string, unknown>).todos as Record<string, unknown>[] | undefined
      const todos = (rawTodos ?? []).map((t: Record<string, unknown>, i: number) => ({
        id: (t.id as string) ?? `todo-${Date.now()}-${i}`,
        content: t.content as string,
        activeForm: t.activeForm as string | undefined,
        status: t.status as 'pending' | 'in_progress' | 'completed',
      }))

      // 更新 session 中的 todos
      const session = request.session
      session.todos = todos
      session.updatedAt = Date.now()

      // 构建摘要
      const counts = { pending: 0, in_progress: 0, completed: 0 }
      for (const td of todos) counts[td.status]++
      const summary = `TODO: ${todos.length} 项（${counts.completed} 完成，${counts.in_progress} 进行中，${counts.pending} 待办）`

      // 检测多 in_progress
      const inProgressWarning = counts.in_progress > 1
        ? ` (警告：${counts.in_progress} 个 in_progress，违反约定)`
        : ''

      return {
        toolCallId: request.toolCall.toolCallId,
        name: 'todo-write',
        content: [{ type: 'text' as const, text: summary + inProgressWarning }],
      }
    },
  }
}
