import type { EventMap, ModelRequest, ModelResponse, ModelStreamEvent, RuntimeInput, ToolDefinition, ToolExecutionRequest, ToolExecutionResult } from './events'
import type { Artifact, ID, MemoryEntry, MemoryScope, Metadata, Message, Observation, PermissionCheckRequest, PermissionDecision, PermissionMode, Session, SessionSummary, Timestamp, ToolCallPart, TrustLevel } from './types'
import type { I18nAdapter } from './i18n'

/** 统一可释放对象，便于卸载扩展时回收资源。 */
export interface Disposable {
  dispose(): void | Promise<void>
}

/** Hook 允许观察、继续、阻断、替换或局部修补当前值。 */
export type HookResult<T> =
  | void
  | { continue?: true }
  | { stop: true; reason?: string }
  | { replace: T }
  | { patch: Partial<T> }

export interface HookContext {
  runtime: RuntimeHandle
  signal?: AbortSignal
}

export type HookHandler<T> = (
  value: T,
  ctx: HookContext,
) => Promise<HookResult<T> | void> | HookResult<T> | void

// ============================================================
// Middleware 类型（借鉴 Eino，提供 before/after/wrap 三种拦截模式）
// ============================================================

/** Middleware 洋葱圈包裹核心流程。不调 next() 可跳过原始逻辑。 */
export interface Middleware<TInput, TOutput> {
  wrap(input: TInput, next: (input: TInput) => Promise<TOutput>): Promise<TOutput>
}

/** 模型请求中间件：包裹 ModelRequest → ModelResponse 的调用。 */
export type ModelMiddleware = Middleware<ModelRequest, ModelResponse>

// ============================================================
// EventBus SKIP 链错误类型
// ============================================================

export class BusNoHandlerError extends Error {
  constructor(eventType: string) {
    super(`Event "${eventType}" has no registered handler`)
    this.name = 'BusNoHandlerError'
  }
}

export class BusTimeoutError extends Error {
  constructor(eventType: string, timeoutMs: number) {
    super(`Event "${eventType}" request timed out after ${timeoutMs}ms`)
    this.name = 'BusTimeoutError'
  }
}

export interface HookMap {
  'session:create': { input?: Metadata; session: Session }
  'input:before': { session: Session; input: RuntimeInput }
  'context:build': { session: Session; messages: Message[] }
  'model:request:before': { session: Session; request: ModelRequest }
  'model:response:after': { session: Session; response: ModelResponse }
  'tool:before': { session: Session; toolCall: ToolCallPart }
  'tool:safetyCheck': { session: Session; toolCall: ToolCallPart; definition: ToolDefinition; mode: PermissionMode }
  'tool:after': { session: Session; result: ToolExecutionResult }
  'turn:after': { session: Session; turnId: ID; messages: Message[] }
  'persist:before': { session: Session }
  'persist:after': { session: Session }
  'permission:check': { session: Session; request: PermissionCheckRequest; decision: PermissionDecision }
  'artifact:save': { session: Session; artifact: Artifact }

  'session:beforeStart': { session: Session; input?: Metadata }
  'session:afterStop': { session: Session; messages: Message[] }
  'turn:beforeModel': { session: Session; request: ModelRequest }
  'turn:afterToolExec': { session: Session; turnId: string; messages: Message[] }
}

export interface HookBus<THooks extends Record<string, any>> {
  on<TKey extends keyof THooks & string>(
    key: TKey,
    handler: HookHandler<THooks[TKey]>,
    options?: { priority?: number },
  ): Disposable

  run<TKey extends keyof THooks & string>(
    key: TKey,
    value: THooks[TKey],
    ctx: HookContext,
  ): Promise<THooks[TKey]>
}

// ============================================================
// EventBus 含 SKIP 链（借鉴 OpenHanako 的设计）
// ============================================================

/** EventBus SKIP sentinel — handler 返回此值表示自己不处理，交给下一个 handler。 */
export const BUS_SKIP = Symbol('BusSKIP')

/** EventBus 含 SKIP 链的请求-响应模式。
 *
 * request: 按注册顺序调用 handler，返回第一个非 SKIP 的值。
 * handle: 注册请求处理器。仅 full-access Extension 可用。
 * hasHandler: 检查是否有已注册的 handler（软依赖检测）。
 */
