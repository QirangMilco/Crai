import type {
  EventMap,
  Message,
  ModelContext,
  ModelRequest,
  ModelResponse,
  RuntimeInput,
  RuntimeError,
  ToolCallPart,
  ToolDefinition,
} from '../../core/src'
import type { HookBus, HookMap, RuntimeHandle, Session } from '../../core/src'
import { EVENTS, HOOKS, ERROR_CODES } from '../../core/src'

/**
 * 最小 turn 运行结果。
 * 当前只返回调度结果，不内置任何默认持久化副作用。
 */
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
  requestModel: (request: ModelRequest) => Promise<ModelResponse>
  resolveTools?: () => Promise<ToolDefinition[]>
}

/**
 * 运行一个最小 turn。
 * kernel 只负责调度顺序，默认行为应由 preset extensions 提供。
 *
 * 执行流：input → hook 归一化 → 构建上下文 → 模型请求 → 事件通知 → persist hooks
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
  const toolList = deps.resolveTools ? await deps.resolveTools() : []
  const contextWithTools: ModelContext = {
    ...context,
    tools: toolList,
  }

  await deps.hooks.run(
    HOOKS.CONTEXT_BUILD,
    { session, messages: contextWithTools.messages },
    { runtime },
  )

  await deps.emitEvent(EVENTS.CONTEXT_BUILT, { session, context: contextWithTools })

  const request: ModelRequest = {
    sessionId: session.id,
    turnId,
    model: modelName ?? 'placeholder-model',
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

  // 请求模型，失败时发出结构化错误事件
  let response: ModelResponse | undefined
  try {
    response = await deps.requestModel(preparedRequest.request)
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
    (p): p is ToolCallPart => p.type === 'tool-call',
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

      await deps.hooks.run(HOOKS.TOOL_SAFETY_CHECK, { session, toolCall: tc, definition: def, mode: 'ask' }, { runtime })
      await deps.emitEvent(EVENTS.TOOL_REQUESTED, { session, toolCall: tc })
    }
  }

  const messages = [response.message]
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
