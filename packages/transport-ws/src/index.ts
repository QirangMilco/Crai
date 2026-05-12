/**
 * @crai/transport-ws — WebSocket transport for Crai runtime.
 */
import type { Extension, RuntimeHandle } from '@crai/core'
import { EVENTS, createId } from '@crai/core'
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
  onWorkspaceConfigGet?: () => WorkspaceConfig | Promise<WorkspaceConfig>
  onWorkspaceConfigSet?: (config: WorkspaceConfig) => void | Promise<void>
}

export interface WsTransportOptions {
  port?: number
  host?: string
  onReady?: (info: { port: number; url: string }) => void
  onConnectionChange?: (count: number) => void
  handlers?: WsTransportHandlers
  /** 根据工作区路径获取对应的 runtime。没有 API key 时可能为 undefined。 */
  getRuntime?: (rootDir: string) => RuntimeHandle | undefined
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

// ── Factory ────────────────────────────────────────

export function createWsTransport(options: WsTransportOptions = {}): WsTransport {
  const { host = '0.0.0.0', port: preferredPort = 0, handlers, getRuntime } = options
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
        const result = await rt.prompt({ type: 'text', text: msg.text }, opts)
        currentSessionId = result.session.id
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'session:new': {
        const rt = resolveRuntime()!
        const session = await rt.createSession(msg.system ? { system: msg.system } : undefined)
        currentSessionId = session.id
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
        const info = await handlers.onWorkspaceSwitch(msg.rootDir)
        currentSessionId = undefined
        currentWorkspace = msg.rootDir
        ws.send(JSON.stringify({ type: 'workspace:switched', rootDir: msg.rootDir, ...info } satisfies ServerMessage))
        break
      }

      case 'workspace:config:get': {
        if (!handlers?.onWorkspaceConfigGet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not available' } satisfies ServerMessage)); break }
        const wc = await handlers.onWorkspaceConfigGet()
        ws.send(JSON.stringify({ type: 'workspace:config:data', config: wc } satisfies ServerMessage))
        break
      }

      case 'workspace:config:set': {
        if (!handlers?.onWorkspaceConfigSet) { ws.send(JSON.stringify({ type: 'error', message: 'workspace config not writable' } satisfies ServerMessage)); break }
        await handlers.onWorkspaceConfigSet(msg.config)
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
      broadcast({ type: 'event', event, payload: { workspaceId, ...(typeof payload === 'object' && payload !== null ? payload : {}) } })
    },
  }

  return transport
}
