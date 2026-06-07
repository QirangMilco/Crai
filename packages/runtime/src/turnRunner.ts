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
import type { HookBus, HookMap, Logger, RuntimeHandle, Session, AdapterContext, StorageAdapter } from '@crai/core'
import type { ModelMiddlewareStore } from './bus'
import { EVENTS, HOOKS, ERROR_CODES, MESSAGE_PART_TYPES, MESSAGE_ROLES, PERMISSION_MODES, RUNTIME_INPUT_TYPES, createId, getContextWindow } from '@crai/core'
import type { PermissionMode } from '@crai/core'
import { guardContext, estimateMessagesTokens, estimateMessageTokens, limitToolResult, cleanOrphanedToolCalls } from '@crai/base'
import type { CheckpointManager } from './checkpoint'
import type { Summarizer } from '@crai/base'
import { debugLog, DEBUG_SCOPES } from './debug'
import { withIdleTimeout, StreamTimeoutError } from '@crai/base'

/** 单次 turn 中工具调用的最大轮次，防止无限循环。 */
const MAX_TOOL_ROUNDS = 10

/**
 * 从 RuntimeHandle.callModel 创建 AI 摘要回调。
 * Snow-CLI 模式：AI 摘要优先，失败时回退硬截断。
 */
function createSummarizerFromRuntime(rt: RuntimeHandle, toolModel?: string): Summarizer {
  return async (removedMessages) => {
    const lines: string[] = []
    for (const m of removedMessages) {
      if (m.role !== 'user' && m.role !== 'assistant') continue
      const role = m.role === 'user' ? '用户' : 'AI'
      for (const p of m.parts) {
        if (p.type === 'text') lines.push(`${role}: ${(p as TextPart).text}`)
      }
    }
    if (lines.length === 0) return null
    // toolModel 格式: "provider/model"，解析出 provider 和 model 分别传给 callModel
    let tmProvider: string | undefined
    let tmModel: string | undefined
    if (toolModel) {
      const si = toolModel.indexOf('/')
      if (si >= 0) {
        tmProvider = toolModel.slice(0, si)
        tmModel = toolModel.slice(si + 1)
      } else {
        tmModel = toolModel
      }
    }
    try {
      const result = await rt.callModel(
        [{ role: 'user' as const, content: lines.join('\n') }],
        {
          model: tmModel,
          provider: tmProvider,
          system: `根据以下对话历史，提取关键上下文信息用于后续对话。直接以项目/任务概览开头，不要添加文档标题。

## 项目/任务概览
- 正在处理的项目或任务
- 目标和预期成果
- 当前完成状态

## 技术环境
- 使用的技术、框架、库和工具
- **精确的文件路径**（完整路径，非相对路径）
- **精确的函数名、类名、变量名**
- 架构模式与设计决策

## 实施细节
- 技术决策及理由
- 选定的方案与实现方法
- **精确的代码片段**（保留语法）

## 已完成的工作
- 已实现的功能（附文件引用）
- 已修复的 bug（附根因分析）
- 代码修改记录

## 进行中的工作
- 未完成的任务及阻塞原因
- 已知问题与诊断细节
- 下一步计划（具体、可执行）

## 关键参考数据
- 重要的 ID、键、值（脱敏）
- 错误消息与堆栈跟踪（原文）
- 用户需求与约束
- 边界情况与特殊处理

要求：
1. 保留精确的技术术语，不要改写代码/文件名
2. 包含完整上下文——路径、版本、配置
3. 保持精确——具体的行号、准确的错误信息
4. 不要做假设——只记录明确讨论过的内容
5. 不要泛泛总结——提供可操作的、具体的细节
6. 代码片段用 Markdown 代码块并标注语言
7. 信息分层次组织，方便快速浏览

直接输出摘要内容，不要额外说明或文档标题。`, 
          temperature: 0.3,
          maxTokens: 200,
          utility: true,
        },
      )
      return result || null
    } catch {
      return null
    }
  }
}

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
  /** 日志记录器，调试输出受 logLevel 过滤。 */
  logger?: Logger
  /** 获取当前存储适配器，用于持久化压缩标记等。 */
  getStorage?: () => StorageAdapter | undefined
  /** 检查点管理器，用于 turn 级别回滚。 */
  checkpointManager?: CheckpointManager
}

