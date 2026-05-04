# Crai Core API Spec

> This document defines the stable core-facing contracts for runtime, extensions, events, hooks, and adapters.

## 1. Scope

This spec covers:
- base types
- session/message/artifact entities
- event model
- hook model
- adapter contracts
- runtime handle
- extension contract
- command registry

This spec does not cover:
- UI implementation details
- provider-specific request formats
- storage engine internals
- transport protocol specifics

## 2. Base Types

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

## 3. Entities

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

Recommended first-class events:

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
}
```

## 5. Hook Model

Hooks may observe and mutate values.

```ts
export interface Disposable {
  dispose(): void | Promise<void>
}

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
```

### 5.1 HookMap

```ts
export interface HookMap {
  "session:create": { input?: Metadata; session: Session }
  "input:before": { session: Session; input: RuntimeInput }
  "context:build": { session: Session; messages: Message[] }
  "model:request:before": { session: Session; request: ModelRequest }
  "model:response:after": { session: Session; response: ModelResponse }
  "tool:before": { session: Session; toolCall: ToolCallPart }
  "tool:after": { session: Session; result: ToolExecutionResult }
  "turn:after": { session: Session; turnId: ID; messages: Message[] }
  "persist:before": { session: Session }
  "persist:after": { session: Session }
  "permission:check": { session: Session; request: PermissionCheckRequest; decision: PermissionDecision }
  "artifact:save": { session: Session; artifact: Artifact }
}
```

### 5.2 Hook execution rules

1. Handlers run in ascending `priority` order; default is `0`.
2. Each handler receives the latest value.
3. `{ continue: true }` leaves the value unchanged.
4. `{ stop: true }` stops the pipeline early.
5. `{ replace: T }` replaces the current value.
6. `{ patch: Partial<T> }` shallow-merges the value.

### 5.3 HookBus

```ts
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
```

## 6. EventBus

```ts
export interface EventBus<TEvents extends Record<string, any>> {
  emit<TKey extends keyof TEvents & string>(
    type: TKey,
    payload: TEvents[TKey],
  ): Promise<void>

  on<TKey extends keyof TEvents & string>(
    type: TKey,
    listener: (event: CoreEvent<TKey, TEvents[TKey]>) => void | Promise<void>,
  ): Disposable
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
    thinkingLevel?: "off" | "low" | "medium" | "high"
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
  supports(model: string): boolean
  stream(request: ModelRequest, ctx: AdapterContext): AsyncIterable<ModelStreamEvent>
}
```

### 7.3 Tool

```ts
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
 * Tool resolution rule:
 * - the runtime kernel may merge tools from all registered ToolProvider instances
 * - tool names must be de-duplicated by `name`
 * - if multiple providers expose the same tool name, the runtime should use the first registered provider unless a custom resolver is injected
 * - the merged list should be treated as the canonical tool catalog for `ModelContext.tools`
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
  appendMessage(sessionId: ID, message: Message): Promise<void>
  listMessages(sessionId: ID): Promise<Message[]>
  saveArtifact(artifact: Artifact): Promise<void>
}

export interface CacheAdapter {
  name: string
  /**
   * Optional helper for deriving a stable cache key from the request.
   * If omitted, the runtime should still be able to fall back to an internal key strategy.
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
   * Inject external input into the runtime.
   * The transport may resolve session identity itself, but the protocol should make the chosen session explicit in the input payload or metadata.
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
  permissions: Registry<PermissionAdapter>
  transports: Registry<TransportAdapter>
}
```

```ts
export interface ExtensionContext {
  runtime: RuntimeHandle
  hooks: HookBus<HookMap>
  events: EventBus<EventMap>
  registry: RuntimeRegistries
  logger: Logger
}

export interface ExtensionPermissionDeclaration {
  kind: PermissionCheckRequest['kind']
  action: string
  payload?: unknown
}

export interface Extension {
  name: string
  /**
   * Optional declarative permission hints used during extension loading.
   * The runtime may evaluate these before running setup and may refuse to load the extension if a required permission is denied.
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
}

export interface RuntimeFactory {
  create(options?: RuntimeOptions): Promise<RuntimeHandle>
}

export declare function createRuntime(options?: RuntimeOptions): Promise<RuntimeHandle>
```

## 12. Stability Notes

- This spec is intended to stay narrow and dependency-light.
- UI, provider, and transport details should remain outside core contracts unless they are truly cross-cutting.
- Breaking changes should be introduced deliberately and documented before implementation.
