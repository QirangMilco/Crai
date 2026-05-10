/**
 * OpenAI ModelAdapter 实现。
 * 支持完整响应 (request) 和 SSE 流式响应 (stream)，
 * 自动在 Crai Message 与 OpenAI API 格式间双向转换。
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
  ToolResultPart,
} from '@crai/core'
import { STREAM_EVENT_TYPES } from '@crai/core'
import { sseLines } from '../core/stream'
import {
  API,
  DEFAULT_ADAPTER_NAME,
  ERROR_CODES,
  OPENAI_ROLES,
  PART_TYPES,
} from './constants'
import { ID_PREFIX } from '../constants'

export interface OpenAIAdapterOptions {
  apiKey: string
  baseURL?: string
  adapterName?: string
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface OpenAIResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: OpenAIMessage
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIStreamChunk {
  id: string
  model: string
  choices: Array<{
    index: number
    delta: Partial<OpenAIMessage>
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/** 将 Crai Message[] 转为 OpenAI API 请求体中的 messages 数组。 */
function toOpenAIMessages(contextMessages: Message[], system?: string): OpenAIMessage[] {
  const result: OpenAIMessage[] = []

  if (system) {
    result.push({ role: OPENAI_ROLES.SYSTEM, content: system })
  }

  for (const msg of contextMessages) {
    if (msg.role === OPENAI_ROLES.SYSTEM) {
      const text = msg.parts.find(p => p.type === PART_TYPES.TEXT) as TextPart | undefined
      if (text) result.push({ role: OPENAI_ROLES.SYSTEM, content: text.text })
      continue
    }

    if (msg.role === OPENAI_ROLES.USER) {
      const text = msg.parts.find(p => p.type === PART_TYPES.TEXT) as TextPart | undefined
      result.push({ role: OPENAI_ROLES.USER, content: text?.text ?? '' })
      continue
    }

    if (msg.role === OPENAI_ROLES.ASSISTANT) {
      const text = msg.parts.find((p: MessagePart) => p.type === PART_TYPES.TEXT) as TextPart | undefined
      const toolCalls = msg.parts.filter((p: MessagePart) => p.type === PART_TYPES.TOOL_CALL) as ToolCallPart[]

      const openAIMsg: OpenAIMessage = {
        role: OPENAI_ROLES.ASSISTANT,
        content: text?.text ?? null,
      }
      if (toolCalls.length > 0) {
        openAIMsg.tool_calls = toolCalls.map(tc => ({
          id: tc.toolCallId,
          type: API.TOOL_TYPE,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      }
      result.push(openAIMsg)
      continue
    }

    if (msg.role === OPENAI_ROLES.TOOL) {
      const toolResult = msg.parts[0] as ToolResultPart | undefined
      const textContent = toolResult?.content.find((p): p is TextPart => p.type === PART_TYPES.TEXT) as TextPart | undefined
      result.push({
        role: OPENAI_ROLES.TOOL,
        content: textContent?.text ?? '',
        tool_call_id: toolResult?.toolCallId ?? '',
      })
    }
  }

  return result
}

/** 将 OpenAI 响应体转为 Crai ModelResponse。 */
function fromOpenAIResponse(openAIResp: OpenAIResponse): ModelResponse {
  const choice = openAIResp.choices[0]
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
      role: OPENAI_ROLES.ASSISTANT,
      createdAt: Date.now(),
      parts,
    },
    usage: openAIResp.usage
      ? {
          inputTokens: openAIResp.usage.prompt_tokens,
          outputTokens: openAIResp.usage.completion_tokens,
        }
      : undefined,
    stopReason: choice.finish_reason ?? undefined,
  }
}

/**
 * 流式 tool_calls 的增量累积器。
 * OpenAI 兼容 API 的 tool_calls args 是分 chunk 发送的，
 * 每个 chunk 的 arguments 是 JSON 片段（可能为空），需要按 index 合并。
 */
const accumulatedToolCallsMap = new Map<
  number,
  { id: string; name: string; args: string }
>()

/** 重置累积器（每次新的模型调用前调用）。 */
export function resetAccumulatedToolCalls(): void {
  accumulatedToolCallsMap.clear()
}

/** 将 OpenAI 流式 chunk delta 组装到 accumulated parts 中。 */
function accumulateChunk(
  chunk: OpenAIStreamChunk,
): { deltaText: string; toolCalls: ToolCallPart[] } {
  const delta = chunk.choices[0]?.delta
  const deltaText = delta?.content ?? ''
  const toolCalls: ToolCallPart[] = []

  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      const index = tc.index ?? 0
      const existing = accumulatedToolCallsMap.get(index) ?? { id: '', name: '', args: '' }

      if (tc.id) existing.id = tc.id
      if (tc.function?.name) existing.name = tc.function.name
      if (tc.function?.arguments) existing.args += tc.function.arguments // 追加增量片段

      accumulatedToolCallsMap.set(index, existing)
    }
  }

  // 只返回累积完整的 tool-call（当这些 chunk 只是更新了累积器时，返回空数组）
  // 实际 tool-call 完整结果由 buildDoneResponse 使用 accumulatedToolCallsMap 构建
  return { deltaText, toolCalls }
}

