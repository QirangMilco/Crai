/**
 * @crai/server — Crai server entry point.
 *
 * - 多工作区并行：每个工作区有独立 runtime，切换即时生效
 * - 通过 Web 界面添加/删除 provider 后自动同步
 * - 从配置文件读取配，无需环境变量
 */
import { createRuntime, type RuntimeHandle } from '@crai/runtime'
import { createOpenAIProvider, createDeepSeekProvider } from '@crai/provider'
import { createFileStorage } from '@crai/storage-fs'
import { createPersistenceExtension } from '@crai/persistence'
import { createWorkspaceSecurity } from '@crai/security'
import { createFsTools } from '@crai/tools-fs'
import { createShellTools, processManager } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createWsTransport } from '@crai/transport-ws'
import { ConfigManager, type AppVariant } from '@crai/config'
import { EVENTS } from '@crai/core'
import type { Extension } from '@crai/core'
import { resolve } from 'node:path'
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

  constructor(config: ConfigManager, onEvent: (wsId: string, evt: string, payload: unknown) => void) {
    this.config = config
    this.onEvent = onEvent
  }

  async ensure(rootDir: string): Promise<void> {
    if (this.runtimes.has(rootDir)) return
    const eff = this.config.getEffectiveConfig(this.config.getGlobal(), await this.config.loadWorkspace(rootDir))
    if (!eff.apiKey) {
      // 没有 API key 时也会记录到 recentWorkspaces
      await this.config.addRecentWorkspace(rootDir)
      console.log(`[server] workspace 已记录: ${rootDir}（无 API key，尚未启动 runtime）`)
      return
    }
    const dataDir = this.config.workspaceDataDir(rootDir)
    const provider = eff.provider === 'deepseek'
      ? createDeepSeekProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined })
      : createOpenAIProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined })
    const runtime = await createRuntime({
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
    console.log(`[server] workspace 已启动: ${rootDir} (${eff.provider}/${eff.model})`)
  }

  /** 获取已启动的 runtime，不存在时返回 undefined。 */
  getRuntime(rootDir: string): RuntimeHandle | undefined {
    return this.runtimes.get(rootDir)
  }

  async stop(rootDir: string): Promise<void> {
    const rt = this.runtimes.get(rootDir)
    if (rt) { await rt.dispose(); this.runtimes.delete(rootDir); console.log(`[server] workspace 已停止: ${rootDir}`) }
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
    if (this.runtimes.size === 0) await this.ensure(process.cwd())
  }

  list(): string[] { return Array.from(this.runtimes.keys()) }
}

// ── 入口 ──

let gWorkspaces: WorkspaceManager | undefined

async function main() {
  const variant = await loadVariant()
  const config = new ConfigManager(variant)
  await config.loadGlobal()

  const transport = createWsTransport({
    port: variant.server.defaultPort,
    handlers: {
      onConfigGet: () => config.getGlobal(),
      onConfigSet: (cfg) => { Object.assign(config.getGlobal(), cfg); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigSetProvider: (name, cfg) => { config.setProvider(name, cfg); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigRemoveProvider: (name) => { config.removeProvider(name); config.saveGlobal(); gWorkspaces?.sync() },
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
      onWorkspaceConfigGet: async () => config.loadWorkspace(process.cwd()),
      onWorkspaceConfigSet: async (cfg) => { await config.saveWorkspace(process.cwd(), cfg); gWorkspaces?.sync() },
    },
    getRuntime: (rootDir) => gWorkspaces?.getRuntime(rootDir),
  })

  gWorkspaces = new WorkspaceManager(config, (wsId, evt, payload) => {
    transport.publishEvent(wsId, evt, payload)
  })
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
