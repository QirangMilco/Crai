/**
 * 调试模块。
 *
 * 通过 AI_DEBUG 环境变量控制，逗号分隔的 scope 列表。
 * 与 trace（全量事件记录）正交，只输出指定子系统的内部状态。
 *
 * 用法：
 *   AI_DEBUG=tools pnpm openai
 *   AI_DEBUG=tools,context pnpm openai
 *   AI_DEBUG=all pnpm openai
 */

const SCOPES = (process.env.AI_DEBUG ?? '').split(',').filter(Boolean)

/** 检查某个 scope 是否开启。 */
export function isDebugScope(scope: string): boolean {
  if (SCOPES.length === 0) return false
  return SCOPES.includes('all') || SCOPES.includes(scope)
}

/** 当 scope 开启时，往 stderr 打印调试信息。 */
export function debugLog(scope: string, label: string, data: unknown): void {
  if (!isDebugScope(scope)) return
  console.error(`[debug:${scope}] ${label}\n${JSON.stringify(data, null, 2)}\n`)
}

/** 预定义的 scope 名称。 */
export const DEBUG_SCOPES = {
  TOOLS: 'tools',
  CONTEXT: 'context',
  MIDDLEWARE: 'middleware',
  ALL: 'all',
} as const
