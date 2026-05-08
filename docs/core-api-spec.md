# Crai 核心 API 规格 (Core API Spec)

> 本文档定义了运行时 (Runtime)、扩展 (Extensions)、事件 (Events)、钩子 (Hooks) 和适配器 (Adapters) 的稳定核心契约。

## 1. 范围

本规格涵盖：
- 基础类型
- Session / Message / Artifact 实体
- 事件模型 (Event model)
- 钩子模型 (Hook model)
- 适配器契约 (Adapter contracts)
- 运行时句柄 (Runtime handle)
- 扩展契约 (Extension contract)
- 命令注册表 (Command registry)

本规格不涵盖：
- UI 实现细节
- 模型供应商特定的请求格式
- 存储引擎内部实现
- 传输协议的具体细节

## 2. 基础类型

```ts
export type ID = string
export type Timestamp = number

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type Metadata = Record<string, JsonValue | undefined>
```

## 2.1 安全类型 (Safety Types)

```ts
/** 工具安全级别：每个 ToolDefinition 必须声明 */
export type ToolSafetyLevel = 'safe' | 'restricted' | 'dangerous'

/**
 * safe: 纯只读操作，不修改任何状态（如 read_file、search、grep）
 * restricted: 受限写操作，仅在 sandbox 范围内生效（如 edit_file、write_file）
 * dangerous: 可能造成不可逆损害的操作（如 rm、shell、sudo），必须显式用户确认
 */

/** 运行时权限模式 */
export type PermissionMode = 'safe' | 'ask' | 'execute'

/**
 * safe: 只允许 safe 级工具，restricted 和 dangerous 被拒绝
 * ask: safe 自动通过，restricted 和 dangerous 需用户确认
 * execute: safe 和 restricted 自动通过，dangerous 需用户确认
 */

/** 文件系统沙箱作用域 */
export interface SandboxScope {
  rootDir: string
  allowWrite?: string[]
  denyWrite?: string[]
  denyRead?: string[]
  maxReadBytes?: number
}
```

## 3. 实体

### 3.1 Session

```ts
export interface Session {
  id: ID
  createdAt: Timestamp
  updatedAt: Timestamp
  title?: string
  metadata?: Metadata
}
```

### 3.2 Message

```ts
export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "custom"

export interface BaseMessage {
  id: ID
  role: MessageRole
  createdAt: Timestamp
  metadata?: Metadata
}

export interface TextPart {
  type: "text"
  text: string
}

export interface ImagePart {
  type: "image"
  mimeType: string
  data: string
}

export interface ToolCallPart {
  type: "tool-call"
  toolCallId: ID
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResultPart {
  type: "tool-result"
  toolCallId: ID
  name: string
  isError?: boolean
  content: Array<TextPart | ImagePart>
}

export type MessagePart = TextPart | ImagePart | ToolCallPart | ToolResultPart

export interface Message extends BaseMessage {
  parts: MessagePart[]
}
```

### 3.3 Artifact

```ts
export interface Artifact {
  id: ID
  sessionId: ID
  kind: string
  uri?: string
  content?: string
  createdAt: Timestamp
  metadata?: Metadata
}
```

## 4. Event Model

```ts
export interface CoreEvent<TType extends string = string, TPayload = unknown> {
  id: ID
  type: TType
  sessionId?: ID
  timestamp: Timestamp
  payload: TPayload
  metadata?: Metadata
}
```

### 4.1 EventMap

推荐的一等公民事件：

