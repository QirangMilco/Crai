import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DeepSeekAdapter } from '../src/deepseek/adapter'
import type { ModelRequest, ModelStreamEvent } from '@crai/core'
import { MESSAGE_PART_TYPES, MESSAGE_ROLES, STREAM_EVENT_TYPES } from '@crai/core'

const TEST_API_KEY = 'sk-test'
const TEST_BASE_URL = 'https://mock-api.example.com'
const TEST_MODEL = 'deepseek-chat'

// ── Mock fetch ──────────────────────────────────────

const originalFetch = globalThis.fetch
let mockResponseBody: unknown = null
let mockStreamChunks: string[] = []
let mockStatus = 200
let capturedBody = ''

function setupMockResponse(body: unknown) {
  mockResponseBody = body
  mockStatus = 200
}

function setupMockStream(chunks: string[]) {
  mockStreamChunks = chunks
  mockStatus = 200
}

beforeEach(() => {
  mockResponseBody = null
  mockStreamChunks = []
  mockStatus = 200
  capturedBody = ''

  globalThis.fetch = async (url: any, opts: any) => {
    capturedBody = opts?.body ?? ''

    if (mockStreamChunks.length > 0) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of mockStreamChunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return {
        ok: mockStatus < 400,
        status: mockStatus,
        body: stream,
      } as Response
    }

    return {
      ok: mockStatus < 400,
      status: mockStatus,
      json: async () => mockResponseBody,
    } as Response
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ── 辅助 ────────────────────────────────────────────

function makeRequest(text: string, model = TEST_MODEL): ModelRequest {
  return {
    model,
    context: {
      messages: [
        { id: 'msg-1', role: MESSAGE_ROLES.USER, createdAt: Date.now(), parts: [{ type: MESSAGE_PART_TYPES.TEXT, text }] },
      ],
    },
    settings: {},
  }
}

describe('DeepSeekAdapter', () => {
  it('request() 返回模型回复', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-ds',
      model: TEST_MODEL,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'DeepSeek reply' },
        finish_reason: 'stop',
      }],
    })

    const result = await adapter.request(makeRequest('hi'))

    assert.equal((result.message.parts[0] as any).text, 'DeepSeek reply')
    assert.equal(result.stopReason, 'stop')
  })

  it('stream() 产 reasoning_content 和 text 事件', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockStream([
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning_content":"思考"},"finish_reason":null}]}\n\n',
      'data: {"id":"1","choices":[{"index":0,"delta":{"content":"回答"},"finish_reason":null}]}\n\n',
      'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const events: ModelStreamEvent[] = []
    for await (const event of adapter.stream(makeRequest('question'))) {
      events.push(event)
    }

    const textDeltas = events.filter(e => e.type === STREAM_EVENT_TYPES.TEXT_DELTA)
    const text = textDeltas.map(e => (e as any).delta).join('')
    assert.equal(text, '回答')

    // reasoning_content 应存储在 metadata.reasoningContent 中（通过最终事件的 response 检查）
    const doneEvent = events.find(e => e.type === STREAM_EVENT_TYPES.DONE) as any
    assert.ok(doneEvent)
    assert.equal(doneEvent.response.message.metadata?.reasoningContent, '思考')
  })

  it('thinking mode 设置 max_tokens', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-think',
      model: 'deepseek-reasoner',
      choices: [{ index: 0, message: { role: 'assistant', content: 'thinking reply' }, finish_reason: 'stop' }],
      usage: {},
    })

    const request: ModelRequest = {
      model: 'deepseek-reasoner',
      context: {
        messages: [
          { id: 'msg-1', role: MESSAGE_ROLES.USER, createdAt: Date.now(), parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: 'hard problem' }] },
        ],
      },
      settings: { thinking: { type: 'enabled' as any, budget_tokens: 8192 } },
    }

    await adapter.request(request)
    const body = JSON.parse(capturedBody)
    assert.ok(body.max_tokens >= 8192, `max_tokens 应 >= 8192，实际 ${body.max_tokens}`)
  })

  it('utility mode 不发送 thinking 配置', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-util',
      model: TEST_MODEL,
      choices: [{ index: 0, message: { role: 'assistant', content: 'quick reply' }, finish_reason: 'stop' }],
    })

    await adapter.request({
      model: TEST_MODEL,
      context: {
        messages: [
          { id: 'msg-1', role: MESSAGE_ROLES.USER, createdAt: Date.now(), parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: 'quick' }] },
        ],
      },
      settings: { providerSpecific: { mode: 'utility' } },
    })
    const body = JSON.parse(capturedBody)
    // utility mode → thinking 应设为 disabled
    assert.deepEqual(body.thinking, { type: 'disabled' })
  })

  it('tool-call 响应正确处理', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-tc',
      model: TEST_MODEL,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_ds_001',
            type: 'function',
            function: { name: 'search', arguments: '{"q":"test"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    })

    const result = await adapter.request(makeRequest('search'))
    assert.equal(result.stopReason, 'tool_calls')
    const tc = result.message.parts.find((p: any) => p.type === MESSAGE_PART_TYPES.TOOL_CALL) as any
    assert.ok(tc)
    assert.equal(tc.name, 'search')
  })

  it('流式 tool-call delta 正确处理', async () => {
    const adapter = new DeepSeekAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockStream([
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_001","type":"function","function":{"name":"search_tool","arguments":""}}]},"finish_reason":null}]}\n\n',
      'data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"q\\":\\"test\\"}"}}]},"finish_reason":null}]}\n\n',
      'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const events: ModelStreamEvent[] = []
    for await (const event of adapter.stream(makeRequest('do search'))) {
      events.push(event)
    }

    const doneEvent = events.find(e => e.type === STREAM_EVENT_TYPES.DONE) as any
    assert.ok(doneEvent)
    const tcPart = doneEvent.response.message.parts.find((p: any) => p.type === MESSAGE_PART_TYPES.TOOL_CALL)
    assert.ok(tcPart, '应有 tool-call part')
    assert.equal(tcPart.name, 'search_tool')
  })
})
