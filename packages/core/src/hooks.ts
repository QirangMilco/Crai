import type { EventMap, ModelRequest, ModelResponse, ModelStreamEvent, RuntimeInput, ToolDefinition, ToolExecutionRequest, ToolExecutionResult } from './events'
import type { Artifact, ID, MemoryEntry, MemoryScope, Metadata, Message, Observation, PermissionCheckRequest, PermissionDecision, PermissionMode, Session, SessionSummary, ToolCallPart } from './types'

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
  'turn:afterToolExec': { session: Session; result: ToolExecutionResult }
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

export interface EventBus<TEvents extends Record<string, any>> {
  emit<TKey extends keyof TEvents & string>(
    type: TKey,
    payload: TEvents[TKey],
  ): Promise<void>

  on<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (event: { id: ID; type: TKey; sessionId?: ID; timestamp: number; payload: TEvents[TKey]; metadata?: Metadata }) => void | Promise<void>,
  ): Disposable
}

/** 适配器执行上下文，携带 session、日志和取消信号。 */
export interface AdapterContext {
  signal?: AbortSignal
  logger: Logger
  session: Session
  turnId?: ID
}

/** 存储适配器：session/message/artifact 的持久化。 */
export interface StorageAdapter {
  name: string
  createSession(session: Session): Promise<void>
  updateSession(session: Session): Promise<void>
  appendMessage(sessionId: ID, message: Message): Promise<void>
  listMessages(sessionId: ID): Promise<Message[]>
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

export interface RuntimeRegistries {
  models: Registry<ModelAdapter>
  tools: Registry<ToolProvider>
  storages: Registry<StorageAdapter>
  caches: Registry<CacheAdapter>
  memories: Registry<MemoryAdapter>
  permissions: Registry<PermissionAdapter>
  transports: Registry<TransportAdapter>
  promptPipelines: Registry<PromptPipeline>
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

/** 扩展 setup 时接收的上下文：持有 runtime、hooks、events、registries 的访问权。 */
export interface ExtensionContext {
  runtime: RuntimeHandle
  hooks: HookBus<HookMap>
  events: EventBus<EventMap>
  registry: RuntimeRegistries
  logger: Logger
}

/** 扩展是 Crai 的能力单元：setup 中注册 hooks/adapters/commands，dispose 时清理资源。 */
export interface Extension {
  name: string
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

export interface Logger {
  debug(message: string, metadata?: Metadata): void
  info(message: string, metadata?: Metadata): void
  warn(message: string, metadata?: Metadata): void
  error(message: string, metadata?: Metadata): void
}

export interface RuntimeHandle {
  id: ID
  prompt(input: RuntimeInput, options?: PromptOptions): Promise<PromptResult>
  createSession(input?: Metadata): Promise<Session>
  stopSession(sessionId: ID, messages?: Message[]): Promise<void>
  getSession(sessionId: ID): Promise<Session | undefined>
  listMessages(sessionId: ID): Promise<Message[]>
  loadExtension(source: string): Promise<void>
  unloadExtension(name: string): Promise<void>
  dispose(): Promise<void>
}

export interface PromptOptions {
  sessionId?: ID
  model?: string
  provider?: string
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
  request(request: ModelRequest): Promise<ModelResponse>
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}
