/**
 * MockDeepSeekAdapter — 模拟 DeepSeek 流式响应，不经网络。
 *
 * 发送 "消息测试" 触发完整 mock 流程：思考 → 工具调用 → 文本回复。
 * 其他消息返回简单问候。
 */

import type { Logger } from '@crai/core'
import { STREAM_EVENT_TYPES, createId } from '@crai/core'
import type { ModelAdapter, ModelRequest, ModelResponse, ModelStreamEvent } from '@crai/core'

const MOCK_ADAPTER_NAME = 'mock'

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
    }
  })
}

/** 逐字符 yield 事件 */
async function* emitChars(
  text: string,
  delayMs: number,
  eventType: string,
  signal?: AbortSignal,
): AsyncIterable<ModelStreamEvent> {
  for (const char of text) {
    if (signal?.aborted) return
    yield { type: eventType as any, delta: char }
    await delay(delayMs, signal)
  }
}

export class MockDeepSeekAdapter implements ModelAdapter {
  name = MOCK_ADAPTER_NAME
  private logger?: Logger

  constructor(options: { logger?: Logger }) {
    this.logger = options.logger
  }

  async request(_request: ModelRequest): Promise<ModelResponse> {
    return {
      message: {
        id: createId('mock'),
        role: 'assistant',
        createdAt: Date.now(),
        parts: [{ type: 'text', text: 'mock response' }],
      },
      stopReason: 'stop',
    }
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const sig = request.signal
    if (sig?.aborted) {
      yield { type: STREAM_EVENT_TYPES.TEXT_END as any }
      yield { type: STREAM_EVENT_TYPES.DONE as any, response: { message: { id: createId('mock'), role: 'assistant', createdAt: Date.now(), parts: [] }, stopReason: 'aborted' } }
      return
    }

    const hasToolResults = request.context.messages.some((m) => m.role === 'tool')
    const lastUserMsg = request.context.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.parts.filter((p) => p.type === 'text').map((p: any) => p.text).join(''))
      .pop() || ''

