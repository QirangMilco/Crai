/**
 * @crai/transport-ws — WebSocket 传输层协议定义。
 *
 * 所有消息均为 UTF-8 JSON 文本帧。
 */

import type { GlobalConfig, ProviderConfig, WorkspaceConfig } from '@crai/core'

// ── Client → Server ───────────────────────────────

/** 客户端向 runtime 发送 prompt。可指定模型/provider 以覆盖默认。 */
export interface PromptMessage {
  type: 'prompt'
  sessionId?: string
  text: string
  model?: string
  provider?: string
  /** 思考深度级别，用于新 session 初始化或在 prompt 时覆盖。 */
  thinkingLevel?: string
  /** 会话模式，用于新 session 初始化或在 prompt 时覆盖。 */
  mode?: string
  /** 强制创建新会话，即使 currentSessionId 有值也不复用。 */
  forceNewSession?: boolean
}

/** 客户端请求创建新 session。 */
export interface SessionNewMessage {
  type: 'session:new'
  system?: string
}

/** 客户端回复 runtime 的提问（权限确认 / 工具提问）。 */
export interface ResolveInputMessage {
  type: 'resolve:input'
  id: string
  value: string
}

/** 客户端请求列出当前工作区的所有 session。 */
export interface SessionListMessage {
  type: 'session:list'
}

export interface SessionDeleteMessage {
  type: 'session:delete'
  sessionId: string
}

/** 客户端请求获取全局配置。 */
export interface ConfigGetMessage {
  type: 'config:get'
}

/** 客户端更新全局配置（覆盖整个 config 对象）。 */
export interface ConfigSetMessage {
  type: 'config:set'
  config: GlobalConfig
}

/** 客户端添加/更新 provider。 */
export interface ConfigSetProviderMessage {
  type: 'config:set:provider'
  name: string
  config: ProviderConfig
}

/** 客户端删除 provider。 */
export interface ConfigRemoveProviderMessage {
  type: 'config:remove:provider'
  name: string
}

/** 客户端请求工作区列表。 */
export interface WorkspaceListMessage {
  type: 'workspace:list'
}

/** 客户端切换工作区。 */
export interface WorkspaceSwitchMessage {
  type: 'workspace:switch'
  /** 工作区根目录路径。 */
  rootDir: string
}

/** 客户端测试 provider 连接（API key + base URL 是否有效）。 */
export interface ConfigTestMessage {
  type: 'config:test'
  providerName: string
}

/** 连接测试响应。 */
export interface ConfigTestResultMessage {
  type: 'config:test:result'
  ok: boolean
  error?: string
}

/** 客户端请求获取指定 provider 的可用模型列表。 */
export interface ConfigFetchModelsMessage {
  type: 'config:fetch:models'
  providerName: string
}

/** 客户端获取当前工作区配置。 */
export interface WorkspaceConfigGetMessage {
  type: 'workspace:config:get'
}

/** 客户端更新当前工作区配置。 */
export interface WorkspaceConfigSetMessage {
  type: 'workspace:config:set'
  config: WorkspaceConfig
}

/** 客户端请求加载指定 session 的历史消息。 */
export interface SessionLoadMessage {
  type: 'session:load'
  sessionId: string
}

/** 客户端请求更新 session 元数据（如标题、模式、思考深度）。 */
export interface SessionUpdateMessage {
  type: 'session:update'
  sessionId: string
  title?: string
  mode?: string
  thinkingLevel?: string
  pinned?: boolean
  archived?: boolean
}

/** 客户端请求浏览指定路径的目录结构。 */
export interface DirBrowseMessage {
  type: 'dir:browse'
  /** 浏览的路径。为空时返回平台根目录列表。 */
  path?: string
  /** 是否同时返回文件列表（默认 false，仅返回目录）。 */
  showFiles?: boolean
}

/** 客户端请求服务端用工具模型为 session 生成标题。 */
export interface SessionGenerateTitleMessage {
  type: 'session:generate-title'
  sessionId: string
}

/** 客户端请求中止当前正在处理的 turn。 */
export interface SessionCancelTurnMessage {
  type: 'session:cancel-turn'
}

