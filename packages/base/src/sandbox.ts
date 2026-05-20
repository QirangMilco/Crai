/**
 * @crai/base — 沙箱执行隔离
 *
 * 包装 shell 命令执行，使用平台原生沙箱工具进行执行隔离。
 * 参考 OpenHanako 的 seatbelt.js / bwrap.js 实现。
 *
 * 支持：
 * - macOS：sandbox-exec（Seatbelt 框架）
 * - Linux：bubblewrap（bwrap）
 * - Windows：暂不支持（返回原始参数）
 *
 * 使用示例：
 * ```ts
 * const box = createSandbox({ rootDir: '/workspace/project' })
 * const { command, args } = box.wrap('sh', ['-c', 'git status'])
 * // → ['sandbox-exec', '-f', '/tmp/sb-profile-xxx.sb', 'sh', '-c', 'git status']
 * ```
 */

import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── 类型 ─────────────────────────────────────────────┰─────────────────────────────────────────

export interface SandboxOptions {
  /** 工作区根目录（允许读写）。 */
  rootDir: string

  /** 额外的可写路径。 */
  extraWritablePaths?: string[]

  /** 是否启用沙箱（默认 false）。 */
  enabled?: boolean

  /** sandbox-exec 超时（秒，macOS 默认 60）。 */
  timeout?: number

  /** 调试：不实际应用沙箱，仅打印日志。 */
  dryRun?: boolean
}

export interface SandboxWrappedCommand {
  command: string
  args: string[]
  cleanup: () => void
}

export interface SandboxProvider {
  /** 可用且启用？ */
  isAvailable: boolean
  name: string
  wrap(originalCommand: string, originalArgs: string[], rootDir: string): SandboxWrappedCommand
}

// ── 平台检测 ─────────────────────────────────────────

const PLATFORM = process.platform

// ── macOS Seatbelt ───────────────────────────────────

function checkSandboxExec(): boolean {
  try {
    execSync('which sandbox-exec', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function generateSeatbeltProfile(rootDir: string, extraWritable?: string[]): string {
  const realRoot = resolveRealPath(rootDir)
  const lines: string[] = [
    '(version 1)',
    '',
    ';; 写保护：只拒绝特定系统路径的写操作，其他全部允许',
  ]

  for (const p of PROTECTED_PATHS) {
    lines.push(`(deny file-write* (subpath "${p}"))`)
  }

  // 确保工作区可写（覆盖上面的 deny）
  lines.push('', ';; 工作区读写')
  lines.push(`(allow file-write* (subpath "${realRoot}"))`)
  lines.push('')

  // 临时目录可写
  lines.push(';; 临时目录')
  lines.push('(allow file-write* (subpath "/private/tmp"))')
  lines.push(`(allow file-write* (subpath "${resolveRealPath(tmpdir())}"))`)

  if (extraWritable) {
    for (const p of extraWritable) {
      lines.push(`(allow file-write* (subpath "${resolveRealPath(p)}"))`)
    }
  }

  // /dev/null
  lines.push('', ';; 杂项')
  lines.push('(allow file-write* (literal "/dev/null"))')

  return lines.join('\n')
}

const PROTECTED_PATHS: string[] = [
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/usr/lib',
  '/System',
  '/Library',
  '/private/etc',
  '/private/var/db',
  '/private/var/root',
].map(resolveRealPath)

function resolveRealPath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

function createTempProfile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'crai-sandbox-'))
  const path = join(dir, 'profile.sb')
  writeFileSync(path, content, 'utf-8')
  return path
}

function createSeatbeltProvider(enabled: boolean, extraWritable?: string[]): SandboxProvider {
  const available = checkSandboxExec()
  return {
    isAvailable: available && enabled,
    name: 'seatbelt (macOS)',
    wrap(originalCommand: string, originalArgs: string[], rootDir: string): SandboxWrappedCommand {
      const profile = generateSeatbeltProfile(rootDir, extraWritable)
      const profilePath = createTempProfile(profile)
      const cleanup = () => {
        try { unlinkSync(profilePath) } catch { /* 忽略 */ }
      }
      return {
        command: 'sandbox-exec',
        args: ['-f', profilePath, originalCommand, ...originalArgs],
        cleanup,
      }
    },
  }
}

// ── Linux Bubblewrap ─────────────────────────────────

function checkBwrap(): boolean {
  try {
    execSync('which bwrap', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function createBwrapProvider(enabled: boolean): SandboxProvider {
  const available = checkBwrap()
  return {
    isAvailable: available && enabled,
    name: 'bubblewrap (Linux)',
    wrap(originalCommand, originalArgs, rootDir: string) {
      return {
        command: 'bwrap',
        args: [
          '--ro-bind', '/', '/',
          '--proc', '/proc',
          '--dev', '/dev',
          '--tmpfs', '/tmp',
          '--bind', rootDir, rootDir,
          originalCommand,
          ...originalArgs,
        ],
        cleanup: () => {},
      }
    },
  }
}

// ── 空沙箱（直通） ───────────────────────────────────

function createNoopProvider(): SandboxProvider {
  return {
    isAvailable: false,
    name: 'none',
    wrap(originalCommand, originalArgs) {
      return {
        command: originalCommand,
        args: originalArgs,
        cleanup: () => {},
      }
    },
  }
}

// ── 工厂 ─────────────────────────────────────────────

/**
 * 创建沙箱执行器。
 * 根据平台和可用工具自动选择沙箱后端。
 */
export function createSandbox(options: SandboxOptions): SandboxProvider {
  if (!options.enabled) return createNoopProvider()

  if (PLATFORM === 'darwin') return createSeatbeltProvider(true, options.extraWritablePaths)
  if (PLATFORM === 'linux') return createBwrapProvider(true)
  return createNoopProvider()
}

/**
 * 简单版本的沙箱包装：给定原始命令和参数，返回沙箱化的命令和参数。
 * 不创建 profile 文件（适合一次性执行）。
 *
 * 如果 sandbox 不可用或未启用，返回原始命令和参数。
 */
export function wrapCommand(
  originalCommand: string,
  originalArgs: string[],
  options: SandboxOptions,
): SandboxWrappedCommand {
  const provider = createSandbox(options)
  if (!provider.isAvailable) {
    return { command: originalCommand, args: originalArgs, cleanup: () => {} }
  }
  return provider.wrap(originalCommand, originalArgs, options.rootDir)
}
