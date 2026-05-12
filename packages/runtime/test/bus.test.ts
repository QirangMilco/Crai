import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHookBus, createEventBus } from '../src/bus'
import { EVENTS } from '@crai/core'
import type { HookMap, HookBus, EventBus, EventMap } from '@crai/core'

// ============================================================
// HookBus
// ============================================================

describe('HookBus', () => {
  it('注册 handler 后 run 会调用它', async () => {
    const bus = createHookBus()
    const calls: string[] = []

    bus.on('tool:safetyCheck', async (val) => {
      calls.push('called')
      return
    })

    await bus.run('tool:safetyCheck', {} as any, {} as any)
    assert.equal(calls.length, 1)
    assert.equal(calls[0], 'called')
  })

  it('handler 返回 void 不影响后续 handler', async () => {
    const bus = createHookBus()
    const order: number[] = []

    bus.on('tool:safetyCheck', async () => { order.push(1) })
    bus.on('tool:safetyCheck', async () => { order.push(2) })

    await bus.run('tool:safetyCheck', {} as any, {} as any)
    assert.deepEqual(order, [1, 2])
  })

  it('handler 返回 { stop: true } 阻断链', async () => {
    const bus = createHookBus()
    const order: number[] = []

    bus.on('tool:safetyCheck', async () => { order.push(1); return { stop: true as const, reason: '阻断' } })
    bus.on('tool:safetyCheck', async () => { order.push(2) })

    await bus.run('tool:safetyCheck', {} as any, {} as any)
    assert.deepEqual(order, [1])
  })

  it('stop 返回值包含 stop: true 和 reason', async () => {
    const bus = createHookBus()

    bus.on('tool:safetyCheck', async () => ({ stop: true as const, reason: 'test reason' }))

    const result = await bus.run('tool:safetyCheck', {} as any, {} as any)
    assert.equal((result as any).stop, true)
    assert.equal((result as any).reason, 'test reason')
  })

  it('handler 返回 { replace } 替换当前值', async () => {
    const bus = createHookBus()

    bus.on('tool:safetyCheck', async () => ({ replace: { replaced: true } }))

    const result = await bus.run('tool:safetyCheck', { original: true } as any, {} as any)
    assert.equal((result as any).replaced, true)
  })

  it('handler 返回 { patch } 合并到当前值', async () => {
    const bus = createHookBus()

    bus.on('tool:safetyCheck', async () => ({ patch: { extra: 'data' } }))

    const result = await bus.run('tool:safetyCheck', { base: 'value' } as any, {} as any)
    assert.equal((result as any).base, 'value')
    assert.equal((result as any).extra, 'data')
  })

  it('handler 按 priority 升序执行', async () => {
    const bus = createHookBus()
    const order: number[] = []

    bus.on('tool:safetyCheck', async () => { order.push(2) }, { priority: 10 })
    bus.on('tool:safetyCheck', async () => { order.push(1) }, { priority: 0 })

    await bus.run('tool:safetyCheck', {} as any, {} as any)
    assert.deepEqual(order, [1, 2])
  })

  it('没有 handler 时 run 不报错', async () => {
    const bus = createHookBus()
    const result = await bus.run('tool:safetyCheck', { test: true } as any, {} as any)
    assert.equal((result as any).test, true)
  })

  it('多次 stop：第二次 stop 不会覆盖第一次', async () => {
    const bus = createHookBus()

    bus.on('tool:safetyCheck', async () => ({ stop: true as const, reason: 'first' }))
    bus.on('tool:safetyCheck', async () => ({ stop: true as const, reason: 'second' }))

    const result = await bus.run('tool:safetyCheck', {} as any, {} as any)
    // 第一次 stop 后链就断了，第二次不执行
    assert.equal((result as any).reason, 'first')
  })
})

// ============================================================
// EventBus
// ============================================================

describe('EventBus', () => {
  it('emit 后 on 能收到事件', async () => {
    const bus = createEventBus()
    const events: any[] = []

    bus.on(EVENTS.TOOL_REQUESTED, (e) => { events.push(e.payload) })

    await bus.emit(EVENTS.TOOL_REQUESTED, { session: { id: 's1' } as any, toolCall: { name: 'test' } as any })

    assert.equal(events.length, 1)
    assert.equal((events[0] as any).session.id, 's1')
  })

  it('多个 listener 都收到事件', async () => {
    const bus = createEventBus()
    let count = 0

    bus.on(EVENTS.TOOL_REQUESTED, () => { count++ })
    bus.on(EVENTS.TOOL_REQUESTED, () => { count++ })

    await bus.emit(EVENTS.TOOL_REQUESTED, { session: {} as any, toolCall: {} as any })
    assert.equal(count, 2)
  })

  it('没有 listener 时 emit 不报错', async () => {
    const bus = createEventBus()
    await bus.emit(EVENTS.TOOL_REQUESTED, { session: {} as any, toolCall: {} as any })
    // should not throw
  })

  it('事件 payload 包含 sessionId', async () => {
    const bus = createEventBus()
    let received: any

    bus.on(EVENTS.SESSION_CREATED, (e) => { received = e })

    await bus.emit(EVENTS.SESSION_CREATED, { session: { id: 'test-session-id' } as any })

    assert.ok(received)
    assert.equal(received.payload.session.id, 'test-session-id')
  })

  it('多个 emit 按顺序到达', async () => {
    const bus = createEventBus()
    const order: string[] = []

    bus.on(EVENTS.TOOL_REQUESTED, (e) => { order.push((e.payload as any).toolCall.name) })

    await bus.emit(EVENTS.TOOL_REQUESTED, { session: {} as any, toolCall: { name: 'a' } as any })
    await bus.emit(EVENTS.TOOL_REQUESTED, { session: {} as any, toolCall: { name: 'b' } as any })

    assert.deepEqual(order, ['a', 'b'])
  })
})
