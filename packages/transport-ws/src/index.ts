/**
 * @crai/transport-ws — WebSocket transport for Crai runtime.
 */
import type { Extension, Logger, RuntimeHandle } from '@crai/core'
import { DEBUG_SCOPES, debugLog, EVENTS, createId, setDebugScopes } from '@crai/core'
import { readdirSync, statSync, realpathSync } from 'node:fs'
import { join, resolve, sep, normalize } from 'node:path'
import { homedir } from 'node:os'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from './protocol'
import type { GlobalConfig, ProviderConfig, WorkspaceConfig } from '@crai/core'

// ── 选项 ───────────────────────────────────────────

export interface WsTransportHandlers {
  onConfigGet?: () => GlobalConfig | Promise<GlobalConfig>
  onConfigSet?: (config: GlobalConfig) => void | Promise<void>
  onConfigSetProvider?: (name: string, config: ProviderConfig) => void | Promise<void>
  onConfigRemoveProvider?: (name: string) => void | Promise<void>
  onConfigFetchModels?: (providerName: string) => Promise<{ models: string[]; error?: string }>
  onWorkspaceList?: () => Array<{ rootDir: string; config: WorkspaceConfig }> | Promise<Array<{ rootDir: string; config: WorkspaceConfig }>>
  onWorkspaceSwitch?: (rootDir: string) => Promise<{ model: string; provider: string }>
  onWorkspaceConfigGet?: (rootDir: string) => WorkspaceConfig | Promise<WorkspaceConfig>
  onWorkspaceConfigSet?: (rootDir: string, config: WorkspaceConfig) => void | Promise<void>
}

export interface WsTransportOptions {
  port?: number
  host?: string
  onReady?: (info: { port: number; url: string }) => void
  onConnectionChange?: (count: number) => void
  handlers?: WsTransportHandlers
  /** 根据工作区路径获取对应的 runtime。没有 API key 时可能为 undefined。 */
  getRuntime?: (rootDir: string) => RuntimeHandle | undefined
  /** 日志记录器，调试输出受 logLevel 过滤。 */
  logger?: Logger
}

// ── 返回接口 ───────────────────────────────────────

export interface WsTransport {
  extension: Extension
  start: () => Promise<{ port: number; url: string }>
  stop: () => Promise<void>
  requestUserInput: (question: string, options?: string[]) => Promise<string>
  /** 发布来自任意 workspace 的事件到所有客户端。事件消息中会带 workspaceId。 */
  publishEvent: (workspaceId: string, event: string, payload: unknown) => void
}

// ── 目录浏览辅助 ──

/** 禁止浏览的系统目录（子路径也会被拒绝）。 */
const DENY_DIRS = new Set([
  // Linux / macOS
  '/etc', '/proc', '/sys', '/dev', '/boot', '/private/etc', '/private/var/db',
  // Windows
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\System32',
])

function isDenied(resolved: string): boolean {
  const norm = resolve(resolved)
  for (const d of DENY_DIRS) {
    if (norm === d || norm.startsWith(d + sep)) return true
  }
  return false
}

/** 安全地浏览目录，带系统目录过滤和路径规范化。 */
export function browseDir(inputPath?: string): { path: string; dirs: string[]; parent?: string; error?: string } {
  try {
    if (!inputPath) {
      // 无参数时返回用户主目录
      const home = homedir()
      let dirs: string[] = []
      try {
        dirs = readdirSync(home).filter((e) => {
          if (e.startsWith('.')) return false // 隐藏目录默认不显示
          try { return statSync(join(home, e)).isDirectory() } catch { return false }
        }).sort()
      } catch {}
      return { path: home, dirs, parent: undefined }
    }

    const resolved = resolve(inputPath)

    // 安全检查：禁止浏览系统敏感目录
    if (isDenied(resolved)) {
      return { path: resolved, dirs: [], error: '不允许浏览此目录' }
    }

    const dirs = readdirSync(resolved).filter((e) => {
      if (e.startsWith('.')) return false
      const full = join(resolved, e)
      // 如果子目录是敏感目录，也不显示
      if (isDenied(full)) return false
      try { return statSync(full).isDirectory() } catch { return false }
    }).sort()

    const parent = resolve(resolved, '..')
    return {
      path: resolved,
      dirs,
      parent: parent === resolved ? undefined : (isDenied(parent) ? undefined : parent),
    }
  } catch (err: any) {
    return { path: inputPath ?? '', dirs: [], error: err.message ?? String(err) }
  }
}

