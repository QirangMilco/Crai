/**
 * @crai/server — Crai server entry point.
 *
 * - 多工作区并行：每个工作区有独立 runtime，切换即时生效
 * - 通过 Web 界面添加/删除 provider 后自动同步
 * - 从配置文件读取配，无需环境变量
 */
import { createRuntime } from '@crai/runtime'
import type { RuntimeHandle } from '@crai/core'
import { createOpenAIProvider, createDeepSeekProvider, createMockProvider, listModels, DeepSeekAdapter, OpenAIAdapter } from '@crai/provider'
import { ConsoleLogger, createSandbox } from '@crai/base'
import { createFileStorage } from '@crai/storage-fs'
import { createPersistenceExtension } from '@crai/persistence'
import { createWorkspaceSecurity } from '@crai/security'
import { createFsTools } from '@crai/tools-fs'
import { createShellTools, processManager } from '@crai/tools-shell'
import { createWebTools } from '@crai/tools-web'
import { createWsTransport } from '@crai/transport-ws'
import type { AppVariant } from '@crai/config'
import { ConfigManager } from '@crai/config'
import { EVENTS } from '@crai/core'
import { KNOWN_MODELS } from '@crai/core'
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

// ── 第一方 provider 元数据 ──

const FIRST_PARTY_PROVIDERS: ReadonlyArray<{ name: string; label: string; defaultBaseURL: string }> = [
  { name: 'deepseek', label: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com' },
  { name: 'openai', label: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1' },
]

class WorkspaceManager {
  private runtimes = new Map<string, RuntimeHandle>()
  private config: ConfigManager
  private onEvent: (wsId: string, evt: string, payload: unknown) => void
  private log: ConsoleLogger

  constructor(
    config: ConfigManager,
    onEvent: (wsId: string, evt: string, payload: unknown) => void,
    log: ConsoleLogger,
    private requestUserInput?: (question: string, options?: string[], meta?: Record<string, unknown>) => Promise<string>,
  ) {
    this.config = config
    this.onEvent = onEvent
    this.log = log
  }

  async ensure(rootDir: string): Promise<void> {
    if (this.runtimes.has(rootDir)) return
    const eff = this.config.getEffectiveConfig(this.config.getGlobal(), await this.config.loadWorkspace(rootDir))
    if (!eff.provider) {
      await this.config.addRecentWorkspace(rootDir)
      this.log.info(`workspace 已记录: ${rootDir}（无 provider）`)
      return
    }
    const dataDir = this.config.workspaceDataDir(rootDir)

    this.log.info(`ensure: provider=${eff.provider}, model=${eff.model}, apiKey=${eff.apiKey ? '***' : '(空)'}`)

    // 根据 provider 类型创建对应适配器。Mock 不需要 API key。
    let provider
    if (eff.provider === 'deepseek') {
      provider = createDeepSeekProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined, logger: this.log })
    } else if (eff.provider === 'mock') {
      provider = createMockProvider({ logger: this.log })
    } else {
      provider = createOpenAIProvider({ apiKey: eff.apiKey, baseURL: eff.baseURL, models: eff.model ? [eff.model] : undefined, logger: this.log })
    }

    const runtime = await createRuntime({
      logger: this.log,
      extensions: [
        provider,
        ...(VARIANT === 'dev' ? [createMockProvider({ logger: this.log })] : []),
        // 预注册工具模型对应的 provider（如 workspace 用 mock 但工具模型用 deepseek）
        ...(() => {
          const global = this.config.getGlobal()
          const toolModel = global.toolModel
          if (!toolModel) return []
          const si = toolModel.indexOf('/')
          if (si < 0) return []
          const toolProvider = toolModel.slice(0, si)
          const toolModelName = toolModel.slice(si + 1)
          // 如果工具模型的 provider 与 workspace 主 provider 相同，不需要重复注册
          if (toolProvider === eff.provider) return []
          // 工具模型的 provider 已在全局配置中找到
          const pcfg = global.providers[toolProvider]
          if (!pcfg?.apiKey) return []
          this.log.info(`预注册工具模型: ${toolModel}`)
          if (toolProvider === 'deepseek') {
            return [createDeepSeekProvider({ apiKey: pcfg.apiKey, baseURL: pcfg.baseURL, models: [toolModelName], logger: this.log })]
          }
          return [createOpenAIProvider({ apiKey: pcfg.apiKey, baseURL: pcfg.baseURL, models: [toolModelName], logger: this.log })]
        })(),
        createFileStorage({ baseDir: dataDir }),
        createPersistenceExtension(),
        createFsTools({ rootDir, snapshotsDir: resolve(dataDir, 'snapshots') }),
        createShellTools({
          rootDir,
          sandbox: {
            enabled: () => this.config.getGlobal().sandboxEnabled === true,
            wrap: (cmd, args) => {
              const sb = createSandbox({ rootDir, enabled: true })
              return sb.wrap(cmd, args, rootDir)
            },
          },
        }),
        createWebTools(),
        createWorkspaceSecurity({
          rootDir, mode: 'ask',
          askHandler: this.requestUserInput
            ? async ({ toolName, args, definition, isSensitive, reason }) => {
                try {
                  const answer = await this.requestUserInput!(
                    `是否允许执行该操作？`,
                    ['allow', 'deny'],
                    { toolName, args, safetyLevel: definition.safetyLevel, isSensitive, reason },
                  )
                  return answer === 'allow'
                } catch {
                  return false
                }
              }
            : async () => true,
        }),
        createEventForwarder(rootDir, this.onEvent),
      ],
      onModelNotFound: async (modelName, provider) => {
        if (!provider) return undefined
        const global = this.config.getGlobal()
        const pcfg = global.providers[provider]
        if (!pcfg?.apiKey) return undefined
        this.log.info(`惰性注册模型: ${provider}/${modelName}`)
        // 按 API 格式选择适配器
        const api = (pcfg as any).api || ''
        if (api === 'deepseek' || provider === 'deepseek') {
          return new DeepSeekAdapter({ apiKey: pcfg.apiKey, baseURL: pcfg.baseURL, logger: this.log })
        }
        if (provider === 'mock') {
          return undefined
        }
        return new OpenAIAdapter({ apiKey: pcfg.apiKey, baseURL: pcfg.baseURL, logger: this.log })
      },
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
      if (!this.config.getEffectiveConfig(global, await this.config.loadWorkspace(dir)).provider) {
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

  // 从变体配置注入调试 scope（兼容新旧格式）
  const serverScopes: string[] = Array.isArray(variant.debug.scopes)
    ? variant.debug.scopes
    : (variant.debug.scopes?.server ?? [])
  const clientScopes: string[] = !Array.isArray(variant.debug.scopes)
    ? (variant.debug.scopes?.client ?? [])
    : []

  if (serverScopes.length > 0) {
    const core = await import('@crai/core')
    core.setDebugScopes(serverScopes)
    const available = Object.values(core.DEBUG_SCOPES).join(', ')
    console.log(`[debug] 服务端 scopes: ${serverScopes.join(', ')}`)
    if (clientScopes.length > 0) console.log(`[debug] 客户端 scopes: ${clientScopes.join(', ')}`)
    console.log(`[debug] 全部可用服务端 scope: ${available}`)
  }

  const logDir = join(homedir(), variant.configDirName, variant.debug.logDir ?? 'logs')
  const log = new ConsoleLogger({
    tag: 'server',
    level: variant.debug.logLevel ?? 'info',
    logDir,
    maxFileSize: variant.debug.maxFileSize,
    maxBackups: variant.debug.maxBackups,
  })

  const config = new ConfigManager(variant, log)
  await config.loadGlobal()

  const transport = createWsTransport({
    port: variant.server.defaultPort,
    logger: log,
    handlers: {
      onConfigGet: () => ({ ...config.getGlobal(), debugScopes: clientScopes, variant: VARIANT }),
      onConfigSet: (cfg) => {
        const changed = Object.keys(cfg).join(', ')
        log.info(`配置已更新: ${changed}`)
        Object.assign(config.getGlobal(), cfg)
        config.saveGlobal()
        gWorkspaces?.sync()
      },
      onConfigSetProvider: (name, cfg) => { config.setProvider(name, cfg); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigRemoveProvider: (name) => { config.removeProvider(name); config.saveGlobal(); gWorkspaces?.sync() },
      onConfigFetchModels: async (providerName) => {
        // Mock provider 返回本地模型列表（无网络请求）
        if (providerName?.toLowerCase().includes('mock')) {
          return { models: ['mock'] }
        }
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
      onConfigTest: async (providerName) => {
        if (providerName?.toLowerCase().includes('mock')) {
          return { ok: true }
        }
        const global = config.getGlobal()
        const p = global.providers[providerName]
        if (!p) return { ok: false, error: `Provider "${providerName}" 不存在` }
        log.info(`正在测试 ${providerName} 的连接...`)
        try {
          const result = await listModels(p.apiKey, p.baseURL, p.modelsPath)
          if (result.error) {
            return { ok: false, error: result.error }
          }
          return { ok: true }
        } catch (err) {
          return { ok: false, error: String(err) }
        }
      },
      onConfigKnownModels: async () => {
        // 从活跃 runtime 收集 provider 声明的思考深度
        const thinkingLevels: Record<string, string[]> = {}
        for (const dir of gWorkspaces?.list() ?? []) {
          const rt = gWorkspaces?.getRuntime(dir)
          if (!rt) continue
          for (const entry of (rt as any).registries?.thinkingLevels?.list() ?? []) {
            if (!thinkingLevels[entry.name]) {
              thinkingLevels[entry.name] = entry.value
            }
          }
        }
        return {
          firstParty: [...FIRST_PARTY_PROVIDERS],
          knownModels: (() => {
            const result: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number; supportedThinkingLevels?: string[] }>> = {}
            for (const [provider, models] of Object.entries(KNOWN_MODELS)) {
              result[provider] = {}
              for (const [model, info] of Object.entries(models)) {
                result[provider][model] = {
              displayName: info.displayName,
              contextWindow: info.contextWindow,
              maxOutput: info.maxOutput,
              supportedThinkingLevels: info.supportedThinkingLevels,
            }
              }
            }
            return result
          })(),
          thinkingLevels,
          defaultThinkingLevels: {
            deepseek: 'high',
            openai: 'medium',
            mock: 'auto',
          },
        }
      },
      onWorkspaceList: async () => {
        const active = new Set(gWorkspaces?.list() ?? [])
        const all = [...new Set([...active, ...(config.getGlobal().recentWorkspaces ?? [])])]
        return all.map(r => ({ rootDir: r, config: {} as any }))
      },
      onWorkspaceSwitch: async (dir) => {
        await gWorkspaces?.ensure(dir)
        const eff = config.getEffectiveConfig(config.getGlobal(), await config.loadWorkspace(dir))
        return { model: `${eff.provider}/${eff.model}`, provider: eff.provider }
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
  }, log, transport.requestUserInput)
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
