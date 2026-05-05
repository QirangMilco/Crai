import type {
  EventMap,
  ModelContext,
  ModelRequest,
  ModelResponse,
  RuntimeInput,
  RuntimeError,
  ToolDefinition,
} from '../../core/src'
import type { HookBus, HookMap, RuntimeHandle, Session } from '../../core/src'

/**
 * 最小 turn 运行结果。
 * 当前只返回调度结果，不内置任何默认持久化副作用。
 */
export interface TurnRunResult {
  session: Session
  turnId: string
  messages: Array<{ id: string; role: string; createdAt: number; parts: unknown[] }>
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
 */
export async function runTurn(
  input: RuntimeInput,
  session: Session,
  runtime: RuntimeHandle,
  deps: TurnRunnerDeps,
): Promise<TurnRunResult> {
  const turnId = `turn_${Date.now()}`

  await deps.emitEvent('input.received', { session, input })
  await deps.emitEvent('turn.started', { session, turnId })

  const normalized = await deps.hooks.run('input:before', { session, input }, { runtime })
  const context = await deps.buildContext(session)
  const toolList = deps.resolveTools ? await deps.resolveTools() : []
  const contextWithTools: ModelContext = {
    ...context,
    tools: toolList,
  }

  await deps.hooks.run(
    'context:build',
    { session, messages: contextWithTools.messages },
    { runtime },
  )

  const request: ModelRequest = {
    sessionId: session.id,
    turnId,
    model: 'placeholder-model',
    context: contextWithTools,
  }

  const preparedRequest = await deps.hooks.run(
    'model:request:before',
    { session, request },
    { runtime },
  )

  await deps.emitEvent('model.requested', { session, request: preparedRequest.request })

  let response: ModelResponse | undefined
  try {
    response = await deps.requestModel(preparedRequest.request)
  } catch (cause) {
    const error: RuntimeError = {
      code: 'MODEL_REQUEST_FAILED',
      message: '模型请求失败',
      cause,
    }
    await deps.emitEvent('turn.failed', { session, turnId, error })
    throw error
  }

  await deps.emitEvent('model.completed', { session, response })

  const messages = [response.message]
  await deps.emitEvent('message.appended', { session, message: response.message })

  await deps.hooks.run('persist:before', { session }, { runtime })
  await deps.hooks.run('turn:after', { session, turnId, messages }, { runtime })
  await deps.hooks.run('persist:after', { session }, { runtime })

  await deps.emitEvent('turn.completed', { session, turnId })

  return {
    session,
    turnId,
    messages,
    response,
  }
}