export interface EventBus<TEvents extends Record<string, any>> {
  emit<TKey extends keyof TEvents & string>(
    type: TKey,
    payload: TEvents[TKey],
  ): Promise<void>

  on<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (event: { id: ID; type: TKey; sessionId?: ID; timestamp: number; payload: TEvents[TKey]; metadata?: Metadata }) => void | Promise<void>,
  ): Disposable

  /** 请求-响应模式：按注册顺序调用 handler，返回第一个非 SKIP 的值。 */
  request<TKey extends string>(
    type: TKey,
    payload: unknown,
  ): Promise<unknown>

  /** 注册请求处理器（仅 full-access Extension 可用）。 */
  handle<TKey extends string>(
    type: TKey,
    handler: (payload: unknown) => Promise<unknown>,
  ): Disposable

  /** 检查是否有注册的 handler。 */
  hasHandler(type: string): boolean
}

export interface ProgressEvent {
  /** 进度描述文本 */
  message: string
  /** 已完成比例（0-1），可选 */
  progress?: number
  /** 是否结束（工具执行完毕时设为 true） */
  done?: boolean
}

export interface AdapterContext {
  signal?: AbortSignal
  logger: Logger
  session: Session
  turnId?: ID
  /**
   * 工具在执行过程中发射进度事件。
   * GUI/Web 应用可以监听此类事件实现实时显示执行进度。
   * 默认空实现，不发射任何事件。
   */
  emitProgress?(event: ProgressEvent): void
  /**
   * 工具在执行中向用户提问。CLI 用 readline，GUI 用弹窗。
   * 如果没注入此回调，需要用户交互的工具应自行降级。
   * @param question 问题描述
   * @param options 可选选项列表（为空时自由输入）
   * @returns 用户输入/选择的字符串
   */
  requestUserInput?(question: string, options?: string[]): Promise<string>
}

/** 存储适配器：session/message/artifact 的持久化。 */
export interface StorageAdapter {
  name: string
  createSession(session: Session): Promise<void>
  /** 按 ID 读取单个 session。不存在时返回 undefined。 */
  getSession(sessionId: ID): Promise<Session | undefined>
  updateSession(session: Session): Promise<void>
  /** 追加写入一条消息。实现应保证追加语义（JSONL 等），避免全量覆盖写。 */
  appendMessage(sessionId: ID, message: Message): Promise<void>
  listMessages(sessionId: ID): Promise<Message[]>
  /** 列举所有已持久化的 session 摘要，不含完整消息列表。 */
  listSessions(): Promise<Array<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp; pinned?: boolean; archived?: boolean }>>
  deleteSession(sessionId: ID): Promise<void>
  truncateMessages?(sessionId: ID, count: number): Promise<void>
  saveArtifact(artifact: Artifact): Promise<void>
}

/** 缓存适配器：在模型请求前后介入，用于缓存命中/写入。 */
export interface CacheAdapter {
  name: string
  getCacheKey?(request: ModelRequest): string
  beforeModel?(request: ModelRequest): Promise<ModelRequest> | ModelRequest
  afterModel?(request: ModelRequest, response: ModelResponse): Promise<void> | void
}

export interface MemoryQueryInput {
  query: string
  scope?: MemoryScope
  projectId?: string
  topK?: number
  filter?: Record<string, unknown>
}

/** 记忆适配器：记忆条目存储与检索的抽象契约。 */
export interface MemoryAdapter {
  name: string
  store(entries: MemoryEntry[]): Promise<void>
  query(input: MemoryQueryInput): Promise<MemoryEntry[]>
  remove(entryId: ID): Promise<void>
  list(scope?: MemoryScope, projectId?: string): Promise<MemoryEntry[]>
  storeSummary(summary: SessionSummary): Promise<void>
  storeObservations(observations: Observation[]): Promise<void>
}

export interface PermissionAdapter {
  name: string
  check(request: PermissionCheckRequest): Promise<PermissionDecision>
}

export interface ToolHandler {
  definition: ToolDefinition
  execute(request: ToolExecutionRequest, ctx: AdapterContext): Promise<ToolExecutionResult> | ToolExecutionResult
}

