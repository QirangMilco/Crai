/**
 * @crai/transport-ws — WebSocket transport for Crai runtime.
 *
 * 将 runtime 事件实时推送到 WebSocket 客户端，
 * 同时将客户端指令路由到 runtime，并桥接用户交互
 * （权限确认 / requestUserInput）。
 *
 * 使用方式：
 *   const wsTransport = createWsTransport({ port: 8080 })
 *   const runtime = await createRuntime({
 *     extensions: [...otherExts, wsTransport.extension],
 *     requestUserInput: wsTransport.requestUserInput,
 *   })
 *   await wsTransport.start()
 */
import type { Extension, RuntimeHandle, EventMap } from '@crai/core'
import { EVENTS, createId } from '@crai/core'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { ClientMessage, ServerMessage } from './protocol'

// ── 选项 ───────────────────────────────────────────

export interface WsTransportOptions {
  /** HTTP 监听端口（默认 0 = 随机端口）。 */
  port?: number
  /** 监听主机（默认 '127.0.0.1'）。 */
  host?: string
  /** 服务器就绪回调。 */
  onReady?: (info: { port: number; url: string }) => void
  /** 连接数变化回调。 */
  onConnectionChange?: (count: number) => void
}

// ── 返回接口 ───────────────────────────────────────

export interface WsTransport {
  /** 加载到 runtime 的 Extension。setup() 中订阅 runtime 事件。 */
  extension: Extension
  /** 启动 WebSocket 服务。在 createRuntime() 之后调用。返回 { port, url }。 */
  start: () => Promise<{ port: number; url: string }>
  /** 停止 WebSocket 服务并断开所有客户端。 */
  stop: () => Promise<void>
  /**
   * 注入 RuntimeOptions.requestUserInput 的回调。
   * 将用户的提问广播给所有已连接客户端，取第一个回复。
   */
  requestUserInput: (question: string, options?: string[]) => Promise<string>
}

// ── Factory ────────────────────────────────────────

export function createWsTransport(options: WsTransportOptions = {}): WsTransport {
  const { host = '127.0.0.1', port: preferredPort = 0 } = options
  const httpServer = http.createServer()
  const wss = new WebSocketServer({ server: httpServer })
  const clients = new Set<WebSocket>()
  const pendingInputs = new Map<string, { resolve: (value: string) => void }>()

  let currentSessionId: string | undefined
  let runtime: RuntimeHandle | undefined
  let stopped = false

  // ── 广播消息到所有已连接客户端 ──
  function broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg)
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(json)
      }
    }
  }

  // ── 处理 WS 客户端发来的指令 ──
  async function handleClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    if (!runtime) {
      ws.send(JSON.stringify({ type: 'error', message: 'runtime not ready' } satisfies ServerMessage))
      return
    }

    switch (msg.type) {
      case 'prompt': {
        const options: any = {}
        if (msg.sessionId) options.sessionId = msg.sessionId
        else if (currentSessionId) options.sessionId = currentSessionId

        const result = await runtime.prompt({ type: 'text', text: msg.text }, options)
        currentSessionId = result.session.id
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'session:new': {
        const session = await runtime.createSession(
          msg.system ? { system: msg.system } : undefined,
        )
        currentSessionId = session.id
        ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
        break
      }

      case 'resolve:input': {
        const pending = pendingInputs.get(msg.id)
        if (pending) {
          pending.resolve(msg.value)
          pendingInputs.delete(msg.id)
        }
        break
      }
    }
  }

  // ── WSS 连接处理器 ──
  wss.on('connection', (ws) => {
    if (stopped) { ws.close(1001, 'Server shutting down'); return }

    clients.add(ws)
    options.onConnectionChange?.(clients.size)

    // 新连接通知当前 session ID
    if (currentSessionId) {
      ws.send(JSON.stringify({ type: 'session:id', id: currentSessionId } satisfies ServerMessage))
    }

    ws.on('message', (data) => {
      const raw = String(data)
      let msg: ClientMessage
      try {
        msg = JSON.parse(raw)
      } catch {
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

  // ── 返回 ──
  const transport: WsTransport = {
    extension: {
      name: 'transport-ws',
      setup(ctx) {
        runtime = ctx.runtime

        // 订阅所有 EVENTS 常量中的事件，广播到 WS
        const disposables: Array<() => void> = []
        for (const key of Object.keys(EVENTS) as Array<keyof typeof EVENTS>) {
          const eventName = EVENTS[key]
          const handler = (event: any) => {
            const payload = event?.payload ?? event
            broadcast({ type: 'event', event: eventName, payload })
          }
          ctx.events.on(eventName, handler)
        }

        ctx.register({
          dispose: () => {
            for (const d of disposables) d()
          },
        })
      },
    },

    async start(): Promise<{ port: number; url: string }> {
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

    async stop(): Promise<void> {
      stopped = true
      for (const ws of clients) ws.close(1001, 'Server shutting down')
      clients.clear()
      pendingInputs.clear()
      return new Promise<void>((resolve) => {
        wss.close(() => httpServer.close(() => resolve()))
      })
    },

    requestUserInput: async (question: string, options?: string[]): Promise<string> => {
      const id = createId('req')
      return new Promise<string>((resolve) => {
        pendingInputs.set(id, { resolve })
        broadcast({ type: 'request:input', id, question, options })
      })
    },
  }

  return transport
}
