/**
 * 前端消息类型。
 *
 * 协议层类型（ServerMsg, ClientMsg 等）从 @crai/transport-ws 导入，
 * 避免与 packages/transport-ws/src/protocol.ts 平行重复。
 * 此文件只保留前端特有的视图层适配类型。
 */

// ── 导入协议类型 ────────────────────────────────
export type {
  // 消息联合
  ClientMessage as ClientMsg,
  ServerMessage as ServerMsg,

  // Server → Client
  EventMessage as EventMsg,
  RequestInputMessage as RequestInputMsg,
  SessionIdMessage as SessionIdMsg,
  ErrorMessage as ErrorMsg,
  ConfigDataMessage as ConfigDataMsg,
  ConfigModelsDataMessage as ConfigModelsDataMsg,
  ConfigTestResultMessage as ConfigTestResultMsg,
  WorkspaceListDataMessage as WorkspaceListDataMsg,
  WorkspaceSwitchedMessage as WorkspaceSwitchedMsg,
  WorkspaceConfigDataMessage as WorkspaceConfigDataMsg,
  SessionListDataMessage as SessionListDataMsg,
  SessionDataMessage as SessionDataMsg,
  DirBrowseDataMessage as DirBrowseDataMsg,
  SessionTitleMessage as SessionTitleMsg,

  // Client → Server
  PromptMessage as PromptMsg,
  SessionGenerateTitleMessage as SessionGenerateTitleMsg,
  SessionNewMessage as SessionNewMsg,
  SessionDeleteMessage as SessionDeleteMsg,
  SessionListMessage as SessionListMsg,
  ResolveInputMessage as ResolveInputMsg,
  SessionLoadMessage as SessionLoadMsg,
  SessionUpdateMessage as SessionUpdateMsg,
  DirBrowseMessage as DirBrowseMsg,
  ConfigGetMessage as ConfigGetMsg,
  ConfigSetMessage as ConfigSetMsg,
  ConfigSetProviderMessage as ConfigSetProviderMsg,
  ConfigRemoveProviderMessage as ConfigRemoveProviderMsg,
  ConfigFetchModelsMessage as ConfigFetchModelsMsg,
  WorkspaceListMessage as WorkspaceListMsg,
  WorkspaceSwitchMessage as WorkspaceSwitchMsg,
  WorkspaceConfigGetMessage as WorkspaceConfigGetMsg,
  WorkspaceConfigSetMessage as WorkspaceConfigSetMsg,
  ConfigTestMessage as ConfigTestMsg,

  // 数据模型
} from '@crai/transport-ws/protocol'

// ── 从 core 导入共享类型 ──────────────────────────
export type { ActivityItem, TodoItem } from '@crai/core'

// ── 前端特有类型 ──────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  /** 活动列表（与文本分离渲染）。 */
  activities?: ActivityItem[]
}