```ts
export interface EventMap {
  "runtime.started": { runtimeId: ID }
  "runtime.stopped": { runtimeId: ID }

  "session.created": { session: Session }
  "session.updated": { session: Session }

  "input.received": { session: Session; input: RuntimeInput }
  "message.appended": { session: Session; message: Message }

  "turn.started": { session: Session; turnId: ID }
  "turn.completed": { session: Session; turnId: ID }
  "turn.failed": { session: Session; turnId: ID; error: RuntimeError }

  "context.built": { session: Session; context: ModelContext }

  "model.requested": { session: Session; request: ModelRequest }
  "model.delta": { session: Session; turnId: ID; delta: string }
  "model.message": { session: Session; message: Message }
  "model.completed": { session: Session; response: ModelResponse }

  "tool.requested": { session: Session; toolCall: ToolCallPart }
  "tool.completed": { session: Session; result: ToolExecutionResult }
  "tool.failed": { session: Session; result: ToolExecutionResult }

  "artifact.created": { session: Session; artifact: Artifact }
  "artifact.updated": { session: Session; artifact: Artifact }

  "extension.loaded": { name: string }
  "extension.unloaded": { name: string }

  // Safety events
  "tool.blocked": { session: Session; toolCall: ToolCallPart; reason: string }
  "permission.requested": { session: Session; request: PermissionCheckRequest }
  "permission.resolved": { session: Session; request: PermissionCheckRequest; decision: PermissionDecision }

  // Phase 2 — 已确认设计但尚未实现
  // "middleware.before": { session: Session; turnId: ID; kind: string; input: unknown }
  // "middleware.after": { session: Session; turnId: ID; kind: string; output: unknown }
  // "checkpoint.saved": { session: Session; turnId: ID; kind: string; artifactId: ID }
}
```

## 5. 钩子与中间件 (Hooks & Middleware)

### 5.1 Hook

```ts
export type HookHandler<T = unknown> = (context: HookContext, data: T) => Promise<T | void>

export interface HookRegistry {
  on(event: string, handler: HookHandler): void
  emit(event: string, data: unknown): Promise<void>
}
```

### 5.2 Middleware (借鉴自 Eino)

中间件提供了一种比钩子更强的封装能力，允许在执行前后进行状态包装或完全替换行为。

```ts
export interface Middleware<TInput, TOutput> {
  before?: (input: TInput) => Promise<TInput>
  after?: (output: TOutput) => Promise<TOutput>
  // 环绕模式，允许完全控制执行流
  wrap?: (input: TInput, next: (input: TInput) => Promise<TOutput>) => Promise<TOutput>
}

// 具体的模型中间件示例
export type ModelMiddleware = Middleware<ModelRequest, ModelResponse>
```

## 6. EventBus

```ts
export interface EventBus<TEvents extends Record<string, any>> {
  /** 发布事件（广播） */
  emit<TKey extends keyof TEvents & string>(
    type: TKey,
    payload: TEvents[TKey],
  ): Promise<void>

  /** 订阅事件 */
  on<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (event: CoreEvent<TKey, TEvents[TKey]>) => void | Promise<void>,
  ): Disposable

  /**
   * 请求-响应模式（借鉴 OpenHanako SKIP 链设计）。
   * 按注册顺序调用已注册的 handler，返回第一个非 EventBus.SKIP 的值。
   * 无 handler 时抛出 BusNoHandlerError；超时时抛出 BusTimeoutError。
   */
  request<TKey extends string>(
    type: TKey,
    payload: unknown,
  ): Promise<unknown>

  /**
   * 注册请求处理器（仅 full-access Extension 可用）。
   * 同一事件类型可注册多个 handler，按注册顺序组成 SKIP 链。
   */
  handle<TKey extends string>(
    type: TKey,
    handler: (payload: unknown) => Promise<unknown>,
  ): Disposable

  /** 检查是否有注册的 handler（软依赖检测） */
  hasHandler(type: string): boolean

  /** 返回此值表示"我不处理，交给下一个 handler" */
  readonly SKIP: unique symbol
}
```

## 7. Adapter Contracts

### 7.1 AdapterContext

```ts
export interface AdapterContext {
  signal?: AbortSignal
  logger: Logger
  session: Session
  turnId?: ID
}
```

### 7.2 Model