// ── Factory ────────────────────────────────────────

export function createWsTransport(options: WsTransportOptions = {}): WsTransport {
  const { host = '0.0.0.0', port: preferredPort = 0, handlers, getRuntime, logger } = options
  const httpServer = http.createServer()
  const wss = new WebSocketServer({ server: httpServer })
  const clients = new Set<WebSocket>()
  const pendingInputs = new Map<string, { resolve: (value: string) => void }>()

  let currentSessionId: string | undefined
  let currentWorkspace: string | undefined

  function resolveRuntime(): RuntimeHandle | undefined {
    if (getRuntime) {
      if (currentWorkspace) return getRuntime(currentWorkspace)
      // 没有设置当前工作区时，让 getRuntime 自己处理（服务端可返回第一个 runtime）
      return getRuntime('')
    }
    return undefined
  }

  function broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg)
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(json)
    }
  }

  async function handleClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    // ── 不需要 runtime 的消息（配置、工作区，放行通过） ──
    switch (msg.type) {
      case 'config:get':
      case 'config:set':
      case 'config:set:provider':
      case 'config:remove:provider':
      case 'config:fetch:models':
      case 'workspace:list':
      case 'workspace:switch':
      case 'workspace:config:get':
      case 'workspace:config:set':
        break
      default: {
        const rt = resolveRuntime()
        if (!rt) {
          ws.send(JSON.stringify({ type: 'error', message: 'runtime not ready' } satisfies ServerMessage))
          return
        }
      }
    }

    switch (msg.type) {
      case 'prompt': {
        const rt = resolveRuntime()!
        const opts: any = {}
        if (msg.sessionId) opts.sessionId = msg.sessionId
        else if (currentSessionId) opts.sessionId = currentSessionId
        if (msg.model) opts.model = msg.model
        if (msg.provider) opts.provider = msg.provider
        const result = await rt.prompt({ type: 'text', text: msg.text }, opts)
        currentSessionId = result.session.id
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'session:new': {
        const rt = resolveRuntime()!
        const session = await rt.createSession(msg.system ? { system: msg.system } : undefined)
        currentSessionId = session.id
        logger?.info(`已创建 session ${session.id}`)
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'resolve:input': {
        const p = pendingInputs.get(msg.id)
        if (p) { p.resolve(msg.value); pendingInputs.delete(msg.id) }
        break
      }

      case 'session:list': {
        const rt = resolveRuntime()!
        const sessions = await rt.listSessions()
        ws.send(JSON.stringify({ type: 'session:list:data', sessions } satisfies ServerMessage))
        break
      }

      case 'session:load': {
        const rt = resolveRuntime()!
        const raw = await rt.listMessages(msg.sessionId)
        // 将内部 Message（parts 格式）转为客户端简易格式
        const messages = raw
          .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
          .map((m) => ({
            id: m.id,
            role: m.role,
            text: m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'),
            createdAt: m.createdAt,
          }))
        ws.send(JSON.stringify({ type: 'session:data', sessionId: msg.sessionId, messages } satisfies ServerMessage))
        break
      }

      // ── session:generate-title ──

      case 'session:generate-title': {
        const rt = resolveRuntime()!
        logger?.info(`正在为 session ${msg.sessionId} 生成标题`)
        // 获取 session 消息
        const raw = await rt.listMessages(msg.sessionId)
        const userMsg = raw.find((m: any) => m.role === 'user')?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        const aiMsg = raw.filter((m: any) => m.role === 'assistant').pop()?.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        debugLog(DEBUG_SCOPES.TITLE_GEN, 'start', { sessionId: msg.sessionId, messagesFound: !!userMsg }, logger)
        if (!userMsg) { ws.send(JSON.stringify({ type: 'error', message: 'no messages to summarize' } satisfies ServerMessage)); break }

        // 查找工具模型配置
        let toolModel: string | undefined
        try {
          const cfg = handlers?.onConfigGet ? await handlers.onConfigGet() : undefined
          if (cfg) {
            toolModel = (cfg as any).toolModel ?? (cfg as any).defaultModel ?? undefined
          }
        } catch { /* 静默回退到默认模型 */ }
        debugLog(DEBUG_SCOPES.TITLE_GEN, 'model', { toolModel }, logger)

        try {
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'calling', { model: toolModel ?? '(default)' }, logger)
          const title = await rt.callModel(
            [
              { role: 'user', content: userMsg.slice(0, 500) },
              ...(aiMsg ? [{ role: 'assistant', content: aiMsg.slice(0, 500) }] : []),
            ],
            {
              system: '用一句简短的话概括这个对话的主题。直接输出标题，不要前缀，不要引号，不要标点结尾。15字以内。',
              model: toolModel,
              temperature: 0.3,
              maxTokens: 50,
              utility: true,
            },
          )
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'raw_response', { raw: title }, logger)
          const cleanTitle = title.replace(/^[""''“”「」]+|[""''“”」」]+$/g, '').trim()
          if (cleanTitle) {
            // 持久化标题
            const session = await rt.getSession(msg.sessionId)
            if (session) {
              const storages = (rt as any).registries?.storages?.list()
              const storage = storages?.[0]?.value
              if (storage) await storage.updateSession({ ...session, title: cleanTitle, updatedAt: Date.now() })
            }
            logger?.info(`标题生成成功: ${cleanTitle}`)
            debugLog(DEBUG_SCOPES.TITLE_GEN, 'success', { title: cleanTitle }, logger)
            ws.send(JSON.stringify({ type: 'session:title', sessionId: msg.sessionId, title: cleanTitle } satisfies ServerMessage))
          }
        } catch (err: any) {
          logger?.warn(`标题生成失败: ${err.message}`)
          debugLog(DEBUG_SCOPES.TITLE_GEN, 'error', { message: err.message }, logger)
          ws.send(JSON.stringify({ type: 'error', message: `title generation failed: ${err.message}` } satisfies ServerMessage))
        }
        break
      }

      case 'session:update': {
        const rt = resolveRuntime()!
        const session = await rt.getSession(msg.sessionId)
        if (session) {
          const updated = { ...session, title: msg.title ?? session.title, updatedAt: Date.now() }
          logger?.info(`已更新 session ${msg.sessionId} 标题: ${(msg.title ?? '(清空)').slice(0, 40)}`)
          // 通过 runtime 的内部存储持久化标题
          const storages = (rt as any).registries?.storages?.list()
          const storage = storages?.[0]?.value
          if (storage) await storage.updateSession(updated)
        }
        const sessions = await rt.listSessions()
        ws.send(JSON.stringify({ type: 'session:list:data', sessions } satisfies ServerMessage))
        break
      }

      // ── 目录浏览（不需要 runtime） ──

      case 'dir:browse': {
        const result = browseDir(msg.path)
        ws.send(JSON.stringify({ type: 'dir:browse:data', ...result } satisfies ServerMessage))
        break
      }

      // ── 配置 / 工作区消息（委托给 handlers） ──

      case 'config:get': {
        if (!handlers?.onConfigGet) { ws.send(JSON.stringify({ type: 'error', message: 'config not available' } satisfies ServerMessage)); break }
        const cfg = await handlers.onConfigGet()
        ws.send(JSON.stringify({ type: 'config:data', config: cfg } satisfies ServerMessage))
        break
      }

      case 'config:set': {
        if (!handlers?.onConfigSet) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        await handlers.onConfigSet(msg.config)
        break
      }

      case 'config:set:provider': {
        if (!handlers?.onConfigSetProvider) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        await handlers.onConfigSetProvider(msg.name, msg.config)
        break
      }

      case 'config:remove:provider': {
        if (!handlers?.onConfigRemoveProvider) { ws.send(JSON.stringify({ type: 'error', message: 'config not writable' } satisfies ServerMessage)); break }
        await handlers.onConfigRemoveProvider(msg.name)
        break
      }

      case 'config:fetch:models': {
        if (!handlers?.onConfigFetchModels) { ws.send(JSON.stringify({ type: 'error', message: 'model fetching not available' } satisfies ServerMessage)); break }
        const result = await handlers.onConfigFetchModels(msg.providerName)
        ws.send(JSON.stringify({ type: 'config:models:data', providerName: msg.providerName, ...result } satisfies ServerMessage))
        break
      }

      case 'workspace:list': {
        if (!handlers?.onWorkspaceList) { ws.send(JSON.stringify({ type: 'error', message: 'workspace not available' } satisfies ServerMessage)); break }
        const workspaces = await handlers.onWorkspaceList()
        ws.send(JSON.stringify({ type: 'workspace:list:data', current: currentWorkspace ?? null, workspaces } satisfies ServerMessage))
        break
      }

      case 'workspace:switch': {
        if (!handlers?.onWorkspaceSwitch) { ws.send(JSON.stringify({ type: 'error', message: 'workspace switching not supported' } satisfies ServerMessage)); break }
        logger?.info(`正在切换到工作区 ${msg.rootDir}`)
        const info = await handlers.onWorkspaceSwitch(msg.rootDir)
        currentSessionId = undefined
        currentWorkspace = msg.rootDir
        ws.send(JSON.stringify({ type: 'workspace:switched', rootDir: msg.rootDir, ...info } satisfies ServerMessage))
        break
      }

      case 'workspace:config:get': {
        if (!handlers?.onWorkspaceConfigGet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not available' } satisfies ServerMessage)); break }
        const wc = await handlers.onWorkspaceConfigGet(currentWorkspace ?? process.cwd())
        ws.send(JSON.stringify({ type: 'workspace:config:data', config: wc } satisfies ServerMessage))
        break
      }

      case 'workspace:config:set': {
        if (!handlers?.onWorkspaceConfigSet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not writable' } satisfies ServerMessage)); break }
        await handlers.onWorkspaceConfigSet(currentWorkspace ?? process.cwd(), msg.config)
        break
      }
    }
  }

  wss.on('connection', (ws) => {
    if (stopped) { ws.close(1001, 'Server shutting down'); return }
    clients.add(ws)
    options.onConnectionChange?.(clients.size)

    if (currentSessionId) {
      ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
    }

    ws.on('message', (data) => {
      const raw = String(data)
      let msg: ClientMessage
      try { msg = JSON.parse(raw) } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' } satisfies ServerMessage))
        return
      }
      handleClientMessage(ws, msg).catch((err) => {
        ws.send(JSON.stringify({ type: 'error', message: err.message ?? String(err) } satisfies ServerMessage))
      })
    })

    ws.on('close', () => {
      clients.delete(ws)
      options.onConnectionChange?.(clients.size)
    })

    ws.on('error', () => ws.close())
  })

  let stopped = false

  const transport: WsTransport = {
    extension: {
      name: 'transport-ws',
      setup(ctx) {
        // 不再设置 runtime——改由 getRuntime 回调按当前工作区查询
        for (const key of Object.keys(EVENTS) as Array<keyof typeof EVENTS>) {
          const eventName = EVENTS[key]
          const handler = (event: any) => {
            const payload = event?.payload ?? event
            broadcast({ type: 'event', event: eventName, payload })
          }
          ctx.events.on(eventName, handler)
        }
        ctx.register({
          dispose: () => { /* cleanup handled by stop() */ },
        })
      },
    },

    async start() {
      return new Promise<{ port: number; url: string }>((resolve) => {
        httpServer.listen(preferredPort, host, () => {
          const addr = httpServer.address()
          const port = typeof addr === 'object' && addr ? addr.port : 0
          const info = { port, url: `ws://${host}:${port}` }
          options.onReady?.(info)
          resolve(info)
        })
      })
    },

    async stop() {
      stopped = true
      for (const ws of clients) ws.close(1001, 'Server shutting down')
      clients.clear()
      pendingInputs.clear()
      return new Promise<void>((resolve) => {
        wss.close(() => httpServer.close(() => resolve()))
      })
    },

    requestUserInput: async (question: string, options?: string[]) => {
      const id = createId('req')
      return new Promise<string>((resolve) => {
        pendingInputs.set(id, { resolve })
        broadcast({ type: 'request:input', id, question, options })
      })
    },

    publishEvent: (workspaceId: string, event: string, payload: unknown) => {
      if (event === 'thinking.delta' || event === 'thinking.done' || event === 'tool.start' || event === 'tool.delta' || event === 'tool.done') {
        debugLog(DEBUG_SCOPES.API, `ws broadcast: ${event}`, { workspaceId, hasPayload: !!payload }, logger)
      }
      broadcast({ type: 'event', event, payload: { workspaceId, ...(typeof payload === 'object' && payload !== null ? payload : {}) } })
    },
  }

  return transport
}
