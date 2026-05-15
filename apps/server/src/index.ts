/**
 * @crai/server — Crai server entry point.
 *
 * - 多工作区并行：每个工作区有独立 runtime，切换即时生效
 * - 通过 Web 界面添加/删除 provider 后自动同步
 * - 从配置文件读取配，无需环境变量
 */
import { createRuntime } from '@crai/runtime'
import type { RuntimeHandle } from '@crai/core'
import { createOpenAIProvider, createDeepSeekProvider, listModels } from '@crai/provider'
import { ConsoleLogger } from '@crai/base'
import { createFileStorage } from '@crai/storage-fs'
import { createPersistenceExtension } from '@crai/persistence'
import { createWorkspaceSecurity } from '@crai/security'
import { createFsTools } from '@crai/tools-fs'
import { createShellTools, processManager } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createWsTransport } from '@crai/transport-ws'
import type { AppVariant } from '@crai/core'
import { ConfigManager } from '@crai/config'
import { EVENTS } from '@crai/core'
import type { Extension } from '@crai/core'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const VARIANT = process.env.CRAI_VARIANT ?? 'dev'

async function loadVariant(): Promise<AppVariant> {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  return JSON.parse(await readFile(resolve(__dirname, '..', 'variants', `${VARIANT}.json`), 'utf-8'))
}

// ── 事件转发 Extension ──

function createEventForwarder(wsId: string, f: (wsId: string, evt: string, payload: unknown) => void): Extension {
  return {
    name: `ws:${wsId}:evt`,
    setup(ctx) {
      const keys = Object.keys(EVENTS) as Array<keyof typeof EVENTS>
      for (const key of keys) {
        const name = EVENTS[key]
        ctx.events.on(name, (event: any) => f(wsId, name, event?.payload ?? event))
      }
    },
  }
}

// ── Workspace 管理器 ──

class WorkspaceManager {
  private runtimes = new Map<string, RuntimeHandle>()
  private config: ConfigManager
  private onEvent: (wsId: string, evt: string, payload: unknown) => void
  private log: ConsoleLogger

  constructor(config: ConfigManager, onEvent: (wsId: string, evt: string, payload: unknown) => void, log: ConsoleLogger) {
    this.config = config
    this.onEvent = onEvent
    this.log = log
  }

  async ensure(rootDir: string): Promise<void> {
    if (this.runtimes.has(rootDir)) return
    const eff = this.config.getEffectiveConfig(this.config.getGlobal(), await this.config.loadWorkspace(rootDir))
    if (!eff.apiKey) {
      // 没有 API key 时也会记录到 recentWorkspaces
      await this.config.addRecentWorkspace(rootDir)
      this.log.info(`workspace 已记录: ${rootDir}（无 API key）`)
      return
    }
    const dataDir = this.config.workspaceDataDir(rootDir)
    const provider = eff.provider === 'deepseek'
      ? createDeepSeekProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined, logger: this.log })
      : createOpenAIProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined, logger: this.log })
    const runtime = await createRuntime({
      logger: this.log,
      extensions: [
        provider,
        createFileStorage({ baseDir: dataDir }),
        createPersistenceExtension(),
        createFsTools({ rootDir, snapshotsDir: resolve(dataDir, 'snapshots') }),
        createShellTools({ rootDir }),
        createWebTools(),
        createWorkspaceSecurity({ rootDir, mode: 'ask', askHandler: async () => true }),
        createEventForwarder(rootDir, this.onEvent),
      ],
    })
    this.runtimes.set(rootDir, runtime)
    await this.config.addRecentWorkspace(rootDir)
    this.log.info(`workspace 已启动: ${rootDir} (${eff.provider}/${eff.model})`)
  }

  /** 获取已启动的 runtime，不存在时返回 undefined。 */
  getRuntime(rootDir: string): RuntimeHandle | undefined {
    return this.runtimes.get(rootDir)
  }

  async stop(rootDir: string): Promise<void> {
    const rt = this.runtimes.get(rootDir)
    if (rt) { await rt.dispose(); this.runtimes.delete(rootDir); this.log.info(`workspace 已停止: ${rootDir}`) }
  }

  async stopAll(): Promise<void> {
    for (const [dir] of this.runtimes) await this.stop(dir)
    processManager.killAll()
  }

  async sync(): Promise<void> {
    const global = this.config.getGlobal()
    for (const [dir, rt] of this.runtimes) {
      if (!this.config.getEffectiveConfig(global, await this.config.loadWorkspace(dir)).apiKey) {
        await rt.dispose(); this.runtimes.delete(dir)
      }
    }
    for (const dir of global.recentWorkspaces) await this.ensure(dir)
  }

  list(): string[] { return Array.from(this.runtimes.keys()) }
}

