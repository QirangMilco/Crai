/**
 * Crai hook 与适配器契约。
 *
 * 本文件是 core 最宽的契约面：除 spec 定义的 HookMap / HookBus / EventBus / Adapter 外，
 * 还包含 runtime 内部需要的 PromptPipeline、Command、SettingsStore 等扩展契约。
 * 这些扩展契约不属于 spec 稳定面，后续可能随 Phase 2/3 演进或回移。
 */
import type { EventMap, ModelRequest, ModelResponse, RuntimeError, RuntimeInput, ToolDefinition, ToolExecutionRequest, ToolExecutionResult } from './events'
import type { Artifact, ID, Metadata, Message, Session, ToolCallPart } from './types'

/** 统一可释放对象，便于卸载扩展时回收资源。 */
export interface Disposable {
  dispose(): void | Promise<void>
}

/** Hook 执行语义：void/continue 放行，stop 阻断，replace 替换整体，patch 浅合并。 */
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

/** 生命周期拦截点。key 格式为 "阶段:时机"，handler 按 priority 升序执行。 */
export interface HookMap {
  'session:create': { input?: Metadata; session: Session }
  'input:before': { session: Session; input: RuntimeInput }
  'context:build': { session: Session; messages: Message[] }
  'model:request:before': { session: Session; request: ModelRequest }
  'model:response:after': { session: Session; response: ModelResponse }
  'tool:before': { session: Session; toolCall: ToolCallPart }
  'tool:after': { session: Session; result: ToolExecutionResult }
  'turn:after': { session: Session; turnId: ID; messages: Message[] }
  'persist:before': { session: Session }
  'persist:after': { session: Session }
  'permission:check': { session: Session; request: PermissionCheckRequest; decision: PermissionDecision }
  'artifact:save': { session: Session; artifact: Artifact }
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

/**
 * 适配器运行上下文，由 runtime 在调度时注入。
 * signal 用于支持取消，logger 保证适配器无需自行创建日志实例。
 */
export interface AdapterContext {
  signal?: AbortSignal
  logger: Logger
  session: Session
  turnId?: ID
}

export interface StorageAdapter {
  name: string
  createSession(session: Session): Promise<void>
  updateSession(session: Session): Promise<void>
  appendMessage(sessionId: ID, message: Message): Promise<void>
  listMessages(sessionId: ID): Promise<Message[]>
  saveArtifact(artifact: Artifact): Promise<void>
}

export interface CacheAdapter {
  name: string
  getCacheKey?(request: ModelRequest): string
  beforeModel?(request: ModelRequest): Promise<ModelRequest> | ModelRequest
  afterModel?(request: ModelRequest, response: ModelResponse): Promise<void> | void
}

export interface PermissionCheckRequest {
  kind: 'tool' | 'transport' | 'storage' | 'custom'
  action: string
  payload?: unknown
  session?: Session
}

export interface PermissionDecision {
  allow: boolean
  reason?: string
  metadata?: Metadata
}

export interface PermissionAdapter {
  name: string
  check(request: PermissionCheckRequest): Promise<PermissionDecision>
}

export interface ToolHandler {
  definition: ToolDefinition
  execute(request: ToolExecutionRequest, ctx: AdapterContext): Promise<ToolExecutionResult> | ToolExecutionResult
}

export interface ToolProvider {
  name: string
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  getTool(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}

/** 工具解析器：合并多个 ToolProvider 的工具目录，同名取先注册者。 */
export interface ToolResolver {
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  resolve(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}

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

export interface Registry<T> {
  register(name: string, value: T): Disposable
  get(name: string): T | undefined
  list(): Array<{ name: string; value: T }>
}

/** [扩展契约] Prompt 流水线：将 input → session → turn 的完整调度封装为可替换策略。 */
export interface PromptPipeline {
  run(input: RuntimeInput, options?: PromptOptions): Promise<PromptResult>
}

/** [扩展契约] 运行时注册表集合，promptPipelines 为 runtime 内部扩展，不在 spec 中。 */
export interface RuntimeRegistries {
  models: Registry<ModelAdapter>
  tools: Registry<ToolProvider>
  storages: Registry<StorageAdapter>
  caches: Registry<CacheAdapter>
  permissions: Registry<PermissionAdapter>
  transports: Registry<TransportAdapter>
  promptPipelines: Registry<PromptPipeline>
}

/** [扩展契约] 命令系统，Phase 2 完整实现。 */
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

export interface ExtensionPermissionDeclaration {
  kind: PermissionCheckRequest['kind']
  action: string
  payload?: unknown
}

export interface ExtensionContext {
  runtime: RuntimeHandle
  hooks: HookBus<HookMap>
  events: EventBus<EventMap>
  registry: RuntimeRegistries
  logger: Logger
}

export interface Extension {
  name: string
  permissions?: ExtensionPermissionDeclaration[]
  setup(ctx: ExtensionContext): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface ExtensionModule {
  default: Extension
}

/** [扩展契约] 运行时键值配置存储，Phase 2 完整实现。 */
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

/**
 * 模型适配器契约。
 * spec 只定义了 stream()；request() 是为非流式场景增加的便利方法，
 * 具体实现可按需提供。
 */
export interface ModelAdapter {
  name: string
  request(request: ModelRequest): Promise<ModelResponse>
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}