```ts
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
    /** 思考强度（由各 provider 自行定义语义，core 只做透传） */
    thinkingLevel?: string
  }
  metadata?: Metadata
}

export type ModelStreamEvent =
  | { type: "text-start" }
  | { type: "text-delta"; delta: string }
  | { type: "text-end" }
  | { type: "tool-call"; toolCall: ToolCallPart }
  | { type: "message"; message: Message }
  | { type: "done"; response: ModelResponse }
  | { type: "error"; error: RuntimeError }

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

export interface ModelAdapter {
  name: string
  /** 模型的上下文窗口长度（token）。用于 Token 预算管理，0 或 undefined 表示未知。 */
  contextLength?: number
  request(request: ModelRequest): Promise<ModelResponse>
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}
```

### 7.3 Tool

```ts
export interface ToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  safetyLevel: ToolSafetyLevel  // 必填：工具声明自身安全级别
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

export interface ToolHandler {
  definition: ToolDefinition
  execute(
    request: ToolExecutionRequest,
    ctx: AdapterContext,
  ): Promise<ToolExecutionResult> | ToolExecutionResult
}

export interface ToolProvider {
  name: string
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  getTool(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}

/**
 * 工具解析规则 (Tool resolution rule):
 * - 运行时内核可以合并来自所有已注册 ToolProvider 实例的工具
 * - 工具名称必须通过 `name` 进行去重
 * - 如果多个提供者暴露相同的工具名称，运行时应当使用第一个注册的提供者，除非注入了自定义解析器
 * - 合并后的列表应当被视为 `ModelContext.tools` 的规范工具目录
 */
export interface ToolResolver {
  listTools(): Promise<ToolDefinition[]> | ToolDefinition[]
  resolve(name: string): Promise<ToolHandler | undefined> | ToolHandler | undefined
}
```

### 7.4 Storage / Cache / Permission / Transport

```ts
export interface StorageAdapter {
  name: string
  createSession(session: Session): Promise<void>
  updateSession(session: Session): Promise<void>
  /** 追加写入一条消息。实现应保证追加语义（JSONL 等），避免全量覆盖写。 */
  appendMessage(sessionId: ID, message: Message): Promise<void>
  listMessages(sessionId: ID): Promise<Message[]>
  /** 列举所有已持久化的 session 摘要，不含完整消息列表。 */
  listSessions(): Promise<Array<{ id: ID; title?: string; createdAt: Timestamp; updatedAt: Timestamp }>>
  deleteSession(sessionId: ID): Promise<void>
  saveArtifact(artifact: Artifact): Promise<void>
}

export interface CacheAdapter {
  name: string
  /**
   * 用于从请求中导出稳定缓存键的可选辅助方法。
   * 如果省略，运行时仍应能够回退到内部键策略。
   */
  getCacheKey?(request: ModelRequest): string
  beforeModel?(request: ModelRequest): Promise<ModelRequest> | ModelRequest
  afterModel?(request: ModelRequest, response: ModelResponse): Promise<void> | void
}

export interface PermissionCheckRequest {
  kind: "tool" | "transport" | "storage" | "custom"
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

export interface TransportContext {
  signal?: AbortSignal
  logger: Logger
  /**
   * 将外部输入注入运行时。
   * 传输层可以自行解析会话身份，但协议应当使选择的会话在输入负载或元数据中保持显式。
   */
  onInput: (input: RuntimeInput) => Promise<void>
  emitEvent: <TKey extends keyof EventMap & string>(
    type: TKey,
    payload: EventMap[TKey],
  ) => Promise<void>
}

export interface TransportAdapter {
  name: string
  start(ctx: TransportContext): Promise<void>
  stop(): Promise<void>
  sendMessage?(sessionId: ID, message: Message): Promise<void>
  sendEvent?<TKey extends keyof EventMap & string>(
    type: TKey,
    payload: EventMap[TKey],
  ): Promise<void>
}
```

## 8. Runtime Inputs and Handle

```ts
export type RuntimeInput =
  | { type: "text"; text: string; metadata?: Metadata }
  | { type: "message"; message: Message }
  | { type: "command"; name: string; args?: unknown }

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
```

## 9. Registry and Extension APIs

