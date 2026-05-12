import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { OpenAIAdapter } from '../src/openai/adapter'
import type { ModelRequest, ModelStreamEvent } from '@crai/core'
import { MESSAGE_PART_TYPES, MESSAGE_ROLES, STREAM_EVENT_TYPES } from '@crai/core'

const TEST_API_KEY = 'sk-test'
const TEST_BASE_URL = 'https://mock-api.example.com'
const TEST_MODEL = 'gpt-4o'

// ── Mock fetch ──────────────────────────────────────

const originalFetch = globalThis.fetch
let mockResponseBody: unknown = null
let mockStreamChunks: string[] = []
let mockStatus = 200
let capturedUrl = ''
let capturedHeaders: Record<string, string> = {}
let capturedBody = ''

function setupMockResponse(body: unknown) {
  mockResponseBody = body
  mockStatus = 200
}

function setupMockStream(chunks: string[]) {
  mockStreamChunks = chunks
  mockStatus = 200
}

function setupMockError(status: number, body: string) {
  mockResponseBody = body
  mockStatus = status
}

beforeEach(() => {
  mockResponseBody = null
  mockStreamChunks = []
  mockStatus = 200
  capturedUrl = ''
  capturedHeaders = {}
  capturedBody = ''

  globalThis.fetch = async (url: any, opts: any) => {
    capturedUrl = String(url)
    capturedHeaders = { ...opts?.headers }
    capturedBody = opts?.body ?? ''

    if (mockStreamChunks.length > 0) {
      // SSE 流式响应
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
        text: async () => mockStreamChunks.join(''),
      } as Response
    }

    return {
      ok: mockStatus < 400,
      status: mockStatus,
      json: async () => mockResponseBody,
      text: async () => String(mockResponseBody ?? ''),
    } as Response
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ── 测试 ────────────────────────────────────────────

function makeRequest(text: string): ModelRequest {
  return {
    model: TEST_MODEL,
    context: {
      messages: [
        { id: 'msg-1', role: MESSAGE_ROLES.USER, createdAt: Date.now(), parts: [{ type: MESSAGE_PART_TYPES.TEXT, text }] },
      ],
    },
    settings: {},
  }
}

describe('OpenAIAdapter', () => {
  it('request() 返回模型回复', async () => {
    const adapter = new OpenAIAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-test',
      model: TEST_MODEL,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Hello from mock!' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })

    const result = await adapter.request(makeRequest('hi'))

    assert.equal(result.message.role, MESSAGE_ROLES.ASSISTANT)
    assert.equal((result.message.parts[0] as any).text, 'Hello from mock!')
    assert.equal(result.stopReason, 'stop')
    assert.ok(capturedUrl.includes('mock-api.example.com'))
  })

  it('request() 正确处理 tool-call 响应', async () => {
    const adapter = new OpenAIAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockResponse({
      id: 'chatcmpl-tc',
      model: TEST_MODEL,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_abc123',
            type: 'function',
            function: { name: 'test_tool', arguments: '{"msg":"hello"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    })

    const result = await adapter.request(makeRequest('use tool'))

    assert.equal(result.stopReason, 'tool_calls')
    assert.ok(result.message.parts.some((p: any) => p.type === MESSAGE_PART_TYPES.TOOL_CALL))
    const tcPart = result.message.parts.find((p: any) => p.type === MESSAGE_PART_TYPES.TOOL_CALL) as any
    assert.equal(tcPart.name, 'test_tool')
  })

  it('API 错误抛出异常', async () => {
    const adapter = new OpenAIAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockError(401, 'Invalid API key')

    await assert.rejects(
      () => adapter.request(makeRequest('hi')),
      (err: any) => err.message.includes('401'),
    )
  })

  it('stream() 产出流式事件', async () => {
    const adapter = new OpenAIAdapter({ apiKey: TEST_API_KEY, baseURL: TEST_BASE_URL })

    setupMockStream([
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"H"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"ello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const events: ModelStreamEvent[] = []
    for await (const event of adapter.stream(makeRequest('hi'))) {
      events.push(event)
    }

    assert.ok(events.length >= 3)
    assert.equal(events[0].type, STREAM_EVENT_TYPES.TEXT_START)
    // 检查文本增量内容
    const textParts = events.filter(e => e.type === STREAM_EVENT_TYPES.TEXT_DELTA).map(e => (e as any).delta).join('')
    assert.equal(textParts, 'Hello')
    assert.equal(events[events.length - 1].type, STREAM_EVENT_TYPES.DONE)
  })

  it('请求包含正确的 headers', async () => {
    const adapter = new OpenAIAdapter({ apiKey: 'sk-mykey', baseURL: 'https://mock-api.example.com/v1' })

    setupMockResponse({
      id: 'chatcmpl-test',
      model: TEST_MODEL,
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    })

    await adapter.request(makeRequest('hi'))

    assert.ok(capturedHeaders['Authorization']?.includes('sk-mykey'))
    assert.equal(capturedHeaders['Content-Type'], 'application/json')
  })
})
