import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../src/createRuntime'
import type {
  Extension,
  ModelAdapter,
  ModelRequest,
  ModelResponse,
  ToolCallPart,
  ToolExecutionResult,
} from '@crai/core'
import {
  ERROR_CODES,
  MESSAGE_PART_TYPES,
  MESSAGE_ROLES,
  RUNTIME_INPUT_TYPES,
  STREAM_EVENT_TYPES,
} from '@crai/core'

// ============================================================
// Mock 工厂
// ============================================================

const MOCK_MODEL = 'test:tool-model'
const MOCK_TOOL_NAME = 'test:echo'

/** 先返回 tool-call，再返回纯文本。 */
function makeMultiRoundModel(): ModelAdapter {
  let callCount = 0
  return {
    name: 'test:tool-mock',
    async request(_request: ModelRequest): Promise<ModelResponse> {
      callCount++

      if (callCount === 1) {
        // 第一轮：返回 tool-call
        const toolCall: ToolCallPart = {
          type: MESSAGE_PART_TYPES.TOOL_CALL,
          toolCallId: 'tc-1',
          name: MOCK_TOOL_NAME,
          arguments: { msg: '你好' },
        }
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: MESSAGE_ROLES.ASSISTANT,
            createdAt: Date.now(),
            parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: '我来调个工具' }, toolCall],
          },
          stopReason: 'tool_calls',
        }
      }

      // 第二轮及之后：返回纯文本
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: MESSAGE_ROLES.ASSISTANT,
          createdAt: Date.now(),
          parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: '工具已执行完毕' }],
        },
        stopReason: 'stop',
      }
    },
    async *stream() {
      // 不使用流式路径
      yield { type: STREAM_EVENT_TYPES.DONE, response: await this.request({} as any) }
    },
  }
}

/** 注册 mock 模型 + mock 工具。 */
function createToolTestExtension(): Extension {
  return {
    name: 'test:tool-ext',
    setup(ctx) {
      // 注册模型
      ctx.registry.models.register(MOCK_MODEL, makeMultiRoundModel())

      // 注册工具
      ctx.registerTool({
        name: MOCK_TOOL_NAME,
        description: '回显参数',
        inputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
        safetyLevel: 'safe' as any,
        execute: async (request): Promise<ToolExecutionResult> => {
          const args = request.toolCall.arguments
          return {
            toolCallId: request.toolCall.toolCallId,
            name: MOCK_TOOL_NAME,
            content: [{ type: MESSAGE_PART_TYPES.TEXT, text: `echo: ${args.msg ?? ''}` }],
          }
        },
      })
    },
  }
}

const QUIET_LOGGER = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

// ============================================================
// 测试
// ============================================================