```ts
export interface Registry<T> {
  register(name: string, value: T): Disposable
  get(name: string): T | undefined
  list(): Array<{ name: string; value: T }>
}

export interface RuntimeRegistries {
  models: Registry<ModelAdapter>
  tools: Registry<ToolProvider>
  storages: Registry<StorageAdapter>
  caches: Registry<CacheAdapter>
  memories: Registry<MemoryAdapter>
  permissions: Registry<PermissionAdapter>
  transports: Registry<TransportAdapter>
}
```

```ts
export interface ExtensionContext {
  /** 运行时句柄 */
  runtime: RuntimeHandle
  /** 钩子总线 */
  hooks: HookBus<HookMap>
  /** 事件总线（含 SKIP 链，等同于 bus） */
  events: EventBus<EventMap>
  /** 事件总线别名（与 events 相同引用，与 OpenHanako 命名习惯对齐） */
  bus: EventBus<EventMap>
  /** 适配器注册表（只读；仅 full-access Extension 可写入） */
  registry: RuntimeRegistries
  /** Logger */
  logger: Logger
  /** Extension 私有配置读写 */
  config: ExtensionConfigStore
  /** Extension 私有数据目录 */
  dataDir: string
  /** 注册可清理资源（卸载时逆序 dispose）。借鉴 OpenHanako register() 模式 */
  register(disposable: Disposable): void
  /** 动态注册工具（仅 full-access，返回清理函数） */
  registerTool(tool: ToolDefinition & { execute: ToolHandler['execute'] }): Disposable
}

export interface ExtensionPermissionDeclaration {
  kind: PermissionCheckRequest['kind']
  action: string
  payload?: unknown
}

export interface Extension {
  /** Extension 唯一标识 */
  name: string
  /** 元数据声明 */
  manifest?: ExtensionManifest
  /**
   * 扩展加载期间使用的可选声明式权限提示。
   * 运行时可以在运行 setup 之前对其进行评估，如果拒绝了所需的权限，则可以拒绝加载该扩展。
   */
  permissions?: ExtensionPermissionDeclaration[]
  setup(ctx: ExtensionContext): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface ExtensionModule {
  default: Extension
}

export function defineExtension(extension: Extension): Extension {
  return extension
}
```

```ts
// ─── Extension 定义（借鉴 OpenHanako 的权限、权限和资源管理模式）───

/** Extension 元数据声明 */
export interface ExtensionManifest {
  id: string
  name?: string
  version?: string
  description?: string
  /** 信任级别，默认 'restricted'。'full-access' 可获得 registry 写入、bus.handle、registerTool */
  trust?: 'restricted' | 'full-access'
  /** 所需权限声明（加载时评估） */
  permissions?: ExtensionPermissionDeclaration[]
}

/** Extension 配置读写接口（由 runtime 注入，持久化对 Extension 透明） */
export interface ExtensionConfigStore {
  get<T = unknown>(key: string): T | undefined
  set<T = unknown>(key: string, value: T): Promise<void>
}
```

## 10. Logging and Errors

```ts
export interface Logger {
  debug(message: string, metadata?: Metadata): void
  info(message: string, metadata?: Metadata): void
  warn(message: string, metadata?: Metadata): void
  error(message: string, metadata?: Metadata): void
}

export interface RuntimeError {
  code: string
  message: string
  cause?: unknown
  metadata?: Metadata
}
```
```

## 11. Runtime Factory

```ts
export interface RuntimeOptions {
  storage?: StorageAdapter
  cache?: CacheAdapter
  permission?: PermissionAdapter
  extensions?: Array<Extension | string>
  logger?: Logger
  /** 是否允许加载声明 trust: 'full-access' 的 Extension（默认 false，它们会被降级为 restricted） */
  allowFullAccessExtensions?: boolean
}

export interface RuntimeFactory {
  create(options?: RuntimeOptions): Promise<RuntimeHandle>
}

export declare function createRuntime(options?: RuntimeOptions): Promise<RuntimeHandle>
```

## 12. 稳定性说明 (Stability Notes)

- 本规格旨在保持精简且轻量依赖。
- UI、供应商和传输层细节应当保持在核心契约之外，除非它们真正具有跨领域性。
- 破坏性变更应当谨慎引入，并在实现前进行记录。
