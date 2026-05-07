import type { Logger, ModelAdapter, PromptOptions, PromptResult, Registry, RuntimeError, RuntimeHandle, RuntimeInput, Session, StorageAdapter, ToolDefinition } from '../../core/src'
import type {
  CacheAdapter,
  CommandRegistry,
  EventBus,
  Extension,
  ExtensionContext,
  HookBus,
  HookMap,
  PermissionAdapter,
  RuntimeRegistries,
  SettingsStore,
} from '../../core/src'
import { EVENTS, ERROR_CODES, HOOKS } from '../../core/src'
import {
  createCommandRegistry,
  createDefaultLogger,
  createEventBus,
  createHookBus,
  createRuntimeRegistries,
  createSettingsStore,
} from './bus'
import { bootstrapRuntimeExtensions, setupExtension } from './bootstrap'
import { buildRuntimeContext } from './contextBuilder'
import { runTurn, TurnRunnerDeps } from './turnRunner'
import { SessionManager } from './sessionManager'

/** 创建 runtime 时的可选注入项。kernel 不内置任何 adapter 默认实现。 */
export interface RuntimeOptions {
  storage?: StorageAdapter
  cache?: CacheAdapter
  permission?: PermissionAdapter
  extensions?: Array<Extension | string>
  logger?: Logger
}

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
}

function createDeps(options?: RuntimeOptions): RuntimeDeps {
  const logger = options?.logger ?? createDefaultLogger()
  const hooks = createHookBus()
  const events = createEventBus()
  const registries = createRuntimeRegistries()
  const commands = createCommandRegistry()
  const settings = createSettingsStore()
  const sessions = new SessionManager()

  return { hooks, events, registries, commands, settings, logger, sessions, storage: options?.storage }
}

function getFirstModel(models: Registry<ModelAdapter>): string | undefined {
  const list = models.list()
  return list.find(m => m.name !== 'placeholder-model')?.name ?? list[0]?.name
}

/**
 * 创建 runtime 实例并完成扩展引导。
 * kernel 本身是纯调度器，所有默认行为（模型、持久化等）都在 preset extensions 中提供。
 */
export async function createRuntime(options?: RuntimeOptions): Promise<RuntimeHandle> {
  const deps = createDeps(options)
  const runtimeId = `runtime_${Date.now()}`
  const loadedExtensions = new Set<Extension>()

  if (options?.storage) {
    deps.registries.storages.register('builtin:storage', options.storage)
  }

  const runtime: RuntimeHandle = {
    id: runtimeId,
    async prompt(input: RuntimeInput, promptOptions?: PromptOptions): Promise<PromptResult> {
      const pipeline = deps.registries.promptPipelines.get('default')
      if (pipeline) {
        return pipeline.run(input, promptOptions)
      }

      let session: Session
      if (promptOptions?.sessionId) {
        const existing = deps.sessions.get(promptOptions.sessionId)
        session = existing ?? await runtime.createSession(promptOptions.metadata)
      } else {
        session = await runtime.createSession(promptOptions?.metadata)
      }

      const turnDeps: TurnRunnerDeps = {
        hooks: deps.hooks,
        emitEvent: deps.events.emit,
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
      const result = await runTurn(input, session, runtime, turnDeps, modelName)

      return {
        session: result.session,
        turnId: result.turnId,
        messages: result.messages,
        response: result.response,
      }
    },
    async createSession(input) {
      await deps.hooks.run(HOOKS.SESSION_BEFORE_START, { session: { id: '', createdAt: 0, updatedAt: 0 }, input }, { runtime })
      const session = await deps.sessions.create(input)
      await deps.events.emit(EVENTS.SESSION_CREATED, { session })
      return session
    },
    async stopSession(sessionId, messages) {
      const session = deps.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} 不存在`)
      }
      session.updatedAt = Date.now()
      await deps.sessions.update(session)
      await deps.hooks.run(HOOKS.SESSION_AFTER_STOP, { session, messages: messages ?? [] }, { runtime })
      await deps.events.emit(EVENTS.SESSION_UPDATED, { session })
    },
    async getSession(sessionId) {
      return deps.sessions.get(sessionId)
    },
    async listMessages(_sessionId) {
      return []
    },
    async loadExtension(source) {
      const { loadExtension: loadFromFile } = await import('../../loader-ts/src/index')
      const ext = await loadFromFile(source)
      const ctx: ExtensionContext = {
        runtime,
        hooks: deps.hooks,
        events: deps.events,
        registry: deps.registries,
        logger: deps.logger,
      }
      await setupExtension(ext, ctx)
      loadedExtensions.add(ext)
      await deps.events.emit(EVENTS.EXTENSION_LOADED, { name: ext.name })
    },
    async unloadExtension(name) {
      for (const ext of loadedExtensions) {
        if (ext.name === name) {
          await ext.dispose?.()
          loadedExtensions.delete(ext)
          await deps.events.emit(EVENTS.EXTENSION_UNLOADED, { name })
          return
        }
      }
    },
    async dispose() {
      for (const ext of loadedExtensions) {
        await ext.dispose?.()
      }
      loadedExtensions.clear()
      await deps.events.emit(EVENTS.RUNTIME_STOPPED, { runtimeId })
    },
  }

  const extensionContext: ExtensionContext = {
    runtime,
    hooks: deps.hooks,
    events: deps.events,
    registry: deps.registries,
    logger: deps.logger,
  }

  await deps.events.emit(EVENTS.RUNTIME_STARTED, { runtimeId })
  await bootstrapRuntimeExtensions(options?.extensions, [], extensionContext)

  return runtime
}
