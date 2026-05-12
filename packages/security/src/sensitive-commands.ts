// ── 类型 ─────────────────────────────────────────────

export type SensitiveCommandScope = 'global' | 'project'

export interface SensitiveCommandEntry {
  id: string
  pattern: string
  description: string
  enabled: boolean
  isPreset: boolean
  scope: SensitiveCommandScope
}

export interface SensitiveCommandsConfig {
  commands: SensitiveCommandEntry[]
}

// ── 预设模式（全部 scope: 'global'，不会写死 project）───

export const DEFAULT_SENSITIVE_COMMANDS: SensitiveCommandEntry[] = [
  { id: 'rm',        pattern: '\\brm\\s',        description: '删除文件或目录',                  enabled: true,  isPreset: true, scope: 'global' },
  { id: 'rmdir',     pattern: '\\brmdir\\s',     description: '删除目录',                        enabled: true,  isPreset: true, scope: 'global' },
  { id: 'unlink',    pattern: '\\bunlink\\s',    description: '删除文件 (unlink)',               enabled: true,  isPreset: true, scope: 'global' },
  { id: 'dd',        pattern: '\\bdd\\s',        description: '磁盘低级操作',                    enabled: true,  isPreset: true, scope: 'global' },
  { id: 'mkfs',      pattern: '\\bmkfs',         description: '格式化文件系统',                  enabled: true,  isPreset: true, scope: 'global' },
  { id: 'fdisk',     pattern: '\\bfdisk\\s',     description: '磁盘分区操作',                    enabled: true,  isPreset: true, scope: 'global' },
  { id: 'reboot',    pattern: '\\breboot\\b',    description: '重启系统',                        enabled: true,  isPreset: true, scope: 'global' },
  { id: 'shutdown',  pattern: '\\bshutdown\\s',  description: '关机',                            enabled: true,  isPreset: true, scope: 'global' },
  { id: 'sudo',      pattern: '\\bsudo\\s',      description: '超级用户权限执行',                enabled: false, isPreset: true, scope: 'global' },
  { id: 'su',        pattern: '\\bsu\\s',        description: '切换用户',                        enabled: false, isPreset: true, scope: 'global' },
  { id: 'chmod-rec', pattern: '\\bchmod\\s+-R\\s+777\\b', description: '递归修改权限为 777',    enabled: true,  isPreset: true, scope: 'global' },
  { id: 'chown-rec', pattern: '\\bchown\\s+-R\\s',      description: '递归修改所有者',          enabled: true,  isPreset: true, scope: 'global' },
  { id: 'git-force-push', pattern: '\\bgit\\s+push\\b.*--force', description: '强制推送 git（破坏性）', enabled: true, isPreset: true, scope: 'global' },
  { id: 'curl-post', pattern: '\\bcurl\\s.*-X\\s+POST',    description: 'HTTP POST 请求',       enabled: false, isPreset: true, scope: 'global' },
  { id: 'wget',      pattern: '\\bwget\\s',      description: '从网络下载文件',                  enabled: false, isPreset: true, scope: 'global' },
]

// ── 管道拆分 ────────────────────────────────────────

/**
 * 将命令按管道/连接符拆分为独立段，逐段检测敏感命令。
 * 摘自 snow-cli splitCommand。
 */
export function splitCommand(command: string): string[] {
  if (!command) return []

  const separators = /(?:&&|\|\||;|\|)/g
  const parts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = separators.exec(command)) !== null) {
    const part = command.slice(lastIndex, match.index).trim()
    if (part) parts.push(part)
    lastIndex = match.index + match[0].length
  }

  const last = command.slice(lastIndex).trim()
  if (last) parts.push(last)

  return parts.length > 0 ? parts : [command]
}

// ── 检查器工厂 ──────────────────────────────────────

export interface SensitiveCommandChecker {
  check(command: string): { matched: boolean; id?: string; description?: string; scope?: SensitiveCommandScope }
  getConfig(): SensitiveCommandEntry[]
}

/**
 * 创建敏感命令检查器。
 *
 * @param globalOverrides 全局覆盖（来自 ~/.snow/sensitive-commands.json）
 * @param projectOverrides 项目覆盖（来自 .crai/sensitive-commands.json）
 *
 * 合并规则：
 *   1. 以 DEFAULT_SENSITIVE_COMMANDS 为基准
 *   2. globalOverrides 覆盖（适用于用户家目录配置）
 *   3. projectOverrides 覆盖（适用于项目本地配置）—— 优先级最高
 */
export function createSensitiveCommandChecker(
  globalOverrides?: SensitiveCommandEntry[],
  projectOverrides?: SensitiveCommandEntry[],
): SensitiveCommandChecker {
  const merged = mergeByScope(globalOverrides ?? [], projectOverrides ?? [])

  const enabledPatterns = merged
    .filter(c => c.enabled)
    .map(c => ({ id: c.id, description: c.description, scope: c.scope, regex: new RegExp(c.pattern) }))

  return {
    check(command: string) {
      const parts = splitCommand(command)
      for (const part of parts) {
        for (const p of enabledPatterns) {
          if (p.regex.test(part)) {
            return { matched: true, id: p.id, description: p.description, scope: p.scope }
          }
        }
      }
      return { matched: false }
    },
    getConfig() {
      return merged
    },
  }
}

/** 三层合并：默认 → global 覆盖 → project 覆盖。每层按 id 覆盖 enabled/scope。 */
function mergeByScope(
  globalOverrides: SensitiveCommandEntry[],
  projectOverrides: SensitiveCommandEntry[],
): SensitiveCommandEntry[] {
  const base = new Map<string, SensitiveCommandEntry>()
  for (const c of DEFAULT_SENSITIVE_COMMANDS) base.set(c.id, { ...c })

  applyOverrides(base, globalOverrides)
  applyOverrides(base, projectOverrides)

  return Array.from(base.values())
}

function applyOverrides(
  base: Map<string, SensitiveCommandEntry>,
  overrides: SensitiveCommandEntry[],
): void {
  for (const c of overrides) {
    const existing = base.get(c.id)
    if (existing && existing.isPreset) {
      base.set(c.id, { ...existing, enabled: c.enabled, scope: c.scope })
    } else {
      base.set(c.id, { ...c, isPreset: false })
    }
  }
}

// ── JSON 文件持久化辅助 ─────────────────────────────

export async function loadSensitiveCommandsFromFile(filePath: string): Promise<SensitiveCommandEntry[]> {
  try {
    const { readFile } = await import('node:fs/promises')
    const raw = await readFile(filePath, 'utf-8')
    const parsed: SensitiveCommandsConfig = JSON.parse(raw)
    if (!Array.isArray(parsed.commands)) return []
    return parsed.commands
  } catch {
    return []
  }
}

export async function saveSensitiveCommandsToFile(
  filePath: string,
  commands: SensitiveCommandEntry[],
): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises')
  const { dirname, resolve } = await import('node:path')
  const dir = dirname(resolve(filePath))
  await mkdir(dir, { recursive: true })
  await writeFile(filePath, JSON.stringify({ commands }, null, 2), 'utf-8')
}
