/**
 * Runtime 工厂：组装最小可运行内核。
 *
 * 启动流程：创建依赖 → 组装 RuntimeHandle → 发射 runtime.started → 引导扩展。
 * prompt 委托给注册表中名为 'default' 的 PromptPipeline，由 preset 扩展提供。
 */
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

/** 运行时创建选项，与 spec §11 RuntimeOptions 对齐。 */
export interface RuntimeOptions {
  storage?: StorageAdapter
  cache?: CacheAdapter
  permission?: PermissionAdapter
  extensions?: Array<Extension | string>
  logger?: Logger
}

/** 运行时内部依赖容器，不对外暴露。 */
interface RuntimeDeps {
  hooks: HookBus<HookMap>
  events: EventBus<any>
  registries: RuntimeRegistries
  commands: CommandRegistry
  settings: SettingsStore
  logger: Logger
  sessions: SessionManager
}

/** 初始化所有内部依赖，均使用内存实现，保证 hollow-by-default。 */
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
      // 委托给 preset 注册的 'default' pipeline；未加载 preset 时会抛错
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
      // TODO: 委托 StorageAdapter 读取，当前为 stub
      return []
    },
    async loadExtension(source) {
      // TODO: 支持 string 类型动态加载，当前仅接受 Extension 对象
      void source
    },
    async unloadExtension(name) {
      // TODO: 调用 extension.dispose() 并清理注册表，当前为 stub
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

  // 先发射 started，再引导扩展；扩展 setup 中可监听后续事件
  await deps.events.emit('runtime.started', { runtimeId })
  await bootstrapRuntimeExtensions(options?.extensions, [], extensionContext)

  return runtime
}
