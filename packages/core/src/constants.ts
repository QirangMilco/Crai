export const EVENTS = {
  RUNTIME_STARTED: 'runtime.started',
  RUNTIME_STOPPED: 'runtime.stopped',
  SESSION_CREATED: 'session.created',
  SESSION_UPDATED: 'session.updated',
  INPUT_RECEIVED: 'input.received',
  MESSAGE_APPENDED: 'message.appended',
  TURN_STARTED: 'turn.started',
  TURN_COMPLETED: 'turn.completed',
  TURN_FAILED: 'turn.failed',
  CONTEXT_BUILT: 'context.built',
  MODEL_REQUESTED: 'model.requested',
  MODEL_DELTA: 'model.delta',
  MODEL_MESSAGE: 'model.message',
  MODEL_COMPLETED: 'model.completed',
  TOOL_REQUESTED: 'tool.requested',
  TOOL_COMPLETED: 'tool.completed',
  TOOL_FAILED: 'tool.failed',
  ARTIFACT_CREATED: 'artifact.created',
  ARTIFACT_UPDATED: 'artifact.updated',
  EXTENSION_LOADED: 'extension.loaded',
  EXTENSION_UNLOADED: 'extension.unloaded',
  SESSION_MEMORY_INJECTED: 'session.memoryInjected',
  SESSION_SUMMARY_GENERATED: 'session.summaryGenerated',
  MEMORY_ENTRIES_STORED: 'memory.entriesStored',
  OBSERVATIONS_EXTRACTED: 'observations.extracted',
  TOOL_BLOCKED: 'tool.blocked',
  PERMISSION_REQUESTED: 'permission.requested',
  PERMISSION_RESOLVED: 'permission.resolved',
} as const

export const HOOKS = {
  SESSION_CREATE: 'session:create',
  INPUT_BEFORE: 'input:before',
  CONTEXT_BUILD: 'context:build',
  MODEL_REQUEST_BEFORE: 'model:request:before',
  MODEL_RESPONSE_AFTER: 'model:response:after',
  TOOL_BEFORE: 'tool:before',
  TOOL_SAFETY_CHECK: 'tool:safetyCheck',
  TOOL_AFTER: 'tool:after',
  TURN_BEFORE: 'turn:before',
  TURN_BEFORE_MODEL: 'turn:beforeModel',
  TURN_AFTER: 'turn:after',
  TURN_AFTER_TOOL_EXEC: 'turn:afterToolExec',
  PERSIST_BEFORE: 'persist:before',
  PERSIST_AFTER: 'persist:after',
  SESSION_BEFORE_START: 'session:beforeStart',
  SESSION_AFTER_STOP: 'session:afterStop',
  PERMISSION_CHECK: 'permission:check',
  ARTIFACT_SAVE: 'artifact:save',
} as const

export const ERROR_CODES = {
  MODEL_ADAPTER_NOT_READY: 'MODEL_ADAPTER_NOT_READY',
  MODEL_REQUEST_FAILED: 'MODEL_REQUEST_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  EXTENSION_LOAD_FAILED: 'EXTENSION_LOAD_FAILED',
  EXTENSION_UNLOAD_FAILED: 'EXTENSION_UNLOAD_FAILED',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CACHE_WRITE_FAILED: 'CACHE_WRITE_FAILED',
  CACHE_READ_FAILED: 'CACHE_READ_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export const TOOL_SAFETY_LEVELS = {
  SAFE: 'safe',
  RESTRICTED: 'restricted',
  DANGEROUS: 'dangerous',
} as const
/** 工具安全级别。从 TOOL_SAFETY_LEVELS 派生。 */
export type ToolSafetyLevel = typeof TOOL_SAFETY_LEVELS[keyof typeof TOOL_SAFETY_LEVELS]

export const PERMISSION_MODES = {
  SAFE: 'safe',
  ASK: 'ask',
  EXECUTE: 'execute',
} as const
/** 运行时权限模式。从 PERMISSION_MODES 派生。 */
export type PermissionMode = typeof PERMISSION_MODES[keyof typeof PERMISSION_MODES]

export const PERMISSION_KINDS = {
  TOOL: 'tool',
  TRANSPORT: 'transport',
  STORAGE: 'storage',
  EXTENSION: 'extension',
  CUSTOM: 'custom',
} as const
/** 权限检查请求类型。从 PERMISSION_KINDS 派生。 */
export type PermissionKind = typeof PERMISSION_KINDS[keyof typeof PERMISSION_KINDS]

export const MEMORY_SCOPES = {
  GLOBAL: 'global',
  PROJECT: 'project',
  SESSION: 'session',
} as const
/** 记忆作用域。从 MEMORY_SCOPES 派生。 */
export type MemoryScope = typeof MEMORY_SCOPES[keyof typeof MEMORY_SCOPES]

export const TRUST_LEVELS = {
  RESTRICTED: 'restricted',
  FULL_ACCESS: 'full-access',
} as const
/** 扩展信任级别。从 TRUST_LEVELS 派生。 */
export type TrustLevel = typeof TRUST_LEVELS[keyof typeof TRUST_LEVELS]

export const OBSERVATION_TYPES = {
  DECISION: 'decision',
  BUGFIX: 'bugfix',
  FEATURE: 'feature',
  REFACTOR: 'refactor',
  DISCOVERY: 'discovery',
  CHANGE: 'change',
} as const
/** Observation 提取类型。从 OBSERVATION_TYPES 派生。 */
export type ObservationType = typeof OBSERVATION_TYPES[keyof typeof OBSERVATION_TYPES]

export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  CUSTOM: 'custom',
} as const
/** 消息角色。从 MESSAGE_ROLES 派生。 */
export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES]

export const RUNTIME_INPUT_TYPES = {
  TEXT: 'text',
  MESSAGE: 'message',
  COMMAND: 'command',
} as const

export const MESSAGE_PART_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  TOOL_CALL: 'tool-call',
  TOOL_RESULT: 'tool-result',
} as const

/** ModelStreamEvent 判别式。所有 provider 实现流式响应时都应引用此常量。 */
/** 预留/占位模型名。runtime 在查找可用模型时跳过此名称，preset-default 注册占位模型时使用。 */
export const PLACEHOLDER_MODEL_NAME = 'placeholder-model'

export const STREAM_EVENT_TYPES = {
  TEXT_START: 'text-start',
  TEXT_DELTA: 'text-delta',
  TEXT_END: 'text-end',
  TOOL_CALL: 'tool-call',
  MESSAGE: 'message',
  DONE: 'done',
  ERROR: 'error',
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]
export type HookName = typeof HOOKS[keyof typeof HOOKS]
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
