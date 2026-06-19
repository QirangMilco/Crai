/**
 * @crai/core 调试模块。
 * 
 * 跨层共享的调试 scope 检查与输出。
 * 通过 setDebugScopes 注入 scope 列表（由变体配置经服务端设置）。
 */

import type { Logger } from './hooks'

let activeScopes: string[] = []

/** 设置激活的调试 scope。传空数组关全部，['all'] 开全部。 */
export function setDebugScopes(scopes: string[]): void {
  activeScopes = scopes
}

/** 检查某个 scope 是否开启。 */
export function isDebugScope(scope: string): boolean {
  if (activeScopes.length === 0) return false
  return activeScopes.includes('all') || activeScopes.includes(scope)
}

/**
 * scope 开启时输出调试信息。
 * 有 logger 时走 logger.debug()（受 logLevel 过滤 + 写日志文件），
 * 否则回退到 console.error()。
 */
export function debugLog(scope: string, label: string, data: unknown, logger?: Logger): void {
  if (!isDebugScope(scope)) return
  const msg = `[debug:${scope}] ${label}\n${JSON.stringify(data, null, 2)}\n`
  if (logger) {
    logger.debug(msg)
  } else {
    console.error(msg)
  }
}

/** 预定义的 scope 名称。 */
export const DEBUG_SCOPES = {
  TOOLS: 'tools',
  CONTEXT: 'context',
  MIDDLEWARE: 'middleware',
  API: 'api',
  TITLE_GEN: 'title-gen',
  THINKING: 'thinking',
  USAGE: 'usage',
  ABORT: 'abort',
  CHECKPOINT: 'checkpoint',
  ALL: 'all',
} as const
