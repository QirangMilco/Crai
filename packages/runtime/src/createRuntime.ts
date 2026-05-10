import type {
  Logger,
  ModelAdapter,
  ModelMiddleware,
  PromptOptions,
  PromptResult,
  Registry,
  RuntimeError,
  Metadata,
  RuntimeHandle,
  RuntimeInput,
  Session,
  StorageAdapter,
  ToolDefinition,
  ToolHandler,
  ToolProvider,
} from '@crai/core'
import type {
  CacheAdapter,
  CommandRegistry,
  Disposable,
  EventBus,
  Extension,
  ExtensionConfigStore,
  ExtensionContext,
  HookBus,
  HookMap,
  PermissionAdapter,
  RuntimeRegistries,
  SettingsStore,
} from '@crai/core'
import { EVENTS, ERROR_CODES, HOOKS } from '@crai/core'
import type { TraceFn } from './bus'
import {
  createCommandRegistry,
  createDefaultLogger,
  createEventBus,
  createHookBus,
  createModelMiddlewareStore,
  createRuntimeRegistries,
  createSettingsStore,
  createTrackedRegistries,
  type ModelMiddlewareStore,
} from './bus'
import { bootstrapRuntimeExtensions, setupExtension } from './bootstrap'
import { buildRuntimeContext } from './contextBuilder'
import { runTurn, type TurnRunnerDeps } from './turnRunner'
import { SessionManager } from './sessionManager'
import { BUILTIN_STORAGE_NAME, DEFAULT_PIPELINE_NAME } from './constants'
import { createTraceCollector, type TraceMode } from './trace'

// ── 公开类型 ──────────────────────────────────────
/** 创建 runtime 时的可选注入项。kernel 不内置任何 adapter 默认实现。 */
export interface RuntimeOptions {
  storage?: StorageAdapter
  cache?: CacheAdapter
  permission?: PermissionAdapter
  extensions?: Array<Extension | string>
  logger?: Logger
  /** 是否允许加载声明 trust: 'full-access' 的扩展（默认 false，降级为 restricted）。 */
  allowFullAccessExtensions?: boolean
  /**
   * trace 模式。
   * - `true` / `'file'` — dispose 时写入 `.crai/trace-latest.md`
   * - `'console'`      — dispose 时打印到 stderr
   * - `'realtime'`     — 每步实时输出到 stderr
   */
  trace?: boolean | TraceMode
}

// ── 内部类型 ──────────────────────────────────────
/** runtime 内部依赖汇总，由 createDeps 统一组装，不暴露给外部。 */
interface RuntimeDeps {
  hooks: HookBus<HookMap>
  events: EventBus<any>
  registries: RuntimeRegistries
  commands: CommandRegistry
  settings: SettingsStore
  logger: Logger
  sessions: SessionManager
  storage?: StorageAdapter
  middlewares: ModelMiddlewareStore
  configStore: ExtensionConfigStore
  traceCollector?: ReturnType<typeof createTraceCollector>
}

// ── 辅助函数 ───────────────────────────────────────
/** noop trace — trace 关闭时静默。 */
const noopTrace = { register() {}, execute() {} }

function resolveTraceMode(options?: RuntimeOptions): TraceMode | undefined {
  if (!options?.trace) return undefined
  if (options.trace === true) return 'file'
  return options.trace
}

function createDeps(options?: RuntimeOptions): RuntimeDeps {
  const logger = options?.logger ?? createDefaultLogger()
  let traceCollector: ReturnType<typeof createTraceCollector> | undefined
  const traceMode = resolveTraceMode(options)
  const traceFn: TraceFn = traceMode
    ? (traceCollector = createTraceCollector({ mode: traceMode }))
    : noopTrace
  const hooks = createHookBus(traceFn)
  const events = createEventBus(traceFn)
  const registries = createRuntimeRegistries()
  const commands = createCommandRegistry()
  const settings = createSettingsStore()
  const sessions = new SessionManager()
  const middlewares = createModelMiddlewareStore()
  const configStore: ExtensionConfigStore = {
    get(_key) { return undefined },
    async set(_key, _value) {},
  }
  return { hooks, events, registries, commands, settings, logger, sessions, storage: options?.storage, middlewares, configStore, traceCollector }
}

function getFirstModel(models: Registry<ModelAdapter>): string | undefined {
  return models.list()[0]?.name
}

