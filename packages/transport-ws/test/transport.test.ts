import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { ExtensionContext, RuntimeHandle, Session } from '@crai/core'
import { EVENTS, createId } from '@crai/core'
import { WebSocket } from 'ws'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createWsTransport, browseDir } from '../src/index'

// ── Mock RuntimeHandle ─────────────────────────────

function mockRuntime(): RuntimeHandle {
  let sessionCounter = 0
  const sessions = new Map<string, Session>()

  const runtime: any = {
    id: 'runtime-test',

    async prompt(input: any, options?: any) {
      const sessionId = options?.sessionId ?? 's-default'
      const session = sessions.get(sessionId) ?? {
        id: sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      if (!sessions.has(sessionId)) sessions.set(sessionId, session)

      return {
        session,
        turnId: createId('turn'),
        messages: [{ id: createId('msg'), role: 'assistant', createdAt: Date.now(), parts: [{ type: 'text', text: `reply: ${input.text}` }] }],
        response: { message: {} as any },
      }
    },

    async createSession(meta?: any, id?: string) {
      sessionCounter++
      const sessionId = id ?? `s-${sessionCounter}`
      const session = { id: sessionId, createdAt: Date.now(), updatedAt: Date.now(), title: '', metadata: meta ?? {} }
      sessions.set(sessionId, session)
      return session
    },

    async stopSession() {},
    async getSession(id: string) { return sessions.get(id) },
    async updateSession(session: Session) { sessions.set(session.id, session) },
    async deleteSession(id: string) { sessions.delete(id) },
    async listMessages() { return [] },
    async callModel(messages: any, opts?: any) { return 'test response' },
    async loadExtension() {},
    async unloadExtension() {},
    async listSessions() { return Array.from(sessions.values()).map((s) => ({ id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt })) },
    async dispose() {},
  }

  return runtime as RuntimeHandle
}

// ── Mock EventBus（简化版，只支持 on + emit） ─────

function mockEventBus() {
  const listeners = new Map<string, Array<(event: any) => void>>()

  return {
    on(event: string, handler: (event: any) => void) {
      const list = listeners.get(event) ?? []
      list.push(handler)
      listeners.set(event, list)
      return { dispose: () => { /* noop */ } }
    },
    emit(event: string, payload: any) {
      const list = listeners.get(event) ?? []
      for (const h of list) h({ payload })
    },
  }
}

// ── Mock ExtensionContext ──────────────────────────

function mockCtx(runtime: RuntimeHandle) {
  const events = mockEventBus()
  return {
    runtime,
    events,
    bus: events,
    register: (_d: any) => {},
    hooks: { on: () => ({ dispose: () => {} }) },
    registry: {} as any,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    config: { get: () => undefined, set: async () => {}, delete: async () => {} },
    dataDir: '/tmp',
    registerTool: () => ({ dispose: () => {} }),
    registerModelMiddleware: () => ({ dispose: () => {} }),
  } as ExtensionContext
}

// ── 辅助：等待 WS 消息 ────────────────────────────

function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout waiting for message')), 3000)
    ws.once('message', (data) => {
      clearTimeout(timeout)
      resolve(String(data))
    })
  })
}

// ── 测试 ───────────────────────────────────────────

