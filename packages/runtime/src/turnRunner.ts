import type {
  EventMap,
  Message,
  ModelContext,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  RuntimeInput,
  RuntimeError,
  TextPart,
  ToolCallPart,
  ToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolHandler,
} from '@crai/core'
import type { HookBus, HookMap, RuntimeHandle, Session, AdapterContext } from '@crai/core'
import type { ModelMiddlewareStore } from './bus'
import { EVENTS, HOOKS, ERROR_CODES, MESSAGE_PART_TYPES, MESSAGE_ROLES, PERMISSION_MODES, RUNTIME_INPUT_TYPES } from '@crai/core'
import { debugLog, DEBUG_SCOPES } from './debug'

/** 单次 turn 中工具调用的最大轮次，防止无限循环。 */
const MAX_TOOL_ROUNDS = 10

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
  /** 按名称查找 ToolHandler。 */
  resolveTool?: (name: string) => Promise<ToolHandler | undefined>
  /** 模型中间件存储，用于 before/after/wrap 拦截。 */
  middlewares?: ModelMiddlewareStore
  /** AdapterContext 供工具执行时传入。 */
  adapterContext?: AdapterContext
}

/** 将 RuntimeInput 转换为 Message。 */
function inputToMessage(input: RuntimeInput, sessionId: string): Message {
  if (input.type === RUNTIME_INPUT_TYPES.MESSAGE) {
    return { ...input.message, id: `${sessionId}_msg_${Date.now()}` }
  }
  const text = input.type === RUNTIME_INPUT_TYPES.TEXT ? input.text
    : input.type === RUNTIME_INPUT_TYPES.COMMAND ? input.name
    : ''
  return {
    id: `${sessionId}_input_${Date.now()}`,
    role: MESSAGE_ROLES.USER,
    createdAt: Date.now(),
    parts: [{ type: MESSAGE_PART_TYPES.TEXT, text }],
  }
}

/** 消费流式事件，发 delta 事件，返回完整 response。Adapter 的 done 事件已包含 tool-call parts。 */
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
      case 'done':
        return event.response
      case 'error':
        throw event.error
    }
  }
  throw { code: ERROR_CODES.MODEL_REQUEST_FAILED, message: '流意外结束，未收到 done 事件' } as RuntimeError
}

/** 构建 modelFn：优先流式，回退非流式。 */
function buildModelFn(
  deps: TurnRunnerDeps,
  session: Session,
  turnId: string,
): (req: ModelRequest) => Promise<ModelResponse> {
  if (deps.streamModel) {
    return async (req) => {
      const stream = deps.streamModel!(req)
      return consumeStream(stream, session, turnId, deps.emitEvent)
    }
  }
  return deps.requestModel
}

/** 执行单个工具，返回执行结果。 */
async function executeOneTool(
  handler: ToolHandler,
  toolCall: ToolCallPart,
  session: Session,
  deps: TurnRunnerDeps,
  turnId: string,
): Promise<ToolExecutionResult> {
  const execRequest: ToolExecutionRequest = {
    session,
    toolCall,
    messages: [],
  }

  const execCtx: AdapterContext = deps.adapterContext ?? {
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    session,
    turnId,
  }

  // 执行前 hook
  await deps.hooks.run(HOOKS.TOOL_BEFORE, { session, toolCall }, { runtime: undefined as any })
  await deps.emitEvent(EVENTS.TOOL_REQUESTED, { session, toolCall })

  try {
    const result = await handler.execute(execRequest, execCtx)
    await deps.emitEvent(EVENTS.TOOL_COMPLETED, { session, result })
    await deps.hooks.run(HOOKS.TOOL_AFTER, { session, result }, { runtime: undefined as any })
    return result
  } catch (cause) {
    const errResult: ToolExecutionResult = {
      toolCallId: toolCall.toolCallId,
      name: toolCall.name,
      isError: true,
      content: [{ type: MESSAGE_PART_TYPES.TEXT, text: `执行出错: ${(cause as Error).message}` }],
    }
    await deps.emitEvent(EVENTS.TOOL_FAILED, { session, result: errResult })
    return errResult
  }
}

