/**
 * Crai core 基础类型。
 * 只放稳定、跨包共享的契约，不放产品层语义。
 */

export type ID = string
export type Timestamp = number

/** JSON 安全值，用于 metadata、配置片段和跨边界数据。 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** 扩展元数据。不要用 metadata 代替应显式建模的核心字段。 */
export type Metadata = Record<string, JsonValue | undefined>

/** Session 是 runtime 的最小隔离容器，承载一次连续任务或对话。 */
export interface Session {
  id: ID
  createdAt: Timestamp
  updatedAt: Timestamp
  title?: string
  metadata?: Metadata
}

/** 保持角色集合最小，避免把 UI 状态引入 core。 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'custom'

export interface BaseMessage {
  id: ID
  role: MessageRole
  createdAt: Timestamp
  metadata?: Metadata
}

export interface TextPart {
  type: 'text'
  text: string
}

export interface ImagePart {
  type: 'image'
  mimeType: string
  /** Base64 数据或资源 URI；具体解释由适配器/上层决定。 */
  data: string
}

export interface ToolCallPart {
  type: 'tool-call'
  toolCallId: ID
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResultPart {
  type: 'tool-result'
  toolCallId: ID
  name: string
  isError?: boolean
  content: Array<TextPart | ImagePart>
}

export type MessagePart = TextPart | ImagePart | ToolCallPart | ToolResultPart

/** Message 是会话中的持久化交互单元，使用 parts 支持多模态与工具交互。 */
export interface Message extends BaseMessage {
  parts: MessagePart[]
}

/** Artifact 是生成物、附件或持久化资产的统一引用。 */
export interface Artifact {
  id: ID
  sessionId: ID
  kind: string
  uri?: string
  content?: string
  createdAt: Timestamp
  metadata?: Metadata
}
