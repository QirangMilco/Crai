/**
 * runtime 内部基础设施工厂函数。
 * 每个函数创建独立的实例，便于后续替换为持久化或分布式版本。
 */
import type {
  EventMap,
  Logger,
  RuntimeRegistries,
  SettingsStore,
} from '../../core/src'
import type {
  CacheAdapter,
  Command,
  CommandRegistry,
  Disposable,
  EventBus,
  HookBus,
  HookHandler,
  HookMap,
  I18nAdapter,
  MemoryAdapter,
  ModelAdapter,
  PermissionAdapter,
  PromptPipeline,
  Registry,
  StorageAdapter,
  ToolProvider,
  TransportAdapter,
} from '../../core/src'

export function createDisposable(dispose: () => void | Promise<void>): Disposable {
  return { dispose }
}

/** 包装一个 Registry，拦截 register() 并将返回的 Disposable 记录到 tracker 中。 */
export function createTrackedRegistry<T>(
  inner: Registry<T>,
  tracker: Set<Disposable>,
): Registry<T> {
  return {
    register(name, value) {
      const disposable = inner.register(name, value)
      tracker.add(disposable)
      return createDisposable(() => {
        disposable.dispose()
        tracker.delete(disposable)
      })
    },
    get(name) { return inner.get(name) },
    list() { return inner.list() },
  }
}

/** 包装所有 registries，让扩展注册的资源可被批量清理。 */
export function createTrackedRegistries(
  registries: RuntimeRegistries,
  tracker: Set<Disposable>,
): RuntimeRegistries {
  return {
    models: createTrackedRegistry(registries.models, tracker),
    tools: createTrackedRegistry(registries.tools, tracker),
    storages: createTrackedRegistry(registries.storages, tracker),
    caches: createTrackedRegistry(registries.caches, tracker),
    memories: createTrackedRegistry(registries.memories, tracker),
    permissions: createTrackedRegistry(registries.permissions, tracker),
    transports: createTrackedRegistry(registries.transports, tracker),
    promptPipelines: createTrackedRegistry(registries.promptPipelines, tracker),
    i18n: createTrackedRegistry(registries.i18n, tracker),
  }
}

export function createRegistry<T>(): Registry<T> {
  const map = new Map<string, T>()
  return {
    register(name, value) {
      map.set(name, value)
      return createDisposable(() => {
        map.delete(name)
      })
    },
    get(name) {
      return map.get(name)
    },
    list() {
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
    },
  }
}

export function createRuntimeRegistries(): RuntimeRegistries {
  return {
    models: createRegistry<ModelAdapter>(),
    tools: createRegistry<ToolProvider>(),
    storages: createRegistry<StorageAdapter>(),
    caches: createRegistry<CacheAdapter>(),
    memories: createRegistry<MemoryAdapter>(),
    permissions: createRegistry<PermissionAdapter>(),
    transports: createRegistry<TransportAdapter>(),
    promptPipelines: createRegistry<PromptPipeline>(),
    i18n: createRegistry<I18nAdapter>(),
  }
}

export function createEventBus(): EventBus<EventMap> {
  const listeners = new Map<keyof EventMap & string, Array<(event: any) => void | Promise<void>>>()
  return {
    async emit(type, payload) {
      const event = { id: `evt_${Date.now()}`, type, timestamp: Date.now(), payload }
      const list = listeners.get(type) ?? []
      for (const listener of list) {
        await listener(event)
      }
    },
    on(type, listener) {
      const list = listeners.get(type) ?? []
      list.push(listener)
      listeners.set(type, list)
      return createDisposable(() => {
        const next = (listeners.get(type) ?? []).filter((item) => item !== listener)
        listeners.set(type, next)
      })
    },
  }
}

export function createHookBus(): HookBus<HookMap> {
  const handlers = new Map<keyof HookMap & string, Array<{ priority: number; handler: HookHandler<any> }>>()
  return {
    on(key, handler, options) {
      const list = handlers.get(key) ?? []
      list.push({ priority: options?.priority ?? 0, handler })
      list.sort((a, b) => a.priority - b.priority)
      handlers.set(key, list)
      return createDisposable(() => {
        const next = (handlers.get(key) ?? []).filter((item) => item.handler !== handler)
        handlers.set(key, next)
      })
    },
    async run(key, value, ctx) {
      const list = handlers.get(key) ?? []
      let current = value
      for (const item of list) {
        const result = await item.handler(current, ctx)
        if (!result) continue
        if ('stop' in result && result.stop) break
        if ('replace' in result) current = result.replace
        if ('patch' in result) {
          current = { ...(current as object), ...(result.patch as object) } as typeof current
        }
      }
      return current
    },
  }
}

export function createSettingsStore(): SettingsStore {
  const map = new Map<string, unknown>()
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async set(key, value) {
      map.set(key, value)
    },
    async delete(key) {
      map.delete(key)
    },
    async list() {
      return Array.from(map.keys()).map((key) => ({ key }))
    },
  }
}

export function createCommandRegistry(): CommandRegistry {
  const map = new Map<string, Command>()
  return {
    register(command) {
      map.set(command.name, command)
      return createDisposable(() => {
        map.delete(command.name)
      })
    },
    get(name) {
      return map.get(name)
    },
    list() {
      return Array.from(map.values())
    },
  }
}

export function createDefaultLogger(): Logger {
  return {
    debug(message, metadata) {
      console.debug(message, metadata)
    },
    info(message, metadata) {
      console.info(message, metadata)
    },
    warn(message, metadata) {
      console.warn(message, metadata)
    },
    error(message, metadata) {
      console.error(message, metadata)
    },
  }
}