/**
 * 运行一个 turn，包含工具执行循环。
 *
 * 执行流：输入归一化 → 构建上下文 → [ 模型请求 → 工具执行 ]* → 持久化
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

  // 输入归一化
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

  // context:build 钩子可追加/改写上下文消息
  const buildResult = await deps.hooks.run(
    HOOKS.CONTEXT_BUILD,
    { session, messages: contextWithTools.messages },
    { runtime },
  )
  if (buildResult) {
    contextWithTools = { ...contextWithTools, messages: buildResult.messages }
  }

  await deps.emitEvent(EVENTS.CONTEXT_BUILT, { session, context: contextWithTools })

  // ── 工具执行循环 ──

  const modelFn = buildModelFn(deps, session, turnId)
  let finalResponse: ModelResponse | undefined
  let allRoundMessages: Message[] = [inputAsMsg]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const request: ModelRequest = {
      sessionId: session.id,
      turnId,
      model: modelName ?? '<no-model>',
      context: {
        ...contextWithTools,
        messages: contextWithTools.messages,
      },
    }

    const preparedRequest = await deps.hooks.run(
      HOOKS.MODEL_REQUEST_BEFORE,
      { session, request },
      { runtime },
    )

    if (round === 0) {
      await deps.hooks.run(
        HOOKS.TURN_BEFORE_MODEL,
        { session, request: preparedRequest.request },
        { runtime },
      )
      await deps.emitEvent(EVENTS.MODEL_REQUESTED, { session, request: preparedRequest.request })
    }

    // 调用模型
    let response: ModelResponse
    try {
      const finalRequest = preparedRequest.request
      if (deps.middlewares && deps.middlewares.list().length > 0) {
        response = await deps.middlewares.apply(finalRequest, deps.requestModel)
      } else {
        response = await modelFn(finalRequest)
      }
    } catch (cause) {
      const causeMsg = cause && typeof cause === 'object'
        ? ((cause as any).message ?? (cause as any).reason ?? '')
        : String(cause ?? '')
      const detail = causeMsg ? `: ${causeMsg}` : ''
      const error: RuntimeError = {
        code: ERROR_CODES.MODEL_REQUEST_FAILED,
        message: `模型请求失败${detail}`,
        cause,
      }
      await deps.emitEvent(EVENTS.TURN_FAILED, { session, turnId, error })
      throw error
    }

    allRoundMessages.push(response.message)
    finalResponse = response

    // 提取 tool-call
    const toolCalls = response.message.parts.filter(
      (p): p is ToolCallPart => p.type === MESSAGE_PART_TYPES.TOOL_CALL,
    )

    if (toolCalls.length === 0) {
      // 模型返回纯文本，退出循环
      break
    }

    // 安全检查 + 执行工具
    // 每个工具调用独立执行，每条结果独立成一条 Message（参见 D-032）
    const toolDefs = deps.resolveTools ? await deps.resolveTools() : []
    const defMap = new Map(toolDefs.map(d => [d.name, d]))
    const toolResultMessages: Message[] = []

    for (const tc of toolCalls) {
      const def = defMap.get(tc.name)
      if (!def) {
        await deps.emitEvent(EVENTS.TOOL_BLOCKED, { session, toolCall: tc, reason: `工具 "${tc.name}" 未注册` })
        toolResultMessages.push({
          id: `${session.id}_tool_${tc.toolCallId}`,
          role: MESSAGE_ROLES.TOOL,
          createdAt: Date.now(),
          parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: `工具 "${tc.name}" 未注册` }],
          toolCallId: tc.toolCallId,
          toolName: tc.name,
          isError: true,
        })
        continue
      }

      // 安全检查
      await deps.hooks.run(
        HOOKS.TOOL_SAFETY_CHECK,
        { session, toolCall: tc, definition: def, mode: PERMISSION_MODES.ASK },
        { runtime },
      )

      // 查找 handler 并执行
      const handler = deps.resolveTool ? await deps.resolveTool(tc.name) : undefined

      // 调试：输出工具调用的原始 JSON
      debugLog(DEBUG_SCOPES.TOOLS, `工具调用: ${tc.name}`, {
        toolCallId: tc.toolCallId,
        name: tc.name,
        arguments: tc.arguments,
      })

      if (!handler) {
        await deps.emitEvent(EVENTS.TOOL_BLOCKED, { session, toolCall: tc, reason: `工具 "${tc.name}" 无 handler` })
        toolResultMessages.push({
          id: `${session.id}_tool_${tc.toolCallId}`,
          role: MESSAGE_ROLES.TOOL,
          createdAt: Date.now(),
          parts: [{ type: MESSAGE_PART_TYPES.TEXT, text: `工具 "${tc.name}" 无 handler` }],
          toolCallId: tc.toolCallId,
          toolName: tc.name,
          isError: true,
        })
        continue
      }

      const execResult = await executeOneTool(handler, tc, session, deps, turnId)

      // 调试：输出工具执行结果
      debugLog(DEBUG_SCOPES.TOOLS, `工具结果: ${tc.name}`, {
        toolCallId: execResult.toolCallId,
        name: execResult.name,
        isError: execResult.isError,
        content: execResult.content,
      })

      toolResultMessages.push({
        id: `${session.id}_tool_${tc.toolCallId}`,
        role: MESSAGE_ROLES.TOOL,
        createdAt: Date.now(),
        parts: execResult.content,
        toolCallId: tc.toolCallId,
        toolName: tc.name,
        isError: execResult.isError ?? false,
      })
    }

    // 每条 tool result 独立追加到上下文
    for (const toolMsg of toolResultMessages) {
      allRoundMessages.push(toolMsg)
    }
    contextWithTools = {
      ...contextWithTools,
      messages: [...contextWithTools.messages, response.message, ...toolResultMessages],
    }
  }

  // ── 最终持久化与返回 ──

  await deps.emitEvent(EVENTS.MODEL_COMPLETED, { session, response: finalResponse! })
  await deps.emitEvent(EVENTS.MESSAGE_APPENDED, { session, message: finalResponse!.message })

  await deps.hooks.run(HOOKS.PERSIST_BEFORE, { session }, { runtime })
  await deps.hooks.run(HOOKS.TURN_AFTER, { session, turnId, messages: allRoundMessages }, { runtime })
  await deps.hooks.run(HOOKS.PERSIST_AFTER, { session }, { runtime })

  await deps.emitEvent(EVENTS.TURN_COMPLETED, { session, turnId })

  return {
    session,
    turnId,
    messages: allRoundMessages,
    response: finalResponse,
  }
}
