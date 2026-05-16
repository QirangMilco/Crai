/**
 * 前端调试工具。
 *
 * scope 开启方式（浏览器控制台）：
 *   localStorage.setItem('crai:debug:scope', 'thinking,stream')
 *
 * 从 server 端自动同步：在 variants/dev.json 的 debug.scopes.client 中配置，
 * 前端收到 config:data 后自动写入 localStorage，无需手动操作。
 *
 * 可用 scope：thinking, stream, merge
 */

export const DEBUG_SCOPES = {
  THINKING: 'thinking',
  STREAM: 'stream',
  MERGE: 'merge',
  ALL: 'all',
} as const

/**
 * 输出调试日志到 stderr，仅在对应的 scope 开启时生效。
 */
export function debugLog(scope: string, ...args: unknown[]): void {
  const raw = typeof localStorage !== 'undefined'
    ? localStorage.getItem('crai:debug:scope') || ''
    : ''
  const scopes = raw.split(',').map((s) => s.trim()).filter(Boolean)

  if (scopes.includes(DEBUG_SCOPES.ALL) || scopes.includes(scope)) {
    console.error(`[crai:${scope}]`, ...args)
  }
}
