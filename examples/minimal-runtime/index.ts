/**
 * Crai 最小运行时示例。
 * 不依赖任何外部 API key，使用内置 mock 模型演示完整流程。
 * 运行方式：npx tsx examples/minimal-runtime/index.ts
 */
import { createRuntime } from '../../packages/runtime/src/createRuntime'
import type { Extension, ModelAdapter, ModelRequest, ModelResponse } from '../../packages/core/src'

function createMockModel(responseText: string): ModelAdapter {
  return {
    name: 'example:mock',
    async request(_request: ModelRequest): Promise<ModelResponse> {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          createdAt: Date.now(),
          parts: [{ type: 'text', text: responseText }],
        },
        stopReason: 'stop',
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
    name: 'example:mock-model',
    setup(ctx) {
      ctx.registry.models.register('example-model', createMockModel(responseText))
    },
  }
}

async function main() {
  console.log('=== Crai 最小运行时示例 ===\n')

  const runtime = await createRuntime({
    extensions: [createMockModelExtension('你好，世界！')],
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  })

  console.log(`runtime 已启动: ${runtime.id}`)

  const session = await runtime.createSession({ title: '最小示例' })
  console.log(`session 已创建: ${session.id}`)

  const result = await runtime.prompt(
    { type: 'text', text: '你好' },
    { model: 'example-model' },
  )

  console.log(`turn: ${result.turnId}`)
  console.log(`消息数: ${result.messages.length}`)
  console.log(`响应内容: ${(result.messages[0].parts[0] as any).text}`)

  await runtime.stopSession(session.id, result.messages)
  console.log('session 已停止')

  await runtime.dispose()
  console.log('runtime 已关闭')
  console.log('\n=== 完成 ===')
}

main().catch(console.error)
