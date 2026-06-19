import type {
  Logger,
  ModelAdapter,
  ModelMiddleware,
  ModelStreamEvent,
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
import { EVENTS, ERROR_CODES, HOOKS, getSupportedThinkingLevels } from '@crai/core'
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
import { createTodoWriteTool } from './todoTool'
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
  /** 工作区根目录，用于解析工具调用的文件路径。 */
  rootDir?: string
  /**
   * trace 模式。
   * - `true` / `'file'` — dispose 时写入 `.crai/trace-latest.md`
   * - `'console'`      — dispose 时打印到 stderr
   * - `'realtime'`     — 每步实时输出到 stderr
   */
  trace?: boolean | TraceMode
  /**
   * 工具在执行中向用户提问的回调。
   * CLI 注入 readline question，GUI 注入弹窗。
   */
  requestUserInput?(question: string, options?: string[]): Promise<string>
  /**
   * 当 callModel 查找模型失败时回调。
   * 可在回调中动态创建并返回 ModelAdapter，runtime 会自动注册到模型表中以备后续使用。
   * 返回 undefined 表示无法提供此模型。
   */
  onModelNotFound?(modelName: string, provider?: string): Promise<ModelAdapter | undefined>
  /** 检查点管理器（用于 turn 级别回滚）。如果提供，会自动集成到 turn 生命周期。 */
  checkpointManager?: import('./checkpoint').CheckpointManager
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
  requestUserInput?: (question: string, options?: string[]) => Promise<string>
  /** 当前 turn 的 AbortController。prompt 开始时设置，结束后清除。 */
  currentAbortController?: AbortController
  /** 检查点管理器（可选）。 */
  checkpointManager?: import('./checkpoint').CheckpointManager
  /** 工作区根目录。 */
  rootDir?: string
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
  return { hooks, events, registries, commands, settings, logger, sessions, storage: options?.storage, middlewares, configStore, traceCollector, requestUserInput: options?.requestUserInput, checkpointManager: options?.checkpointManager, rootDir: options?.rootDir }
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
    if (existing) {
      session = existing
    } else {
      // 从 storage 恢复 session（含 todos 等元数据）
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      const stored = storage ? await storage.getSession(promptOptions.sessionId) : undefined
      if (stored) {
        session = stored
        deps.sessions.update(session)
      } else {
        session = await runtime.createSession(promptOptions.metadata, promptOptions.sessionId)
      }
    }
  } else {
    session = await runtime.createSession(promptOptions?.metadata)
  }

  // 组装 turn 依赖
  const turnDeps: TurnRunnerDeps = {
    hooks: deps.hooks,
    emitEvent: deps.events.emit,
    logger: deps.logger,
    middlewares: deps.middlewares,
    checkpointManager: deps.checkpointManager,
    rootDir: deps.rootDir,
    getStorage: () => {
      const storages = deps.registries.storages.list()
      return storages[0]?.value ?? deps.storage
    },
    buildContext: async () => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value ?? deps.storage
      const messages = storage ? await storage.listMessages(session.id) : []

      // 压缩标记检测：如果存在 ctx-compaction 消息，将其后的消息作为上下文
      let filtered = messages
      const lastCtxIdx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
          if ((messages[i] as any).id === 'ctx-compaction') return i
        }
        return -1
      })()
      if (lastCtxIdx >= 0) {
        filtered = messages.slice(lastCtxIdx)
        if (deps.logger?.debug) deps.logger.debug(`[context] 检测到压缩标记，截断至 ${filtered.length} 条消息 (原 ${messages.length} 条)`)
      }

      // 调试：查看加载的消息
      if (deps.logger?.debug) {
        deps.logger.debug(`[abort] buildContext: ${session.id} loaded ${messages.length} msgs`)
        for (const m of messages) {
          deps.logger.debug(`[abort]   msg: id=${m.id?.substring(0,20)} role=${m.role} turnId=${m.turnId} stopReason=${(m as any).stopReason}`)
        }
      }

      // OpenHanako 模式：按 turn 边界过滤中止轮次
      const abortedTurnIds = new Set<string>()
      for (const m of filtered) {
        if (m.role === 'assistant' && (m as any).stopReason === 'aborted' && m.turnId) {
          abortedTurnIds.add(m.turnId)
          if (deps.logger?.debug) deps.logger.debug(`[abort]   → aborted turnId=${m.turnId}`)
        }
      }
      const abortedFiltered = filtered.filter((m: any) => {
        if (m.turnId && abortedTurnIds.has(m.turnId)) {
          if (deps.logger?.debug) deps.logger.debug(`[abort]   → filtered out: id=${m.id?.substring(0,20)} role=${m.role} turnId=${m.turnId}`)
          return false
        }
        if (m.role === 'assistant' && (m as any).stopReason === 'aborted') return false
        return true
      })
      if (deps.logger?.debug) deps.logger.debug(`[abort] buildContext: filtered ${abortedFiltered.length}/${filtered.length} msgs (${messages.length} total)`)

      return buildRuntimeContext({ session, messages: abortedFiltered, tools: [] })
    },
    requestModel: async (request) => {
      const adapter = deps.registries.models.get(request.model)
      if (!adapter) {
        const err: RuntimeError = { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: `模型 "${request.model}" 未注册` }
        throw err
      }
      return adapter.request(request)
    },
    streamModel: (request) => {
      const adapter = deps.registries.models.get(request.model)
      if (!adapter) {
        throw { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: `模型 "${request.model}" 未注册` } as RuntimeError
      }
      if (!('stream' in adapter)) {
        throw { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: `Adapter "${request.model}" 不支持流式` } as RuntimeError
      }
      return (adapter as any).stream(request) as AsyncIterable<ModelStreamEvent>
    },
    resolveTools: async () => {
      const tools: ToolDefinition[] = []
      for (const { value: provider } of deps.registries.tools.list()) {
        const defs = await provider.listTools()
        tools.push(...defs)
      }
      return tools
    },
    resolveTool: async (name: string) => {
      for (const { value: provider } of deps.registries.tools.list()) {
        const handler = await provider.getTool(name)
        if (handler) return handler
      }
      return undefined
    },
    adapterContext: {
      logger: deps.logger,
      session: session,
      requestUserInput: deps.requestUserInput,
    },
  }

  const modelName = promptOptions?.model ?? getFirstModel(deps.registries.models)
  const toolModel = promptOptions?.toolModel ?? modelName
  const compressionThreshold = promptOptions?.compressionThreshold
  const compressionKeepTokens = promptOptions?.compressionKeepTokens
  // prompt 级别的 thinkingLevel 覆盖 session.metadata
  const thinkingLevel = promptOptions?.thinkingLevel
  if (thinkingLevel) {
    const updatedMeta = { ...session.metadata, thinkingLevel }
    session = { ...session, metadata: updatedMeta }
    deps.sessions.update(session)
  }
  const mode = promptOptions?.mode
  if (mode && session.metadata?.mode !== mode) {
    if (!session.metadata) session = { ...session, metadata: {} }
    ;(session as any).metadata!.mode = mode
    // plan 模式附加系统提示
    if (mode === 'plan') {
      const { PLAN_MODE_SYSTEM_PROMPT } = await import('./planModePrompt')
      const existing = (session as any).metadata!.system ?? ''
      const planPrompt = existing
        ? `${existing}\n\n${PLAN_MODE_SYSTEM_PROMPT}`
        : PLAN_MODE_SYSTEM_PROMPT
      ;(session as any).metadata!.system = planPrompt
    }
    deps.sessions.update(session)
  }
  const inputText = typeof input === 'string' ? input : (input as any)?.text
  deps.traceCollector?.note(`prompt — ${JSON.stringify(inputText ?? input)}`)

  // 创建当前 turn 的 AbortController，供 abortCurrentTurn 中止
  // 如果已由调用方传入 signal（如 transport 层创建的），则直接复用
  const turnSignal = promptOptions?.signal ?? (() => {
    const ctrl = new AbortController()
    deps.currentAbortController = ctrl
    return ctrl.signal
  })()

  const result = await runTurn(input, session, runtime, turnDeps, modelName, toolModel, compressionThreshold, compressionKeepTokens, turnSignal)

  deps.currentAbortController = undefined
  // 持久化 turn 结束后 session 的变更（如 tool 对 todos 的修改）
  deps.sessions.update(result.session)

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
  sessionId?: string,
): Promise<Session> {
  const pipeline = deps.registries.sessionPipelines.get(DEFAULT_PIPELINE_NAME)
  if (pipeline) {
    return pipeline.createSession(input, sessionId as any)
  }

  await deps.hooks.run(HOOKS.SESSION_BEFORE_START, { session: { id: '', createdAt: 0, updatedAt: 0 }, input }, { runtime })
  const session = await deps.sessions.create(input, sessionId)
  deps.traceCollector?.note(`createSession — ${session.id}`)
  // 持久化新 session 到磁盘，使 listSessions 立即可见
  const storages = deps.registries.storages.list()
  const storage = storages[0]?.value
  if (storage) await storage.updateSession(session)
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
    abortCurrentTurn: () => deps.currentAbortController?.abort(),
    createSession: (input, sessionId) => handleCreateSession(deps, runtime, input, sessionId),
    stopSession: (sessionId, messages) => handleStopSession(deps, runtime, sessionId, messages),
    getSession: async (sessionId) => {
      const mem = deps.sessions.get(sessionId)
      if (mem) return mem
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      if (storage) return storage.getSession(sessionId)
      return undefined
    },
    updateSession: async (session) => {
      deps.sessions.update(session)
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      if (storage) await storage.updateSession(session)
    },
    listSessions: async () => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      return storage ? storage.listSessions() : []
    },
    deleteSession: async (sessionId) => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      if (storage) await storage.deleteSession(sessionId)
      deps.sessions.delete(sessionId)
      // 清理该 session 的所有检查点
      await deps.checkpointManager?.clearAll(sessionId)
    },
    truncateMessages: async (sessionId, count) => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      if (storage?.truncateMessages) await storage.truncateMessages(sessionId, count)
    },
    appendMessage: async (sessionId, message) => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      if (storage) await storage.appendMessage(sessionId, message)
    },
    getCheckpointManager: () => options?.checkpointManager,
    registerTool(tool: ToolDefinition & { execute: ToolHandler['execute'] }) {
      const provider: ToolProvider = {
        name: `builtin:${tool.name}`,
        listTools() {
          return [{ name: tool.name, description: tool.description, inputSchema: tool.inputSchema, safetyLevel: tool.safetyLevel }]
        },
        getTool(name: string) {
          if (name !== tool.name) return undefined
          return { definition: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema, safetyLevel: tool.safetyLevel }, execute: tool.execute }
        },
      }
      return deps.registries.tools.register(provider.name, provider)
    },
    listMessages: async (sessionId) => {
      const storages = deps.registries.storages.list()
      const storage = storages[0]?.value
      return storage ? storage.listMessages(sessionId) : []
    },
    callModel: async (messages, opts) => {
      const models = deps.registries.models.list()
      const modelName = opts?.model ?? models[0]?.name
      if (!modelName) throw new Error('No model available')
      // 优先用 provider:modelName 查找，防止同名模型冲突
      let adapter = opts?.provider
        ? deps.registries.models.get(`${opts.provider}:${modelName}`)
        : deps.registries.models.get(modelName)
      // 惰性注册：模型不存在时通过回调动态创建
      if (!adapter && options?.onModelNotFound) {
        const newAdapter = await options.onModelNotFound(modelName, opts?.provider)
        if (newAdapter) {
          adapter = newAdapter
          if (opts?.provider) deps.registries.models.register(`${opts.provider}:${modelName}`, newAdapter)
          deps.registries.models.register(modelName, newAdapter)
          // 注册 thinking levels（自定义 provider 需要）
          if (opts?.provider && deps.registries.thinkingLevels) {
            const levels = getSupportedThinkingLevels(opts.provider, modelName)
            deps.registries.thinkingLevels.register(opts.provider, levels)
          }
        }
      }
      if (!adapter) throw new Error(`Model "${modelName}" not found`)

      const context: any = {
        messages: messages.map((m) => ({
          role: m.role,
          parts: [{ type: 'text' as const, text: m.content }],
        })),
        tools: [],
        settings: {
          temperature: opts?.temperature ?? 0.3,
          maxTokens: opts?.maxTokens ?? 100,
          providerSpecific: opts?.utility ? { mode: 'utility' } : undefined,
        },
      }

      if (opts?.system) {
        context.messages.unshift({
          role: 'system',
          parts: [{ type: 'text' as const, text: opts.system }],
        })
      }

      const res = await adapter.request({
        sessionId: '',
        turnId: '',
        model: modelName,
        context,
        settings: context.settings,
      })
      const text = res.message.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
      return text
    },
    loadExtension: (ext) => handleLoadExtension(deps, runtime, loadedExtensions, options, ext),
    unloadExtension: (name) => handleUnloadExtension(deps, loadedExtensions, name),
    dispose: () => handleDispose(deps, loadedExtensions, runtimeId),
  }

  // 注册内置工具
  const todoHandler = createTodoWriteTool()
  runtime.registerTool({ ...todoHandler.definition, execute: todoHandler.execute })

  // 初始引导使用 tracked registries，扩展注册的资源可被批量清理
  const bootstrapDisposables = new Set<Disposable>()
  const bootstrapRegistry = createTrackedRegistries(deps.registries, bootstrapDisposables)
  const bootstrapCtx = createExtensionContext(deps, runtime, bootstrapDisposables, bootstrapRegistry)

  await deps.events.emit(EVENTS.RUNTIME_STARTED, { runtimeId })
  await bootstrapRuntimeExtensions(options?.extensions, [], bootstrapCtx, options?.allowFullAccessExtensions ?? false)

  return runtime
}
