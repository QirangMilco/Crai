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

/** 记忆作用域：决定记忆的生命周期和注入优先级。 */
export type MemoryScope = 'global' | 'project' | 'session'

/** 记忆溯源：记录每条记忆的来源信息。 */
export interface MemoryProvenance {
  sessionId: ID
  sourceKind: string
  sourceId: string
}

/** MemoryEntry 是长期记忆的最小单元，采用多视图索引模型。 */
export interface MemoryEntry {
  id: ID

  losslessRestatement: string
  embedding?: number[]

  keywords: string[]

  scope: MemoryScope
  projectId?: string
  timestamp?: string
  location?: string
  persons: string[]
  entities: string[]
  topic?: string

  importance: number
  createdAt: Timestamp
  validFrom?: Timestamp
  validTo?: Timestamp
  supersededBy?: ID
  provenance?: MemoryProvenance
}

/** SessionSummary 是会话结束时生成的摘要，用于快速恢复上下文。 */
export interface SessionSummary {
  id: ID
  sessionId: ID
  request?: string
  investigated?: string
  learned?: string
  completed?: string
  nextSteps?: string
  observationCount: number
  memoryEntriesStored: number
  createdAt: Timestamp
}

/** Observation 是会话过程中提取的细粒度发现或决策。 */
export interface Observation {
  id: ID
  sessionId: ID
  type: 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery' | 'change'
  title: string
  subtitle?: string
  narrative?: string
  facts?: Record<string, unknown>
  files?: string[]
  createdAt: Timestamp
}

/** ContextBundle 是 Session 启动时注入的上下文包，携带 Token 预算估算。 */
export interface ContextBundle {
  sessionSummaries: SessionSummary[]
  observations: Observation[]
  memoryEntries: MemoryEntry[]
  totalTokensEstimate: number
}
