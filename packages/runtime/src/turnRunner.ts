/**
 * Turn 运行器：执行一次 input → context → model → persist 的最小调度循环。
 *
 * 当前实现与 spec runtime-flow.md 的差距：
 * - 未发射 context.built 事件（仅有 hook）
 * - 未执行 model:response:after hook
 * - 未实现工具执行循环（model 返回 tool-call 后应解析并执行）
 * - 未处理流式输出（model.delta 等）
 * 这些能力应随 Phase 1 后续迭代补全，或由 preset 扩展提供。
 */
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

/** Turn 运行所需的外部依赖，由调用方注入，便于测试和替换。 */
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

  // input:before hook 允许扩展拦截或修改输入
  const normalized = await deps.hooks.run('input:before', { session, input }, { runtime })
  const context = await deps.buildContext(session)
  const toolList = deps.resolveTools ? await deps.resolveTools() : []
  const contextWithTools: ModelContext = {
    ...context,
    tools: toolList,
  }

  // context:build hook 允许扩展修改上下文（如注入 system prompt）
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

  // model:request:before hook 允许扩展修改请求参数（如切换模型、调整 temperature）
  const preparedRequest = await deps.hooks.run(
    'model:request:before',
    { session, request },
    { runtime },
  )

  await deps.emitEvent('model.requested', { session, request: preparedRequest.request })

  // 模型请求失败时发射 turn.failed 并抛出结构化错误（与 error-recovery.md 一致）
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

  // TODO: 此处应检查 response.message.parts 中的 tool-call 并进入工具执行循环
  const messages = [response.message]
  await deps.emitEvent('message.appended', { session, message: response.message })

  // 持久化与收尾 hook：persist:before → turn:after → persist:after
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
