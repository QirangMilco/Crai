/**
 * @crai/transport-ws — WebSocket 传输层协议定义。
 *
 * 所有消息均为 UTF-8 JSON 文本帧。
 */

import type { GlobalConfig, ProviderConfig, WorkspaceConfig } from '@crai/core'

// ── Client → Server ───────────────────────────────

/** 客户端向 runtime 发送 prompt。 */
export interface PromptMessage {
  type: 'prompt'
  sessionId?: string
  text: string
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

export type ClientMessage =
  | PromptMessage
  | SessionNewMessage
  | ResolveInputMessage
  | ConfigGetMessage
  | ConfigSetMessage
  | ConfigSetProviderMessage
  | ConfigRemoveProviderMessage
  | ConfigFetchModelsMessage
  | WorkspaceListMessage
  | WorkspaceSwitchMessage
  | WorkspaceConfigGetMessage
  | WorkspaceConfigSetMessage
  | SessionListMessage

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
  sessions: Array<{ id: string; title?: string; createdAt: number; updatedAt: number }>
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
