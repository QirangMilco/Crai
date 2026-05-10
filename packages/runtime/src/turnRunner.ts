import type {
  EventMap,
  Message,
  ModelContext,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  RuntimeInput,
  RuntimeError,
  ToolCallPart,
  ToolDefinition,
} from '@crai/core'
import type { HookBus, HookMap, RuntimeHandle, Session } from '@crai/core'
import type { ModelMiddlewareStore } from './bus'
import { EVENTS, HOOKS, ERROR_CODES, MESSAGE_PART_TYPES, MESSAGE_ROLES, PERMISSION_MODES, RUNTIME_INPUT_TYPES } from '@crai/core'

/** 最小 turn 运行结果。只返回调度结果，不做持久化。 */
export interface TurnRunResult {
  session: Session
  turnId: string
  messages: Message[]
  response?: ModelResponse
}

export interface TurnRunnerDeps {
  hooks: HookBus<HookMap>
  emitEvent: <TKey extends keyof EventMap & string>(
    type: TKey,
    payload: EventMap[TKey],
  ) => Promise<void>
  buildContext: (session: Session) => Promise<ModelContext>
  /** 非流式模型调用，当 adapter 没有 stream() 或存在 middleware 时回退。 */
  requestModel: (request: ModelRequest) => Promise<ModelResponse>
  /** 流式模型调用。adapter 支持时优先走流。 */
  streamModel?: (request: ModelRequest) => AsyncIterable<ModelStreamEvent>
  resolveTools?: () => Promise<ToolDefinition[]>
  /** 模型中间件存储，用于 before/after/wrap 拦截。 */
  middlewares?: ModelMiddlewareStore
}

/** 将 RuntimeInput 转换为 Message 并追加到上下文。 */
function inputToMessage(input: RuntimeInput, sessionId: string): Message {
  if (input.type === RUNTIME_INPUT_TYPES.MESSAGE) {
    return { ...input.message, id: `${sessionId}_msg_${Date.now()}` }
  }
  const text = input.type === RUNTIME_INPUT_TYPES.TEXT ? input.text
    : input.type === RUNTIME_INPUT_TYPES.COMMAND ? input.command
    : ''
  return {
    id: `${sessionId}_input_${Date.now()}`,
    role: MESSAGE_ROLES.USER,
    createdAt: Date.now(),
    parts: [{ type: MESSAGE_PART_TYPES.TEXT, text }],
  }
}

/** 消费流式事件，发 delta 事件，返回完整 response。 */
async function consumeStream(
  stream: AsyncIterable<ModelStreamEvent>,
  session: Session,
  turnId: string,
  emitEvent: TurnRunnerDeps['emitEvent'],
): Promise<ModelResponse> {
  for await (const event of stream) {
    switch (event.type) {
      case 'text-delta':
        await emitEvent(EVENTS.MODEL_DELTA, { session, turnId, delta: event.delta })
        break
      case 'tool-call':
        // 暂不处理，工具执行循环尚未实现
        break
      case 'message':
        // 部分 message，暂不处理
        break
      case 'done':
        return event.response
      case 'error':
        throw event.error
    }
  }
  throw { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: '流意外结束，未收到 done 事件' } as RuntimeError
}

/**
 * 运行一个最小 turn。
 * kernel 只负责调度顺序，具体行为由扩展通过 hook 注入。
 *
 * 执行流：input → hook 归一化 → 构建上下文 → 模型请求 → 安全检查 → 持久化
 */