/** 客户端请求获取已知模型信息和第一方 provider 列表。 */
export interface ConfigKnownModelsMessage {
  type: 'config:known-models'
}

/** 客户端请求获取访问密钥列表。 */
export interface ConfigAuthListMessage {
  type: 'config:auth:list'
}

/** 客户端请求生成新的访问密钥。 */
export interface ConfigAuthGenerateMessage {
  type: 'config:auth:generate'
  description: string
}

/** 客户端请求吊销一个访问密钥。 */
export interface ConfigAuthRevokeMessage {
  type: 'config:auth:revoke'
  id: string
}

export type ClientMessage =
  | PromptMessage
  | SessionNewMessage
  | SessionUpdateMessage
  | SessionDeleteMessage
  | ResolveInputMessage
  | SessionLoadMessage
  | SessionGenerateTitleMessage
  | DirBrowseMessage
  | ConfigGetMessage
  | ConfigSetMessage
  | ConfigSetProviderMessage
  | ConfigRemoveProviderMessage
  | ConfigFetchModelsMessage
  | ConfigTestMessage
  | ConfigKnownModelsMessage
  | WorkspaceListMessage
  | WorkspaceSwitchMessage
  | WorkspaceConfigGetMessage
  | WorkspaceConfigSetMessage
  | SessionListMessage
  | SessionCancelTurnMessage
  | ConfigAuthListMessage
  | ConfigAuthGenerateMessage
  | ConfigAuthRevokeMessage
  | CheckpointListMessage
  | CheckpointRollbackMessage
  | CheckpointRollbackToIndexMessage
  | CheckpointForkMessage
  | CheckpointRollbackPointsMessage

// ── Server → Client ───────────────────────────────

export interface EventMessage {
  type: 'event'
  event: string
  payload: unknown
}

export interface RequestInputMessage {
  type: 'request:input'
  id: string
  question: string
  options?: string[]
  /** 工具确认等场景携带的额外上下文（工具名、参数、安全级别等）。 */
  meta?: Record<string, unknown>
}

export interface SessionIdMessage {
  type: 'session:id'
  id: string
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

/** 全局配置响应。 */
export interface ConfigDataMessage {
  type: 'config:data'
  config: GlobalConfig
}

/** 模型列表响应。 */
export interface ConfigModelsDataMessage {
  type: 'config:models:data'
  providerName: string
  models: string[]
  error?: string
}

/** 工作区列表响应。 */
export interface WorkspaceListDataMessage {
  type: 'workspace:list:data'
  /** 当前工作区（路径或 null）。 */
  current: string | null
  /** 所有可用工作区列表。 */
  workspaces: Array<{ rootDir: string; config: WorkspaceConfig }>
}

/** 工作区切换完成通知。 */
export interface WorkspaceSwitchedMessage {
  type: 'workspace:switched'
  rootDir: string
  /** 此工作区使用的模型信息。 */
  model: string
  provider: string
}

/** 当前工作区配置响应。 */
export interface WorkspaceConfigDataMessage {
  type: 'workspace:config:data'
  config: WorkspaceConfig
}

/** session 列表响应。 */
export interface SessionListDataMessage {
  type: 'session:list:data'
  sessions: Array<{ id: string; title?: string; createdAt: number; updatedAt: number; pinned?: boolean; archived?: boolean }>
}

/** session 历史消息响应。服务端返回时按需附带 blocks。 */
export interface SessionDataMessage {
  type: 'session:data'
  sessionId: string
  messages: Array<{ id: string; role: string; text: string; createdAt: number; blocks?: any[]; metadata?: Record<string, unknown> }>
  /** session 元数据，含 thinkingLevel、mode 等。 */
  metadata?: Record<string, unknown>
  /** 会话 TODO 列表。 */
  todos?: Array<{ id: string; content: string; activeForm?: string; status: 'pending' | 'in_progress' | 'completed' }>
  /** 本会话累计的 token 用量。 */
  usageAccumulated?: { inputTokens: number; outputTokens: number; cachedInputTokens: number }
  lastRoundUsage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number }
  /** 当前上下文窗口的 token 数（由服务端在每次模型调用后计算并持久化，刷新后可恢复）。 */
  contextTokenCount?: number
}

