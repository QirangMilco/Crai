/**
 * DeepSeek API 连通性测试。
 *
 * 自动处理 DeepSeek thinking mode 的 reasoning_content 捕获与回传。
 *
 * 使用方法：
 *   export AI_API_KEY=sk-xxx
 *   export AI_BASE_URL=https://api.deepseek.com
 *   export AI_MODEL=deepseek-v4-flash
 *   pnpm deepseek
 *
 * 测试内容：
 *   - 单轮对话（流式展示）
 *   - 多轮对话（上下文记忆 + 持久化）
 *   - 带 system prompt
 *   - 工具执行（含多轮 tool-call 循环，验证 reasoning_content 回传）
 *   - 直接调用 adapter.stream()
 *   - 错误处理
 */

import { createRuntime } from '@crai/runtime'
import type { Extension, ToolExecutionResult } from '@crai/core'
import { EVENTS, HOOKS, TOOL_SAFETY_LEVELS } from '@crai/core'
import { createDeepSeekProvider, DeepSeekAdapter } from '@crai/provider'
import { createFileStorage } from '@crai/storage-fs'

// ── 配置 ─────────────────────────────────────────────
const API_KEY = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY
const BASE_URL = process.env.AI_BASE_URL ?? 'https://api.deepseek.com'
const MODEL = process.env.AI_MODEL ?? 'deepseek-v4-flash'
const AI_TRACE = process.env.AI_TRACE ?? ''
const TRACE_OPTION =
  AI_TRACE === 'file' ? 'file'
  : AI_TRACE === 'realtime' ? 'realtime'
  : AI_TRACE === 'console' ? 'console'
  : AI_TRACE === '1' || AI_TRACE === 'true' ? true
  : undefined

if (!API_KEY) {
  console.error('请设置 AI_API_KEY 或 DEEPSEEK_API_KEY 环境变量')
  process.exit(1)
}

const providerOptions: { apiKey: string; models: string[]; baseURL?: string } = {
  apiKey: API_KEY!,
  models: [MODEL],
}
if (BASE_URL) providerOptions.baseURL = BASE_URL

// ── 辅助扩展 ─────────────────────────────────────────

/** 流式展示：将 model:delta 事件实时写到 stdout。 */
function streamDisplay(): Extension {
  return {
    name: 'example:stream-display',
    setup(ctx) {
      ctx.events.on(EVENTS.MODEL_DELTA, (event: any) => {
        process.stdout.write(event.payload.delta)
      })
    },
  }
}

/** 持久化：turn 结束后将消息写入 storage。 */
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

// ── 单轮对话 ─────────────────────────────────────────
async function testSingleTurn() {
  console.log('\n═══ 单轮对话 ═══')

  const runtime = await createRuntime({
    extensions: [createDeepSeekProvider(providerOptions), streamDisplay()],
    trace: TRACE_OPTION,
  })

  process.stdout.write('\n回复: ')
  await runtime.prompt({ type: 'text', text: '用一句话解释量子纠缠' })
  console.log()

  await runtime.dispose()
}

// ── 多轮对话 ─────────────────────────────────────────
async function testMultiTurn() {
  console.log('\n═══ 多轮对话（持久化） ═══\n')

  const runtime = await createRuntime({
    extensions: [
      createDeepSeekProvider(providerOptions),
      createFileStorage({ baseDir: '.crai/deepseek-data' }),
      persistExt,
      streamDisplay(),
    ],
    trace: TRACE_OPTION,
  })

  const session = await runtime.createSession({ title: '多轮测试' })

  process.stdout.write('用户: 我的名字是水晶\n')
  process.stdout.write('助手: ')
  const r1 = await runtime.prompt(
    { type: 'text', text: '我的名字是水晶' },
    { sessionId: session.id },
  )
  console.log()

  process.stdout.write('用户: 我刚才说了我叫什么？\n')
  process.stdout.write('助手: ')
  const r2 = await runtime.prompt(
    { type: 'text', text: '我刚才说了我叫什么？' },
    { sessionId: session.id },
  )
  console.log()

  await runtime.stopSession(session.id, r2.messages)
  await runtime.dispose()
}

