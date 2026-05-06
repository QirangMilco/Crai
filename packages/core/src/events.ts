import type { Artifact, ContextBundle, ID, MemoryEntry, Metadata, Message, Observation, PermissionCheckRequest, PermissionDecision, Session, SessionSummary, TextPart, ImagePart, ToolCallPart, ToolSafetyLevel, SandboxScope } from './types'

/** 事件只表达“发生了什么”，不直接承担业务逻辑。 */
export interface CoreEvent<TType extends string = string, TPayload = unknown> {
  id: ID
  type: TType
  sessionId?: ID
  timestamp: number
  payload: TPayload
  metadata?: Metadata
}

/** Runtime 与扩展/UI/transport 之间的核心事件契约。 */
export interface EventMap {
  'runtime.started': { runtimeId: ID }
  'runtime.stopped': { runtimeId: ID }

  'session.created': { session: Session }
  'session.updated': { session: Session }

  'input.received': { session: Session; input: RuntimeInput }
  'message.appended': { session: Session; message: Message }

  'turn.started': { session: Session; turnId: ID }
  'turn.completed': { session: Session; turnId: ID }
  'turn.failed': { session: Session; turnId: ID; error: RuntimeError }

  'context.built': { session: Session; context: ModelContext }

  'model.requested': { session: Session; request: ModelRequest }
  'model.delta': { session: Session; turnId: ID; delta: string }
  'model.message': { session: Session; message: Message }
  'model.completed': { session: Session; response: ModelResponse }

  'tool.requested': { session: Session; toolCall: ToolCallPart }
  'tool.completed': { session: Session; result: ToolExecutionResult }
  'tool.failed': { session: Session; result: ToolExecutionResult }

  'artifact.created': { session: Session; artifact: Artifact }
  'artifact.updated': { session: Session; artifact: Artifact }

  'extension.loaded': { name: string }
  'extension.unloaded': { name: string }

  'session.memoryInjected': { session: Session; bundle: ContextBundle }
  'session.summaryGenerated': { session: Session; summary: SessionSummary }
  'memory.entriesStored': { session: Session; entries: MemoryEntry[] }
  'observations.extracted': { session: Session; observations: Observation[] }

  'tool.blocked': { session: Session; toolCall: ToolCallPart; reason: string }
  'permission.requested': { session: Session; request: PermissionCheckRequest }
  'permission.resolved': { session: Session; request: PermissionCheckRequest; decision: PermissionDecision }
}

export type RuntimeInput =
  | { type: 'text'; text: string; metadata?: Metadata }
  | { type: 'message'; message: Message }
  | { type: 'command'; name: string; args?: unknown }

/** 模型请求前的抽象上下文，具体 provider 格式由 ModelAdapter 转换。 */
export interface ModelContext {
  system?: string
  messages: Message[]
  tools?: ToolDefinition[]
  metadata?: Metadata
}

export interface ModelRequest {
  sessionId: ID
  turnId: ID
  model: string
  provider?: string
  context: ModelContext
  settings?: {
    temperature?: number
    maxTokens?: number
    thinkingLevel?: 'off' | 'low' | 'medium' | 'high'
  }
  metadata?: Metadata
}

export type ModelStreamEvent =
  | { type: 'text-start' }
  | { type: 'text-delta'; delta: string }
  | { type: 'text-end' }
  | { type: 'tool-call'; toolCall: ToolCallPart }
  | { type: 'message'; message: Message }
  | { type: 'done'; response: ModelResponse }
  | { type: 'error'; error: RuntimeError }

export interface ModelResponse {
  message: Message
  usage?: {
    inputTokens?: number
    outputTokens?: number
    cachedInputTokens?: number
    cost?: number
    currency?: string
  }
  stopReason?: string
  metadata?: Metadata
}

/** 工具声明面向模型暴露；执行逻辑由 ToolHandler 承担。每个工具必须声明 safetyLevel。 */
export interface ToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  safetyLevel: ToolSafetyLevel
  sandbox?: SandboxScope
  metadata?: Metadata
}

export interface ToolExecutionRequest {
  session: Session
  toolCall: ToolCallPart
  messages: Message[]
}

export interface ToolExecutionResult {
  toolCallId: ID
  name: string
  isError?: boolean
  content: Array<TextPart | ImagePart>
  metadata?: Metadata
  terminate?: boolean
}

/** 结构化错误，避免把恢复策略绑定到字符串解析。 */
export interface RuntimeError {
  code: string
  message: string
  cause?: unknown
  metadata?: Metadata
}
