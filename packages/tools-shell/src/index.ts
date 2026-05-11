import type { Extension } from '@crai/core'
import { TOOL_SAFETY_LEVELS } from '@crai/core'
import { execSync, spawnSync } from 'node:child_process'
import { isDangerousCommand, isSelfDestructiveCommand, truncateOutput } from './security'

// ── 配置 ─────────────────────────────────────────────

export interface ShellToolsOptions {
  /** 工作区根目录（bash 的 cwd）。 */
  rootDir: string
  /** 输出截断长度（默认 10000 字符）。 */
  maxOutputLength?: number
}

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
        execute: async (request) => {
          try {
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

            // 执行
            const result = execSync(command, {
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024,
              timeout,
              cwd: rootDir,
            })

            const output = truncateOutput(result?.trim() || '', maxOutput)

            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              content: [{ type: 'text', text: output || '(无输出)' }],
            }
          } catch (err: any) {
            const stderr = err.stderr?.trim() || err.message || ''
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'bash',
              isError: true,
              content: [{ type: 'text', text: `执行失败: ${truncateOutput(stderr, maxOutput)}` }],
            }
          }
        },
      })
    },
  }
}
