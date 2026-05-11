/**
 * DeepSeek ModelAdapter 实现。
 *
 * 基于 OpenAI Completions 兼容 API，额外处理：
 *   1. reasoning_content 捕获（流式响应中的思考链）
 *   2. reasoning_content 回传（带 tool_calls 的 assistant 消息必须回传）
 *   3. assistant tool-call 消息的 content 必须为非 null 字符串
 *
 * 参考：refs/openhanako/core/provider-compat/deepseek.js
 */
import type {
  Message,
  MessagePart,
  ModelAdapter,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  RuntimeError,
  TextPart,
  ToolCallPart,
} from '@crai/core'
import { STREAM_EVENT_TYPES } from '@crai/core'
import { sseLines } from '../core/stream'
import { isDebugScope, DEBUG_SCOPES } from '../core/debug'
import {
  API,
  DEFAULT_ADAPTER_NAME,
  ERROR_CODES,
  DEEPSEEK_ROLES,
  PART_TYPES,
  DEEPSEEK_HIGH_THINKING_BUDGET,
  DEEPSEEK_HIGH_SAFE_MAX_TOKENS,
  DEEPSEEK_MAX_EFFORT_MAX_TOKENS,
} from './constants'
import { ID_PREFIX } from '../constants'

// ============================================================
// 类型
// ============================================================

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  /** DeepSeek thinking mode: must be echoed back on tool_calls rounds */
  reasoning_content?: string
}

interface DeepSeekResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: DeepSeekMessage
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    completion_tokens_details?: {
      reasoning_tokens: number
    }
  }
}

