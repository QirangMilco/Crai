import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../src/createRuntime'
import type { Extension, ModelAdapter, ModelRequest, ModelResponse } from '../../core/src'

// ============================================================
// Mock 模型工厂 — 用于隔离测试，不依赖真实网络
// ============================================================

const MOCK_MODEL_NAME = 'test:mock-model'
const MOCK_ADAPTER_NAME = 'test:mock-adapter'
const MOCK_EXT_NAME = 'test:mock-model-ext'
const MOCK_RESPONSE_TEXT = '你好，我是 mock！'
const MOCK_STOP_REASON = 'stop'

function makeMockModel(responseText: string): ModelAdapter {
  return {
    name: MOCK_ADAPTER_NAME,
    async request(_request: ModelRequest): Promise<ModelResponse> {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          createdAt: Date.now(),
          parts: [{ type: 'text', text: responseText }],
        },
        stopReason: MOCK_STOP_REASON,
      }
    },
    async *stream() {
      yield { type: 'text-start' }
      yield { type: 'text-end' }
      yield { type: 'done', response: { message: { id: `msg_${Date.now()}`, role: 'assistant', createdAt: Date.now(), parts: [{ type: 'text', text: responseText }] } } }
    },
  }
}

function createMockModelExtension(responseText: string): Extension {
  return {
    name: MOCK_EXT_NAME,
    setup(ctx) {
      ctx.registry.models.register(MOCK_MODEL_NAME, makeMockModel(responseText))
    },
  }
}

const QUIET_LOGGER = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

// ============================================================
// 测试
// ============================================================

describe('Crai runtime', () => {
  it('prompt 通过 mock 模型完整走通 input→context→model→persist', async () => {
    const runtime = await createRuntime({
      extensions: [createMockModelExtension(MOCK_RESPONSE_TEXT)],
      logger: QUIET_LOGGER,
    })

    const result = await runtime.prompt({ type: 'text', text: 'hello' }, { model: MOCK_MODEL_NAME })

    assert.equal(result.session.id.startsWith('session_'), true, '应创建 session')
    assert.equal(result.turnId.startsWith('turn_'), true, '应创建 turn')
    assert.equal(result.messages.length, 1, '应返回一条消息')
    assert.equal(result.messages[0].role, 'assistant')
    assert.equal((result.messages[0].parts[0] as any).text, MOCK_RESPONSE_TEXT)
    assert.equal(result.response?.stopReason, MOCK_STOP_REASON)

    await runtime.dispose()
  })

  it('createSession 和 stopSession 正常工作', async () => {
    const runtime = await createRuntime({ logger: QUIET_LOGGER })

    const session = await runtime.createSession({ test: true })
    assert.ok(session.id)
    assert.equal(session.createdAt, session.updatedAt)

    await runtime.stopSession(session.id, [])
    const updated = await runtime.getSession(session.id)
    assert.ok(updated)
    assert.ok(updated!.updatedAt >= session.createdAt, 'updatedAt 应前进')

    await runtime.dispose()
  })

  it('无模型注册时报错', async () => {
    const runtime = await createRuntime({ logger: QUIET_LOGGER })

    await assert.rejects(
      () => runtime.prompt({ type: 'text', text: 'hello' }),
      (err: any) => {
        assert.ok(err)
        return true
      },
    )

    await runtime.dispose()
  })
})
