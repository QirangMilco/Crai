import type {
  Extension,
  PermissionMode,
  ToolDefinition,
} from '@crai/core'
import { PERMISSION_MODES, TOOL_SAFETY_LEVELS, HOOKS } from '@crai/core'
import { validateToolPaths } from './path-validator'
import { isSensitiveCommand } from './sensitive-commands'

// ── 类型 ─────────────────────────────────────────────

/** Transport 层注入的确认函数。 */
export type AskHandler = (request: {
  toolName: string
  args: Record<string, unknown>
  definition: ToolDefinition
  reason: string
  /** 命令是否匹配敏感模式。即使工具已被设为始终允许，敏感命令仍需确认。 */
  isSensitive?: boolean
}) => Promise<boolean>

/** createWorkspaceSecurity 配置选项。 */
export interface WorkspaceSecurityOptions {
  /** 工作区根目录。 */
  rootDir: string
  /** 权限模式（默认 ask）。 */
  mode?: PermissionMode
  /** dangerous 工具在 ask 模式下的确认回调。不传时默认拒绝。 */
  askHandler?: AskHandler
}

// ── 入口 ─────────────────────────────────────────────

export function createWorkspaceSecurity(options: WorkspaceSecurityOptions): Extension {
  const rootDir = options.rootDir
  const mode = options.mode ?? PERMISSION_MODES.ASK
  const askHandler = options.askHandler

  return {
    name: 'workspace-security',
    setup(ctx) {
      ctx.hooks.on(
        HOOKS.TOOL_SAFETY_CHECK,
        async (value: any) => {
          const { definition: def, toolCall: tc } = value as {
            session: any
            toolCall: { name: string; arguments: Record<string, unknown> }
            definition: ToolDefinition
            mode: PermissionMode
          }
          const level = def.safetyLevel ?? TOOL_SAFETY_LEVELS.SAFE
          const args = tc.arguments as Record<string, unknown> ?? {}

          // safe / restricted：路径校验
          if (level === TOOL_SAFETY_LEVELS.SAFE || level === TOOL_SAFETY_LEVELS.RESTRICTED) {
            const pathError = validateToolPaths(args, rootDir)
            if (pathError) {
              return { stop: true as const, reason: pathError.reason }
            }
            return
          }

          // dangerous
          if (level === TOOL_SAFETY_LEVELS.DANGEROUS) {
            if (mode === PERMISSION_MODES.SAFE) {
              return { stop: true as const, reason: `危险工具 "${def.name}" 在 safe 模式下被禁止` }
            }

            if (mode === PERMISSION_MODES.ASK && askHandler) {
              // 对 bash 工具检查命令是否敏感
              let sensitive = false
              let sensitiveDesc = ''
              if (def.name === 'bash' || def.name === 'terminal-execute') {
                const cmd = String((args as any).command ?? '')
                const check = isSensitiveCommand(cmd)
                sensitive = check.matched
                sensitiveDesc = check.description ?? ''
              }

              const allowed = await askHandler({
                toolName: def.name,
                args,
                definition: def,
                isSensitive: sensitive,
                reason: sensitive
                  ? `敏感命令: ${sensitiveDesc}。请确认是否允许执行？`
                  : `工具 "${def.name}" 被标记为 dangerous，是否允许执行？`,
              })
              if (!allowed) {
                return { stop: true as const, reason: `工具 "${def.name}" 被用户拒绝` }
              }
              return
            }

            return
          }

          return
        },
      )
    },
  }
}