describe('工具执行循环', () => {
  it('模型返回 tool-call 后执行工具，再调模型，最终返回纯文本', async () => {
    const runtime = await createRuntime({
      extensions: [createToolTestExtension()],
      logger: QUIET_LOGGER,
    })

    const result = await runtime.prompt(
      { type: RUNTIME_INPUT_TYPES.TEXT, text: '使用工具' },
      { model: MOCK_MODEL },
    )

    // 应包含 4 条消息：input, assistant(含tool-call), tool-result, assistant(纯文本)
    assert.equal(result.messages.length, 4, `应为 4 条消息，实际 ${result.messages.length}`)
    assert.equal(result.messages[0].role, MESSAGE_ROLES.USER, '第一条为 user')
    assert.equal(result.messages[1].role, MESSAGE_ROLES.ASSISTANT, '第二条为 assistant')
    assert.equal(result.messages[2].role, MESSAGE_ROLES.TOOL, '第三条为 tool')
    assert.equal(result.messages[3].role, MESSAGE_ROLES.ASSISTANT, '第四条为 assistant')

    // 最终响应应为纯文本
    const finalText = (result.messages[3].parts[0] as any)?.text
    assert.equal(finalText, '工具已执行完毕')

    await runtime.dispose()
  })

  it('无 handler 的工具被跳过', async () => {
    const runtime = await createRuntime({
      extensions: [
        {
          name: 'test:no-handler-ext',
          setup(ctx) {
            ctx.registry.models.register(MOCK_MODEL, makeMultiRoundModel())
          },
        },
      ],
      logger: QUIET_LOGGER,
    })

    // 模型第一轮返回 tool-call，但没注册工具 handler
    const result = await runtime.prompt(
      { type: RUNTIME_INPUT_TYPES.TEXT, text: '使用工具' },
      { model: MOCK_MODEL },
    )

    // 第二轮模型继续被调用，最终返回纯文本
    assert.equal(result.messages.length, 4)
    const finalText = (result.messages[3].parts[0] as any)?.text
    assert.equal(finalText, '工具已执行完毕')

    await runtime.dispose()
  })

  it('工具执行出错返回错误结果', async () => {
    const failingToolExt: Extension = {
      name: 'test:failing-tool-ext',
      setup(ctx) {
        let callCount = 0
        const model: ModelAdapter = {
          name: 'test:failing-model',
          async request(): Promise<ModelResponse> {
            callCount++
            if (callCount === 1) {
              const toolCall: ToolCallPart = {
                type: MESSAGE_PART_TYPES.TOOL_CALL,
                toolCallId: 'tc-fail',
                name: 'test:fail',
                arguments: {},
              }
              return {
                message: {
                  id: `msg_${Date.now()}`,
                  role: MESSAGE_ROLES.ASSISTANT,
                  createdAt: Date.now(),
                  parts: [toolCall],
                },
                stopReason: 'tool_calls',
              }
            }
            return {
              message: {
                id: `msg_${Date.now()}`,
                role: MESSAGE_ROLES.ASSISTANT,
                createdAt: Date.now(),
                parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: '处理完成' }],
              },
              stopReason: 'stop',
            }
          },
          async *stream() {
            yield { type: STREAM_EVENT_TYPES.DONE, response: await this.request({} as any) }
          },
        }
        ctx.registry.models.register('test:failing-model', model)
        ctx.registerTool({
          name: 'test:fail',
          description: '总会失败',
          inputSchema: {},
          safetyLevel: 'safe' as any,
          execute: async () => {
            throw new Error('意图出错')
          },
        })
      },
    }

    const runtime = await createRuntime({
      extensions: [failingToolExt],
      logger: QUIET_LOGGER,
    })

    const result = await runtime.prompt(
      { type: RUNTIME_INPUT_TYPES.TEXT, text: 'use tool' },
      { model: 'test:failing-model' },
    )

    // 工具执行出错后，tool-result 消息应包含错误文本
    const toolResult = result.messages[2]
    assert.equal(toolResult.role, MESSAGE_ROLES.TOOL)
    const errPart = toolResult.parts[0] as any
    assert.equal(errPart.type, MESSAGE_PART_TYPES.TEXT, '应为 text 类型')
    assert.ok(errPart.text.includes('意图出错'), `应包含原始错误信息，实际: ${errPart.text}`)

    // 后续应继续完成
    assert.equal(result.messages.length, 4)

    await runtime.dispose()
  })

  it('多工具并行执行并保留顺序', async () => {
    const execOrder: number[] = []

    const parallelExt: Extension = {
      name: 'test:parallel-ext',
      setup(ctx) {
        let callCount = 0
        const model: ModelAdapter = {
          name: 'test:parallel-model',
          async request(): Promise<ModelResponse> {
            callCount++
            if (callCount === 1) {
              return {
                message: {
                  id: `msg_${Date.now()}`,
                  role: MESSAGE_ROLES.ASSISTANT,
                  createdAt: Date.now(),
                  parts: [
                    { type: MESSAGE_PART_TYPES.TEXT, text: '开始并行执行' },
                    { type: MESSAGE_PART_TYPES.TOOL_CALL, toolCallId: 'tc-a', name: 'test:slow', arguments: { delay: 50 } },
                    { type: MESSAGE_PART_TYPES.TOOL_CALL, toolCallId: 'tc-b', name: 'test:fast', arguments: { msg: 'b' } },
                    { type: MESSAGE_PART_TYPES.TOOL_CALL, toolCallId: 'tc-c', name: 'test:slow', arguments: { delay: 50 } },
                  ],
                },
                stopReason: 'tool_calls',
              }
            }
            return {
              message: {
                id: `msg_${Date.now()}`,
                role: MESSAGE_ROLES.ASSISTANT,
                createdAt: Date.now(),
                parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: '全部工具执行完毕' }],
              },
              stopReason: 'stop',
            }
          },
          async *stream() {
            yield { type: STREAM_EVENT_TYPES.DONE, response: await this.request({} as any) }
          },
        }
        ctx.registry.models.register('test:parallel-model', model)

        let slowCounter = 0
        ctx.registerTool({
          name: 'test:slow',
          description: '模拟耗时操作',
          inputSchema: { type: 'object', properties: { delay: { type: 'number' } } },
          safetyLevel: 'safe' as any,
          execute: async (request): Promise<ToolExecutionResult> => {
            const delay = (request.toolCall.arguments as any)?.delay ?? 0
            await new Promise(r => setTimeout(r, delay))
            execOrder.push(slowCounter++)
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'test:slow',
              content: [{ type: MESSAGE_PART_TYPES.TEXT, text: `slow-${delay}` }],
            }
          },
        })

        ctx.registerTool({
          name: 'test:fast',
          description: '立即返回',
          inputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
          safetyLevel: 'safe' as any,
          execute: async (request): Promise<ToolExecutionResult> => {
            execOrder.push(100)
            return {
              toolCallId: request.toolCall.toolCallId,
              name: 'test:fast',
              content: [{ type: MESSAGE_PART_TYPES.TEXT, text: `fast-${(request.toolCall.arguments as any)?.msg ?? ''}` }],
            }
          },
        })
      },
    }

    const runtime = await createRuntime({
      extensions: [parallelExt],
      logger: QUIET_LOGGER,
    })

    const start = Date.now()
    const result = await runtime.prompt(
      { type: RUNTIME_INPUT_TYPES.TEXT, text: '并行执行多个工具' },
      { model: 'test:parallel-model' },
    )
    const elapsed = Date.now() - start

    const toolCount = result.messages.filter(m => m.role === MESSAGE_ROLES.TOOL).length
    assert.equal(toolCount, 3, '应产生 3 条 tool result 消息')
    assert.equal(execOrder.length, 3, '所有工具都应执行')

    // 快工具应早于两个慢工具完成（如果串行则排在最后）
    const fastIndex = execOrder.indexOf(100)
    // 并行：0ms 任务在 50ms 任务之前完成 → fastIndex 为 0
    // 串行：先执行 50ms 再执行 0ms → fastIndex 为 1
    // 断言 fastIndex 为 0 证明并行
    assert.equal(fastIndex, 0, `快工具应为第一个完成（并行），实际顺序 ${JSON.stringify(execOrder)}`)

    // 总时间应 < 两个 50ms 串行的 100ms
    assert.ok(elapsed < 80, `并行执行时间 ${elapsed}ms 应 < 80ms（串行两个 50ms 工具应 > 100ms）`)

    // 结果按原始顺序排列
    assert.equal(result.messages[2].toolCallId, 'tc-a')
    assert.equal(result.messages[3].toolCallId, 'tc-b')
    assert.equal(result.messages[4].toolCallId, 'tc-c')

    await runtime.dispose()
  })
})
