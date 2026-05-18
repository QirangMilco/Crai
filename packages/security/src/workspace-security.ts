import type {
  Extension,
  PermissionMode,
  ToolDefinition,
} from '@crai/core'
import { PERMISSION_MODES, TOOL_SAFETY_LEVELS, HOOKS } from '@crai/core'
import { validateToolPaths } from './path-validator'
import { createSensitiveCommandChecker, loadSensitiveCommandsFromFile } from './sensitive-commands'
import type { SensitiveCommandEntry } from './sensitive-commands'

// ── 类型 ─────────────────────────────────────────────

/** Transport 层注入的确认函数。 */
export type AskHandler = (request: {
  toolName: string
  args: Record<string, unknown>
  definition: ToolDefinition
  reason: string
  /** 命令是否匹配敏感模式。 */
  isSensitive?: boolean
}) => Promise<boolean>

export interface WorkspaceSecurityOptions {
  /** 工作区根目录。 */
  rootDir: string
  /** 权限模式（默认 ask）。 */
  mode?: PermissionMode
  /** dangerous 工具在 ask 模式下的确认回调。不传时默认拒绝。 */
  askHandler?: AskHandler
  /**
   * YOLO 模式：非敏感命令自动放行，敏感命令仍需确认。
   * 仅在 mode='ask' 时生效。
   */
  yoloMode?: boolean
  /**
   * 敏感命令配置列表（全局）。适用于用户家目录级别配置。
   * 覆盖默认预设的 enabled/scope。
   */
  sensitiveCommands?: SensitiveCommandEntry[]
  /**
   * 从 JSON 文件加载全局敏感命令配置（如 ~/.snow/sensitive-commands.json）。
   * 与 sensitiveCommands 合并，两者都属于 global 层。
   */
  sensitiveCommandsFile?: string
  /**
   * 从 JSON 文件加载项目级敏感命令配置（如 .crai/sensitive-commands.json）。
   * 优先级最高，覆盖全局层和默认预设。
   */
  sensitiveCommandsProjectFile?: string
}

// ── 入口 ─────────────────────────────────────────────

export function createWorkspaceSecurity(options: WorkspaceSecurityOptions): Extension {
  const rootDir = options.rootDir
  const askHandler = options.askHandler
  const yoloMode = options.yoloMode ?? false

  return {
    name: 'workspace-security',
    setup(ctx) {
      // 初始化敏感命令检查器
      let checkerPromise: Promise<ReturnType<typeof createSensitiveCommandChecker>> | null = null

      async function getChecker() {
        if (!checkerPromise) {
          checkerPromise = (async () => {
            const globalOverrides = [...(options.sensitiveCommands ?? [])]
            if (options.sensitiveCommandsFile) {
              const fileCmds = await loadSensitiveCommandsFromFile(options.sensitiveCommandsFile)
              globalOverrides.push(...fileCmds)
            }
            const projectOverrides: SensitiveCommandEntry[] = []
            if (options.sensitiveCommandsProjectFile) {
              const fileCmds = await loadSensitiveCommandsFromFile(options.sensitiveCommandsProjectFile)
              projectOverrides.push(...fileCmds)
            }
            return createSensitiveCommandChecker(globalOverrides, projectOverrides)
          })()
        }
        return checkerPromise
      }

      ctx.hooks.on(
        HOOKS.TOOL_SAFETY_CHECK,
        async (value: any) => {
          const { definition: def, toolCall: tc, mode } = value as {
            session: any
            toolCall: { name: string; arguments: Record<string, unknown> }
            definition: ToolDefinition
            mode: PermissionMode
          }
          const checkMode = mode ?? PERMISSION_MODES.ASK
          const level = def.safetyLevel ?? TOOL_SAFETY_LEVELS.SAFE
          const args = tc.arguments as Record<string, unknown> ?? {}

          // safe / restricted：路径校验
          if (level === TOOL_SAFETY_LEVELS.SAFE || level === TOOL_SAFETY_LEVELS.RESTRICTED) {
            const pathError = validateToolPaths(args, rootDir)
            if (pathError) {
              return { stop: true as const, reason: pathError.reason }
            }
            // safe 模式下 RESTRICTED 工具也被拦截
            if (level === TOOL_SAFETY_LEVELS.RESTRICTED && checkMode === PERMISSION_MODES.SAFE) {
              return { stop: true as const, reason: `修改工具 "${def.name}" 在只读模式下被禁止` }
            }
            return
          }

          // safe 模式（只读）：拦截所有 dangerous 工具
          if (checkMode === PERMISSION_MODES.SAFE) {
            if (level === TOOL_SAFETY_LEVELS.DANGEROUS) {
              return { stop: true as const, reason: `危险工具 "${def.name}" 在只读模式下被禁止` }
            }
          }
          if (level === TOOL_SAFETY_LEVELS.DANGEROUS) {

            // 检测敏感命令
            let sensitive = false
            let sensitiveDesc = ''
            if (def.name === 'bash' || def.name === 'terminal-execute') {
              const cmd = String((args as any).command ?? '')
              const checker = await getChecker()
              const check = checker.check(cmd)
              sensitive = check.matched
              sensitiveDesc = check.description ?? ''
            }

            // YOLO 模式：非敏感命令自动放行
            if (yoloMode && !sensitive) {
              return // 自动放行
            }

            if (checkMode === PERMISSION_MODES.ASK && askHandler) {
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
