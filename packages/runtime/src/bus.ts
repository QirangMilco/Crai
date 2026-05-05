/**
 * Runtime 基础设施工厂。
 *
 * 提供 EventBus、HookBus、Registry 等核心组件的内存实现，
 * 以及 Logger、SettingsStore、CommandRegistry 等辅助工具。
 * 所有工厂均无外部依赖，保证 runtime 可在无 provider/UI 的条件下启动。
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
  ModelAdapter,
  PermissionAdapter,
  Registry,
  StorageAdapter,
  ToolProvider,
  TransportAdapter,
} from '../../core/src'

export function createDisposable(dispose: () => void | Promise<void>): Disposable {
  return { dispose }
}

/** 通用注册表：register 返回 Disposable 用于扩展卸载时自动清理。 */
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

/** 创建全部适配器注册表，与 RuntimeRegistries 契约一一对应。 */
export function createRuntimeRegistries(): RuntimeRegistries {
  return {
    models: createRegistry<ModelAdapter>(),
    tools: createRegistry<ToolProvider>(),
    storages: createRegistry<StorageAdapter>(),
    caches: createRegistry<CacheAdapter>(),
    permissions: createRegistry<PermissionAdapter>(),
    transports: createRegistry<TransportAdapter>(),
  }
}

/**
 * 内存事件总线实现。
 * 注意：当前 emit 未填充 sessionId，需由调用方在 payload 中携带或后续补全。
 */
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

/**
 * Hook 总线实现。
 * 执行规则（与 spec §5.2 一致）：
 * 1. handler 按 priority 升序执行
 * 2. 每个 handler 接收最新值
 * 3. void / continue → 放行
 * 4. stop → 中断管道
 * 5. replace → 替换当前值
 * 6. patch → 浅合并到当前值
 */
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

/** 内存键值存储，Phase 2 可替换为持久化实现。 */
export function createSettingsStore(): SettingsStore {
  const map = new Map<string, unknown>()
  return {
    async get(key) {
      return map.get(key)
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

/** 命令注册表，Phase 2 完整实现。 */
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

/** 默认日志器，直接输出到 console。生产环境应通过 RuntimeOptions 注入自定义实现。 */
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