/** 工具提供者：向 runtime 注册一组工具。 */
export interface ToolProvider {
  name: string
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  getTool(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}

/** 工具解析器：决定 multi-provider 场景下如何合并与查找工具。 */
export interface ToolResolver {
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  resolve(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}

/** 传输层上下文：连接 runtime 与外部输入输出通道（CLI、WebSocket、IM 等）。 */
export interface TransportContext {
  signal?: AbortSignal
  logger: Logger
  onInput: (input: RuntimeInput) => Promise<void>
  emitEvent: <TKey extends keyof EventMap & string>(type: TKey, payload: EventMap[TKey]) => Promise<void>
}

export interface TransportAdapter {
  name: string
  start(ctx: TransportContext): Promise<void>
  stop(): Promise<void>
  sendMessage?(sessionId: ID, message: Message): Promise<void>
  sendEvent?<TKey extends keyof EventMap & string>(type: TKey, payload: EventMap[TKey]): Promise<void>
}

/** 通用注册表：runtime 中所有 adapter/extensions 的注册与发现入口。 */
export interface Registry<T> {
  register(name: string, value: T): Disposable
  get(name: string): T | undefined
  list(): Array<{ name: string; value: T }>
}

export interface PromptPipeline {
  run(input: RuntimeInput, options?: PromptOptions): Promise<PromptResult>
}

/** 接管 Session 完整生命周期。注册后 createSession / stopSession 直接委托给 pipeline。 */
export interface SessionPipeline {
  createSession(input?: Metadata, sessionId?: ID): Promise<Session>
  stopSession(sessionId: string, messages?: Message[]): Promise<void>
  getSession(sessionId: string): Promise<Session | undefined>
}

export interface RuntimeRegistries {
  models: Registry<ModelAdapter>
  /** Provider/extension → 支持的思考深度列表。由 provider extension 在 setup() 中注册。 */
  thinkingLevels: Registry<string[]>
  tools: Registry<ToolProvider>
  storages: Registry<StorageAdapter>
  caches: Registry<CacheAdapter>
  memories: Registry<MemoryAdapter>
  permissions: Registry<PermissionAdapter>
  transports: Registry<TransportAdapter>
  promptPipelines: Registry<PromptPipeline>
  sessionPipelines: Registry<SessionPipeline>
  i18n: Registry<I18nAdapter>
}

export interface Command {
  name: string
  description?: string
  execute(args: unknown, ctx: RuntimeHandle): Promise<unknown> | unknown
}

export interface CommandRegistry {
  register(command: Command): Disposable
  get(name: string): Command | undefined
  list(): Command[]
}

/** 扩展在 setup 时可声明的权限需求。 */
export interface ExtensionPermissionDeclaration {
  kind: PermissionCheckRequest['kind']
  action: string
  payload?: unknown
}

/** Extension 元数据声明。 */
export interface ExtensionManifest {
  id: string
  name?: string
  version?: string
  description?: string
  /** 信任级别，默认 'restricted'。'full-access' 可获得 registry 写入、bus.handle、registerTool。 */
  trust?: TrustLevel
  /** 所需权限声明（加载时评估）。 */
  permissions?: ExtensionPermissionDeclaration[]
}

/** Extension 配置读写接口（由 runtime 注入，持久化对 Extension 透明）。 */
export interface ExtensionConfigStore {
  get<T = unknown>(key: string): T | undefined
  set<T = unknown>(key: string, value: T): Promise<void>
}

/** 扩展 setup 时接收的上下文：持有 runtime、hooks、events、registries 的访问权。 */
export interface ExtensionContext {
  runtime: RuntimeHandle
  hooks: HookBus<HookMap>
  events: EventBus<EventMap>
  /** events 的别名，与 OpenHanako 命名习惯对齐。 */
  bus: EventBus<EventMap>
  registry: RuntimeRegistries
  logger: Logger
  /** Extension 私有配置读写。 */
  config: ExtensionConfigStore
  /** Extension 私有数据目录。 */
  dataDir: string
  /** 注册可清理资源（卸载时逆序 dispose）。借鉴 OpenHanako register() 模式。 */
  register(disposable: Disposable): void
  /** 动态注册工具（仅 full-access）。返回清理函数。 */
  registerTool(tool: ToolDefinition & { execute: ToolHandler['execute'] }): Disposable
  /** 注册模型中间件。洋葱圈包裹模型调用，不调 next() 可跳过原始调用。 */
  registerModelMiddleware(mw: ModelMiddleware): Disposable
}

/** 扩展是 Crai 的能力单元：setup 中注册 hooks/adapters/commands，dispose 时清理资源。 */
export interface Extension {
  name: string
  manifest?: ExtensionManifest
  permissions?: ExtensionPermissionDeclaration[]
  setup(ctx: ExtensionContext): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface ExtensionModule {
  default: Extension
}

export interface SettingsStore {
  get<T = unknown>(key: string): Promise<T | undefined>
  set<T = unknown>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<Array<{ key: string }>>
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, metadata?: Metadata): void
  info(message: string, metadata?: Metadata): void
  warn(message: string, metadata?: Metadata): void
  error(message: string, metadata?: Metadata): void
}

export interface RuntimeHandle {
  id: ID
  prompt(input: RuntimeInput, options?: PromptOptions): Promise<PromptResult>
  callModel(messages: Array<{ role: string; content: string }>, options?: CallModelOptions): Promise<string>
  createSession(input?: Metadata, sessionId?: ID): Promise<Session>
  stopSession(sessionId: ID, messages?: Message[]): Promise<void>
  getSession(sessionId: ID): Promise<Session | undefined>
  /** 更新内存中的 session 元数据。用于 session:update 等非 prompt 场景同步 metadata。 */
  updateSession(session: Session): Promise<void>
  listSessions(): Promise<Array<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp; pinned?: boolean; archived?: boolean }>>
  listMessages(sessionId: ID): Promise<Message[]>
  /** 删除 session 及其所有消息。 */
  deleteSession(sessionId: ID): Promise<void>
  /** 截断 session 消息，只保留前 count 条。用于检查点回滚。 */
  truncateMessages?(sessionId: ID, count: number): Promise<void>
  /** 追加消息到 session。用于分叉等操作。 */
  appendMessage?(sessionId: ID, message: Message): Promise<void>
  /** 获取检查点管理器（如果可用）。 */
  getCheckpointManager?(): any
  /** 中止当前正在处理的 turn。无正在处理的 turn 时无操作。 */
  abortCurrentTurn(): void
  /** 动态注册工具。返回清理函数。 */
  registerTool(tool: ToolDefinition & { execute: ToolHandler['execute'] }): Disposable
  loadExtension(ext: Extension): Promise<void>
  unloadExtension(name: string): Promise<void>
  dispose(): Promise<void>
}

export interface CallModelOptions {
  system?: string
  model?: string
  provider?: string
  temperature?: number
  maxTokens?: number
  /** 工具模式：关闭思考/推理，用于标题生成、摘要等轻量任务。 */
  utility?: boolean
  signal?: AbortSignal
}

export interface PromptOptions {
  sessionId?: ID
  model?: string
  provider?: string
  /** 工具模型。格式：provider/model。用于标题生成、对话摘要等辅助 LLM 调用。未设置时使用 model。 */
  toolModel?: string
  /** 思考深度级别，覆盖 session.metadata.thinkingLevel。 */
  thinkingLevel?: string
  /** 会话模式，覆盖 session.metadata.mode。 */
  mode?: string
  /** 上下文压缩阈值（0~1）。覆盖全局配置的 compressionThreshold。 */
  compressionThreshold?: number
  /** 压缩后保留的最近消息 token 数。覆盖全局配置的 keepRecentTokens。 */
  compressionKeepTokens?: number
  metadata?: Metadata
  signal?: AbortSignal
}

export interface PromptResult {
  session: Session
  turnId: ID
  messages: Message[]
  response?: ModelResponse
}

export interface ModelAdapter {
  name: string
  /** 模型的上下文窗口长度（token）。用于 Token 预算管理，0 或 undefined 表示未知。 */
  contextLength?: number
  request(request: ModelRequest): Promise<ModelResponse>
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}
