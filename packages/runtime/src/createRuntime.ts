import type { Logger, PromptOptions, PromptResult, RuntimeHandle, RuntimeInput, StorageAdapter } from '../../core/src'
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
import {
  createCommandRegistry,
  createDefaultLogger,
  createEventBus,
  createHookBus,
  createRuntimeRegistries,
  createSettingsStore,
} from './bus'
import { bootstrapRuntimeExtensions } from './bootstrap'
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
}

function createDeps(options?: RuntimeOptions): RuntimeDeps {
  const logger = options?.logger ?? createDefaultLogger()
  const hooks = createHookBus()
  const events = createEventBus()
  const registries = createRuntimeRegistries()
  const commands = createCommandRegistry()
  const settings = createSettingsStore()
  const sessions = new SessionManager()

  return { hooks, events, registries, commands, settings, logger, sessions }
}

/**
 * 创建 runtime 实例并完成扩展引导。
 * kernel 本身是纯调度器，所有默认行为（模型、持久化等）都在 preset extensions 中提供。
 */
export async function createRuntime(options?: RuntimeOptions): Promise<RuntimeHandle> {
  const deps = createDeps(options)
  const runtimeId = `runtime_${Date.now()}`

  const runtime: RuntimeHandle = {
    id: runtimeId,
    async prompt(input: RuntimeInput, promptOptions?: PromptOptions): Promise<PromptResult> {
      const pipeline = deps.registries.promptPipelines.get('default')
      if (!pipeline) {
        throw new Error('没有可用的 prompt pipeline，请先加载 preset 或注册默认流水线')
      }
      return pipeline.run(input, promptOptions)
    },
    async createSession(input) {
      await deps.hooks.run('session:beforeStart', { session: { id: '', createdAt: 0, updatedAt: 0 }, input }, { runtime })
      const session = await deps.sessions.create(input)
      await deps.events.emit('session.created', { session })
      return session
    },
    async stopSession(sessionId, messages) {
      const session = deps.sessions.get(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} 不存在`)
      }
      session.updatedAt = Date.now()
      await deps.sessions.update(session)
      await deps.hooks.run('session:afterStop', { session, messages: messages ?? [] }, { runtime })
      await deps.events.emit('session.updated', { session })
    },
    async getSession(sessionId) {
      return deps.sessions.get(sessionId)
    },
    async listMessages(_sessionId) {
      return []
    },
    async loadExtension(source) {
      void source
    },
    async unloadExtension(name) {
      void name
    },
    async dispose() {
      await deps.events.emit('runtime.stopped', { runtimeId })
    },
  }

  const extensionContext: ExtensionContext = {
    runtime,
    hooks: deps.hooks,
    events: deps.events,
    registry: deps.registries,
    logger: deps.logger,
  }

  await deps.events.emit('runtime.started', { runtimeId })
  await bootstrapRuntimeExtensions(options?.extensions, [], extensionContext)

  return runtime
}