describe('transport-ws', () => {
  let transport: ReturnType<typeof createWsTransport>
  let runtime: RuntimeHandle
  let ctx: ExtensionContext
  let serverUrl: string

  beforeEach(async () => {
    runtime = mockRuntime()
    ctx = mockCtx(runtime)
    transport = createWsTransport({
      port: 0,
      host: '127.0.0.1',
      getRuntime: (_dir) => runtime,
    })

    // 模拟 runtime 加载 extension
    transport.extension.setup(ctx)

    // 启动服务并获取实际地址
    const info = await transport.start()
    serverUrl = info.url
  })

  afterEach(async () => {
    await transport.stop()
  })

  // ── 问题 1：前端需要实时接收 runtime 事件 ──
  it('转发 runtime 事件到连接的客户端', async () => {
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    // runtime 发射事件
    ctx.events.emit(EVENTS.MODEL_DELTA, { delta: 'Hello' })

    const raw = await waitForMessage(ws)
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'event')
    assert.equal(msg.event, EVENTS.MODEL_DELTA)
    assert.equal(msg.payload.delta, 'Hello')

    ws.close()
  })

  // ── 问题 2：前端需要发送 prompt 并获取回复 ──
  it('客户端发送 prompt 后拿到 session ID', async () => {
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    ws.send(JSON.stringify({ type: 'prompt', text: 'hello' }))

    const raw = await waitForMessage(ws)
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'session:id')
    assert.ok(typeof msg.id === 'string')

    ws.close()
  })

  // ── 问题 3：多个客户端同时接收同一事件 ──
  it('两个客户端都收到同一事件', async () => {
    const ws1 = new WebSocket(serverUrl)
    const ws2 = new WebSocket(serverUrl)
    await Promise.all([
      new Promise<void>((r) => ws1.on('open', () => r())),
      new Promise<void>((r) => ws2.on('open', () => r())),
    ])

    ctx.events.emit(EVENTS.TURN_STARTED, { sessionId: 's1' })

    const [raw1, raw2] = await Promise.all([
      waitForMessage(ws1),
      waitForMessage(ws2),
    ])

    const msg1 = JSON.parse(raw1)
    const msg2 = JSON.parse(raw2)
    assert.equal(msg1.event, EVENTS.TURN_STARTED)
    assert.equal(msg2.event, EVENTS.TURN_STARTED)

    ws1.close()
    ws2.close()
  })

  // ── 问题 4：客户端断开后服务不受影响 ──
  it('客户端断开后其他客户端继续接收事件', async () => {
    const ws1 = new WebSocket(serverUrl)
    const ws2 = new WebSocket(serverUrl)
    await Promise.all([
      new Promise<void>((r) => ws1.on('open', () => r())),
      new Promise<void>((r) => ws2.on('open', () => r())),
    ])

    ws1.close()
    // 等待断开
    await new Promise((r) => setTimeout(r, 100))

    ctx.events.emit(EVENTS.TURN_COMPLETED, { turnId: 't1' })

    const raw = await waitForMessage(ws2)
    const msg = JSON.parse(raw)
    assert.equal(msg.event, EVENTS.TURN_COMPLETED)

    ws2.close()
  })

  // ── 问题 5：runtime 提问桥接到客户端并取回回复 ──
  it('requestUserInput 提问后等待客户端回复', async () => {
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    // 模拟工具执行中调 requestUserInput
    const answerPromise = transport.requestUserInput('是否继续？', ['y', 'n'])

    // 客户端应收到提问
    const raw = await waitForMessage(ws)
    const question = JSON.parse(raw)
    assert.equal(question.type, 'request:input')
    assert.equal(question.question, '是否继续？')
    assert.deepEqual(question.options, ['y', 'n'])

    // 客户端回复
    ws.send(JSON.stringify({ type: 'resolve:input', id: question.id, value: 'y' }))

    const answer = await answerPromise
    assert.equal(answer, 'y')

    ws.close()
  })

  // ── 问题 6：无效数据不崩溃 ──
  it('收到无效 JSON 后返回错误但不崩溃', async () => {
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    ws.send('不是 JSON')
    const raw = await waitForMessage(ws)
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'error')

    // 服务正常：仍可处理合法请求
    ws.send(JSON.stringify({ type: 'prompt', text: 'still works' }))
    const raw2 = await waitForMessage(ws)
    const msg2 = JSON.parse(raw2)
    assert.equal(msg2.type, 'session:id')

    ws.close()
  })

  // ── publishEvent：向所有客户端广播 workspace 事件 ──
  it('publishEvent 广播带 workspaceId 的事件', async () => {
    const ws = new WebSocket(serverUrl)
    // 先注册监听，再等 open，确保不会漏消息
    const msgPromise = waitForMessage(ws)
    await new Promise<void>((r) => ws.on('open', () => r()))

    transport.publishEvent('/home/user/proj', 'turn.started', { turnId: 'turn-123' })

    const raw = await msgPromise
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'event')
    assert.equal(msg.event, 'turn.started')
    assert.equal(msg.payload.workspaceId, '/home/user/proj')
    assert.equal(msg.payload.turnId, 'turn-123')

    ws.close()
  })

  // ── publishEvent：事件 payload 可以是非对象 ──
  it('publishEvent 支持非对象 payload', async () => {
    const ws = new WebSocket(serverUrl)
    const msgPromise = waitForMessage(ws)
    await new Promise<void>((r) => ws.on('open', () => r()))

    transport.publishEvent('ws-1', 'custom.event', 'just a string')

    const raw = await msgPromise
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'event')
    assert.equal(msg.payload.workspaceId, 'ws-1')

    ws.close()
  })

  // ── 问题 7：start/stop 生命周期 ──
  it('stop 后新连接被拒绝', async () => {
    await transport.stop()

    const ws = new WebSocket(serverUrl)
    let disconnected = false
    ws.on('close', () => { disconnected = true })
    ws.on('error', () => { disconnected = true })
    await new Promise((r) => setTimeout(r, 100))
    assert.ok(disconnected, 'stop 后新连接应被拒绝')
  })

  // ── session:update ──
  it('session:update 更新标题并刷新列表', async () => {
    // 先创建一个 session
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    ws.send(JSON.stringify({ type: 'session:new' }))
    const raw = await waitForMessage(ws)
    const { id: sessionId } = JSON.parse(raw)
    assert.ok(sessionId)

    // 发送 session:update 设置标题
    ws.send(JSON.stringify({ type: 'session:update', sessionId, title: '测试会话' }))
    // session:update 不返回响应，主动请求列表验证
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'session:list' }))
    const raw2 = await waitForMessage(ws)
    const msg2 = JSON.parse(raw2)
    assert.equal(msg2.type, 'session:list:data')
    const updated = msg2.sessions?.find((s: any) => s.id === sessionId)
    assert.ok(updated, '更新后的 session 应在列表中')

    ws.close()
  })

  // ── dir:browse ──
  it('dir:browse 返回目录列表', async () => {
    const ws = new WebSocket(serverUrl)
    await new Promise<void>((r) => ws.on('open', () => r()))

    // 请求浏览用户主目录
    ws.send(JSON.stringify({ type: 'dir:browse' }))

    const raw = await waitForMessage(ws)
    const msg = JSON.parse(raw)
    assert.equal(msg.type, 'dir:browse:data')
    assert.ok(Array.isArray(msg.dirs))
    assert.equal(typeof msg.path, 'string')

    ws.close()
  })
})

