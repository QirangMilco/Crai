// ── 类型 ─────────────────────────────────────────────

/** 敏感命令作用域。 */
export type SensitiveCommandScope = 'global' | 'project'

/** 单条敏感命令配置。 */
export interface SensitiveCommandEntry {
  id: string
  /** 匹配模式（RegExp 字符串，运行时 new RegExp）。 */
  pattern: string
  description: string
  /** 是否启用。禁用的模式不参与检测。 */
  enabled: boolean
  /** 是否为内建预设（用户可改 enabled，不可删除）。 */
  isPreset: boolean
  /** 作用域：global 始终生效，project 仅当前工作区生效。 */
  scope: SensitiveCommandScope
}

/** 敏感命令配置集合。 */
export interface SensitiveCommandsConfig {
  commands: SensitiveCommandEntry[]
}

// ── 预设模式 ─────────────────────────────────────────

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
  { id: 'git-force-push', pattern: '\\bgit\\s+push\\b.*--force', description: '强制推送 git（破坏性）', enabled: true, isPreset: true, scope: 'project' },
  { id: 'curl-post', pattern: '\\bcurl\\s.*-X\\s+POST',    description: 'HTTP POST 请求（潜在数据传输）', enabled: false, isPreset: true, scope: 'project' },
  { id: 'wget',      pattern: '\\bwget\\s',      description: '从网络下载文件',                  enabled: false, isPreset: true, scope: 'project' },
]

// ── 检查器工厂 ──────────────────────────────────────

export interface SensitiveCommandChecker {
  /** 检测命令是否匹配已启用的敏感模式。 */
  check(command: string): { matched: boolean; id?: string; description?: string; scope?: SensitiveCommandScope }
  /** 获取当前启用的全部配置。 */
  getConfig(): SensitiveCommandEntry[]
}

/** 从配置数组创建检查器。合并预设与用户自定义，以 id 去重（非预设优先）。 */
export function createSensitiveCommandChecker(
  commands?: SensitiveCommandEntry[],
): SensitiveCommandChecker {
  const merged = mergeCommands(commands ?? [])

  const enabledPatterns = merged
    .filter(c => c.enabled)
    .map(c => ({ id: c.id, description: c.description, scope: c.scope, regex: new RegExp(c.pattern) }))

  return {
    check(command: string) {
      for (const p of enabledPatterns) {
        if (p.regex.test(command)) {
          return { matched: true, id: p.id, description: p.description, scope: p.scope }
        }
      }
      return { matched: false }
    },
    getConfig() {
      return merged
    },
  }
}

/** 合并默认预设与用户配置，以 id 去重。用户配置覆盖预设的 enabled/scope。 */
function mergeCommands(overrides: SensitiveCommandEntry[]): SensitiveCommandEntry[] {
  const map = new Map<string, SensitiveCommandEntry>()
  for (const c of DEFAULT_SENSITIVE_COMMANDS) map.set(c.id, { ...c })
  for (const c of overrides) {
    const existing = map.get(c.id)
    if (existing && existing.isPreset) {
      // 用户只能改 enabled 和 scope，不能改 pattern/description/isPreset
      map.set(c.id, { ...existing, enabled: c.enabled, scope: c.scope })
    } else {
      // 用户自定义新增
      map.set(c.id, { ...c, isPreset: false })
    }
  }
  return Array.from(map.values())
}

// ── JSON 文件持久化辅助 ─────────────────────────────

/** 从 JSON 文件加载敏感命令配置（覆盖默认设置的 enabled/scope）。返回合并后的配置。 */
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

/** 将配置保存到 JSON 文件。只保存非预设项和与预设不同的 enabled/scope。 */
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