interface DeepSeekStreamChunk {
  id: string
  model: string
  choices: Array<{
    index: number
    delta: Partial<DeepSeekMessage> & { reasoning_content?: string }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface DeepSeekAdapterOptions {
  apiKey: string
  baseURL?: string
  adapterName?: string
}

// ============================================================
// Message 转换
// ============================================================

/**
 * 将 Crai Message[] 转为 DeepSeek API 请求体中的 messages 数组。
 * 对于带 tool_calls 的 assistant 消息，从 metadata 中提取 reasoning_content 回传。
 */
function toDeepSeekMessages(contextMessages: Message[], system?: string): DeepSeekMessage[] {
  const result: DeepSeekMessage[] = []

  if (system) {
    result.push({ role: DEEPSEEK_ROLES.SYSTEM, content: system })
  }

  for (const msg of contextMessages) {
    if (msg.role === DEEPSEEK_ROLES.SYSTEM) {
      const text = msg.parts.find(p => p.type === PART_TYPES.TEXT) as TextPart | undefined
      if (text) result.push({ role: DEEPSEEK_ROLES.SYSTEM, content: text.text })
      continue
    }

    if (msg.role === DEEPSEEK_ROLES.USER) {
      const text = msg.parts.find(p => p.type === PART_TYPES.TEXT) as TextPart | undefined
      result.push({ role: DEEPSEEK_ROLES.USER, content: text?.text ?? '' })
      continue
    }

    if (msg.role === DEEPSEEK_ROLES.ASSISTANT) {
      const text = msg.parts.find((p: MessagePart) => p.type === PART_TYPES.TEXT) as TextPart | undefined
      const toolCalls = msg.parts.filter((p: MessagePart) => p.type === PART_TYPES.TOOL_CALL) as ToolCallPart[]

      const dsMsg: DeepSeekMessage = {
        role: DEEPSEEK_ROLES.ASSISTANT,
        content: text?.text ?? null,
      }

      if (toolCalls.length > 0) {
        dsMsg.tool_calls = toolCalls.map(tc => ({
          id: tc.toolCallId,
          type: API.TOOL_TYPE,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))

        // DeepSeek thinking mode 要求带 tool_calls 的 assistant 消息必须回传 reasoning_content
        // 从 metadata.reasoningContent 读取（由 stream() 捕获时写入）
        const rc = msg.metadata?.reasoningContent
        if (typeof rc === 'string') {
          dsMsg.reasoning_content = rc
        }

        // DeepSeek 要求 tool-call 消息的 content 不能为 null（改为空字符串）
        dsMsg.content = dsMsg.content ?? ''
      }

      result.push(dsMsg)
      continue
    }

    if (msg.role === DEEPSEEK_ROLES.TOOL) {
      const textPart = msg.parts.find((p): p is TextPart => p.type === PART_TYPES.TEXT) as TextPart | undefined
      result.push({
        role: DEEPSEEK_ROLES.TOOL,
        content: textPart?.text ?? '',
        tool_call_id: msg.toolCallId ?? '',
      })
    }
  }

  return result
}

// ============================================================
// 响应转换
// ============================================================

/** 将 DeepSeek 非流式响应体转为 Crai ModelResponse。 */
function fromDeepSeekResponse(dsResp: DeepSeekResponse): ModelResponse {
  const choice = dsResp.choices[0]
  const msg = choice.message
  const parts: MessagePart[] = []

  if (msg.content) {
    parts.push({ type: PART_TYPES.TEXT, text: msg.content })
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      parts.push({
        type: PART_TYPES.TOOL_CALL,
        toolCallId: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    }
  }

  return {
    message: {
      id: `${ID_PREFIX}${Date.now()}`,
      role: DEEPSEEK_ROLES.ASSISTANT,
      createdAt: Date.now(),
      parts,
      metadata: {
        ...(msg.reasoning_content ? { reasoningContent: msg.reasoning_content } : undefined),
      },
    },
    usage: dsResp.usage
      ? {
          inputTokens: dsResp.usage.prompt_tokens,
          outputTokens: dsResp.usage.completion_tokens,
        }
      : undefined,
    stopReason: choice.finish_reason ?? undefined,
  }
}

// ============================================================
// 流式累积器
// ============================================================

/**
 * reasoning_content 累积器（模块级）。
 * DeepSeek 的 reasoning_content 在 stream 中逐 chunk 发送增量。
 * 一轮 stream() 开始前由 resetAccumulator 清空。
 */
let accumulatedReasoningContent = ''

function resetAccumulator(): void {
  accumulatedReasoningContent = ''
}

// ============================================================
// Thinking 辅助
// ============================================================

/** 从 providerSpecific 中提取 reasoning_effort 并归一化。 */
function resolveReasoningEffort(settings: ModelRequest['settings']): string | undefined {
  // 优先从 thinkingLevel 读取（将来 core 升为 settings 一等字段）
  const raw = (settings as any)?.thinkingLevel ?? settings?.providerSpecific?.reasoningEffort
  if (!raw || typeof raw !== 'string') return undefined

  const lower = raw.toLowerCase()
  // DeepSeek 只接受 'high' 和 'max'，其他值归一化
  if (lower === 'low' || lower === 'medium') return 'high'
  if (lower === 'xhigh') return 'max'
  if (lower === 'high' || lower === 'max') return lower
  return undefined
}

/** 判断是否应该开启 thinking mode。 */
function shouldEnableThinking(request: ModelRequest): boolean {
  // providerSpecific.mode === 'utility' → 关思考
  if (request.settings?.providerSpecific?.mode === 'utility') return false
  // 显式关思考
  if (request.settings?.providerSpecific?.thinkingEnabled === false) return false
  // 通过 thinkingLevel='off' 关
  if ((request.settings as any)?.thinkingLevel === 'off') return false
  return true
}

/**
 * 从 messages 数组中剥离所有 assistant 消息的 reasoning_content 字段。
 * 关闭 thinking mode 时，必须删除 messages 中的 reasoning_content 否则 API 报错。
 */
function stripReasoningContent(messages: DeepSeekMessage[]): DeepSeekMessage[] {
  return messages.map(msg => {
    if (msg.role !== 'assistant' || msg.reasoning_content === undefined) return msg
    const copy = { ...msg }
    delete copy.reasoning_content
    return copy
  })
}

// ============================================================
// 请求构建
// ============================================================

function buildDeepSeekBody(
  request: ModelRequest,
  stream?: boolean,
): Record<string, unknown> {
  let dsMessages = toDeepSeekMessages(request.context.messages, request.context.system)

  const body: Record<string, unknown> = {
    model: request.model,
    messages: dsMessages,
  }

  if (stream) {
    body.stream = true
    body.stream_options = { include_usage: true }
  }

  if (request.context.tools && request.context.tools.length > 0) {
    body.tools = request.context.tools.map(t => ({
      type: API.TOOL_TYPE,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }))
  }

  if (request.settings?.temperature !== undefined) body.temperature = request.settings.temperature

  // ── Thinking mode 决策 ──
  const thinking = shouldEnableThinking(request)
  const maxTokens = request.settings?.maxTokens

  if (thinking) {
    const effort = resolveReasoningEffort(request.settings)
    body.thinking = { type: 'enabled' }
    if (effort) body.reasoning_effort = effort

    // thinking 模式下 max_tokens 需要 ≥ 32K，否则 API 报错
    if (maxTokens !== undefined && maxTokens < DEEPSEEK_HIGH_THINKING_BUDGET) {
      // 用户显式设了小预算 → 关思考（通知用户但静默降级）
      if (request.settings?.providerSpecific?.mode !== 'utility') {
        body.thinking = { type: 'disabled' }
        delete body.reasoning_effort
        body.messages = stripReasoningContent(dsMessages)
      }
      if (maxTokens > 0) body.max_tokens = maxTokens
    } else if (maxTokens === undefined) {
      // 未设 max_tokens → 给 thinking 模式一个安全值
      // effort='max' 需要更大预算（OpenHanako 参考）
      body.max_tokens = effort === 'max'
        ? DEEPSEEK_MAX_EFFORT_MAX_TOKENS
        : DEEPSEEK_HIGH_SAFE_MAX_TOKENS
    } else {
      body.max_tokens = maxTokens
    }
  } else {
    // thinking 关闭：显式禁思考 + 剥离 reasoning_content
    body.thinking = { type: 'disabled' }
    body.messages = stripReasoningContent(dsMessages)
    if (maxTokens !== undefined && maxTokens > 0) {
      body.max_tokens = maxTokens
    }
  }

  return body
}

// ============================================================
// Stream done 事件构建
// ============================================================

function buildDoneResponse(text: string, finishReason: string | null): ModelStreamEvent & { type: 'done' } {
  const parts: MessagePart[] = text ? [{ type: PART_TYPES.TEXT, text }] : []
  const toolParts = buildToolCallPartsFromAccumulator()
  parts.push(...toolParts)

  if (isDebugScope(DEBUG_SCOPES.API)) {
    console.error(`[debug:api] stream response (model=..., finish_reason=${finishReason ?? 'null'}):\n${JSON.stringify({
      text: text || '(no text content)',
      toolCalls: toolParts.map(t => ({ name: t.name, arguments: t.arguments })),
    }, null, 2)}\n`)
  }

  return {
    type: 'done',
    response: {
      message: {
        id: `${ID_PREFIX}${Date.now()}`,
        role: DEEPSEEK_ROLES.ASSISTANT,
        createdAt: Date.now(),
        parts,
        // 把本轮捕获的 reasoning_content 存入 metadata，后续轮次回传用
        metadata: {
          ...(accumulatedReasoningContent ? { reasoningContent: accumulatedReasoningContent } : undefined),
        },
      },
      stopReason: finishReason ?? undefined,
    },
  }
}

// ============================================================
// tool_calls 累积器
// ============================================================

const accumulatedToolCallsMap = new Map<
  number,
  { id: string; name: string; args: string }
>()

function resetAccumulatedToolCalls(): void {
  accumulatedToolCallsMap.clear()
}

function buildToolCallPartsFromAccumulator(): ToolCallPart[] {
  const parts: ToolCallPart[] = []
  for (const [, entry] of accumulatedToolCallsMap) {
    try {
      parts.push({
        type: PART_TYPES.TOOL_CALL,
        toolCallId: entry.id,
        name: entry.name,
        arguments: entry.args ? JSON.parse(entry.args) : {},
      })
    } catch {
      // arguments 不完整就跳过
    }
  }
  return parts
}

// ============================================================
// DeepSeekAdapter
// ============================================================

export class DeepSeekAdapter implements ModelAdapter {
  readonly name: string

  constructor(private readonly options: DeepSeekAdapterOptions) {
    this.name = options.adapterName ?? DEFAULT_ADAPTER_NAME
  }

  private get baseURL(): string {
    return this.options.baseURL ?? API.DEFAULT_BASE_URL
  }

  private get chatURL(): string {
    return `${this.baseURL}${API.CHAT_PATH}`
  }

  async request(request: ModelRequest): Promise<ModelResponse> {
    const body = buildDeepSeekBody(request)
    const bodyJson = JSON.stringify(body)

    if (isDebugScope(DEBUG_SCOPES.API)) {
      console.error(`[debug:api] POST ${this.chatURL}`)
      console.error(`[debug:api] request body (model=${request.model}):\n${bodyJson}\n`)
    }

    const res = await fetch(this.chatURL, {
      method: API.METHOD,
      headers: {
        'Content-Type': API.CONTENT_TYPE,
        Authorization: `${API.AUTH_SCHEME} ${this.options.apiKey}`,
      },
      body: bodyJson,
    })

    if (!res.ok) {
      const errBody = await res.text()
      if (isDebugScope(DEBUG_SCOPES.API)) {
        console.error(`[debug:api] response error (${res.status}):\n${errBody}\n`)
      }
      const err: RuntimeError = { code: ERROR_CODES.API_ERROR, message: `DeepSeek API error (${res.status}): ${errBody}` }
      throw err
    }

    const data = (await res.json()) as DeepSeekResponse
    if (isDebugScope(DEBUG_SCOPES.API)) {
      console.error(`[debug:api] response body:\n${JSON.stringify(data, null, 2)}\n`)
    }
    return fromDeepSeekResponse(data)
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const body = buildDeepSeekBody(request, true)
    const bodyJson = JSON.stringify(body)

    if (isDebugScope(DEBUG_SCOPES.API)) {
      console.error(`[debug:api] POST ${this.chatURL} (stream)`)
      console.error(`[debug:api] request body (model=${request.model}):\n${bodyJson}\n`)
    }

    const res = await fetch(this.chatURL, {
      method: API.METHOD,
      headers: {
        'Content-Type': API.CONTENT_TYPE,
        Authorization: `${API.AUTH_SCHEME} ${this.options.apiKey}`,
      },
      body: bodyJson,
    })

    if (!res.ok) {
      const errBody = await res.text()
      if (isDebugScope(DEBUG_SCOPES.API)) {
        console.error(`[debug:api] stream response error (${res.status}):\n${errBody}\n`)
      }
      yield { type: STREAM_EVENT_TYPES.ERROR, error: { code: ERROR_CODES.API_ERROR, message: `DeepSeek API error (${res.status}): ${errBody}` } }
      return
    }

    yield { type: STREAM_EVENT_TYPES.TEXT_START }

    // 重置累积器
    resetAccumulatedToolCalls()
    resetAccumulator()
    let fullContent = ''

    try {
      for await (const data of sseLines(res.body)) {
        let chunk: DeepSeekStreamChunk
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }

        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        // 捕获 reasoning_content（DeepSeek thinking mode 的思考链）
        if (delta?.reasoning_content) {
          accumulatedReasoningContent += delta.reasoning_content
        }

        // 普通文本 delta
        if (delta?.content) {
          fullContent += delta.content
          yield { type: STREAM_EVENT_TYPES.TEXT_DELTA, delta: delta.content }
        }

        // tool_calls delta（与 OpenAI 格式相同）
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0
            const existing = accumulatedToolCallsMap.get(index) ?? { id: '', name: '', args: '' }

            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments) existing.args += tc.function.arguments

            accumulatedToolCallsMap.set(index, existing)
          }
        }

        // finish_reason 检测
        if (choice.finish_reason) {
          yield { type: STREAM_EVENT_TYPES.TEXT_END }
          yield buildDoneResponse(fullContent, choice.finish_reason)
        }
      }

      // 流正常结束但未收到 finish_reason，发 done
      yield { type: STREAM_EVENT_TYPES.TEXT_END }
      yield buildDoneResponse(fullContent, null)
    } catch (err) {
      yield {
        type: STREAM_EVENT_TYPES.ERROR,
        error: { code: ERROR_CODES.API_ERROR, message: `SSE 流解析出错: ${(err as Error).message}` },
      }
    }
  }
}
