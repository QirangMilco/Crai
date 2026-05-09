/**
 * Trace 收集器与结构树渲染。
 *
 * 当 runtime 开启 `trace` 选项时，所有 event/hook 调用被记录下来。
 * dispose() 时输出完整链路树到文件或控制台。
 *
 * 支持三种模式：
 *   file      — 写入 .crai/trace-latest.md（默认）
 *   console   — dispose 时打印到 stderr
 *   realtime  — 每步实时输出到 stderr
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TraceFn } from './bus'

export type TraceMode = 'file' | 'console' | 'realtime'

export interface TraceEntry {
  kind: 'event' | 'hook' | 'note'
  name: string
  triggeredBy: string
  handlers: Array<{ source: string }>
  timestamp: number
}

/** 从 stack frame 行提取相对路径:行号。 */
function parseLocation(line: string): { display: string; link: string } {
  const parenMatch = line.match(/\((.+?(?::\d+)?(?::\d+)?)\)\s*$/)
  if (parenMatch) return formatLocation(parenMatch[1])
  const pathMatch = line.match(/([/\w_.-]+\.(?:ts|js|mjs|tsx|jsx):\d+)/)
  if (pathMatch) return formatLocation(pathMatch[1])
  return { display: line.trim(), link: '' }
}

function formatLocation(full: string): { display: string; link: string } {
  // 解析 /path/file.ts:line:col
  const m = full.match(/^(.+?)(?::(\d+))?(?::\d+)?$/)
  if (!m) return { display: full.trim(), link: '' }

  let filePath = m[1]   // /Users/.../turnRunner.ts
  const lineNum = m[2]    // '55' 或 undefined

  // 确保绝对路径
  if (!filePath.startsWith('/')) {
    filePath = `${process.cwd()}/${filePath}`
  }

  // 显示：turnRunner.ts:55（仅文件名+行号）
  const fileName = filePath.split('/').pop() ?? filePath
  const display = lineNum ? `${fileName}:${lineNum}` : fileName

  // 链接：file:///absolute/path#L55（VS Code markdown 中 Cmd+click 可跳转）
  const link = lineNum
    ? `file://${filePath}#L${lineNum}`
    : `file://${filePath}`

  return { display, link }
}

/** 实时模式一行输出的最大宽度。 */
const MAX_LABEL_WIDTH = 32

