/**
 * 测试中止功能：
 * - 通过 AbortController 中止 mock 流
 * - 验证不再继续 yield 事件
 * - 验证最终收到 { type: 'done', stopReason: 'aborted' }
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MockDeepSeekAdapter } from '../src/mock/adapter'

function makeRequest(text: string, signal?: AbortSignal) {
  return {
    sessionId: 'test',
    turnId: 'test-turn',
    model: 'mock',
    signal,
    context: {
      messages: [{ id: 'user-1', role: 'user' as const, createdAt: Date.now(), parts: [{ type: 'text' as const, text }] }],
    },
    settings: {},
  }
}

describe('abort flow', () => {
  let adapter: MockDeepSeekAdapter

  before(() => { adapter = new MockDeepSeekAdapter({}) })
  after(() => {})

  it('首先检查 mock adapter 正常非中止流程', async () => {
    const controller = new AbortController()
    const stream = adapter.stream(makeRequest('你好', controller.signal))
    const events = []
    for await (const e of stream) {
      events.push(e.type)
    }
    assert.ok(events.includes('done'), '正常流程应收到 done 事件')
  })

  it('stream 收到 done 事件且 stopReason = aborted', async () => {
    const controller = new AbortController()
    const stream = adapter.stream(makeRequest('你好', controller.signal))

    // 收集事件
    const events: any[] = []
    const collect = (async () => {
      for await (const e of stream) {
        events.push(e)
      }
    })()

    // 等待一点时间让流开始，然后中止
    await new Promise((r) => setTimeout(r, 30))
    controller.abort()
    await collect

    // 验证：应该收到 done 事件，stopReason 为 aborted
    const doneEvent = events.find((e) => e.type === 'done')
    assert.ok(doneEvent, '应收到 done 事件')
    assert.equal(doneEvent.response.stopReason, 'aborted', 'stopReason 应为 aborted')
    assert.equal(doneEvent.type, 'done')
  })

  it('stream 不会把 abort 当成 error', async () => {
    const controller = new AbortController()
    const stream = adapter.stream(makeRequest('你好', controller.signal))

    const events: any[] = []
    const collect = (async () => {
      for await (const e of stream) {
        events.push(e)
      }
    })()

    await new Promise((r) => setTimeout(r, 30))
    controller.abort()
    await collect

    const errorEvent = events.find((e) => e.type === 'error')
    assert.equal(errorEvent, undefined, '中止不应产生 error 事件')
  })

  it('signal 在调用前已 aborted：立即结束', async () => {
    const controller = new AbortController()
    // 在调用 stream 前就 abort
    controller.abort()

    const stream = adapter.stream(makeRequest('你好', controller.signal))
    const events: any[] = []
    for await (const e of stream) {
      events.push(e)
    }

    assert.equal(events.length, 2, '应只收到 text-end + done')
    assert.equal(events.filter((e) => e.type === 'done').length, 1)
    assert.equal(events.filter((e) => e.type === 'error').length, 0)
    assert.equal(events.find((e) => e.type === 'done')?.response.stopReason, 'aborted')
  })

  it('长时间流中 abort：后续不再 yield', async () => {
    const controller = new AbortController()
    // "消息测试" 触发长时间流（思考+3工具+文本）
    const stream = adapter.stream(makeRequest('消息测试', controller.signal))

    const events: any[] = []
    const collect = (async () => {
      for await (const e of stream) {
        events.push(e.type)
      }
    })()

    // 等一点时间让流开始，然后立即中止
    await new Promise((r) => setTimeout(r, 50))
    controller.abort()
    await collect

    // 应该收到 done，且没有 error
    assert.ok(events.includes('done'), '应收到 done')
    assert.equal(events.includes('error'), false, '不应有 error')
  })
})
