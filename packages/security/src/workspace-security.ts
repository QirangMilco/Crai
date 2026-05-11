import type {
  Extension,
  HookMap,
  PermissionMode,
  ToolDefinition,
} from '@crai/core'
import { PERMISSION_MODES, TOOL_SAFETY_LEVELS, HOOKS } from '@crai/core'
import { validateToolPaths } from './path-validator'

// ── 类型 ─────────────────────────────────────────────

/** Transport 层注入的确认函数。dangerous + ask 模式时调用。 */
export type AskHandler = (request: {
  toolName: string
  args: Record<string, unknown>
  definition: ToolDefinition
  reason: string
}) => Promise<boolean>

/** createWorkspaceSecurity 配置选项。 */
export interface WorkspaceSecurityOptions {
  /** 工作区根目录，所有路径类工具参数不得逃逸此目录。 */
  rootDir: string

  /** 权限模式（默认 ask）。 */
  mode?: PermissionMode

  /** dangerous 工具在 ask 模式下的确认回调。不传时默认拒绝。 */
  askHandler?: AskHandler
}

// ── 入口 ─────────────────────────────────────────────

/**
 * 创建一个 workspace security extension。
 *
 * - 注册 `tool:safetyCheck` hook，按 safetyLevel 执行安全策略
 * - **safe / restricted**: 路径参数校验（不能逃逸 rootDir）
 * - **dangerous**:
 *   - `safe` 模式 → 直接拒绝
 *   - `ask` 模式 → 调用 askHandler，用户确认后才放行
 *   - `execute` 模式 → 放行
 */
export function createWorkspaceSecurity(options: WorkspaceSecurityOptions): Extension {
  const rootDir = options.rootDir
  const mode = options.mode ?? PERMISSION_MODES.ASK
  const askHandler = options.askHandler

  return {
    name: 'workspace-security',
    setup(ctx) {
      ctx.onHook(
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

          if (level === TOOL_SAFETY_LEVELS.SAFE || level === TOOL_SAFETY_LEVELS.RESTRICTED) {
            // safe / restricted 工具：校验路径参数
            const pathError = validateToolPaths(args, rootDir)
            if (pathError) {
              return { stop: true as const, reason: pathError.reason }
            }
            return
          }

          if (level === TOOL_SAFETY_LEVELS.DANGEROUS) {
            if (mode === PERMISSION_MODES.SAFE) {
              return { stop: true as const, reason: `危险工具 "${def.name}" 在 safe 模式下被禁止` }
            }

            if (mode === PERMISSION_MODES.ASK && askHandler) {
              const allowed = await askHandler({
                toolName: def.name,
                args,
                definition: def,
                reason: `工具 "${def.name}" 被标记为 dangerous，是否允许执行？`,
              })
              if (!allowed) {
                return { stop: true as const, reason: `危险工具 "${def.name}" 被用户拒绝` }
              }
              return
            }

            // ask 模式但没有 askHandler 或 execute 模式：放行
            return
          }

          // 其他级别暂不额外处理
          return
        },
      )
    },
  }
}
