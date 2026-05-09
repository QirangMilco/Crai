/**
 * Crai 最小运行时示例（含持久化）。
 * 使用文件系统存储演示多轮对话上下文延续。
 * 运行方式：pnpm example
 */
import { createRuntime } from '@crai/runtime'
import type { Extension, ModelAdapter, ModelRequest, ModelResponse } from '@crai/core'
import { HOOKS, MESSAGE_PART_TYPES, MESSAGE_ROLES, RUNTIME_INPUT_TYPES, STREAM_EVENT_TYPES } from '@crai/core'
import { createFileStorage } from '@crai/storage-fs'

const AI_TRACE = process.env.AI_TRACE ?? ''
const TRACE_OPTION =
  AI_TRACE === 'file' ? 'file'
  : AI_TRACE === 'realtime' ? 'realtime'
  : AI_TRACE === 'console' ? 'console'
  : AI_TRACE === '1' || AI_TRACE === 'true' ? true
  : undefined

function createMockModel(responseText: string): ModelAdapter {
  return {
    name: 'example:mock',
    async request(_request: ModelRequest): Promise<ModelResponse> {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: MESSAGE_ROLES.ASSISTANT,
          createdAt: Date.now(),
          parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: responseText }],
        },
        stopReason: 'stop',
      }
    },
    async *stream() {
      yield { type: STREAM_EVENT_TYPES.TEXT_START }
      yield { type: STREAM_EVENT_TYPES.TEXT_END }
      yield { type: STREAM_EVENT_TYPES.DONE, response: { message: { id: `msg_${Date.now()}`, role: MESSAGE_ROLES.ASSISTANT, createdAt: Date.now(), parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: responseText }] } } }
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

/** 示例：turn 结束后将消息写入 storage 的持久化 extension。 */
function createPersistExtension(): Extension {
  return {
    name: 'example:persist',
    setup(ctx) {
      ctx.hooks.on(HOOKS.TURN_AFTER, async (payload) => {
        const { session, messages, runtime } = payload as any
        const storages = ctx.registry.storages.list()
        const storage = storages[0]?.value
        if (!storage) return { continue: true }

        await storage.updateSession(session)
        for (const msg of messages) {
          await storage.appendMessage(session.id, msg)
        }
        return { continue: true }
      })
    },
  }
}

async function main() {
  console.log('=== Crai 最小运行时示例（含持久化）===\n')

  const runtime = await createRuntime({
    extensions: [
      createMockModelExtension('你好，世界！我是你的助手。'),
      createFileStorage({ baseDir: '.crai/example-data' }),
      createPersistExtension(),
    ],
    trace: TRACE_OPTION,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  })

  console.log(`runtime: ${runtime.id}`)

  const session = await runtime.createSession({ title: '多轮对话示例' })
  console.log(`session: ${session.id}\n`)

  // 第一轮
  const r1 = await runtime.prompt(
    { type: RUNTIME_INPUT_TYPES.TEXT, text: '你好' },
    { model: 'example-model', sessionId: session.id },
  )
  console.log(`[第1轮] ${r1.turnId}`)
  console.log(`  assistant → ${(r1.messages[0].parts[0] as any).text}`)

  // 第二轮（复用 sessionId，context 包含上轮消息）
  const r2 = await runtime.prompt(
    { type: RUNTIME_INPUT_TYPES.TEXT, text: '还记得我第一轮说了什么吗' },
    { model: 'example-model', sessionId: session.id },
  )
  console.log(`[第2轮] ${r2.turnId}`)
  console.log(`  assistant → ${(r2.messages[0].parts[0] as any).text}`)

  await runtime.stopSession(session.id, [])
  await runtime.dispose()
  console.log('\n=== 完成 ===')
}

main().catch(console.error)
