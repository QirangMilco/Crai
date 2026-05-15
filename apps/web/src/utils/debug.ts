/**
 * 前端调试工具。
 *
 * 用法（浏览器控制台）：
 *   localStorage.setItem('crai:debug:scope', 'thinking,stream')
 *
 * 可用 scope 定义在 DEBUG_SCOPES 中，开启后通过 console.error 输出。
 */

export const DEBUG_SCOPES = {
  THINKING: 'thinking',
  STREAM: 'stream',
  MERGE: 'merge',
  ALL: 'all',
} as const

/** 全部可用 scope 名称（不含 'all'），用于发现提示。 */
const SCOPE_NAMES = Object.values(DEBUG_SCOPES).filter((s) => s !== 'all')

let hinted = false

/**
 * 输出调试日志到 stderr，仅在对应的 scope 开启时生效。
 * scope 开启方式：localStorage.setItem('crai:debug:scope', 'scope1,scope2')
 */
export function debugLog(scope: string, ...args: unknown[]): void {
  const raw = typeof localStorage !== 'undefined'
    ? localStorage.getItem('crai:debug:scope') || ''
    : ''
  const scopes = raw.split(',').map((s) => s.trim()).filter(Boolean)

  // 首次调用时提示可用 scope
  if (!hinted) {
    hinted = true
    if (scopes.length > 0) {
      const unknown = scopes.filter((s) => !SCOPE_NAMES.includes(s as any) && s !== 'all')
      if (unknown.length > 0) {
        console.error(`[crai:debug] 未知 scope: ${unknown.join(', ')}。可用: ${SCOPE_NAMES.join(', ')}`)
      }
    }
  }

  if (scopes.includes(DEBUG_SCOPES.ALL) || scopes.includes(scope)) {
    console.error(`[crai:${scope}]`, ...args)
  }
}
