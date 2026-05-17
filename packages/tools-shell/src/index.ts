import type { AdapterContext, Extension } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import { isDangerousCommand, isSelfDestructiveCommand, truncateOutput } from './security'
import { execCommand, processManager } from './process-manager'

// ── 配置 ─────────────────────────────────────────────

export interface ShellToolsOptions {
  /** 工作区根目录（bash 的 cwd）。 */
  rootDir: string
  /** 输出截断长度（默认 10000 字符）。 */
  maxOutputLength?: number
  /**
   * 沙箱配置。
   * 参考 OpenHanako 的 `getSandboxEnabled` 回调模式：每次工具调用时动态检查开关。
   */
  sandbox?: {
    /** 每次执行时动态求值。返回 true 时启用 OS 沙箱。 */
    enabled: () => boolean
    /** 将原始 (command, args) 包装为沙箱化命令。 */
    wrap: (command: string, args: string[]) => { command: string; args: string[]; cleanup: () => void }
  }
}

export { processManager }

// ── Extension 工厂 ──────────────────────────────────

export function createShellTools(options: ShellToolsOptions): Extension {
  const rootDir = options.rootDir
  const maxOutput = options.maxOutputLength ?? 10_000

  return {
    name: 'tools-shell',
    setup(ctx) {
      ctx.registerTool({
        name: 'bash',
        description: '执行 shell 命令（编译、测试、git 操作等）。不应用于文件读写操作——请用 fs_read / fs_write。',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的 shell 命令' },
            timeout: {
              type: 'number',
              description: '超时毫秒（默认 30000）',
              default: 30000,
            },
          },
          required: ['command'],
        },
        safetyLevel: TOOL_SAFETY_LEVELS.DANGEROUS as any,
        execute: async (request, ctx) => {
          const args = request.toolCall.arguments as any
          const command = String(args.command ?? '')
          const timeout = args.timeout ? Number(args.timeout) : 30_000

          if (!command) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              isError: true,
              content: [{ type: 'text', text: '命令不能为空' }],
            }
          }

          // 安全检测（防御纵深：安全层检查后工具自身再检一次）
          if (isDangerousCommand(command)) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              isError: true,
              content: [{ type: 'text', text: `危险命令被拦截: ${command.slice(0, 100)}` }],
            }
          }

          const selfDestruct = isSelfDestructiveCommand(command)
          if (selfDestruct.isSelfDestructive) {
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              isError: true,
              content: [{ type: 'text', text: `自我保护拦截: ${selfDestruct.reason}\n建议: ${selfDestruct.suggestion}` }],
            }
          }

          ctx?.emitProgress?.({ message: `执行: ${command.slice(0, 80)}`, progress: 0 })

          // ── ESC 中断（CLI 模式） / 取消信号（GUI 模式） ──
          const escController = new AbortController()
          let escListener: ((data: Buffer) => void) | undefined

          if (process.stdin.isTTY && process.stdin.setRawMode) {
            escListener = (data: Buffer) => {
              // ESC 键 = \x1b
              if (data[0] === 0x1b && !escController.signal.aborted) {
                escController.abort()
              }
            }
            process.stdin.setRawMode(true)
            process.stdin.on('data', escListener)
          }

          // 合并外部 signal（来自 Transport 层，如 GUI 取消按钮）和 ESC signal
          const signals: AbortSignal[] = []
          if (ctx?.signal) signals.push(ctx.signal)
          signals.push(escController.signal)
          const combinedSignal = signals.length > 1
            ? AbortSignal.any(signals)
            : signals[0]

          try {
            const result = await execCommand(command, {
              cwd: rootDir,
              timeout,
              signal: combinedSignal,
              sandbox: options.sandbox ? {
                enabled: options.sandbox.enabled,
                wrap: options.sandbox.wrap,
              } : undefined,
            })

            ctx?.emitProgress?.({ message: '执行完成', progress: 1, done: true })

            // snow-cli 模式：非零退出码也保留输出，不视为 error
            const output = truncateOutput(
              (result.stdout + result.stderr).trim() || '',
              maxOutput,
            )

            const isError = result.exitCode !== 0 && !output
            const exitInfo = result.exitCode !== 0 ? `\n[退出码: ${result.exitCode}]` : ''

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              isError,
              content: [{ type: 'text', text: (output || '(无输出)') + exitInfo }],
            }
          } finally {
            // 清理 ESC 监听
            if (escListener) {
              if (process.stdin.isTTY && process.stdin.setRawMode) {
                process.stdin.setRawMode(false)
              }
              process.stdin.removeListener('data', escListener)
            }
          }
        },
      })
    },
  }
}
