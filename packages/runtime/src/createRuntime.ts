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

export interface RuntimeOptions {
  storage?: StorageAdapter
  cache?: CacheAdapter
  permission?: PermissionAdapter
  extensions?: Array<Extension | string>
  logger?: Logger
}

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
      const session = await deps.sessions.create(input)
      await deps.events.emit('session.created', { session })
      return session
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
