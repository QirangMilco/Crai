/** 与 transport-ws 通信的消息类型。 */

// ── Server → Client ──

export interface EventMsg {
  type: 'event'
  event: string
  payload: unknown
}

export interface RequestInputMsg {
  type: 'request:input'
  id: string
  question: string
  options?: string[]
}

export interface SessionIdMsg {
  type: 'session:id'
  id: string
}

export interface ErrorMsg {
  type: 'error'
  message: string
}

export type ServerMsg = EventMsg | RequestInputMsg | SessionIdMsg | ErrorMsg | ConfigDataMsg | ConfigModelsDataMsg | WorkspaceListDataMsg | WorkspaceSwitchedMsg | WorkspaceConfigDataMsg | SessionListDataMsg | SessionDataMsg | DirBrowseDataMsg | SessionTitleMsg

// ── 配置/工作区 响应 ──

export interface ConfigDataMsg {
  type: 'config:data'
  config: {
    providers: Record<string, { apiKey: string; baseURL?: string; models?: string[] }>
    defaultProvider?: string
    defaultModel?: string
    recentWorkspaces: string[]
    /** 服务端变体配置中的调试 scope 列表，自动同步到前端。 */
    debugScopes?: string[]
  }
}

export interface ConfigModelsDataMsg {
  type: 'config:models:data'
  providerName: string
  models: string[]
  error?: string
}

export interface WorkspaceListDataMsg {
  type: 'workspace:list:data'
  current: string | null
  workspaces: Array<{ rootDir: string; config: { provider?: string; model?: string } }>
}

export interface WorkspaceSwitchedMsg {
  type: 'workspace:switched'
  rootDir: string
  model: string
  provider: string
}

export interface WorkspaceConfigDataMsg {
  type: 'workspace:config:data'
  config: { provider?: string; model?: string; security?: { mode?: string } }
}

export interface SessionListDataMsg {
  type: 'session:list:data'
  sessions: Array<{ id: string; title?: string; createdAt: number; updatedAt: number }>
}

export interface SessionDataMsg {
  type: 'session:data'
  sessionId: string
  messages: Array<{ id: string; role: string; text: string; createdAt: number }>
}

// ── Client → Server ──

export interface PromptMsg {
  type: 'prompt'
  sessionId?: string
  text: string
  model?: string
  provider?: string
}

export interface SessionGenerateTitleMsg {
  type: 'session:generate-title'
  sessionId: string
}

export interface SessionTitleMsg {
  type: 'session:title'
  sessionId: string
  title: string
}

export interface SessionNewMsg {
  type: 'session:new'
  system?: string
}

export interface SessionListMsg {
  type: 'session:list'
}

export interface ResolveInputMsg {
  type: 'resolve:input'
  id: string
  value: string
}

export interface SessionLoadMsg {
  type: 'session:load'
  sessionId: string
}

export interface SessionUpdateMsg {
  type: 'session:update'
  sessionId: string
  title?: string
}

export interface DirBrowseMsg {
  type: 'dir:browse'
  path?: string
}

export interface DirBrowseDataMsg {
  type: 'dir:browse:data'
  path: string
  dirs: string[]
  parent?: string
  error?: string
}

export type ClientMsg = PromptMsg | SessionNewMsg | SessionLoadMsg | SessionUpdateMsg | SessionGenerateTitleMsg | DirBrowseMsg | ResolveInputMsg | SessionListMsg |
  ConfigGetMsg | ConfigSetMsg | ConfigSetProviderMsg | ConfigRemoveProviderMsg | ConfigFetchModelsMsg |
  WorkspaceListMsg | WorkspaceSwitchMsg | WorkspaceConfigGetMsg | WorkspaceConfigSetMsg

// ── 配置/工作区 消息 ──

export interface ConfigGetMsg { type: 'config:get' }
export interface ConfigSetMsg { type: 'config:set'; config: any }
export interface ConfigSetProviderMsg { type: 'config:set:provider'; name: string; config: { apiKey: string; baseURL?: string; models?: string[]; modelsPath?: string } }
export interface ConfigRemoveProviderMsg { type: 'config:remove:provider'; name: string }
export interface ConfigFetchModelsMsg { type: 'config:fetch:models'; providerName: string }
export interface WorkspaceListMsg { type: 'workspace:list' }
export interface WorkspaceSwitchMsg { type: 'workspace:switch'; rootDir: string }
export interface WorkspaceConfigGetMsg { type: 'workspace:config:get' }
export interface WorkspaceConfigSetMsg { type: 'workspace:config:set'; config: { provider?: string; model?: string; security?: { mode?: string } } }

// ── 内容块类型（流式渲染用） ──

export type ContentBlock =
  | { type: 'thinking'; content: string; sealed: boolean }
  | { type: 'tool_group'; tools: Array<{ toolCallId: string; name: string; args: string; status: 'running' | 'success' | 'error' }>; collapsed: boolean }
  | { type: 'text'; content: string }

// ── 内部消息模型 ──

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  /** 流式内容块：思考、工具调用等，按展示顺序渲染。 */
  blocks?: ContentBlock[]
}
