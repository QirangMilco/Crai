import type { ActivityItem, Artifact, ContextBundle, ID, MemoryEntry, Metadata, Message, Observation, PermissionCheckRequest, PermissionDecision, Session, SessionSummary, TextPart, ImagePart, ToolCallPart, ToolSafetyLevel, SandboxScope } from './types'

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
  'compression:status': { session: Session; turnId: ID; status: { step: string; message?: string; tokensBefore?: number; tokensAfter?: number } }

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

  'thinking.delta': { session: Session; turnId: ID; delta: string }
  'thinking.done': { session: Session; turnId: ID }
  'tool.start': { session: Session; turnId: ID; toolCallId: ID; name: string }
  'tool.delta': { session: Session; turnId: ID; toolCallId: ID; delta: string }
  'tool.done': { session: Session; turnId: ID; toolCallId: ID; name: string; isError?: boolean; summary?: string }

  // ── Activity 事件（统一 thinking/tool 的状态机，参见 frontend-architecture.md） ──
  'activity.start': { session: Session; turnId: ID; activity: ActivityItem }
  'activity.delta': { session: Session; turnId: ID; activityId: ID; delta: string }
  'activity.done': { session: Session; turnId: ID; activity: ActivityItem }
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
  signal?: AbortSignal
  /**
   * 通用设置字段。所有 provider 都能理解的参数放这里。
   * provider 独有参数放 settings.providerSpecific，核心只透传不解释。
   */
  settings?: {
    temperature?: number
    maxTokens?: number
    /** 思考深度级别。off / auto / low / medium / high / xhigh。 */
    thinkingLevel?: string
    /**
     * Provider 私有参数。核心只透传，由具体的 ModelAdapter 自行解释。
     * 当一个参数被多个 provider 支持后，应提升为 settings 的一等字段。
     * 示例：
     *   { reasoning_effort: 'medium' }      // OpenAI o-series
     *   { thinking: { type: 'enabled', budget_tokens: 16000 } }  // Anthropic
     *   { grounding_config: { type: 'web' } } // Google
     */
    providerSpecific?: Record<string, unknown>
  }
  metadata?: Metadata
}

export type ModelStreamEvent =
  | { type: 'text-start' }
  | { type: 'text-delta'; delta: string }
  | { type: 'text-end' }
  | { type: 'thinking-delta'; delta: string }
  | { type: 'thinking-done' }
  | { type: 'tool-call'; toolCall: ToolCallPart }
  | { type: 'tool-call-delta'; toolCallId: string; name: string; argsDelta: string; index: number }
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
  /**
   * Provider 原始响应数据。核心不解释，由扩展或上层消费。
   * 当一个响应字段被多个 provider 支持后，应提升为一等字段。
   * 示例：
   *   { thinking: { content: [...], signature: '...' } }   // Anthropic
   *   { logprobs: [...] }                                  // OpenAI
   */
  raw?: Record<string, unknown>
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
  /** 中止信号。工具可在执行中检查此信号以支持用户中止。 */
  signal?: AbortSignal
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