// ── browseDir 单元测试 ──

describe('browseDir', () => {
  it('无参数时返回用户主目录', () => {
    const result = browseDir()
    assert.ok(result.path.length > 0)
    assert.ok(Array.isArray(result.dirs))
    assert.equal(result.parent, undefined)
  })

  it('返回指定路径的子目录（不含文件）', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'crai-test-'))
    mkdirSync(join(tmp, 'sub1'))
    mkdirSync(join(tmp, 'sub2'))

    const result = browseDir(tmp)
    assert.ok(result.dirs.includes('sub1'))
    assert.ok(result.dirs.includes('sub2'))

    rmSync(tmp, { recursive: true, force: true })
  })

  it('不返回隐藏目录', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'crai-test-'))
    mkdirSync(join(tmp, 'visible'))
    mkdirSync(join(tmp, '.hidden'))

    const result = browseDir(tmp)
    assert.ok(result.dirs.includes('visible'))
    assert.ok(!result.dirs.includes('.hidden'))

    rmSync(tmp, { recursive: true, force: true })
  })

  it('不存在的路径返回错误', () => {
    const result = browseDir('/this/path/does/not/exist/12345')
    assert.ok(result.error)
    assert.deepEqual(result.dirs, [])
  })

  it('拒绝系统敏感目录', () => {
    const result = browseDir('/etc')
    assert.equal(result.error, '不允许浏览此目录')
  })

  it('系统敏感目录的子目录也被拒绝', () => {
    const result = browseDir('/etc/ssl')
    assert.equal(result.error, '不允许浏览此目录')
  })
})
