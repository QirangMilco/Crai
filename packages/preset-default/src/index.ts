import type {
  Extension,
  ModelAdapter,
  PermissionAdapter,
  PermissionDecision,
  RuntimeError,
  ToolSafetyLevel,
} from '../../core/src'
import { ERROR_CODES, HOOKS } from '../../core/src'
import { createDefaultI18nAdapter } from './i18n/index'

// ============================================================
// 默认安全配置
// ============================================================

/** 危险命令列表：这些命令在任意权限模式下都需用户确认。 */
const DANGEROUS_COMMANDS = new Set([
  'rm', 'rmdir', 'sudo', 'su', 'chmod', 'chown', 'chgrp',
  'mv', 'cp', 'dd', 'mkfs', 'fdisk', 'parted',
  'kill', 'killall', 'pkill',
  'reboot', 'shutdown', 'halt', 'poweroff',
  'curl', 'wget', 'ssh', 'scp', 'rsync',
])

/** 危险命令正则模式：补充语义匹配，捕获复合命令。 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/[^/\s]*/i,
  />\s*\/dev\/sda/i,
  /mkfs/i,
  /dd\s+if=/i,
  /\bcurl\b.*\|\s*(ba|z)?sh\b/i,
  /\bwget\b.*-O\s*-\s*\|\s*(ba|z)?sh\b/i,
]

/** 受保护的文件/目录列表：禁止写入。 */
const PROTECTED_PATHS: string[] = [
  '.env', '.env.*', '*.pem', '*.key',
  '~/.ssh', '~/.aws', '~/.gnupg',
  '/etc', '/usr', '/bin', '/sbin',
  'node_modules/.cache',
  '.git/objects',
]

/** 环境变量黑名单：子进程执行时屏蔽。 */
const BLOCKED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'STRIPE_SECRET_KEY',
  'NPM_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
]

/**
 * 检查命令是否匹配危险模式。
 */
export function isDangerousCommand(command: string): boolean {
  const baseCommand = command.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (DANGEROUS_COMMANDS.has(baseCommand)) return true
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command))
}

/**
 * 检查命令是否属于自毁操作（会杀掉自身 Node.js 进程）。
 */
export function isSelfDestructiveCommand(command: string): boolean {
  const lower = command.toLowerCase()
  if (/\bkillall\s+(-\w+\s+)*node\b/i.test(lower)) return true
  if (/\bpkill\s+(-\w+\s+)*node\b/i.test(lower)) return true
  if (/\btaskkill\b/i.test(lower) && /\bnode(\.exe)?\b/i.test(lower)) return true
  return false
}

/**
 * 环境变量清洗：从 env 对象中移除敏感变量。
 */
export function sanitizeEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const result = { ...env }
  for (const key of BLOCKED_ENV_VARS) {
    delete result[key]
  }
  return result
}

/**
 * 默认权限策略适配器。
 * - safe 模式：只允许 safe 级工具
 * - ask 模式：safe 自动通过，restricted 和 dangerous 需确认（通过 hook 通知上层）
 * - execute 模式：safe 和 restricted 自动通过，dangerous 需确认
 */
export function createDefaultPermissionAdapter(mode: 'safe' | 'ask' | 'execute' = 'ask'): PermissionAdapter {
  return {
    name: 'preset-default:permission',
    async check(request): Promise<PermissionDecision> {
      if (request.kind === 'extension') {
        // 扩展权限默认允许（可被上层策略覆盖）
        return { allow: true, reason: 'preset-default 允许扩展加载' }
      }

      if (request.kind !== 'tool') {
        return { allow: true }
      }

      const safetyLevel = request.payload as ToolSafetyLevel | undefined

      if (mode === 'safe') {
        if (safetyLevel === 'restricted' || safetyLevel === 'dangerous') {
          return { allow: false, reason: `safe 模式下不允许 ${safetyLevel} 级工具` }
        }
        return { allow: true }
      }

      if (mode === 'ask') {
        if (safetyLevel === 'safe') {
          return { allow: true }
        }
        // restricted 和 dangerous 需确认——返回 deny，由上层 hook 处理确认流程
        return { allow: false, reason: '需要用户确认' }
      }

      // execute 模式
      if (safetyLevel === 'dangerous') {
        return { allow: false, reason: '需要用户确认' }
      }
      return { allow: true }
    },
  }
}

// ============================================================
// 预设扩展
// ============================================================

export function createDefaultPresetExtensions(): Extension[] {
  const builtinDefaults: Extension = {
    name: 'preset-default:builtin-defaults',
    setup(ctx) {
      const placeholderModel: ModelAdapter = {
        name: 'placeholder-model',
        async request() {
          throw {
            code: ERROR_CODES.MODEL_ADAPTER_NOT_READY,
            message: '当前没有加载真实模型适配器，请先注册一个 ModelAdapter preset。',
          } satisfies RuntimeError
        },
        async *stream() {
          throw {
            code: ERROR_CODES.MODEL_ADAPTER_NOT_READY,
            message: '当前没有加载真实模型适配器，请先注册一个 ModelAdapter preset。',
          } satisfies RuntimeError
        },
      }

      ctx.registry.models.register(placeholderModel.name, placeholderModel)

      // 注册默认权限适配器
      ctx.registry.permissions.register(
        'preset-default:permission',
        createDefaultPermissionAdapter('ask'),
      )

      // 注册默认 i18n 适配器（自动检测系统语言）
      ctx.registry.i18n.register('preset-default:i18n', createDefaultI18nAdapter())

      // 这些 hook 作为默认行为占位存在，后续可逐步替换为真正的默认策略。
      ctx.hooks.on(HOOKS.CONTEXT_BUILD, async () => ({ continue: true }))
      ctx.hooks.on(HOOKS.PERSIST_BEFORE, async () => ({ continue: true }))
      ctx.hooks.on(HOOKS.PERSIST_AFTER, async () => ({ continue: true }))
    },
  }

  return [builtinDefaults]
}
