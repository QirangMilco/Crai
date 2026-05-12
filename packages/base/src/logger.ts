/**
 * @crai/base/logger — 可配置的 Logger 实现。
 *
 * Logger 接口定义在 @crai/core 中，此文件提供标准实现。
 * 支持控制台输出 + 可选的文件日志（追加模式）。
 */
import type { Logger, LogLevel } from '@crai/core'
import { appendFileSync, statSync, renameSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
}

function parseLevel(level?: string): number {
  if (level && level in LEVEL_VALUES) return LEVEL_VALUES[level as LogLevel]
  return 1
}

export interface ConsoleLoggerOptions {
  tag: string
  level?: LogLevel | string | number
  /** 日志文件输出目录。设置后日志同时写入 {logDir}/{tag}.log。 */
  logDir?: string
  /** 单个日志文件最大字节数，超过后自动轮转（默认 10MB）。0 或负数不轮转。 */
  maxFileSize?: number
  /** 保留的旧日志文件数量（默认 3）。 */
  maxBackups?: number
}

/**
 * 带级别过滤和标签前缀的日志实现。
 *
 * 用法：
 *   const log = new ConsoleLogger({ tag: 'server', level: 'debug', logDir: '/tmp/logs' })
 *   log.info('服务已启动', { port: 8080 })
 *   log.warn('配置缺失')
 *   log.error('连接失败', { err: 'timeout' })
 */
export class ConsoleLogger implements Logger {
  private _tag: string
  private _level: number
  private _logPath: string | null = null
  private _maxFileSize: number
  private _maxBackups: number

  constructor(tagOrOpts: string | ConsoleLoggerOptions, level?: LogLevel | string | number) {
    if (typeof tagOrOpts === 'string') {
      this._tag = tagOrOpts
      this._level = typeof level === 'number' ? level : parseLevel(level)
      this._maxFileSize = 10 * 1024 * 1024
      this._maxBackups = 3
    } else {
      this._tag = tagOrOpts.tag
      this._level = typeof tagOrOpts.level === 'number' ? tagOrOpts.level : parseLevel(tagOrOpts.level as string | undefined)
      this._maxFileSize = (tagOrOpts.maxFileSize ?? 10 * 1024 * 1024)
      this._maxBackups = tagOrOpts.maxBackups ?? 3
      if (tagOrOpts.logDir) {
        mkdirSync(tagOrOpts.logDir, { recursive: true })
        this._logPath = join(tagOrOpts.logDir, `${this._tag}.log`)
      }
    }
  }

  private shouldLog(level: number): boolean {
    return level >= this._level
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LEVEL_VALUES[level])) return

    const meta = metadata && Object.keys(metadata).length > 0
      ? ` ${JSON.stringify(metadata)}`
      : ''
    const ts = new Date().toISOString()
    const line = `${ts} [${LEVEL_LABELS[level]}] [${this._tag}] ${message}${meta}`

    switch (level) {
      case 'debug': console.debug(line); break
      case 'info':  console.info(line); break
      case 'warn':  console.warn(line); break
      case 'error': console.error(line); break
    }

    if (this._logPath) {
      try { this.rotateIfNeeded(); appendFileSync(this._logPath, line + '\n', 'utf-8') } catch { /* 忽略文件写入错误 */ }
    }
  }

  /** 文件超过 maxFileSize 时执行轮转。 */
  private rotateIfNeeded(): void {
    if (this._maxFileSize <= 0 || !this._logPath) return
    try {
      const stat = statSync(this._logPath)
      if (stat.size < this._maxFileSize) return
    } catch { return } // 文件不存在，首次写入

    // server.log → server.20240101-120000.log
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const rotated = `${this._logPath}.${ts}`
    try { renameSync(this._logPath, rotated) } catch { return }

    // 清理旧备份，只保留 maxBackups 个
    if (this._maxBackups <= 0) return
    const dir = this._logPath.substring(0, this._logPath.lastIndexOf('/'))
    const base = this._logPath.substring(this._logPath.lastIndexOf('/') + 1)
    try {
      const files = readdirSync(dir)
        .filter((f) => f.startsWith(base + '.'))
        .sort()
      while (files.length > this._maxBackups) {
        const old = files.shift()!
        try { unlinkSync(join(dir, old)) } catch { /* 删除失败则跳过 */ }
      }
    } catch { /* 清理错误忽略 */ }
  }

  setLevel(level: LogLevel | string): void { this._level = parseLevel(level) }
  get tag(): string { return this._tag }

  debug(message: string, metadata?: Record<string, unknown>): void { this.write('debug', message, metadata) }
  info(message: string, metadata?: Record<string, unknown>): void { this.write('info', message, metadata) }
  warn(message: string, metadata?: Record<string, unknown>): void { this.write('warn', message, metadata) }
  error(message: string, metadata?: Record<string, unknown>): void { this.write('error', message, metadata) }
}