// ── ExtensionContext 工厂 ──────────────────────────
/**
 * 创建 runtime 实例并完成扩展引导。
 * kernel 本身是纯调度器，所有默认行为（模型、持久化等）都在 preset extensions 中提供。
 */
function createExtensionContext(
  deps: RuntimeDeps,
  runtime: RuntimeHandle,
  disposables: Set<Disposable>,
  registry: RuntimeRegistries,
): ExtensionContext {
  return {
    runtime,
    hooks: deps.hooks,
    events: deps.events,
    bus: deps.events,
    registry,
    logger: deps.logger,
    config: deps.configStore,
    dataDir: '.',
    register(disposable: Disposable) {
      disposables.add(disposable)
    },
    registerTool(tool: ToolDefinition & { execute: ToolHandler['execute'] }) {
      const extName = tool.name
      const provider: ToolProvider = {
        name: `registerTool:${extName}`,
        listTools() {
          return [{
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            safetyLevel: tool.safetyLevel,
            sandbox: tool.sandbox,
          }]
        },
        getTool(name: string) {
          if (name !== tool.name) return undefined
          return {
            definition: {
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              safetyLevel: tool.safetyLevel,
              sandbox: tool.sandbox,
            },
            execute: tool.execute,
          }
        },
      }
      return registry.tools.register(provider.name, provider)
    },
    registerModelMiddleware(mw: ModelMiddleware) {
      return deps.middlewares.register(mw)
    },
  }
}

// ── Runtime 方法处理器 ────────────────────────────

async function handlePrompt(
  deps: RuntimeDeps,
  runtime: RuntimeHandle,
  input: RuntimeInput,
  promptOptions?: PromptOptions,
): Promise<PromptResult> {
  // 检查是否有自定义 pipeline 接管 prompt
  const pipeline = deps.registries.promptPipelines.get(DEFAULT_PIPELINE_NAME)
  if (pipeline) {
    return pipeline.run(input, promptOptions)
  }

  // 获取或创建 session
  let session: Session
  if (promptOptions?.sessionId) {
    const existing = deps.sessions.get(promptOptions.sessionId)
    session = existing ?? await runtime.createSession(promptOptions.metadata)
  } else {
    session = await runtime.createSession(promptOptions?.metadata)
  }

  // 组装 turn 依赖
  const turnDeps: TurnRunnerDeps = {
    hooks: deps.hooks,
    emitEvent: deps.events.emit,
    middlewares: deps.middlewares,
    buildContext: async () => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value ?? deps.storage
      const messages = storage ? await storage.listMessages(session.id) : []
      return buildRuntimeContext({ session, messages, tools: [] })
    },
    requestModel: async (request) => {
      const adapter = deps.registries.models.get(request.model)
      if (!adapter) {
        const err: RuntimeError = { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: `模型 "${request.model}" 未注册` }
        throw err
      }
      return adapter.request(request)
    },
    resolveTools: async () => {
      const tools: ToolDefinition[] = []
      for (const { value: provider } of deps.registries.tools.list()) {
        const defs = await provider.listTools()
        tools.push(...defs)
      }
      return tools
    },
  }

  const modelName = promptOptions?.model ?? getFirstModel(deps.registries.models)
  const inputText = typeof input === 'string' ? input : (input as any)?.text
  deps.traceCollector?.note(`prompt — ${JSON.stringify(inputText ?? input)}`)
  const result = await runTurn(input, session, runtime, turnDeps, modelName)

  return {
    session: result.session,
    turnId: result.turnId,
    messages: result.messages,
    response: result.response,
  }
}

async function handleCreateSession(
  deps: RuntimeDeps,
  runtime: RuntimeHandle,
  input?: Metadata,
): Promise<Session> {
  // 优先使用注册的 session pipeline
  const pipeline = deps.registries.sessionPipelines.get(DEFAULT_PIPELINE_NAME)
  if (pipeline) {
    return pipeline.createSession(input)
  }

  await deps.hooks.run(HOOKS.SESSION_BEFORE_START, { session: { id: '', createdAt: 0, updatedAt: 0 }, input }, { runtime })
  const session = await deps.sessions.create(input)
  deps.traceCollector?.note(`createSession — ${session.id}`)
  await deps.events.emit(EVENTS.SESSION_CREATED, { session })
  return session
}