/** 将 RuntimeInput 转换为 Message。 */
function inputToMessage(input: RuntimeInput, sessionId: string): Message {
  if (input.type === RUNTIME_INPUT_TYPES.MESSAGE) {
    return { ...input.message, id: createId('msg') }
  }
  const text = input.type === RUNTIME_INPUT_TYPES.TEXT ? input.text
    : input.type === RUNTIME_INPUT_TYPES.COMMAND ? input.name
    : ''
  return {
    id: createId('msg'),
    role: MESSAGE_ROLES.USER,
    createdAt: Date.now(),
    parts: [{ type: MESSAGE_PART_TYPES.TEXT, text }],
  }
}

/** 消费流式事件，发 delta 事件，返回完整 response。Adapter 的 done 事件已包含 tool-call parts。 */
function makeActivityId(): string {
  return createId('act')
}

async function consumeStream(
  stream: AsyncIterable<ModelStreamEvent>,
  session: Session,
  turnId: string,
  emitEvent: TurnRunnerDeps['emitEvent'],
  logger?: Logger,
): Promise<ModelResponse> {
  const startedTools = new Set<string>()
  let thinkingAccum = ''  // 积累 thinking 内容，用于持久化
  let thinkingActivityId: string | undefined
  let thinkingStartTime = 0
  let textBeforeTool = ''  // 积累 tool 之前的文本，作为 intent
  for await (const event of stream) {
    switch (event.type) {
      case 'text-delta':
        textBeforeTool += event.delta
        await emitEvent(EVENTS.MODEL_DELTA, { session, turnId, delta: event.delta })
        break
      case 'thinking-delta':
        if (!thinkingActivityId) {
          thinkingActivityId = makeActivityId()
          thinkingStartTime = Date.now()
          await emitEvent(EVENTS.ACTIVITY_START, {
            session, turnId,
            activity: {
              id: thinkingActivityId,
              type: 'thinking',
              status: 'running',
              timestamp: Date.now(),
            },
          })
        }
        thinkingAccum += event.delta
        debugLog(DEBUG_SCOPES.MIDDLEWARE, `consumeStream: thinking-delta (${event.delta.substring(0, 60)})`, { sessionId: session.id }, logger)
        await emitEvent(EVENTS.ACTIVITY_DELTA, { session, turnId, activityId: thinkingActivityId!, delta: event.delta })
        break
      case 'thinking-done':
        debugLog(DEBUG_SCOPES.MIDDLEWARE, 'consumeStream: thinking-done', { sessionId: session.id }, logger)
        if (thinkingActivityId) {
          await emitEvent(EVENTS.ACTIVITY_DONE, {
            session, turnId,
            activity: {
              id: thinkingActivityId,
              type: 'thinking',
              status: 'completed',
              content: thinkingAccum,
              timestamp: Date.now(),
            },
          })
          thinkingActivityId = undefined
        }
        break
      case 'tool-call-delta':
        if (!startedTools.has(event.toolCallId)) {
          startedTools.add(event.toolCallId)
          // 使用 tool-{toolCallId} 作为 activity ID，与 executeOneTool 的 activity.done 一致
          await emitEvent(EVENTS.ACTIVITY_START, {
            session, turnId,
            activity: {
              id: `tool-${event.toolCallId}`,
              type: 'tool',
              status: 'running',
              toolName: event.name,
              toolCallId: event.toolCallId,
              toolInput: (() => {
                try { return JSON.parse(event.argsDelta) } catch { return undefined }
              })(),
              intent: textBeforeTool.trim() || undefined,
              timestamp: Date.now(),
            },
          })
          textBeforeTool = ''
        }
        break
      case 'done': {
        const response = event.response

        // 如果 thinking 已开始但尚未收到 thinking-done（如用户中止），补发 activity done
        if (thinkingActivityId) {
          debugLog(DEBUG_SCOPES.ABORT, 'consumeStream: done completing incomplete thinking', { thinkingLen: thinkingAccum.length }, logger)
          await emitEvent(EVENTS.ACTIVITY_DONE, {
            session, turnId,
            activity: {
              id: thinkingActivityId,
              type: 'thinking',
              status: 'completed',
              content: thinkingAccum,
              elapsedSeconds: Math.floor((Date.now() - thinkingStartTime) / 1000),
              timestamp: Date.now(),
            },
          })
          thinkingActivityId = undefined
        }

        // 将 thinking 内容附加到 response message 的 parts 中（用于持久化）
        if (thinkingAccum) {
          // 即使是中止，只要积累了 thinking 就保留；
          // 不要求 hasText（避免只有 thinking 的空消息检查留给下游）
          response.message.parts.push({
            type: 'thinking',
            thinking: thinkingAccum,
            elapsedSeconds: Math.floor((Date.now() - thinkingStartTime) / 1000),
          })
        }

        // 工具已通过 tool-call-delta 启动（toolInput 已在首 delta 中设置）；
        // 对于未通过 delta 启动的 tool-call（某些 adapter 在 done 中一次性返回），补发 start
        for (const p of response.message.parts) {
          if (p.type === 'tool-call') {
            const tc = p as ToolCallPart
            if (!startedTools.has(tc.toolCallId)) {
              await emitEvent(EVENTS.ACTIVITY_START, {
                session, turnId,
                activity: {
                  id: `tool-${tc.toolCallId}`,
                  type: 'tool',
                  status: 'running',
                  toolName: tc.name,
                  toolCallId: tc.toolCallId,
                  toolInput: tc.arguments as Record<string, unknown>,
                  timestamp: Date.now(),
                },
              })
              startedTools.add(tc.toolCallId)
            }
          }
        }

        // 处理已通过 tool-call-delta 启动但未出现在 done 响应中的工具
        // （适配器在 abort 时可能 yield 空部分的 done）。这些工具不会被 turn 循环处理，
        // 需要在此补发 ACTIVITY_DONE 避免前端活动保持 running。
        if (startedTools.size > 0) {
          const partsToolIds = new Set(response.message.parts.filter((p: any) => p.type === 'tool-call').map((p: any) => p.toolCallId))
          const orphanTools = [...startedTools].filter(t => !partsToolIds.has(t))
          if (orphanTools.length > 0) debugLog(DEBUG_SCOPES.ABORT, 'consumeStream: done completing orphan tools', { orphanTools }, logger)
        }
        if (startedTools.size > 0) {
          const partsToolIds = new Set(
            response.message.parts
              .filter((p: any) => p.type === 'tool-call')
              .map((p: any) => p.toolCallId),
          )
          for (const toolId of startedTools) {
            if (!partsToolIds.has(toolId)) {
              await emitEvent(EVENTS.ACTIVITY_DONE, {
                session, turnId,
                activity: {
                  id: `tool-${toolId}`,
                  type: 'tool',
                  status: 'aborted',
                  timestamp: Date.now(),
                },
              })
            }
          }
        }

        return response
      }
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
      const protectedStream = withIdleTimeout(stream, 60_000)
      return consumeStream(protectedStream, session, turnId, deps.emitEvent, deps.logger)
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
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  const execRequest: ToolExecutionRequest = {
    session,
    toolCall,
    messages: [],
    signal,
  }

  const execCtx: AdapterContext = deps.adapterContext ?? {
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    session,
    turnId,
  }

  // 执行前 hook
  await deps.hooks.run(HOOKS.TOOL_BEFORE, { session, toolCall }, { runtime: undefined as any })
  await deps.emitEvent(EVENTS.TOOL_REQUESTED, { session, toolCall })

  // 记录文件修改前的原始内容（用于检查点回滚）
  const cp = deps.checkpointManager
  if (cp) {
    const args = toolCall.arguments as any
    const filePath = args?.path || args?.filePath || args?.file
    if (typeof filePath === 'string') {
      await cp.recordFile(session.id, turnId, filePath).catch(() => {})
    }
  }

  try {
    const result = await handler.execute(execRequest, execCtx)
    await deps.emitEvent(EVENTS.TOOL_COMPLETED, { session, result })
    // 提取简短摘要（最多 120 字符）供前端显示
    const summary = result.content?.slice(0, 1).map(p => {
      const t = (p as any)?.text ?? ''
      return t.length > 120 ? t.slice(0, 120) + '…' : t
    }).filter(Boolean).join(' | ') || undefined
    await deps.emitEvent(EVENTS.ACTIVITY_DONE, {
      session, turnId,
      activity: {
        id: `tool-${toolCall.toolCallId}`,
        type: 'tool',
        status: result.isError ? 'error' : 'completed',
        toolName: toolCall.name,
        toolCallId: toolCall.toolCallId,
        toolInput: toolCall.arguments as Record<string, unknown> | undefined,
        content: summary,
        timestamp: Date.now(),
      },
    })
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
    await deps.emitEvent(EVENTS.ACTIVITY_DONE, {
      session, turnId,
      activity: {
        id: `tool-${toolCall.toolCallId}`,
        type: 'tool',
        status: 'error',
        toolName: toolCall.name,
        toolCallId: toolCall.toolCallId,
        content: (cause as Error).message,
        error: (cause as Error).message,
        timestamp: Date.now(),
      },
    })
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
  toolModel?: string,
  compressionThreshold?: number,
  compressionKeepTokens?: number,
  signal?: AbortSignal,
): Promise<TurnRunResult> {
  const turnId = createId('turn')

  await deps.emitEvent(EVENTS.INPUT_RECEIVED, { session, input })
  await deps.emitEvent(EVENTS.TURN_STARTED, { session, turnId })

  // 输入归一化
  await deps.hooks.run(HOOKS.INPUT_BEFORE, { session, input }, { runtime })
  const context = await deps.buildContext(session)

  // 创建检查点（用于回滚/分叉），此时已有上下文消息数
  const cp = deps.checkpointManager
  if (cp) {
    await cp.create(session.id, turnId, context.messages.length)
  }

  // 将输入转换为消息并追加到上下文
  const inputAsMsg: Message = { ...inputToMessage(input, session.id), turnId }
  debugLog(DEBUG_SCOPES.ABORT, 'turnRunner: inputAsMsg', { id: inputAsMsg.id, turnId, role: inputAsMsg.role }, deps.logger)
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

  // ── 辅助：为工具调用分配资源 ID ──
  function getResourceId(tc: ToolCallPart): string {
    const args = tc.arguments as Record<string, unknown> | undefined
    const path = typeof args?.path === 'string' ? args.path : ''
    if (tc.name === 'bash') return 'res:terminal'
    if (tc.name === 'fs_write' || tc.name === 'fs_edit') return `res:fs:${path || ''}`
    if (tc.name === 'fs_read' || tc.name === 'fs_list' || tc.name === 'fs_grep') return `res:fs-read:${path}`
    if (tc.name.startsWith('web_')) return `res:web:${tc.toolCallId}`
    return `res:indep:${tc.toolCallId}`
  }

  // ── 辅助：执行单个工具 ──
  async function runOneTool(
    tc: ToolCallPart,
    defMap: Map<string, ToolDefinition>,
  ): Promise<{ execResult: ToolExecutionResult; tc: ToolCallPart }> {
    const def = defMap.get(tc.name)
    if (!def) {
      await deps.emitEvent(EVENTS.ACTIVITY_DONE, { session, turnId, activity: { id: `tool-${tc.toolCallId}`, type: 'tool', status: 'error', toolName: tc.name, toolCallId: tc.toolCallId, error: `工具 "${tc.name}" 未注册`, timestamp: Date.now() } })
      return { tc, execResult: makeErrResult(tc, `工具 "${tc.name}" 未注册`) }
    }
    const safetyResult: any = await deps.hooks.run(
      HOOKS.TOOL_SAFETY_CHECK,
      { session, toolCall: tc, definition: def, mode: (session.metadata?.mode as PermissionMode) ?? PERMISSION_MODES.ASK },
      { runtime },
    )
    if (safetyResult?.stop) {
      await deps.emitEvent(EVENTS.ACTIVITY_DONE, { session, turnId, activity: { id: `tool-${tc.toolCallId}`, type: 'tool', status: 'error', toolName: tc.name, toolCallId: tc.toolCallId, error: safetyResult.reason ?? '权限拒绝', timestamp: Date.now() } })
      return { tc, execResult: makeErrResult(tc, `权限拒绝: ${safetyResult.reason ?? '工具调用被安全策略阻止'}`) }
    }
    const handler = deps.resolveTool ? await deps.resolveTool(tc.name) : undefined
    debugLog(DEBUG_SCOPES.TOOLS, `工具调用: ${tc.name}`, {
      toolCallId: tc.toolCallId, name: tc.name, arguments: tc.arguments,
    }, deps.logger)
    if (!handler) {
      await deps.emitEvent(EVENTS.ACTIVITY_DONE, { session, turnId, activity: { id: `tool-${tc.toolCallId}`, type: 'tool', status: 'error', toolName: tc.name, toolCallId: tc.toolCallId, error: `工具 "${tc.name}" 无 handler`, timestamp: Date.now() } })
      return { tc, execResult: makeErrResult(tc, `工具 "${tc.name}" 无 handler`) }
    }
    const execResult = await executeOneTool(handler, tc, session, deps, turnId, signal)
    debugLog(DEBUG_SCOPES.TOOLS, `工具结果: ${tc.name}`, {
      toolCallId: execResult.toolCallId, name: execResult.name, isError: execResult.isError,
    }, deps.logger)
    return { tc, execResult }
  }

  function makeErrResult(tc: ToolCallPart, msg: string): ToolExecutionResult {
    return { toolCallId: tc.toolCallId, name: tc.name, isError: true, content: [{ type: MESSAGE_PART_TYPES.TEXT, text: msg }] }
  }

  function tcToMsg(tc: ToolCallPart, r: ToolExecutionResult): Message {
    return {
      id: `${session.id}_tool_${tc.toolCallId}`,
      role: MESSAGE_ROLES.TOOL,
      createdAt: Date.now(),
      parts: r.content,
      toolCallId: tc.toolCallId,
      toolName: tc.name,
      isError: r.isError ?? false,
    }
  }

  // ── 工具执行循环 ──

  // 每轮 turn 开始时检查一次上下文。
  // 不移入循环内重复检查（参考 OpenHanako：初始化时检查 + 客户端手动 compact 事件触发）。
  const guarded = await guardContext(contextWithTools.messages, '', modelName ?? '', {
    threshold: compressionThreshold ?? 0.8,
    keepRecentTokens: compressionKeepTokens ?? 32000,
    logger: deps.logger,
    summarize: runtime ? createSummarizerFromRuntime(runtime, toolModel) : undefined,
    onProgress: (status) => {
      deps.emitEvent('compression.status', { session, turnId, status })
      if (status.step === 'done' || status.step === 'truncating') {
        deps.logger?.info?.(`[context] 压缩完成: ${status.message}`)
      }
    },
  })
  if (guarded.compacted) {
    debugLog(DEBUG_SCOPES.CONTEXT, '上下文压缩', {
      beforeCount: contextWithTools.messages.length,
      afterCount: guarded.messages.length,
      beforeRoles: contextWithTools.messages.map((m: any) => ({
        role: m.role,
        preview: m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text?.substring(0, 60)).filter(Boolean).join(' ') || '',
        id: (m.id as string)?.substring(0, 16),
      })),
      afterRoles: guarded.messages.map((m: any) => ({
        role: m.role,
        preview: m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text?.substring(0, 60)).filter(Boolean).join(' ') || '',
        id: (m.id as string)?.substring(0, 16),
      })),
      method: guarded.method,
    }, deps.logger)
    // 持久化压缩标记：将摘要消息追加到 JSONL，后续 buildContext 检测到此标记
    // 时直接从该位置截断，不再重新计算 token 和 AI 摘要。
    try {
      const storage = deps.getStorage?.()
      if (storage) {
        const summaryMsg = guarded.messages.find((m: any) => m.id === 'ctx-compaction')
        if (summaryMsg) {
          // 标记已持久化的最早消息 ID，供 buildContext 截断用
          const firstKeptId = guarded.messages.find((m: any) => m.id !== 'ctx-compaction')?.id
          const msgWithMeta = { ...summaryMsg, metadata: { ...summaryMsg.metadata, compressedAt: Date.now(), firstKeptId, tokensBefore: guarded.tokensBefore, tokensAfter: guarded.tokensAfter } }
          await storage.appendMessage(session.id, msgWithMeta)
          deps.logger?.info?.('[context] 压缩标记已持久化')
          // 通知客户端实时显示压缩摘要气泡
          await deps.emitEvent(EVENTS.MESSAGE_APPENDED, { session, message: msgWithMeta })
        }
      }
    } catch {}
    contextWithTools = { ...contextWithTools, messages: guarded.messages }
  } else {
    debugLog(DEBUG_SCOPES.CONTEXT, '上下文无需压缩', {
      count: contextWithTools.messages.length,
    }, deps.logger)
  }
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // 决策点 1：每轮开始前检查中止
    if (signal?.aborted) {
      debugLog(DEBUG_SCOPES.ABORT, `turnRunner: check 1 abort (round=${round})`, { round, finalResponseId: finalResponse?.message?.id, finalResponseParts: finalResponse?.message?.parts?.length }, deps.logger)
      break
    }

    const request: ModelRequest = {
      sessionId: session.id,
      turnId,
      model: modelName ?? '<no-model>',
      signal,
      context: {
        ...contextWithTools,
        messages: contextWithTools.messages,
      },
      settings: {
        thinkingLevel: (session.metadata?.thinkingLevel as string | undefined) ?? 'auto',
      },
    }
    const tl = (session.metadata?.thinkingLevel as string | undefined) ?? 'auto'
    debugLog('thinking', 'turnRunner settings', { sessionId: session.id, thinkingLevel: tl, metadata: session.metadata, round }, deps.logger)

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
      const isTimeout = cause instanceof StreamTimeoutError
      const error: RuntimeError = {
        code: isTimeout ? ERROR_CODES.STREAM_TIMEOUT : ERROR_CODES.MODEL_REQUEST_FAILED,
        message: isTimeout ? `模型响应超时${detail}` : `模型请求失败${detail}`,
        cause,
      }
      await deps.emitEvent(EVENTS.TURN_FAILED, { session, turnId, error })
      await deps.emitEvent(EVENTS.TURN_COMPLETED, { session, turnId })
      throw error
    }

    // 为本轮消息标记 turnId
    response.message = { ...response.message, turnId }
    // 如果模型已返回中止状态或信号已触发，在首次持久化前写入 stopReason
    if (response.stopReason === 'aborted' || signal?.aborted) {
      response.message = { ...response.message, stopReason: 'aborted' }
    }
    allRoundMessages.push(response.message)
    finalResponse = response
    // 每轮结束立即持久化（防止后续轮次失败时本轮消息丢失）
    // 第一轮同时持久化用户消息
    const roundMessages = allRoundMessages.length === 1
      ? [inputAsMsg, response.message]
      : [response.message]
    await deps.hooks.run(HOOKS.TURN_AFTER_TOOL_EXEC, { session, turnId, messages: roundMessages }, { runtime })

    // 提取 tool-call
    const toolCalls = response.message.parts.filter(
      (p): p is ToolCallPart => p.type === MESSAGE_PART_TYPES.TOOL_CALL,
    )
    // 本轮新增的消息（仅当前 round，不含之前 round 的）
    if (toolCalls.length === 0) {
      // 模型返回纯文本，退出循环
      break
    }

    // 决策点 3：工具执行前检查中止。中止时不执行工具，直接跳出。
    if (signal?.aborted) {
      debugLog(DEBUG_SCOPES.ABORT, 'turnRunner: check 3 abort (tool execution skipped)', { toolCount: toolCalls.length }, deps.logger)
      // 补发工具活动的 ACTIVITY_DONE（前端需要它们变为 completed 才能恢复发送按钮）
      for (const tc of toolCalls) {
        await deps.emitEvent(EVENTS.ACTIVITY_DONE, {
          session, turnId,
          activity: {
            id: `tool-${tc.toolCallId}`,
            type: 'tool',
            status: 'aborted',
            toolName: tc.name,
            toolCallId: tc.toolCallId,
            toolInput: tc.arguments as Record<string, unknown>,
            timestamp: Date.now(),
          },
        })
      }
      break
    }

    // 安全检查 + 执行工具
    // 每个工具调用独立执行，每条结果独立成一条 Message（参见 D-032）
    const toolDefs = deps.resolveTools ? await deps.resolveTools() : []
    const defMap = new Map(toolDefs.map(d => [d.name, d]))

    // 分组并行执行：同资源串行，不同资源并行
    const groups = new Map<string, ToolCallPart[]>()
    for (const tc of toolCalls) {
      const rid = getResourceId(tc)
      const g = groups.get(rid) ?? []
      g.push(tc)
      groups.set(rid, g)
    }

    const groupPromises = Array.from(groups.values()).map(async (group) => {
      const results: Array<{ tc: ToolCallPart; execResult: ToolExecutionResult }> = []
      for (const tc of group) {
        if (signal?.aborted) {
          // 跳过未执行的工具，补发 ACTIVITY_DONE
          debugLog(DEBUG_SCOPES.ABORT, 'turnRunner: group abort, skipping tools', { skipped: group.slice(results.length).length, resultsSoFar: results.length }, deps.logger)
          for (const skipTc of group.slice(results.length)) {
            await deps.emitEvent(EVENTS.ACTIVITY_DONE, {
              session, turnId,
              activity: {
                id: `tool-${skipTc.toolCallId}`,
                type: 'tool',
                status: 'aborted',
                toolName: skipTc.name,
                toolCallId: skipTc.toolCallId,
                toolInput: skipTc.arguments as Record<string, unknown>,
                timestamp: Date.now(),
              },
            })
          }
          break
        }
        results.push(await runOneTool(tc, defMap))
      }
      return results
    })

    const groupedResults = await Promise.all(groupPromises)
    const allResults = groupedResults.flat()

    // 按原始 toolCalls 顺序重建结果
    const resultByCallId = new Map(allResults.map(r => [r.execResult.toolCallId, r]))
    const toolResultMessages: Message[] = []
    for (const tc of toolCalls) {
      const r = resultByCallId.get(tc.toolCallId)
      if (r) toolResultMessages.push(tcToMsg(r.tc, r.execResult))
    }

    // Snow-CLI 模式：限制每个 tool result 的大小
    // 防止单次工具结果撑爆上下文窗口
    const toolProvider = modelName?.includes('/') ? modelName.split('/')[0] : ''
    const toolModelName = modelName?.includes('/') ? modelName.split('/')[1] : modelName
    const modelWindow = getContextWindow(toolProvider, toolModelName ?? '', undefined)
    for (const toolMsg of toolResultMessages) {
      const limited = limitToolResult(toolMsg.parts, modelWindow)
      if (limited.truncated) {
        toolMsg.parts = limited.parts
        deps.logger?.debug?.(`[token-limiter] 工具 ${toolMsg.toolName} 结果过长，已截断`)
      }
    }

    // 每条 tool result 独立追加到上下文
    for (const toolMsg of toolResultMessages) {
      allRoundMessages.push(toolMsg)
    }
    // 持久化工具执行结果
    if (toolResultMessages.length > 0) {
      await deps.hooks.run(HOOKS.TURN_AFTER_TOOL_EXEC, { session, turnId, messages: toolResultMessages }, { runtime })
    }
    // 决策点 2：工具执行完成后检查中止
    if (signal?.aborted) {
      debugLog(DEBUG_SCOPES.ABORT, `turnRunner: check 2 abort (round=${round})`, { round, allRoundMessagesLen: allRoundMessages.length }, deps.logger)
      break
    }

    contextWithTools = {
      ...contextWithTools,
      messages: [...contextWithTools.messages, response.message, ...toolResultMessages],
    }
  }

  // ── 最终持久化与返回 ──

  debugLog(DEBUG_SCOPES.ABORT, 'turnRunner: after-loop', { aborted: !!signal?.aborted, hasFinalResponse: !!finalResponse, allRoundCount: allRoundMessages.length, msgIds: allRoundMessages.map((m: any) => ({ id: m.id, role: m.role, turnId: m.turnId, stopReason: m.stopReason })) }, deps.logger)

  // 标记中止的 finalResponse（OpenHanako 模式：写入完整记录，读取时过滤）
  if (signal?.aborted && finalResponse) {
    finalResponse = { ...finalResponse, stopReason: 'aborted' }
    // 将 stopReason 同步到 message 级别，持久化后供读取时过滤和 UI 展示
    finalResponse.message = { ...finalResponse.message, stopReason: 'aborted', turnId }
    // 同步更新 allRoundMessages 中的对应消息（持久化用的是 allRoundMessages）
    const abortedMsgId = finalResponse.message.id
    if (abortedMsgId) {
      allRoundMessages = allRoundMessages.map((m) =>
        m.id === abortedMsgId ? { ...m, stopReason: 'aborted' } : m
      )
    }
  }

  // 给所有本轮消息标记 turnId（包含正常完成和中止的）
  allRoundMessages = allRoundMessages.map((m) => {
    if (!m.turnId) return { ...m, turnId }
    return m
  })

  await deps.hooks.run(HOOKS.PERSIST_BEFORE, { session }, { runtime })
  await deps.hooks.run(HOOKS.TURN_AFTER, { session, turnId, messages: allRoundMessages }, { runtime })
  await deps.hooks.run(HOOKS.PERSIST_AFTER, { session }, { runtime })

  if (finalResponse) {
    // 若适配器未返回 usage（如 mock），用服务端估算值填充
    if (!finalResponse.usage) {
      finalResponse.usage = {
        inputTokens: estimateMessagesTokens(contextWithTools.messages),
        outputTokens: estimateMessageTokens(finalResponse.message),
      }
    }

    await deps.emitEvent(EVENTS.MODEL_COMPLETED, { session, response: finalResponse })
    await deps.emitEvent(EVENTS.MESSAGE_APPENDED, { session, message: finalResponse.message })

    // 服务端为授权源，主动通知客户端当前上下文 token 数（对齐 CrystalAgents / Snow-CLI）。
    // 使用 API 实际返回的 prompt_tokens（含消息 + 工具定义），而非仅消息的估算值。
    const apiInputTokens = finalResponse.usage?.inputTokens
    if (typeof apiInputTokens === 'number') {
      await deps.emitEvent('usage.update', { session, inputTokens: apiInputTokens })
      // 持久化上下文 token 数到 session metadata（用于页面刷新后恢复显示）
      if (!session.metadata) session.metadata = {}
      ;(session.metadata as Record<string, unknown>).contextTokenCount = apiInputTokens
    } else {
      // 兜底：API 未返回 usage 时用消息估算
      const totalContext = [...contextWithTools.messages, finalResponse.message]
      const finalTokens = estimateMessagesTokens(totalContext)
      await deps.emitEvent('usage.update', { session, inputTokens: finalTokens })
      if (!session.metadata) session.metadata = {}
      ;(session.metadata as Record<string, unknown>).contextTokenCount = finalTokens
    }

    debugLog(DEBUG_SCOPES.USAGE, 'model.completed finalResponse', {
      hasUsage: !!finalResponse?.usage,
      usage: finalResponse?.usage,
    }, deps.logger)
  }

  // 累计 token 用量到 session（持久化，跨 restart 保留）
  if (finalResponse?.usage) {
    const u = finalResponse.usage
    const acc = session.usageAccumulated ?? { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }
    if (u.inputTokens) acc.inputTokens += u.inputTokens
    if (u.outputTokens) acc.outputTokens += u.outputTokens
    if (u.cachedInputTokens) acc.cachedInputTokens += u.cachedInputTokens
    session.usageAccumulated = acc
    // 保存本轮 usage 到 metadata（用于跨刷新显示）
    if (!session.metadata) session.metadata = {}
    ;(session.metadata as Record<string, unknown>).lastRoundUsage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cachedInputTokens: u.cachedInputTokens }
    await runtime.updateSession(session)
    debugLog(DEBUG_SCOPES.USAGE, 'usage from response', { inputTokens: acc.inputTokens, outputTokens: acc.outputTokens }, deps.logger)
  } else {
    debugLog(DEBUG_SCOPES.USAGE, 'usage unavailable (API did not return usage)', { hasFinalResponse: !!finalResponse }, deps.logger)
  }

  await deps.emitEvent(EVENTS.TURN_COMPLETED, { session, turnId })

  // 提交检查点（turn 正常完成，保留文件供后续回滚）
  if (cp) {
    await cp.complete(session.id, turnId)
  }

  return {
    session,
    turnId,
    messages: allRoundMessages,
    response: finalResponse,
  }
}
