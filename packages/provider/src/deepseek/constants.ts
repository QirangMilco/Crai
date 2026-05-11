/** DeepSeek provider 内部常量 */

export const DEEPSEEK_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
} as const

export const PART_TYPES = {
  TEXT: 'text',
  TOOL_CALL: 'tool-call',
} as const

export const API = {
  DEFAULT_BASE_URL: 'https://api.deepseek.com',
  CHAT_PATH: '/chat/completions',
  METHOD: 'POST',
  AUTH_SCHEME: 'Bearer',
  CONTENT_TYPE: 'application/json',
  TOOL_TYPE: 'function',
} as const

export const ERROR_CODES = {
  API_ERROR: 'DEEPSEEK_API_ERROR',
} as const

export const DEFAULT_ADAPTER_NAME = 'deepseek'

export const DEFAULT_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const

export const EXTENSION_NAME = 'provider:deepseek'

/**
 * Thinking mode 要求 output token 预算 ≥ 32K。
 * 低于此值时自动关思考。
 */
export const DEEPSEEK_HIGH_THINKING_BUDGET = 32768
export const DEEPSEEK_HIGH_SAFE_MAX_TOKENS = 65536
/** reasoning_effort='max' 时用更高的预算。 */
export const DEEPSEEK_MAX_EFFORT_MAX_TOKENS = 131072