    try {
      if (hasToolResults) {
        if (lastUserMsg === '复杂多轮测试') {
          yield* this.mockSecondRound(sig)
        } else {
          yield* this.mockFollowUp(sig)
        }
        return
      }

      if (lastUserMsg === '消息测试') {
        yield* this.mockStream(request, sig)
      } else if (lastUserMsg === '复杂多轮测试') {
        yield* this.mockFirstRound(sig)
      } else if (lastUserMsg === '工具测试' || lastUserMsg === 'tool test') {
        yield* this.mockToolTest(request, sig)
      } else if (lastUserMsg === '压缩测试' || lastUserMsg === 'compression test') {
        yield* this.mockCompressionTest(request, sig)
      } else if (lastUserMsg === '第二次压缩测试') {
        const replyText = '压缩触发验证完成。'
        yield* emitChars(replyText, 5, STREAM_EVENT_TYPES.TEXT_DELTA, sig)
        if (sig?.aborted) return
        yield {
          type: STREAM_EVENT_TYPES.DONE as any,
          response: {
            message: { id: createId('mock'), role: 'assistant', createdAt: Date.now(), parts: [{ type: 'text', text: replyText }] },
            stopReason: 'stop',
          },
        }
      } else {
        const replyText = `（Mock 回复）你说了: ${lastUserMsg}`
        yield* emitChars(replyText, 20, STREAM_EVENT_TYPES.TEXT_DELTA, sig)
        if (sig?.aborted) return
        yield {
          type: STREAM_EVENT_TYPES.DONE as any,
          response: {
            message: { id: createId('mock'), role: 'assistant', createdAt: Date.now(), parts: [{ type: 'text', text: replyText }] },
            stopReason: 'stop',
          },
        }
      }
    } finally {
      if (sig?.aborted) {
        yield { type: STREAM_EVENT_TYPES.TEXT_END as any }
        yield { type: STREAM_EVENT_TYPES.DONE as any, response: { message: { id: createId('mock'), role: 'assistant', createdAt: Date.now(), parts: [] }, stopReason: 'aborted' } }
      }
    }
  }
  /** 基本测试：思考 → 3个工具 → 文本。 */
  private async *mockStream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    const tl = (request.settings as any)?.thinkingLevel
    const thinkingEnabled = tl !== 'off'
    if (thinkingEnabled) {
      const thinking = '好的，用户发来一条测试消息，我需要模拟思考过程。首先理解用户需求，然后规划要调用的工具，最后生成回复。'
      yield* emitChars(thinking, 60, STREAM_EVENT_TYPES.THINKING_DELTA, signal)
      if (signal?.aborted) return
      yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }
    }

    const text = '这是 mock 测试的回复内容。以下是当前目录的文件列表信息，以及 README 文件的概要内容，供你参考。'
    const tools: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    for (const tool of [
      { name: 'fs_list', args: JSON.stringify({}) },
      { name: 'fs_read', args: JSON.stringify({ path: 'README.md' }) },
      { name: 'bash', args: JSON.stringify({ command: 'ls -la' }) },
    ]) {
      const id = createId('tc')
      tools.push({ id, name: tool.name, args: JSON.parse(tool.args) })
      if (signal?.aborted) return
      yield {
        type: STREAM_EVENT_TYPES.TOOL_CALL_DELTA as any,
        toolCallId: id,
        name: tool.name,
        argsDelta: tool.args,
        index: 0,
      }
      await delay(200, signal)
    }
    yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return
    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant' as const,
          createdAt: Date.now(),
          parts: [
            { type: 'text' as const, text },
            ...tools.map((t) => ({
              type: 'tool-call' as const,
              toolCallId: t.id,
              name: t.name,
              arguments: t.args,
            })),
          ],
        },
        stopReason: 'tool_calls',
      },
    }
  }

  /** 工具测试：触发所有工具类型，测试分组显示。 */
  private async *mockToolTest(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    // 思考阶段
    if ((request.settings as any)?.thinkingLevel !== 'off') {
      const thinking = '收到工具测试请求。需要调用多种工具完成不同任务。'
      yield* emitChars(thinking, 30, STREAM_EVENT_TYPES.THINKING_DELTA, signal)
      if (signal?.aborted) return
      yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }
    }

    const text = '开始执行测试任务：'
    yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return

    // 全种类工具调用（不同 resourceId 分组）
    const toolList = [
      // fs_read → res:fs-read:/README.md（与 fs_grep /same/path 同组串行）
      { name: 'fs_read', args: { path: 'README.md' } },
      // fs_grep → res:fs-read:/README.md（与 fs_read 同组串行）
      { name: 'fs_grep', args: { path: 'README.md', pattern: 'test' } },
      // fs_list → res:fs-read:（独立路径，另一个串行组）
      { name: 'fs_list', args: {} },
      // bash → res:terminal（独立组串行）
      { name: 'bash', args: { command: 'ls -la' } },
      // web_fetch + web_search → res:web:xxx（每个独立并行）
      { name: 'web_fetch', args: { url: 'https://example.com' } },
      { name: 'web_search', args: { query: 'test' } },
      // 每个 tool-call 作为独立 delta 流式发出
    ]

    const tools: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    for (const tool of toolList) {
      const id = createId('tc')
      tools.push({ id, name: tool.name, args: tool.args })
      if (signal?.aborted) return
      yield {
        type: STREAM_EVENT_TYPES.TOOL_CALL_DELTA as any,
        toolCallId: id,
        name: tool.name,
        argsDelta: JSON.stringify(tool.args),
        index: 0,
      }
      await delay(100, signal)
    }
    if (signal?.aborted) return

    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant' as const,
          createdAt: Date.now(),
          parts: [
            { type: 'text' as const, text },
            ...tools.map((t) => ({
              type: 'tool-call' as const,
              toolCallId: t.id,
              name: t.name,
              arguments: t.args,
            })),
          ],
        },
        stopReason: 'tool_calls',
      },
    }
  }

  /** 压缩测试：返回大量文本积累 token，供上下文压缩触发验证。 */
  private async *mockCompressionTest(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    // 大量长文本（约 1500 tokens），使 2-3 轮发送后 token 数超过 1% 阈值触发压缩
    const paragraphs = [
      '一、系统架构概览。本系统采用模块化的微服务架构，各组件之间通过事件总线进行通信。核心组件包括：运行时引擎（Runtime Engine）、会话管理器（Session Manager）、模型适配器（Model Adapter）、工具执行器（Tool Executor）和持久化层（Persistence Layer）。',
      '二、事件驱动设计。系统内部使用事件驱动架构，所有组件通过统一事件总线进行异步通信。主要事件类型包括：模型流事件（text-delta、thinking-delta）、活动事件（activity.start、activity.done）、工具事件（tool.start、tool.done）和会话事件（session.start、session.end）。这种设计使得各组件之间解耦，便于测试和扩展。',
      '三、会话生命周期。每个会话从用户发送第一条消息开始，到用户主动关闭或超时结束。会话中维护完整的消息历史，每条消息包含角色（user/assistant/tool）、时间戳、内容部分（parts）和元数据。会话管理器负责会话的创建、检索和持久化。',
      '四、上下文管理策略。为了防止上下文窗口溢出，系统会根据当前会话的 token 占用率自动触发上下文压缩。压缩策略包括：AI 摘要优先，失败时回退到硬截断。压缩后保留最近两轮对话和 AI 生成的摘要。',
      '五、工具调用机制。工具调用分为流式和非流式两种模式。流式模式下，工具调用的参数通过 tool-call-delta 事件逐片传输，done 事件携带完整的工具调用列表。工具执行器根据 resourceId 对工具调用进行分组，同一资源的工具串行执行，不同资源的工具并行执行。',
      '六、安全性设计。系统内置了多层安全机制：PII 检测在持久化时自动脱敏敏感信息、沙箱隔离对 shell 命令提供 OS 级隔离、权限系统对敏感操作进行二次确认。访问密钥使用 scrypt 哈希存储，支持吊销和多密钥管理。',
      '七、测试策略。系统提供完整的 Mock 适配器，支持模拟思考过程、工具调用、多轮对话和上下文压缩等场景。Mock 适配器不经过网络，适用于集成测试和功能验证。',
      '八、事件总线。采用发布-订阅模式，支持多个订阅者同时监听同一事件。每个事件类型有独立的主题，订阅者通过主题名称注册。事件负载包含事件发生的上下文信息，如 sessionId 和 turnId。',
      '九、数据流路径。用户消息从前端发送到 WebSocket 传输层，传输层解析消息类型后转发给对应的 runtime 处理。Runtime 调用模型适配器获取响应，响应通过事件系统广播给所有连接的客户端。',
      '十、错误处理。系统实现了三层错误处理机制：模型调用层捕获 API 错误并进行重试，工具执行层捕获执行异常并记录错误结果，传输层捕获未预期异常并返回错误给前端。',
    ]
    
    const longText = Array.from({ length: 15 }, (_, i) =>
      '[段落 ' + (i + 1) + '/15] ' +
      paragraphs[i % paragraphs.length] + ' ' +
      paragraphs[(i + 3) % paragraphs.length] + ' ' +
      paragraphs[(i + 7) % paragraphs.length] + '\n\n'
    ).join('') +
    '—— 压缩测试结束 ——'

    yield* emitChars(longText, 1, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return
    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant',
          createdAt: Date.now(),
          parts: [{ type: 'text', text: longText }],
        },
        stopReason: 'stop',
      },
    }
  }

  /** 复杂多轮测试：第一轮（思考→文本→2个工具→触发第二轮）。 */  /** 复杂多轮测试：第一轮（思考→文本→2个工具→触发第二轮）。 */
  private async *mockFirstRound(signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    const think1 = '用户请求多轮交互测试。首先需要理解需求，准备第一轮的工具调用。'
    yield* emitChars(think1, 80, STREAM_EVENT_TYPES.THINKING_DELTA, signal)
    if (signal?.aborted) return
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    const text1 = '好的，开始第一轮处理。让我先列出当前目录文件，然后读取 README。'
    yield* emitChars(text1, 30, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return

    const tools: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    for (const tool of [
      { name: 'fs_list', args: JSON.stringify({}) },
      { name: 'fs_read', args: JSON.stringify({ path: 'README.md' }) },
    ]) {
      const id = createId('tc')
      tools.push({ id, name: tool.name, args: JSON.parse(tool.args) })
      if (signal?.aborted) return
      yield {
        type: STREAM_EVENT_TYPES.TOOL_CALL_DELTA as any,
        toolCallId: id,
        name: tool.name,
        argsDelta: tool.args,
        index: 0,
      }
      await delay(300, signal)
    }
    if (signal?.aborted) return
    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant' as const,
          createdAt: Date.now(),
          parts: [
            { type: 'text' as const, text: text1 },
            ...tools.map((t) => ({
              type: 'tool-call' as const,
              toolCallId: t.id,
              name: t.name,
              arguments: t.args,
            })),
          ],
        },
        stopReason: 'tool_calls',
      },
    }
  }

  /** 基础测试的第二轮：工具执行完成后，简单总结，不再调工具。 */
  private async *mockFollowUp(signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    const think = '工具已全部执行完毕，现在整理结果。'
    yield* emitChars(think, 30, STREAM_EVENT_TYPES.THINKING_DELTA, signal)
    if (signal?.aborted) return
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    const text = '文件列表、README 内容和目录结构均已获取。这就是 mock 测试的全部回复。'
    yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return
    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant',
          createdAt: Date.now(),
          parts: [{ type: 'text', text }],
        },
        stopReason: 'stop',
      },
    }
  }

  /** 复杂多轮测试：第二轮（工具结果回传后，思考→文本）。 */
  private async *mockSecondRound(signal?: AbortSignal): AsyncIterable<ModelStreamEvent> {
    await delay(1500, signal)
    if (signal?.aborted) return

    const think2 = '工具执行完毕，现在基于结果进行第二轮分析。'
    yield* emitChars(think2, 80, STREAM_EVENT_TYPES.THINKING_DELTA, signal)
    if (signal?.aborted) return
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    const text2 = '总结：当前目录包含 README.md 等文件。'
    yield* emitChars(text2, 30, STREAM_EVENT_TYPES.TEXT_DELTA, signal)
    if (signal?.aborted) return

    yield {
      type: STREAM_EVENT_TYPES.DONE as any,
      response: {
        message: {
          id: createId('mock'),
          role: 'assistant',
          createdAt: Date.now(),
          parts: [{ type: 'text', text: text2 }],
        },
        stopReason: 'stop',
      },
    }
  }
}
