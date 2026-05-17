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
 *
 * 时光轴日志（scope: 'timeline'）：
 * 记录每个用户操作和流式事件的精确时刻，帮助排查顺序和时序问题。
 * 日志格式：[tl] #序号 [+ms] 事件描述 [详情]
 */

export const DEBUG_SCOPES = {
  THINKING: 'thinking',
  STREAM: 'stream',
  MERGE: 'merge',
  TIMELINE: 'timeline',
  ALL: 'all',
} as const

let _eventCounter = 0
let _startTime = 0

/**
 * 时光轴日志。scope 匹配时输出带序号和相对时间的日志。
 * 每行格式：[tl] #3 [+450ms] 事件描述
 */
export function debugLog(scope: string, ...args: unknown[]): void {
  const raw = typeof localStorage !== 'undefined'
    ? localStorage.getItem('crai:debug:scope') || ''
    : ''
  const scopes = raw.split(',').map((s) => s.trim()).filter(Boolean)

  if (scopes.includes(DEBUG_SCOPES.ALL) || scopes.includes(scope)) {
    if (scope === DEBUG_SCOPES.TIMELINE) {
      if (!_startTime) _startTime = Date.now()
      _eventCounter++
      const elapsed = Date.now() - _startTime
      console.error(`[tl] #${_eventCounter} [+${elapsed}ms]`, ...args)
    } else {
      console.error(`[crai:${scope}]`, ...args)
    }
  }
}
