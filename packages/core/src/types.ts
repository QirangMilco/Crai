/**
 * Crai core 基础类型。
 * 只放稳定、跨包共享的契约，不放产品层语义。
 *
 * 类型定义规范：
 * - 若类型值在运行时被引用（比较、赋值、switch-case），
 *   则值定义在 constants.ts，类型从中派生，此处重导出。
 * - 若类型值仅在类型层面使用（判别式标签、第三方接口映射），
 *   每个值在 union 中只出现一次，允许保持裸字面量。
 */
import type {
  ToolSafetyLevel,
  PermissionMode,
  PermissionKind,
  MemoryScope,
  TrustLevel,
  ObservationType,
  MessageRole,
} from './constants'

export type { ToolSafetyLevel, PermissionMode, PermissionKind, MemoryScope, TrustLevel, ObservationType, MessageRole }

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

// ============================================================
// 安全类型 (Safety types)
// ============================================================

/** 文件系统沙箱作用域。 */
export interface SandboxScope {
  rootDir: string
  allowWrite?: string[]
  denyWrite?: string[]
  denyRead?: string[]
  maxReadBytes?: number
}

/** 权限检查请求。 */
export interface PermissionCheckRequest {
  kind: PermissionKind
  action: string
  payload?: unknown
  session?: Session
}

/** 权限检查决策。 */
export interface PermissionDecision {
  allow: boolean
  reason?: string
  metadata?: Metadata
}

// ============================================================

/** Session 是 runtime 的最小隔离容器，承载一次连续任务或对话。 */
export interface Session {
  id: ID
  createdAt: Timestamp
  updatedAt: Timestamp
  title?: string
  metadata?: Metadata
}

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

export type MessagePart = TextPart | ImagePart | ToolCallPart

/**
 * Message 是会话中的持久化交互单元，使用 parts 支持多模态与工具交互。
 *
 * tool 角色的消息：toolCallId 标识对应的 tool_call，parts 直接存放结果内容（TextPart | ImagePart），
 * 每个工具结果是一条独立消息。参见 D-032。
 */
export interface Message extends BaseMessage {
  parts: MessagePart[]
  /** 对于 tool 角色消息：对应的 tool_call_id。 */
  toolCallId?: ID
  /** 对于 tool 角色消息：产生该结果的工具名。 */
  toolName?: string
  /** 对于 tool 角色消息：是否执行出错。 */
  isError?: boolean
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

/** Observation 是会话过程中提取的细粒度发现或决策。类型由 OBSERVATION_TYPES 常量派生。 */
export interface Observation {
  id: ID
  sessionId: ID
  type: ObservationType
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

/**
 * 生成带时间戳和随机后缀的唯一 ID。
 * 格式：{prefix}_{timestamp}_{random7}
 * 例如：session_1747000000000_a1b2c3d
 * 时间戳保证可排序，7 位随机后缀保证同一毫秒内不碰撞。
 * 参考 snow-cli 的 ID 生成模式。
 */
export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ════════════════════════════════════════════════════════
// 配置类型
// ════════════════════════════════════════════════════════

/** 变体配置：由应用定义（dev/prod 目录隔离、端口等）。 */
export interface AppVariant {
  configDirName: string
  workspaceDataDirName: string
  server: {
    defaultPort: number
  }
  debug: {
    trace: boolean
    verboseTools: boolean
  }
}

export interface ProviderConfig {
  apiKey: string
  baseURL?: string
  models?: string[]
}

export interface GlobalConfig {
  providers: Record<string, ProviderConfig>
  defaultProvider?: string
  defaultModel?: string
  recentWorkspaces: string[]
}

export interface WorkspaceSecurityConfig {
  mode?: 'safe' | 'ask' | 'execute'
}

export interface WorkspaceConfig {
  security?: WorkspaceSecurityConfig
}

/** 配置存储适配器：不同的格式（JSON、TOML、YAML）实现此接口。 */
export interface ConfigStore {
  load(): Promise<GlobalConfig>
  save(config: GlobalConfig): Promise<void>
  /** 可选：加载工作区配置。不实现时由调用方管理。 */
  loadWorkspace?(rootDir: string): Promise<WorkspaceConfig>
  /** 可选：保存工作区配置。 */
  saveWorkspace?(rootDir: string, config: WorkspaceConfig): Promise<void>
}
