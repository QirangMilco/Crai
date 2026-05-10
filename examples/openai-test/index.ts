/**
 * OpenAI 兼容 API 连通性测试。
 *
 * 使用方法：
 *   export AI_API_KEY=sk-xxx
 *   export AI_BASE_URL=https://api.deepseek.com
 *   export AI_MODEL=gpt-4o-mini 
 *   pnpm openai
 *
 * 测试内容：
 *   - 单轮对话
 *   - 多轮对话（上下文记忆 + 持久化）
 *   - 带 system prompt
 *   - 直接调用 adapter.stream() 验证流式
 *   - 错误处理（无效 key）
 */

import { createRuntime } from '@crai/runtime'
import type { Extension } from '@crai/core'
import { HOOKS } from '@crai/core'
import { createOpenAIProvider, OpenAIAdapter } from '@crai/provider'
import { createFileStorage } from '@crai/storage-fs'

// ── 配置 ─────────────────────────────────────────────
const API_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY
const BASE_URL = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL
const MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini'
const AI_TRACE = process.env.AI_TRACE ?? ''
const TRACE_OPTION =
  AI_TRACE === 'file' ? 'file'
  : AI_TRACE === 'realtime' ? 'realtime'
  : AI_TRACE === 'console' ? 'console'
  : AI_TRACE === '1' || AI_TRACE === 'true' ? true
  : undefined

if (!API_KEY) {
  console.error('请设置 AI_API_KEY 或 OPENAI_API_KEY 环境变量')
  process.exit(1)
}

/** 经过顶部的守卫检查，API_KEY 和 BASE_URL 在此之后保证有值。 */

const providerOptions: { apiKey: string; models: string[]; baseURL?: string } = { apiKey: API_KEY!, models: [MODEL] }
if (BASE_URL) providerOptions.baseURL = BASE_URL

// ── 单轮对话 ─────────────────────────────────────────
async function testSingleTurn() {
  console.log('\n═══ 单轮对话 ═══\n')

  const runtime = await createRuntime({
    extensions: [createOpenAIProvider(providerOptions)],
    trace: TRACE_OPTION,
  })

  const result = await runtime.prompt({ type: 'text', text: '用一句话解释量子纠缠' })
  const text = (result.response?.message.parts[0] as any)?.text
  console.log(`回复: ${text || '(空)'}`)

  await runtime.dispose()
}

// ── 多轮对话 ─────────────────────────────────────────
/** 将 turn 输出的消息保存到 storage，让下一轮能读到上下文。 */
const persistExt: Extension = {
  name: 'example:persist',
  setup(ctx) {
    ctx.hooks.on(HOOKS.TURN_AFTER, async (payload: any) => {
      const { session, messages } = payload
      const storage = ctx.registry.storages.list()[0]?.value
      if (!storage) return { continue: true }
      await storage.updateSession(session)
      for (const msg of messages) {
        await storage.appendMessage(session.id, msg)
      }
      return { continue: true }
    })
  },
}


async function testMultiTurn() {
  console.log('\n═══ 多轮对话（持久化） ═══\n')

  const runtime = await createRuntime({
    extensions: [
      createOpenAIProvider(providerOptions),
      createFileStorage({ baseDir: './crai/openai-data' }),
      persistExt,
    ],
    trace: TRACE_OPTION,
  })

  const session = await runtime.createSession({ title: '多轮测试' })

  const r1 = await runtime.prompt(
    { type: 'text', text: '我的名字是水晶' },
    { sessionId: session.id },
  )
  const t1 = (r1.response?.message.parts[0] as any)?.text
  console.log(`用户: 我的名字是水晶`)
  console.log(`助手: ${t1?.slice(0, 100)}...`)

  const r2 = await runtime.prompt(
    { type: 'text', text: '我刚才说了我叫什么？' },
    { sessionId: session.id },
  )
  const t2 = (r2.response?.message.parts[0] as any)?.text
  console.log(`用户: 我刚才说了我叫什么？`)
  console.log(`助手: ${t2?.slice(0, 100)}...`)

  await runtime.stopSession(session.id, r2.messages)
  await runtime.dispose()
}

// ── 带 System Prompt ─────────────────────────────────
async function testWithSystemPrompt() {
  console.log('\n═══ System Prompt ═══\n')

  const runtime = await createRuntime({
    extensions: [createOpenAIProvider(providerOptions)],
    trace: TRACE_OPTION,
  })

  const session = await runtime.createSession({
    system: '你是一个只用一个字的冷面大师',
  })

  const result = await runtime.prompt(
    { type: 'text', text: '今天天气如何' },
    { sessionId: session.id },
  )
  const text = (result.response?.message.parts[0] as any)?.text
  console.log(`回复: ${text}`)

  await runtime.dispose()
}

// ── 流式测试（直接调用 adapter）───────────────────────
async function testStream() {
  console.log('\n═══ 流式测试 ═══\n')

  const adapter = new OpenAIAdapter({ apiKey: API_KEY!, baseURL: BASE_URL })

  const stream = adapter.stream({
    sessionId: 'stream-test',
    turnId: 'stream-test',
    model: MODEL,
    context: {
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          createdAt: Date.now(),
          parts: [{ type: 'text', text: '从 1 数到 3' }],
        },
      ],
      tools: [],
    },
  })

  let text = ''
  for await (const event of stream) {
    if (event.type === 'text-delta') {
      text += event.delta
    } else if (event.type === 'error') {
      console.error('流错误:', (event as any).error?.message)
    }
  }
  console.log(`流式回复: ${text}`)
}

// ── 错误处理 ──────────────────────────────────────────
async function testErrorHandling() {
  console.log('\n═══ 错误处理（无效 key） ═══\n')

  const runtime = await createRuntime({
    extensions: [createOpenAIProvider({ apiKey: 'sk-invalid' })],
    trace: TRACE_OPTION,
  })

  try {
    await runtime.prompt({ type: 'text', text: 'hi' })
  } catch (err: any) {
    console.log(`正确捕获: ${err.code} — ${err.message?.slice(0, 80)}`)
  }

  await runtime.dispose()
}

// ── 主入口 ────────────────────────────────────────────
async function main() {
  const tests: [string, () => Promise<void>][] = [
    ['单轮对话', testSingleTurn],
    ['多轮对话', testMultiTurn],
    ['System Prompt', testWithSystemPrompt],
    ['流式测试', testStream],
    ['错误处理', testErrorHandling],
  ]

  for (const [name, fn] of tests) {
    try {
      await fn()
      console.log(`✓ ${name} 通过`)
    } catch (e: any) {
      console.error(`✗ ${name} 失败: ${e.message}`)
    }
  }

  console.log('\n完成')
}

main()