/** 构建 OpenAI 兼容的 HTTP 请求体。 */
function buildOpenAIBody(
  request: ModelRequest,
  stream?: boolean,
): Record<string, unknown> {
  const openAIMessages = toOpenAIMessages(request.context.messages, request.context.system)

  const body: Record<string, unknown> = {
    model: request.model,
    messages: openAIMessages,
  }

  if (stream) body.stream = true

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
  if (request.settings?.maxTokens !== undefined) body.max_tokens = request.settings.maxTokens

  return body
}

/** 从累积器构建 ToolCallPart 列表。 */
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
      // arguments 片段不完整就跳过
    }
  }
  return parts
}

/** 构造 Stream done 事件响应。
 *   tool-call 从 accumulatedToolCallsMap 读取，确保增量合并后的 arguments 为完整 JSON。
 */
function buildDoneResponse(
  text: string,
  finishReason: string | null,
): ModelStreamEvent & { type: 'done' } {
  const parts: MessagePart[] = text ? [{ type: PART_TYPES.TEXT, text }] : []
  const toolParts = buildToolCallPartsFromAccumulator()
  parts.push(...toolParts)
  return {
    type: 'done',
    response: {
      message: {
        id: `${ID_PREFIX}${Date.now()}`,
        role: OPENAI_ROLES.ASSISTANT,
        createdAt: Date.now(),
        parts,
      },
      stopReason: finishReason ?? undefined,
    },
  }
}

/**
 * OpenAI ModelAdapter。
 * 通过 Extension 工厂注册到 runtime，支持通过 loader-ts 热更新。
 */
export class OpenAIAdapter implements ModelAdapter {
  readonly name: string

  constructor(private readonly options: OpenAIAdapterOptions) {
    this.name = options.adapterName ?? DEFAULT_ADAPTER_NAME
  }

  private get baseURL(): string {
    return this.options.baseURL ?? API.DEFAULT_BASE_URL
  }

  private get chatURL(): string {
    return `${this.baseURL}${API.CHAT_PATH}`
  }

  async request(request: ModelRequest): Promise<ModelResponse> {
    const body = buildOpenAIBody(request)

    const res = await fetch(this.chatURL, {
      method: API.METHOD,
      headers: {
        'Content-Type': API.CONTENT_TYPE,
        Authorization: `${API.AUTH_SCHEME} ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text()
      const err: RuntimeError = { code: ERROR_CODES.API_ERROR, message: `OpenAI API error (${res.status}): ${errBody}` }
      throw err
    }

    const data = (await res.json()) as OpenAIResponse
    return fromOpenAIResponse(data)
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    const body = buildOpenAIBody(request, true)

    const res = await fetch(this.chatURL, {
      method: API.METHOD,
      headers: {
        'Content-Type': API.CONTENT_TYPE,
        Authorization: `${API.AUTH_SCHEME} ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text()
      yield { type: STREAM_EVENT_TYPES.ERROR, error: { code: ERROR_CODES.API_ERROR, message: `OpenAI API error (${res.status}): ${errBody}` } }
      return
    }

    yield { type: STREAM_EVENT_TYPES.TEXT_START }

    // 重置工具调用累积器，准备新一轮流式解析
    resetAccumulatedToolCalls()
    let fullContent = ''

    try {
      for await (const data of sseLines(res.body)) {
        let chunk: OpenAIStreamChunk
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }

        const { deltaText } = accumulateChunk(chunk)

        if (deltaText) {
          fullContent += deltaText
          yield { type: STREAM_EVENT_TYPES.TEXT_DELTA, delta: deltaText }
        }

        if (chunk.choices[0]?.finish_reason) {
          yield { type: STREAM_EVENT_TYPES.TEXT_END }
          yield buildDoneResponse(fullContent, chunk.choices[0].finish_reason)
        }
      }

      // 流正常结束但未收到 finish_reason（如 [DONE] 哨兵），也发 done
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
