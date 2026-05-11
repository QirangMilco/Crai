/**
 * Provider 调试模块。
 * 与 runtime 的 debug.ts 读取同一份 AI_DEBUG 环境变量，按 scope 控制输出到 stderr。
 *
 * 用法：
 *   AI_DEBUG=api pnpm openai
 *   AI_DEBUG=tools,api pnpm openai
 *   AI_DEBUG=all pnpm openai
 */

const SCOPES = (process.env.AI_DEBUG ?? '').split(',').filter(Boolean)

/** 检查某个 scope 是否开启。 */
export function isDebugScope(scope: string): boolean {
  if (SCOPES.length === 0) return false
  return SCOPES.includes('all') || SCOPES.includes(scope)
}

export const DEBUG_SCOPES = {
  API: 'api',
  ALL: 'all',
} as const