// ── 入口 ──

let gWorkspaces: WorkspaceManager | undefined

async function main() {
  const variant = await loadVariant()

  // 从变体配置注入调试 scope
  if (variant.debug.scopes?.length) {
    const core = await import('@crai/core')
    core.setDebugScopes(variant.debug.scopes)
    console.log(`[debug] 激活的 scopes: ${variant.debug.scopes.join(', ')}`)
  }

  const config = new ConfigManager(variant)
  await config.loadGlobal()

  const logDir = join(homedir(), variant.configDirName, variant.debug.logDir ?? 'logs')
  const log = new ConsoleLogger({
    tag: 'server',
    level: variant.debug.logLevel ?? 'info',
    logDir,
    maxFileSize: variant.debug.maxFileSize,
    maxBackups: variant.debug.maxBackups,
  })

  const transport = createWsTransport({
    port: variant.server.defaultPort,
    logger: log,
    handlers: {
      onConfigGet: () => config.getGlobal(),
      onConfigSet: (cfg) => { Object.assign(config.getGlobal(), cfg); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigSetProvider: (name, cfg) => { config.setProvider(name, cfg); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigRemoveProvider: (name) => { config.removeProvider(name); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigFetchModels: async (providerName) => {
        const global = config.getGlobal()
        const p = global.providers[providerName]
        if (!p) return { models: [], error: `Provider "${providerName}" 不存在` }
        log.info(`正在获取 ${providerName} 的模型列表...`)
        const result = await listModels(p.apiKey, p.baseURL, p.modelsPath)
        if (result.error) {
          log.warn(`获取模型列表失败: ${result.error}`)
        } else {
          log.info(`获取到 ${result.models.length} 个模型`)
        }
        return result
      },
      onWorkspaceList: async () => {
        const active = new Set(gWorkspaces?.list() ?? [])
        const all = [...new Set([...active, ...(config.getGlobal().recentWorkspaces ?? [])])]
        return all.map(r => ({ rootDir: r, config: {} as any }))
      },
      onWorkspaceSwitch: async (dir) => {
        await gWorkspaces?.ensure(dir)
        const eff = config.getEffectiveConfig(config.getGlobal(), await config.loadWorkspace(dir))
        return { model: eff.model, provider: eff.provider }
      },
      onWorkspaceConfigGet: async (rootDir) => config.loadWorkspace(rootDir || process.cwd()),
      onWorkspaceConfigSet: async (rootDir, cfg) => { await config.saveWorkspace(rootDir || process.cwd(), cfg); gWorkspaces?.sync() },
    },
    getRuntime: (rootDir) => {
      if (rootDir) return gWorkspaces?.getRuntime(rootDir)
      // 未指定工作区时返回第一个活跃 runtime
      const first = gWorkspaces?.list()[0]
      return first ? gWorkspaces?.getRuntime(first) : undefined
    },
  })

  gWorkspaces = new WorkspaceManager(config, (wsId, evt, payload) => {
    transport.publishEvent(wsId, evt, payload)
  }, log)
  await gWorkspaces.sync()

  const { url } = await transport.start()
  console.log(`\n  Crai server (${VARIANT}) 已启动`)
  console.log(`  Web UI:  http://localhost:5173`)
  console.log(`  WS:      ${url}`)
  console.log(`  Workspaces: ${gWorkspaces.list().length}`)
  console.log(`  数据:    ~/${variant.configDirName}\n`)
}

process.on('SIGINT', async () => {
  console.log('\n正在关闭…')
  await gWorkspaces?.stopAll()
  process.exit(0)
})

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
