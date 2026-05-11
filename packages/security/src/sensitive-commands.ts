/**
 * 敏感命令检测。
 *
 * 即使工具被设为"始终允许"，敏感命令仍需用户确认。
 * 移植自 snow-cli 的 sensitiveCommandManager。
 */

const SENSITIVE_PATTERNS: Array<{ id: string; pattern: RegExp; description: string }> = [
  { id: 'rm',        pattern: /\brm\s/, description: '删除文件或目录' },
  { id: 'rmdir',     pattern: /\brmdir\s/, description: '删除目录' },
  { id: 'dd',        pattern: /\bdd\s/, description: '磁盘低级操作' },
  { id: 'mkfs',      pattern: /\bmkfs/, description: '格式化文件系统' },
  { id: 'fdisk',     pattern: /\bfdisk\s/, description: '磁盘分区操作' },
  { id: 'reboot',    pattern: /\breboot\b/, description: '重启系统' },
  { id: 'shutdown',  pattern: /\bshutdown\s/, description: '关机' },
  { id: 'sudo',      pattern: /\bsudo\s/, description: '超级用户权限执行' },
  { id: 'su',        pattern: /\bsu\s/, description: '切换用户' },
  { id: 'chmod-rec', pattern: /\bchmod\s+-R\s+777\b/, description: '递归修改权限为 777' },
  { id: 'chown-rec', pattern: /\bchown\s+-R\s/, description: '递归修改所有者' },
  { id: 'git-force-push', pattern: /\bgit\s+push\b.*--force/, description: '强制推送 git（破坏性）' },
]

/** 检查命令是否匹配敏感模式。返回匹配到的第一个敏感命令，或 undefined。 */
export function isSensitiveCommand(command: string): { matched: boolean; id?: string; description?: string } {
  for (const sc of SENSITIVE_PATTERNS) {
    if (sc.pattern.test(command)) {
      return { matched: true, id: sc.id, description: sc.description }
    }
  }
  return { matched: false }
}
