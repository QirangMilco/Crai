import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

/**
 * 进程管理器：跟踪所有 spawn 的子进程，dispose 时清理。
 */
class ProcessManager {
  private processes = new Set<ChildProcess>()
  private isShuttingDown = false
  private readonly isWindows = process.platform === 'win32'

  register(proc: ChildProcess): void {
    if (this.isShuttingDown) {
      this.kill(proc)
      return
    }
    this.processes.add(proc)
    const cleanup = () => { this.processes.delete(proc) }
    proc.once('exit', cleanup)
    proc.once('error', cleanup)
  }

  private kill(proc: ChildProcess): void {
    const pid = proc.pid
    if (!pid || proc.killed) return

    if (this.isWindows) {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true, stdio: 'ignore',
      })
    } else {
      try { proc.kill('SIGTERM') } catch { /* 已结束 */ }
      setTimeout(() => {
        try { if (!proc.killed) proc.kill('SIGKILL') } catch { /* 已结束 */ }
      }, 1000)
    }
  }

  killAll(): void {
    this.isShuttingDown = true
    for (const proc of this.processes) this.kill(proc)
    this.processes.clear()
  }
}

export const processManager = new ProcessManager()

/** spawn 执行结果（含非零退出码的输出）。 */
export interface SpawnResult {
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
}

/**
 * 以 spawn 方式执行命令，返回 Promise<SpawnResult>。
 *
 * - 非零退出码不 reject，以 SpawnResult.exitCode 体现（snow-cli 模式）
 * - 支持 AbortSignal 取消
 * - 自动注册到 processManager
 */
export function execCommand(
  command: string,
  options: {
    cwd?: string
    timeout?: number
    signal?: AbortSignal
    maxBuffer?: number
    env?: Record<string, string | undefined>
  } = {},
): Promise<SpawnResult> {
  const { cwd, timeout = 30_000, signal, maxBuffer = 10 * 1024 * 1024, env } = options

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    processManager.register(child)

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeout)

    const onAbort = () => {
      clearTimeout(timer)
      child.kill('SIGTERM')
    }

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer)
        onAbort()
      } else {
        signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < maxBuffer) stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < maxBuffer) stderr += String(chunk)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve({ stdout, stderr, exitCode: -1, signal: undefined })
    })

    child.on('close', (code, sig) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve({
        stdout: trimBuffer(stdout, maxBuffer),
        stderr: trimBuffer(stderr, maxBuffer),
        exitCode: timedOut ? -1 : (code ?? -1),
        signal: sig ?? undefined,
      })
    })
  })
}

function trimBuffer(output: string, maxBytes: number): string {
  if (Buffer.byteLength(output, 'utf-8') <= maxBytes) return output
  // 逐字符截断，确保不截断多字节 UTF-8 字符
  let truncated = ''
  for (const char of output) {
    const next = truncated + char
    if (Buffer.byteLength(next, 'utf-8') > maxBytes) break
    truncated = next
  }
  return truncated + '\n... (输出已截断)'
}