export type ServerMessage =
  | EventMessage
  | RequestInputMessage
  | SessionIdMessage
  | ErrorMessage
  | ConfigDataMessage
  | ConfigModelsDataMessage
  | WorkspaceListDataMessage
  | WorkspaceSwitchedMessage
  | WorkspaceConfigDataMessage
  | SessionListDataMessage
  | SessionDataMessage
  | DirBrowseDataMessage
  | SessionTitleMessage
  | ConfigKnownModelsDataMessage
  | ConfigTestResultMessage
  | ConfigAuthListDataMessage
  | ConfigAuthGeneratedMessage
  | ConfigAuthRevokedMessage
  | CheckpointListDataMessage
  | CheckpointRollbackDoneMessage
  | CheckpointForkDoneMessage
  | CheckpointRollbackPointsDataMessage

/** 目录浏览响应。 */
export interface DirBrowseDataMessage {
  type: 'dir:browse:data'
  /** 当前浏览的目录路径。 */
  path: string
  /** 当前目录下的子目录名列表。 */
  dirs: string[]
  /** 文件列表（仅当请求中 showFiles=true 时返回）。 */
  files?: Array<{
    name: string
    path: string
    size: number
    mtime: number
    isDirectory: boolean
  }>
  /** 父目录路径。在根目录时为 undefined。 */
  parent?: string
  /** 错误信息。 */
  error?: string
}

/** session 标题生成响应。 */
export interface SessionTitleMessage {
  type: 'session:title'
  sessionId: string
  title: string
}

/** 已知模型与第一方 provider 信息响应。 */
export interface ConfigKnownModelsDataMessage {
  type: 'config:known-models:data'
  /** 第一方 provider 列表。 */
  firstParty: Array<{ name: string; label: string; defaultBaseURL: string }>
  /** 已知模型窗口数据。provider → model → { contextWindow, maxOutput? }。 */
  knownModels: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number; supportedThinkingLevels?: string[] }>>
  /** Provider 声明的思考深度列表。provider → string[]。 */
  thinkingLevels?: Record<string, string[]>
  /** 各 provider 的默认思考深度。provider → level。 */
  defaultThinkingLevels?: Record<string, string>
}

/** 访问密钥列表响应。 */
export interface ConfigAuthListDataMessage {
  type: 'config:auth:list:data'
  keys: Array<{ id: string; description: string; createdAt: string; lastUsedAt: string | null; status: string }>
}

/** 访问密钥生成响应。 */
export interface ConfigAuthGeneratedMessage {
  type: 'config:auth:generated'
  rawToken: string
  info: { id: string; description: string; createdAt: string; lastUsedAt: string | null; status: string }
}

/** 访问密钥吊销响应。 */
export interface ConfigAuthRevokedMessage {
  type: 'config:auth:revoked'
  id: string
}

// ── 检查点消息 ──

export interface CheckpointListMessage {
  type: 'checkpoint:list'
  sessionId: string
}

export interface CheckpointListDataMessage {
  type: 'checkpoint:list:data'
  sessionId: string
  checkpoints: Array<{ turnId: string; messageCount: number; timestamp: number; fileCount: number }>
}

export interface CheckpointRollbackMessage {
  type: 'checkpoint:rollback'
  sessionId: string
  turnId: string
}

export interface CheckpointRollbackToIndexMessage {
  type: 'checkpoint:rollback:to-index'
  sessionId: string
  messageIndex: number
}

export interface CheckpointRollbackDoneMessage {
  type: 'checkpoint:rollback:done'
  sessionId: string
  turnId: string
  messageCount: number | null
  filesRestored?: number
}

export interface CheckpointForkMessage {
  type: 'checkpoint:fork'
  sessionId: string
  turnId: string
  newSessionId: string
}

export interface CheckpointForkDoneMessage {
  type: 'checkpoint:fork:done'
  sessionId: string
  turnId: string
  newSessionId: string
}

export interface CheckpointRollbackPointsMessage {
  type: 'checkpoint:rollback:points'
  sessionId: string
}

export interface CheckpointRollbackPointsDataMessage {
  type: 'checkpoint:rollback:points:data'
  sessionId: string
  points: Array<{ messageIndex: number; turnId: string; fileCount: number; timestamp: number }>
}
