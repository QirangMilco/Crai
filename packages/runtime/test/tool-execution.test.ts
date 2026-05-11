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
})