export async function runTurn(
  input: RuntimeInput,
  session: Session,
  runtime: RuntimeHandle,
  deps: TurnRunnerDeps,
  modelName?: string,
): Promise<TurnRunResult> {
  const turnId = `turn_${Date.now()}`

  await deps.emitEvent(EVENTS.INPUT_RECEIVED, { session, input })
  await deps.emitEvent(EVENTS.TURN_STARTED, { session, turnId })

  // 输入归一化：让扩展有机会改写或阻断输入
  await deps.hooks.run(HOOKS.INPUT_BEFORE, { session, input }, { runtime })
  const context = await deps.buildContext(session)

  // 将输入转换为消息并追加到上下文
  const inputAsMsg: Message = inputToMessage(input, session.id)
  const allMessages = [...context.messages, inputAsMsg]
  const toolList = deps.resolveTools ? await deps.resolveTools() : []
  let contextWithTools: ModelContext = {
    ...context,
    messages: allMessages,
    tools: toolList,
  }

  // context:build 钩子可追加/改写上下文消息（如注入历史记录）
  const buildResult = await deps.hooks.run(
    HOOKS.CONTEXT_BUILD,
    { session, messages: contextWithTools.messages },
    { runtime },
  )
  if (buildResult) {
    contextWithTools = { ...contextWithTools, messages: buildResult.messages }
  }

  await deps.emitEvent(EVENTS.CONTEXT_BUILT, { session, context: contextWithTools })

  const request: ModelRequest = {
    sessionId: session.id,
    turnId,
    model: modelName ?? '<no-model>',
    context: contextWithTools,
  }

  const preparedRequest = await deps.hooks.run(
    HOOKS.MODEL_REQUEST_BEFORE,
    { session, request },
    { runtime },
  )

  await deps.hooks.run(
    HOOKS.TURN_BEFORE_MODEL,
    { session, request: preparedRequest.request },
    { runtime },
  )

  await deps.emitEvent(EVENTS.MODEL_REQUESTED, { session, request: preparedRequest.request })

  // 请求模型：优先流式，回退非流式
  let response: ModelResponse | undefined
  try {
    const finalRequest = preparedRequest.request

    // 如果 adapter 支持流式，将 stream 包装为 requestModel 兼容的签名
    let modelFn = deps.requestModel
    if (deps.streamModel) {
      modelFn = async (req) => {
        const stream = deps.streamModel!(req)
        return consumeStream(stream, session, turnId, deps.emitEvent)
      }
    }

    if (deps.middlewares && deps.middlewares.list().length > 0) {
      response = await deps.middlewares.apply(finalRequest, modelFn)
    } else {
      response = await modelFn(finalRequest)
    }
  } catch (cause) {
    const error: RuntimeError = {
      code: ERROR_CODES.MODEL_REQUEST_FAILED,
      message: '模型请求失败',
      cause,
    }
    await deps.emitEvent(EVENTS.TURN_FAILED, { session, turnId, error })
    throw error
  }

  await deps.emitEvent(EVENTS.MODEL_COMPLETED, { session, response })

  // 安全检查门：检查模型返回的 tool-call 是否在当前安全策略下被允许
  const toolCalls = response.message.parts.filter(
    (p): p is ToolCallPart => p.type === MESSAGE_PART_TYPES.TOOL_CALL,
  )

  if (toolCalls.length > 0) {
    const toolDefs = deps.resolveTools ? await deps.resolveTools() : []
    const defMap = new Map(toolDefs.map(d => [d.name, d]))

    for (const tc of toolCalls) {
      const def = defMap.get(tc.name)
      if (!def) {
        await deps.emitEvent(EVENTS.TOOL_BLOCKED, { session, toolCall: tc, reason: `工具 "${tc.name}" 未注册` })
        continue
      }

      await deps.hooks.run(HOOKS.TOOL_SAFETY_CHECK, { session, toolCall: tc, definition: def, mode: PERMISSION_MODES.ASK }, { runtime })
      await deps.emitEvent(EVENTS.TOOL_REQUESTED, { session, toolCall: tc })
    }
  }

  const messages = [inputAsMsg, response.message]
  await deps.emitEvent(EVENTS.MESSAGE_APPENDED, { session, message: response.message })

  // 持久化阶段：具体存储行为由 preset 或 hook 实现，kernel 不直接写存储
  await deps.hooks.run(HOOKS.PERSIST_BEFORE, { session }, { runtime })
  await deps.hooks.run(HOOKS.TURN_AFTER, { session, turnId, messages }, { runtime })
  await deps.hooks.run(HOOKS.PERSIST_AFTER, { session }, { runtime })

  await deps.emitEvent(EVENTS.TURN_COMPLETED, { session, turnId })

  return {
    session,
    turnId,
    messages,
    response,
  }
}
