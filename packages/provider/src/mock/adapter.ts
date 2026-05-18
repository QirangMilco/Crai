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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 逐字符 yield 事件 */
async function* emitChars(
  text: string,
  delayMs: number,
  eventType: string,
): AsyncIterable<ModelStreamEvent> {
  for (const char of text) {
    yield { type: eventType as any, delta: char }
    await delay(delayMs)
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
    const hasToolResults = request.context.messages.some((m) => m.role === 'tool')
    const userText = request.context.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.parts.filter((p) => p.type === 'text').map((p: any) => p.text).join(''))
      .join('\n')

    // 带工具结果的第二轮调用
    if (hasToolResults) {
      if (userText === '复杂多轮测试') {
        yield* this.mockSecondRound()
      } else {
        // 基础测试的第二轮：简单总结，不再调工具
        yield* this.mockFollowUp()
      }
      return
    }

    if (userText === '消息测试') {
      yield* this.mockStream(request)
    } else if (userText === '复杂多轮测试') {
      yield* this.mockFirstRound()
    } else {
      // 简单回复
      const text = `（Mock 回复）你说了: ${userText}`
      yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA)
      const content = request.context.messages.map((m) => m.parts.map((p: any) => p.text).join('')).join('\n')
      yield {
        type: STREAM_EVENT_TYPES.DONE as any,
        response: {
          message: {
            id: createId('mock'),
            role: 'assistant',
            createdAt: Date.now(),
            parts: [{ type: 'text', text: content }],
          },
          stopReason: 'stop',
        },
      }
    }
  }

  /** 基本测试：思考 → 3个工具 → 文本。 */
  private async *mockStream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const tl = (request.settings as any)?.thinkingLevel
    const thinkingEnabled = tl !== 'off'
    if (thinkingEnabled) {
      const thinking = '好的，用户发来一条测试消息，我需要模拟思考过程。首先理解用户需求，然后规划要调用的工具，最后生成回复。'
      yield* emitChars(thinking, 60, STREAM_EVENT_TYPES.THINKING_DELTA)
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
      yield {
        type: STREAM_EVENT_TYPES.TOOL_CALL_DELTA as any,
        toolCallId: id,
        name: tool.name,
        argsDelta: tool.args,
        index: 0,
      }
      await delay(200)
    }
    yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA)
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

  /** 复杂多轮测试：第一轮（思考→文本→2个工具→触发第二轮）。 */
  private async *mockFirstRound(): AsyncIterable<ModelStreamEvent> {
    // ── 第一轮：思考 ──
    const think1 = '用户请求多轮交互测试。首先需要理解需求，准备第一轮的工具调用。'
    yield* emitChars(think1, 80, STREAM_EVENT_TYPES.THINKING_DELTA)
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    // ── 第一轮：文本 ──
    const text1 = '好的，开始第一轮处理。让我先列出当前目录文件，然后读取 README。'
    yield* emitChars(text1, 30, STREAM_EVENT_TYPES.TEXT_DELTA)

    // ── 第一轮：工具调用（积累工具信息，用于 DONE 的 parts） ──
    const tools: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    for (const tool of [
      { name: 'fs_list', args: JSON.stringify({}) },
      { name: 'fs_read', args: JSON.stringify({ path: 'README.md' }) },
    ]) {
      const id = createId('tc')
      tools.push({ id, name: tool.name, args: JSON.parse(tool.args) })
      yield {
        type: STREAM_EVENT_TYPES.TOOL_CALL_DELTA as any,
        toolCallId: id,
        name: tool.name,
        argsDelta: tool.args,
        index: 0,
      }
      await delay(300)
    }

    // DONE 必须包含 tool-call parts，runtime 才能检测到工具调用并执行
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
  private async *mockFollowUp(): AsyncIterable<ModelStreamEvent> {
    const think = '工具已全部执行完毕，现在整理结果。'
    yield* emitChars(think, 30, STREAM_EVENT_TYPES.THINKING_DELTA)
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    const text = '文件列表、README 内容和目录结构均已获取。这就是 mock 测试的全部回复。'
    yield* emitChars(text, 20, STREAM_EVENT_TYPES.TEXT_DELTA)
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

  /** 复杂多轮测试：第二轮（工具结果回传后，思考→文本）。有 1.5s 模拟延迟。 */
  private async *mockSecondRound(): AsyncIterable<ModelStreamEvent> {
    await delay(1500)

    const think2 = '工具执行完毕，现在基于结果进行第二轮分析。文件列表显示有 README.md 等文件。'
    yield* emitChars(think2, 80, STREAM_EVENT_TYPES.THINKING_DELTA)
    yield { type: STREAM_EVENT_TYPES.THINKING_DONE as any }

    const text2 = '总结：当前目录包含 README.md 等文件。以上就是多轮交互的完整 mock 演示。'
    yield* emitChars(text2, 30, STREAM_EVENT_TYPES.TEXT_DELTA)

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
