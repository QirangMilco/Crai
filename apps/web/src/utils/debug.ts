/**
 * 前端调试工具。
 *
 * scope 开启方式（浏览器控制台）：
 *   localStorage.setItem('crai:debug:scope', 'thinking,stream,timeline,merge')
 *
 * 从 server 端自动同步：在 variants/dev.json 的 debug.scopes.client 中配置，
 * 前端收到 config:data 后自动写入 localStorage，无需手动操作。
 *
 * 可用 scope（在控制台执行可查看当前值）：
 *   localStorage.getItem('crai:debug:scope')
 *
 * 可用 scope 列表：
 *   thinking   - 思考过程 delta
 *   stream    - 流式文本 delta
 *   timeline  - 时光轴（事件时序）
 *   merge     - session:data 合并日志
 *   all       - 全部输出
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
  TITLE_GEN: 'title-gen',
  ALL: 'all',
} as const

// 启动时打印可用 scopes，用户无需翻代码就知道能开什么
const SCOPE_LIST = Object.values(DEBUG_SCOPES)
if (typeof window !== 'undefined') {
  ;(window as any).craiDebugScopes = SCOPE_LIST
  console.log(
    `[crai:debug] 可用 scope: ${SCOPE_LIST.join(', ')}\n` +
    `激活: localStorage.setItem('crai:debug:scope', 'thinking,stream')\n` +
    `查看当前值: localStorage.getItem('crai:debug:scope')`
  )
}

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