export function createTraceCollector(opts?: {
  outputDir?: string
  mode?: TraceMode
}): TraceFn & {
  /** 添加一条上下文注解（如 session ID、prompt 参数）。 */
  note(msg: string): void
  render(): string
  writeFile(): string
  /** dispose 时调用，根据 mode 输出。 */
  flush(): void
} {
  const entries: TraceEntry[] = []
  const outputDir = opts?.outputDir ?? '.crai'
  const mode: TraceMode = opts?.mode ?? 'file'

  // ── TraceFn 实现 ──

  const collector: TraceFn = {
    register() {},
    execute(execOpts) {
      const entry: TraceEntry = {
        kind: execOpts.kind,
        name: execOpts.name,
        triggeredBy: execOpts.triggeredBy,
        handlers: execOpts.handlers.map((h) => ({ source: h.source })),
        timestamp: Date.now(),
      }

      if (mode === 'realtime') {
        printRealtime(entry)
      }

      entries.push(entry)
    },
  }

  // ── 注解 ──

  function note(msg: string): void {
    const entry: TraceEntry = {
      kind: 'note',
      name: msg,
      triggeredBy: '',
      handlers: [],
      timestamp: Date.now(),
    }
    if (mode === 'realtime') {
      const line = `  · ${msg}`
      console.error(line)
    }
    entries.push(entry)
  }

  // ── 实时行输出 ──

  function printRealtime(entry: TraceEntry): void {
    const tag = entry.kind === 'hook' ? 'HOOK' : 'EVENT'
    const trig = entry.triggeredBy
      ? parseLocation(entry.triggeredBy)
      : null
    const loc = trig ? trig.display : ''
    const hCount = entry.handlers.length > 0
      ? ` (${entry.handlers.length})`
      : ''
    const label = `${tag} ${entry.name}`.padEnd(MAX_LABEL_WIDTH)
    console.error(`  ${label} ${loc}${hCount}`)
    for (const h of entry.handlers) {
      if (h.source) {
        const hl = parseLocation(h.source)
        console.error(`  ${''.padEnd(MAX_LABEL_WIDTH)}  handled by ${hl.display}`)
      }
    }
  }

  // ── mdLink ──

  function mdLink(loc: { display: string; link: string }): string {
    if (!loc.link) return loc.display
    return `[\`${loc.display}\`](${loc.link})`
  }

  // ── 分组检测 ──

  function detectGroup(name: string, prev: string): string | null {
    if (name === 'runtime:started') return 'createRuntime'
    if (name === 'runtime:stopped') return 'dispose'
    if (name === 'input:received' && prev !== 'prompt') return 'prompt'
    if (name === 'session:afterStop') return 'stopSession'
    return null
  }

  // ── 渲染 ──

  function render(): string {
    const lines: string[] = []
    let turnCounter = 0
    let prevGroup = ''

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]

      // 注解行
      if (e.kind === 'note') {
        if (prevGroup) {
          lines.push('│')
        }
        lines.push(`${e.name}`)
        prevGroup = 'note'
        continue
      }

      const tag = e.kind === 'hook' ? 'HOOK' : 'EVENT'
      const trig = e.triggeredBy ? parseLocation(e.triggeredBy) : null
      const handlerSources = e.handlers
        .filter((h) => h.source && h.source !== '(unknown)')
        .map((h) => parseLocation(h.source))

      const label = detectGroup(e.name, prevGroup)

      if (label === 'prompt') {
        turnCounter++
        lines.push('')
        lines.push(`├─ prompt (turn #${turnCounter})`)
        lines.push('│')
        prevGroup = 'prompt'
      } else if (label && label !== 'prompt') {
        lines.push('')
        lines.push(`├─ ${label}`)
        lines.push('│')
        prevGroup = label
      }

      const locPart = trig ? `  ${mdLink(trig)}` : ''
      lines.push(`│ ${tag}  ${e.name}${locPart}`)
      for (const h of handlerSources) {
        lines.push(`│   handled by  ${mdLink(h)}`)
      }
    }

    lines.push('')

    const consumedHooks = entries.filter(
      (e) => e.kind === 'hook' && e.handlers.length > 0,
    ).length
    const consumedEvents = entries.filter(
      (e) => e.kind === 'event' && e.handlers.length > 0,
    ).length

    const out: string[] = [
      '# Trace',
      '',
      `> ${new Date().toISOString()} · ${entries.length} entries`,
      '',
      ...lines,
      '',
      `**${turnCounter} turns** · ${consumedEvents} events · ${consumedHooks} hooks consumed`,
      '',
    ]
    return out.join('\n')
  }

  // ── 输出 ──

  function writeFile(): string {
    const content = render()
    mkdirSync(outputDir, { recursive: true })
    const path = join(outputDir, 'trace-latest.md')
    writeFileSync(path, content, 'utf-8')
    return path
  }

  function flush(): void {
    if (mode === 'file') {
      const path = writeFile()
      console.error(`\nTrace → ${path}`)
    } else if (mode === 'console') {
      console.error('\n' + renderConsole())
    }
  }

  /** 纯文本渲染（无 md 链接，用于 console 模式）。 */
  function renderConsole(): string {
    const lines: string[] = []
    let turnCounter = 0
    let prevGroup = ''

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]

      if (e.kind === 'note') {
        if (prevGroup) lines.push('│')
        lines.push(e.name)
        prevGroup = 'note'
        continue
      }

      const tag = e.kind === 'hook' ? 'HOOK' : 'EVENT'
      const trig = e.triggeredBy ? parseLocation(e.triggeredBy) : null
      const handlerSources = e.handlers
        .filter((h) => h.source && h.source !== '(unknown)')
        .map((h) => parseLocation(h.source))

      const label = detectGroup(e.name, prevGroup)

      if (label === 'prompt') {
        turnCounter++
        lines.push('')
        lines.push(`├─ prompt (turn #${turnCounter})`)
        lines.push('│')
        prevGroup = 'prompt'
      } else if (label && label !== 'prompt') {
        lines.push('')
        lines.push(`├─ ${label}`)
        lines.push('│')
        prevGroup = label
      }

      const locPart = trig ? `  ${trig.display}` : ''
      lines.push(`│ ${tag}  ${e.name}${locPart}`)
      for (const h of handlerSources) {
        lines.push(`│   handled by  ${h.display}`)
      }
    }

    lines.push('')

    const consumedHooks = entries.filter(
      (e) => e.kind === 'hook' && e.handlers.length > 0,
    ).length
    const consumedEvents = entries.filter(
      (e) => e.kind === 'event' && e.handlers.length > 0,
    ).length

    const out: string[] = [
      `${'─'.repeat(50)}`,
      `Trace · ${turnCounter} turns · ${consumedEvents} events · ${consumedHooks} hooks`,
      '',
      ...lines,
      `${'─'.repeat(50)}`,
      '',
    ]
    return out.join('\n')
  }

  return Object.assign(collector, { note, render, writeFile, flush })
}
