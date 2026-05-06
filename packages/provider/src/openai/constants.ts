/** OpenAI provider 内部常量 */

export const OPENAI_ROLES = {
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
  DEFAULT_BASE_URL: 'https://api.openai.com/v1',
  CHAT_PATH: '/chat/completions',
  METHOD: 'POST',
  AUTH_SCHEME: 'Bearer',
  CONTENT_TYPE: 'application/json',
  TOOL_TYPE: 'function',
} as const

export const ERROR_CODES = {
  API_ERROR: 'OPENAI_API_ERROR',
  NO_RESPONSE_BODY: 'NO_RESPONSE_BODY',
} as const

export const DEFAULT_ADAPTER_NAME = 'openai'

export const DEFAULT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] as const

export const EXTENSION_NAME = 'provider:openai'
