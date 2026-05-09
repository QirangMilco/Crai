/**
 * runtime 内部基础设施工厂函数。
 * 每个函数创建独立的实例，便于后续替换为持久化或分布式版本。
 */
import type {
  EventMap,
  Logger,
  ModelMiddleware,
  ModelRequest,
  ModelResponse,
  RuntimeRegistries,
  SettingsStore,
} from '@crai/core'
import { BUS_SKIP, BusNoHandlerError } from '@crai/core'

// ── Trace 辅助 ────────────────────────────────────

/** trace 回调类型。 */
export type TraceFn = {
  /** handler 注册时调用。 */
  register(opts: { kind: 'event' | 'hook'; name: string; source: string }): void
  /** handler 执行前调用。 */
  execute(opts: {
    kind: 'event' | 'hook'
    name: string
    /** 触发这次 emit/run 的源代码位置。 */
    triggeredBy: string
    handlers: Array<{ source: string }>
  }): void
}

/** 调用方源代码位置（file:line:col）。跳过内部内部框架。 */
function callerLocation(): string {
  const lines = new Error().stack?.split('\n') ?? []
  for (const line of lines) {
    if (line.includes('bus.ts') || line.includes('createRuntime.ts') || line.includes('bootstrap.ts')) continue
    if (line.includes('callerLocation')) continue
    if (line.includes('node_modules') || line.includes('at new ')) continue
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'Error') continue
    return trimmed
  }
  return '(unknown)'
}

/** emit 或 hook.run 的来源（触发位置）。显示调用栈中紧挨着 bus 框架之外的帧。 */
function triggerSource(): string {
  const lines = new Error().stack?.split('\n') ?? []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'Error' || trimmed.includes('triggerSource') || trimmed.includes('bus.ts')) continue
    return trimmed
  }
  return '(unknown)'
}
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
} from '@crai/core'

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

export function createEventBus(trace?: TraceFn): EventBus<EventMap> {
  /** 普通事件 listener，附带注册源位置。 */
  const listeners = new Map<string, Array<{ listener: (event: any) => void | Promise<void>; source: string }>>()
  /** request / handle 专用的 handler 链，附带注册源位置。 */
  const requestHandlers = new Map<string, Array<{ handler: (payload: unknown) => Promise<unknown>; source: string }>>()

  return {
    async emit(type, payload) {
      const event = { id: `evt_${Date.now()}`, type, timestamp: Date.now(), payload }
      const list = listeners.get(type) ?? []
      trace?.execute({ kind: 'event', name: type, triggeredBy: triggerSource(), handlers: list.map(h => ({ source: h.source })) })
      for (const { listener } of list) {
        await listener(event)
      }
    },
    on(type, listener) {
      const key = type as string
      const source = callerLocation()
      trace?.register({ kind: 'event', name: key, source })
      const list = listeners.get(key) ?? []
      list.push({ listener, source })
      listeners.set(key, list)
      return createDisposable(() => {
        const next = (listeners.get(key) ?? []).filter((item) => item.listener !== listener)
        listeners.set(key, next)
      })
    },
    /** 请求-响应模式：按注册顺序调用 handler，返回第一个非 SKIP 的值。 */
    async request(type, payload) {
      const list = requestHandlers.get(type)
      if (!list || list.length === 0) {
        throw new BusNoHandlerError(type)
      }
      trace?.execute({ kind: 'event', name: `request:${type}`, triggeredBy: triggerSource(), handlers: list.map(h => ({ source: h.source })) })
      for (const { handler } of list) {
        const result = await handler(payload)
        if (result !== BUS_SKIP) {
          return result
        }
      }
      throw new BusNoHandlerError(type)
    },
    /** 注册请求处理器。 */
    handle(type, handler) {
      const key = type
      const source = callerLocation()
      trace?.register({ kind: 'event', name: `request:${key}`, source })
      const list = requestHandlers.get(key) ?? []
      list.push({ handler, source })
      requestHandlers.set(key, list)
      return createDisposable(() => {
        const next = (requestHandlers.get(key) ?? []).filter((h) => h.handler !== handler)
        requestHandlers.set(key, next)
      })
    },
    /** 检查是否有注册的 handler。 */
    hasHandler(type) {
      const list = requestHandlers.get(type)
      return !!list && list.length > 0
    },
  }
}

export function createHookBus(trace?: TraceFn): HookBus<HookMap> {
  const handlers = new Map<keyof HookMap & string, Array<{ priority: number; handler: HookHandler<any>; source: string }>>()
  return {
    on(key, handler, options) {
      const source = callerLocation()
      trace?.register({ kind: 'hook', name: key, source })
      const list = handlers.get(key) ?? []
      list.push({ priority: options?.priority ?? 0, handler, source })
      list.sort((a, b) => a.priority - b.priority)
      handlers.set(key, list)
      return createDisposable(() => {
        const next = (handlers.get(key) ?? []).filter((item) => item.handler !== handler)
        handlers.set(key, next)
      })
    },
    async run(key, value, ctx) {
      const list = handlers.get(key) ?? []
      trace?.execute({ kind: 'hook', name: key, triggeredBy: triggerSource(), handlers: list.map(h => ({ source: h.source })) })
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

/** 模型中间件存储：维护注册的中间件列表并支持批量清理。 */
export function createModelMiddlewareStore() {
  const middlewares: ModelMiddleware[] = []

  return {
    register(mw: ModelMiddleware): Disposable {
      middlewares.push(mw)
      return createDisposable(() => {
        const idx = middlewares.indexOf(mw)
        if (idx >= 0) middlewares.splice(idx, 1)
      })
    },
    /** 应用所有中间件到模型调用。按注册顺序执行 before → 原始调用 → after。 */
    async apply(input: ModelRequest, next: (input: ModelRequest) => Promise<ModelResponse>): Promise<ModelResponse> {
      // 1. before 链（正序）
      let current = input
      for (const mw of middlewares) {
        if (mw.before) current = await mw.before(current)
      }

      // 2. 构造 wrap 链：从右向左嵌套，最内层调用 next
      let chain: (input: ModelRequest) => Promise<ModelResponse> = next
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const mw = middlewares[i]
        if (mw.wrap) {
          const inner = chain
          chain = (input) => mw.wrap!(input, inner)
        }
      }

      // 3. 执行 wrap 链（或直接 next）
      let result = await chain(current)

      // 4. after 链（逆序）
      for (let i = middlewares.length - 1; i >= 0; i--) {
        if (middlewares[i].after) result = await middlewares[i].after!(result)
      }

      return result
    },
    list() {
      return [...middlewares]
    },
  }
}

export type ModelMiddlewareStore = ReturnType<typeof createModelMiddlewareStore>