// ── 带 System Prompt ─────────────────────────────────
async function testWithSystemPrompt() {
  console.log('\n═══ System Prompt ═══')

  const runtime = await createRuntime({
    extensions: [createDeepSeekProvider(providerOptions), streamDisplay()],
    trace: TRACE_OPTION,
  })

  const session = await runtime.createSession({
    system: '你是一个只用一个字的冷面大师',
  })

  process.stdout.write('\n回复: ')
  await runtime.prompt(
    { type: 'text', text: '今天天气如何' },
    { sessionId: session.id },
  )
  console.log()

  await runtime.dispose()
}

// ── 流式测试（直接调用 adapter）───────────────────────
async function testStream() {
  console.log('\n═══ 流式测试 ═══\n')

  const adapter = new DeepSeekAdapter({ apiKey: API_KEY!, baseURL: BASE_URL })

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

// ── 测试工具 ─────────────────────────────────────────
/** 三个测试工具：get_time / calculator / get_random。 */
const toolExt: Extension = {
  name: 'example:test-tools',
  setup(ctx) {
    ctx.registerTool({
      name: 'get_time',
      description: '获取当前系统时间',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      safetyLevel: TOOL_SAFETY_LEVELS.SAFE,
      execute: async (): Promise<ToolExecutionResult> => ({
        toolCallId: '',
        name: 'get_time',
        content: [{ type: 'text', text: `当前时间: ${new Date().toLocaleString('zh-CN')}` }],
      }),
    })

    ctx.registerTool({
      name: 'calculator',
      description: '执行四则运算，支持加(+)、减(-)、乘(*)、除(/)',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '第一个数' },
          b: { type: 'number', description: '第二个数' },
          op: { type: 'string', enum: ['+', '-', '*', '/'], description: '运算符' },
        },
        required: ['a', 'b', 'op'],
      },
      safetyLevel: TOOL_SAFETY_LEVELS.SAFE,
      execute: async (request): Promise<ToolExecutionResult> => {
        const { a, b, op } = request.toolCall.arguments as any
        const ops: Record<string, (x: number, y: number) => number> = {
          '+': (x, y) => x + y,
          '-': (x, y) => x - y,
          '*': (x, y) => x * y,
          '/': (x, y) => (y === 0 ? NaN : x / y),
        }
        const fn = ops[op as string]
        const result = fn ? fn(Number(a), Number(b)) : NaN
        return {
          toolCallId: request.toolCall.toolCallId,
          name: 'calculator',
          content: [{ type: 'text', text: `${a} ${op} ${b} = ${result}` }],
        }
      },
    })

    ctx.registerTool({
      name: 'get_random',
      description: '生成一个 0 到 1 之间的随机数',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      safetyLevel: TOOL_SAFETY_LEVELS.SAFE,
      execute: async (request): Promise<ToolExecutionResult> => ({
        toolCallId: request.toolCall.toolCallId,
        name: 'get_random',
        content: [{ type: 'text', text: `随机数: ${Math.random().toFixed(4)}` }],
      }),
    })
  },
}

async function testToolExecution() {
  console.log('\n═══ 工具执行测试 ═══\n')

  const runtime = await createRuntime({
    extensions: [createDeepSeekProvider(providerOptions), toolExt, streamDisplay()],
    trace: TRACE_OPTION,
  })

  const session = await runtime.createSession()

  process.stdout.write('用户: 请使用 get_time 工具告诉我当前时间，然后再用 calculator 计算 123 + 456 的结果，然后用 get_random 工具生成一个随机数，最后用 calculator 计算随机数与结果的和\n')
  process.stdout.write('助手: ')
  const result = await runtime.prompt(
    { type: 'text', text: '请使用 get_time 工具告诉我当前时间，然后再用 calculator 计算 123 + 456 的结果，然后用 get_random 工具生成一个随机数，最后用 calculator 计算随机数与结果的和' },
    { sessionId: session.id },
  )
  console.log()

  // 打印工具调用详情
  const toolMessages = result.messages.filter(m => m.role === 'tool')
  if (toolMessages.length > 0) {
    console.log(`\n工具调用次数: ${toolMessages.length}`)
    for (const msg of toolMessages) {
      for (const part of msg.parts) {
        if (part.type === 'text') {
          console.log(`  结果: ${(part as any).text}`)
        }
      }
    }
  }

  await runtime.stopSession(session.id, result.messages)
  await runtime.dispose()
}

// ── 错误处理 ──────────────────────────────────────────
async function testErrorHandling() {
  console.log('\n═══ 错误处理 ═══\n')

  const runtime = await createRuntime({
    extensions: [createDeepSeekProvider({ apiKey: 'sk-invalid' })],
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
    ['工具执行', testToolExecution],
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
