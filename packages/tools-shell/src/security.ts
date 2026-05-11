/**
 * 危险命令检测（从 snow-cli 直接吸收）。
 */

/** 应被拦截的危险命令模式。 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/[^/\s]*/i,      // rm -rf /xxx
  />\s*\/dev\/sda/i,             // 写入磁盘设备
  /mkfs/i,                        // 格式化文件系统
  /dd\s+if=/i,                    // 磁盘操作
  /:\(\)\s*\{.*:\s*\}\s*;/i,     // fork bomb
]

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command))
}

/** 检测是否会杀死 CLI 自身的 Node.js 进程。 */
export function isSelfDestructiveCommand(command: string): {
  isSelfDestructive: boolean
  reason?: string
  suggestion?: string
} {
  const lower = command.toLowerCase()
  const cliPid = process.pid

  // PowerShell: Stop-Process node
  if (lower.includes('stop-process') && /\bnode\b/i.test(command)) {
    return {
      isSelfDestructive: true,
      reason: '命令会终止 Node.js 进程（含当前 CLI）',
      suggestion: `当前 CLI 进程 PID: ${cliPid}。使用 PID 排除过滤器。`,
    }
  }

  // Windows: taskkill node.exe
  if (/\btaskkill\b/i.test(command) && /\bnode(\.exe)?\b/i.test(command)) {
    return {
      isSelfDestructive: true,
      reason: '命令会终止 node.exe 进程（含当前 CLI）',
      suggestion: `当前 CLI 进程 PID: ${cliPid}。使用 taskkill /PID <target_pid> 指定目标。`,
    }
  }

  // Unix: killall node
  if (/\bkillall\s+(-\w+\s+)*node\b/i.test(command)) {
    return {
      isSelfDestructive: true,
      reason: 'killall node 会终止所有 Node.js 进程（含当前 CLI）',
      suggestion: `使用 kill <pid> 指定单个进程，排除 PID ${cliPid}。`,
    }
  }

  // Unix: pkill node
  if (/\bpkill\s+(-\w+\s+)*node\b/i.test(command)) {
    return {
      isSelfDestructive: true,
      reason: 'pkill node 会终止 Node.js 进程（含当前 CLI）',
      suggestion: `使用 kill <pid> 指定单个进程，排除 PID ${cliPid}。`,
    }
  }

  // 直接攻击 CLI 自身 PID
  const pidPatterns = [
    new RegExp(`\\bkill\\s+(-\\d+\\s+)*${cliPid}\\b`),
    new RegExp(`\\bStop-Process\\s+.*-Id\\s+${cliPid}\\b`, 'i'),
    new RegExp(`\\btaskkill\\b.*\\/PID\\s+${cliPid}\\b`, 'i'),
  ]
  if (pidPatterns.some(p => p.test(command))) {
    return {
      isSelfDestructive: true,
      reason: `命令直接指向当前 CLI 进程 (PID: ${cliPid})`,
      suggestion: `PID ${cliPid} 是当前 CLI 进程，终止它将结束当前会话。`,
    }
  }

  return { isSelfDestructive: false }
}

/** 截断过长输出。 */
export function truncateOutput(output: string, maxLength: number): string {
  if (!output) return ''
  if (output.length > maxLength) {
    return output.slice(0, maxLength) + '\n... (输出已截断)'
  }
  return output
}