async function handleStopSession(
  deps: RuntimeDeps,
  runtime: RuntimeHandle,
  sessionId: string,
  messages?: any[],
): Promise<void> {
  // 优先使用注册的 session pipeline
  const pipeline = deps.registries.sessionPipelines.get(DEFAULT_PIPELINE_NAME)
  if (pipeline) {
    return pipeline.stopSession(sessionId, messages)
  }

  const session = deps.sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} 不存在`)
  }
  session.updatedAt = Date.now()
  await deps.sessions.update(session)
  await deps.hooks.run(HOOKS.SESSION_AFTER_STOP, { session, messages: messages ?? [] }, { runtime })
  await deps.events.emit(EVENTS.SESSION_UPDATED, { session })
}

async function handleLoadExtension(
  deps: RuntimeDeps,
  runtime: RuntimeHandle,
  loadedExtensions: Map<Extension, Set<Disposable>>,
  options: RuntimeOptions | undefined,
  ext: Extension,
): Promise<void> {
  const disposables = new Set<Disposable>()
  const trackedRegistry = createTrackedRegistries(deps.registries, disposables)
  const ctx = createExtensionContext(deps, runtime, disposables, trackedRegistry)
  await setupExtension(ext, ctx, options?.allowFullAccessExtensions ?? false)
  loadedExtensions.set(ext, disposables)
  await deps.events.emit(EVENTS.EXTENSION_LOADED, { name: ext.name })
}

async function handleUnloadExtension(
  deps: RuntimeDeps,
  loadedExtensions: Map<Extension, Set<Disposable>>,
  name: string,
): Promise<void> {
  for (const [ext, disposables] of loadedExtensions) {
    if (ext.name === name) {
      await ext.dispose?.()
      for (const d of disposables) {
        await d.dispose()
      }
      loadedExtensions.delete(ext)
      await deps.events.emit(EVENTS.EXTENSION_UNLOADED, { name })
      return
    }
  }
}

async function handleDispose(
  deps: RuntimeDeps,
  loadedExtensions: Map<Extension, Set<Disposable>>,
  runtimeId: string,
): Promise<void> {
  for (const [ext, disposables] of loadedExtensions) {
    await ext.dispose?.()
    for (const d of disposables) {
      await d.dispose()
    }
  }
  loadedExtensions.clear()
  await deps.events.emit(EVENTS.RUNTIME_STOPPED, { runtimeId })
  deps.traceCollector?.flush()
}

// ── 入口 ──────────────────────────────────────────

export async function createRuntime(options?: RuntimeOptions): Promise<RuntimeHandle> {
  // 在 deps 创建前捕获调用方位置（用于 trace）
  const callerStackLines = new Error().stack?.split('\n') ?? []
  const createRuntimeCaller = callerStackLines.find(line => {
    const t = line.trim()
    return !t.includes('createRuntime') && !t.includes('Error') && !t.includes('/node_modules/')
  })

  const deps = createDeps(options)
  const runtimeId = `runtime_${Date.now()}`

  if (deps.traceCollector) {
    deps.traceCollector.note(`createRuntime — from ${createRuntimeCaller?.trim() ?? '(unknown)'}`)
  }

  const loadedExtensions = new Map<Extension, Set<Disposable>>()

  if (options?.storage) {
    deps.registries.storages.register(BUILTIN_STORAGE_NAME, options.storage)
  }

  const runtime: RuntimeHandle = {
    id: runtimeId,
    prompt: (input, opts) => handlePrompt(deps, runtime, input, opts),
    createSession: (input) => handleCreateSession(deps, runtime, input),
    stopSession: (sessionId, messages) => handleStopSession(deps, runtime, sessionId, messages),
    getSession: async (sessionId) => deps.sessions.get(sessionId) ?? undefined,
    listMessages: () => Promise.resolve([]),
    loadExtension: (ext) => handleLoadExtension(deps, runtime, loadedExtensions, options, ext),
    unloadExtension: (name) => handleUnloadExtension(deps, loadedExtensions, name),
    dispose: () => handleDispose(deps, loadedExtensions, runtimeId),
  }

  // 初始引导使用 tracked registries，扩展注册的资源可被批量清理
  const bootstrapDisposables = new Set<Disposable>()
  const bootstrapRegistry = createTrackedRegistries(deps.registries, bootstrapDisposables)
  const bootstrapCtx = createExtensionContext(deps, runtime, bootstrapDisposables, bootstrapRegistry)

  await deps.events.emit(EVENTS.RUNTIME_STARTED, { runtimeId })
  await bootstrapRuntimeExtensions(options?.extensions, [], bootstrapCtx, options?.allowFullAccessExtensions ?? false)

  return runtime
}
