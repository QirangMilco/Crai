/**
 * Crai 事件与模型/工具契约。
 *
 * 本文件定义运行时核心事件（EventMap）、模型交互（ModelRequest/Response/StreamEvent）、
 * 工具交互（ToolDefinition/ExecutionResult）以及 RuntimeInput 等跨包共享的数据结构。
 * 与 core-api-spec.md §4-§7 对齐。
 */
import type { Artifact, ID, Metadata, Message, Session, TextPart, ImagePart, ToolCallPart } from './types'

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
}

/** 运行时输入的联合类型，覆盖文本、完整消息和命令三种入口。 */
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

/** 模型流式输出事件，stream() 方法按此协议逐个产出。 */
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

/** 工具声明面向模型暴露；执行逻辑由 ToolHandler 承担。 */
export interface ToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  metadata?: Metadata
}

export interface ToolExecutionRequest {
  session: Session
  toolCall: ToolCallPart
  messages: Message[]
}

/** 工具执行结果，terminate=true 时通知 runtime 终止当前 turn。 */
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
