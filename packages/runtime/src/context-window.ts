/**
 * @crai/runtime — 上下文窗口管理与压缩
 *
 * 改进跟踪：
 * - Token 估算：tiktoken 优先（Snow-CLI 模式），字符近似回退
 * - 分轮感知：截断不切分 user/assistant 对（OpenHanako 模式）
 * - AI 摘要：可选的异步 summarizer 回调（Snow-CLI 模式），失败时回退硬截断
 * - 触发时机：每次模型调用前自动检查 + 手动 compact 事件支持
 *
 * 参考 OpenHanako 的 compaction-utils.js 和 Snow-CLI 的 contextCompressor。
 */

import type { Message } from '@crai/core'
import { getContextWindow, DEFAULT_COMPRESSION_THRESHOLD, CONTEXT_RESERVE_RATIO } from '@crai/core'
import type { Logger } from '@crai/core'

// ── Token 估算（Snow-CLI 模式：tiktoken 优先，字符近似回退） ──

let _tiktokenAvailable: boolean | null = null
let _tiktokenWarned = false

/**
 * 检查 tiktoken 是否可用（首次调用时动态 import）。
 */
async function checkTiktoken(): Promise<boolean> {
  if (_tiktokenAvailable !== null) return _tiktokenAvailable
  try {
    await import('tiktoken')
    _tiktokenAvailable = true
  } catch {
    _tiktokenAvailable = false
  }
  return _tiktokenAvailable
}

/**
 * 使用 tiktoken 估算 token 数。失败时返回 null。
 */
async function tiktokenEstimate(text: string, modelHint?: string): Promise<number | null> {
  try {
    const mod = await import('tiktoken')
    const encodingForModel = (mod as any).encoding_for_model
    if (typeof encodingForModel !== 'function') return null
    const encoder = encodingForModel(modelHint ?? 'gpt-4o')
    if (!encoder) return null
    const tokens = encoder.encode(text)
    return tokens.length
  } catch {
    return null
  }
}

/**
 * 字符级 token 近似回退。
 * CJK 约 1.5 字符/token，ASCII 约 4 字符/token。
 */
function charEstimate(text: string): number {
  if (!text) return 0
  let cjkChars = 0
  let asciiChars = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f)) {
      cjkChars++
    } else {
      asciiChars++
    }
  }
  return Math.ceil(cjkChars / 1.5) + Math.ceil(asciiChars / 4)
}

/**
 * 估算一段文本的 token 数。
 *
 * Snow-CLI 模式：tiktoken 优先（动态 import，可用时自动使用），
 * 不可用时回退字符近似。同步版本直接使用字符近似。
 */
export function estimateTokens(text: string): number {
  return charEstimate(text)
}

/**
 * 异步 token 估算。优先使用 tiktoken，否则字符近似。
 * 用于压缩等需要更精确计数的场景。
 */
export async function estimateTokensAccurate(text: string, modelHint?: string): Promise<number> {
  if (await checkTiktoken()) {
    const result = await tiktokenEstimate(text, modelHint)
    if (result !== null) return result
  }
  return charEstimate(text)
}

/**
 * 估算一条消息的 token 数（遍历所有 text 和 thinking parts）。
 */
export function estimateMessageTokens(msg: Message): number {
  let total = 0
  total += 4 // 角色开销
  for (const part of msg.parts) {
    if (part.type === 'text') {
      total += estimateTokens(part.text)
    } else if (part.type === 'thinking') {
      total += estimateTokens(part.thinking)
    } else if (part.type === 'tool-call') {
      total += estimateTokens(JSON.stringify(part.arguments))
      total += part.name.length / 4
    }
  }
  return Math.ceil(total)
}

/**
 * 估算消息数组的总 token 数。
 */
export function estimateMessagesTokens(messages: Message[]): number {
  let sum = 0
  for (const m of messages) sum += estimateMessageTokens(m)
  return sum
}

// ── 上下文检查 ──────────────────────────────────────

export interface ContextCheckResult {
  currentTokens: number
  effectiveWindow: number
  needsCompression: boolean
  usageRatio: number
}

/**
 * 检查当前消息列表是否接近上下文窗口上限。
 */
export function checkContext(
  messages: Message[],
  provider: string,
  model: string,
  threshold?: number,
  customWindows?: Record<string, number>,
): ContextCheckResult {
  const totalWindow = getContextWindow(provider, model, customWindows)
  const effectiveWindow = Math.floor(totalWindow * CONTEXT_RESERVE_RATIO)
  const currentTokens = estimateMessagesTokens(messages)
  const usageRatio = currentTokens / effectiveWindow
  const needsCompression = usageRatio >= (threshold ?? DEFAULT_COMPRESSION_THRESHOLD)
  return { currentTokens, effectiveWindow, needsCompression, usageRatio }
}

// ── 压缩（OpenHanako 模式：分轮感知） ──

/**
 * 分轮感知的硬截断。
 *
 * OpenHanako 模式：检测截断点是否落在 user+assistant 对中间，
 * 如果是，将截断点前移到完整轮次的起始位置。
 *
 * @param messages 消息数组
 * @param cutIndex 原始截断索引
 * @returns 调整后的截断索引（不会切分 user/assistant 对）
 */
function adjustForTurnBoundary(messages: Message[], cutIndex: number): number {
  if (cutIndex <= 0 || cutIndex >= messages.length) return cutIndex

  // 从 cutIndex 开始向前扫描，找到最近的 user message
  // 如果 cutIndex 落在 assistant 消息上，前移到对应的 user 消息
  for (let i = cutIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      // 保留整轮：从这条 user 消息开始
      return i
    }
  }
  return cutIndex
}

/**
 * 硬截断：保留最近 keepRecentTokens 的消息，前面的替换为摘要占位符。
 *
 * 改进相对于 v1：
 * - 分轮感知（OpenHanako）：截断点不会切分 user/assistant 对
 * - 摘要信息更丰富：记录移除的消息类型统计
 * - 占位符使用系统角色（不影响对话语义）
 */
export function hardTruncate(
  messages: Message[],
  keepRecentTokens: number = 32000,
): {
  truncated: Message[]
  removedCount: number
  tokensBefore: number
  tokensAfter: number
  summary: string
} {
  if (messages.length < 2) {
    return { truncated: messages, removedCount: 0, tokensBefore: 0, tokensAfter: 0, summary: '' }
  }

  const totalTokens = estimateMessagesTokens(messages)

  // 从后往前累计 token，直到达到 keepRecentTokens
  let accumulated = 0
  let cutIndex = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    accumulated += estimateMessageTokens(messages[i])
    if (accumulated >= keepRecentTokens) {
      cutIndex = i
      break
    }
  }

  // 切点在 0 或开头 → 无法截断
  if (cutIndex <= 0) {
    return { truncated: messages, removedCount: 0, tokensBefore: totalTokens, tokensAfter: totalTokens, summary: '' }
  }

  // 分轮感知：将截断点调整到完整的轮次边界
  const adjustedCut = adjustForTurnBoundary(messages, cutIndex)
  if (adjustedCut <= 0) {
    return { truncated: messages, removedCount: 0, tokensBefore: totalTokens, tokensAfter: totalTokens, summary: '' }
  }

  const removed = messages.slice(0, adjustedCut)
  const kept = messages.slice(adjustedCut)
  const removedTokens = estimateMessagesTokens(removed)

  // 统计移除的消息类型
  const removedUserCount = removed.filter(m => m.role === 'user').length
  const removedAsstCount = removed.filter(m => m.role === 'assistant').length

  const summary = (
    `[早期对话历史已被截断：移除了 ${removed.length} 条消息（${removedUserCount} 条用户消息，${removedAsstCount} 条 AI 回复），约 ${removedTokens} token]`
  )

  const summaryMsg: Message = {
    id: 'ctx-compaction',
    role: 'system',
    createdAt: Date.now(),
    parts: [{ type: 'text' as const, text: summary }],
  }

  const truncated = [summaryMsg, ...kept]
  const afterTokens = estimateMessagesTokens(truncated)

  return {
    truncated,
    removedCount: removed.length,
    tokensBefore: totalTokens,
    tokensAfter: afterTokens,
    summary,
  }
}

// ── AI 摘要（Snow-CLI 模式） ────────────────────────

/**
 * 异步摘要函数类型。
 * 接收被截断的消息列表，返回一段摘要文本。
 * 返回 null 表示摘要失败（触发方应回退硬截断）。
 */
export type Summarizer = (removedMessages: Message[]) => Promise<string | null>

const DEFAULT_SUMMARIZATION_PROMPT = '用简短的话概括以下对话中讨论的内容。保留技术要点和关键决策。'

/**
 * 使用 AI 生成对话摘要。
 * Snow-CLI 模式：AI 摘要优先，失败时返回 null（调用方回退硬截断）。
 *
 * @param messages 需要被压缩的消息（早期的）
 * @param summarize 异步摘要函数
 * @returns 摘要文本，或 null 表示失败
 */
export async function generateSummary(
  messages: Message[],
  summarize: Summarizer,
  systemPrompt?: string,
): Promise<string | null> {
  try {
    const summary = await summarize(messages)
    return summary
  } catch {
    return null
  }
}

// ── 压缩守卫（供 turnRunner 调用） ──────────────────

export interface CompactionGuardOptions {
  /** 压缩阈值（0~1），默认 0.8。 */
  threshold?: number
  /** 保留最近多少 token，默认 32000。 */
  keepRecentTokens?: number
  /** 日志记录器。 */
  logger?: Logger
  /** 自定义模型上下文窗口覆盖（modelName → token 数）。 */
  customWindows?: Record<string, number>
  /**
   * AI 摘要函数（Snow-CLI 模式）。
   * 如果提供，压缩时将优先使用 AI 生成摘要而非固定占位符。
   * 函数接收被移除的早期消息，返回摘要文本或 null（失败）。
   */
  summarize?: Summarizer
}

export interface GuardContextResult {
  messages: Message[]
  compacted: boolean
  result?: ContextCheckResult
  /** 压缩方式：'ai' | 'hard-truncate' | 'none' */
  method?: 'ai' | 'hard-truncate' | 'none'
}

/**
 * 上下文守卫：检查消息列表是否超限，必要时自动压缩。
 *
 * Snow-CLI 模式：提供 summarize 回调时优先 AI 摘要，失败回退硬截断。
 * OpenHanako 模式：硬截断时分轮感知。
 * 触发时机：每次模型调用前调用。客户端也可通过 compact 事件手动触发。
 */
export async function guardContext(
  messages: Message[],
  provider: string,
  model: string,
  options?: CompactionGuardOptions,
): Promise<GuardContextResult> {
  const result = checkContext(messages, provider, model, options?.threshold, options?.customWindows)
  const logger = options?.logger

  logger?.info?.(
    `[context] ${provider}/${model}: ${result.currentTokens}/${result.effectiveWindow} token (${(result.usageRatio * 100).toFixed(0)}%)`
  )

  if (!result.needsCompression) {
    return { messages, compacted: false, result, method: 'none' }
  }

  logger?.info?.(
    `[context] 超过压缩阈值 (${(result.usageRatio * 100).toFixed(0)}% > ${((options?.threshold ?? DEFAULT_COMPRESSION_THRESHOLD) * 100).toFixed(0)}%)，触发压缩`
  )

  // Snow-CLI 模式：AI 摘要优先
  if (options?.summarize) {
    try {
      const summaryText = await generateSummary(messages, options.summarize)
      if (summaryText && summaryText.length > 0) {
        const summaryMsg: Message = {
          id: 'ctx-compaction',
          role: 'system' as const,
          createdAt: Date.now(),
          parts: [{ type: 'text' as const, text: `[上一轮对话摘要] ${summaryText}` }],
        }
        // 保留最近的 2 轮（最后 user + assistant 对）加上摘要
        const keepMessages: Message[] = []
        let roundsKept = 0
        for (let i = messages.length - 1; i >= 0 && roundsKept < 2; i--) {
          keepMessages.unshift(messages[i])
          if (messages[i].role === 'user') roundsKept++
        }
        const truncated = [summaryMsg, ...keepMessages]
        const afterTokens = estimateMessagesTokens(truncated)
        logger?.info?.(
          `[context] AI 压缩完成: ${result.currentTokens} → ${afterTokens} token`
        )
        return {
          messages: truncated,
          compacted: true,
          result: { ...result, needsCompression: true },
          method: 'ai',
        }
      }
    } catch {
      // AI 摘要失败，回退硬截断
      logger?.warn?.('[context] AI 摘要失败，回退硬截断')
    }
  }

  // 回退：硬截断（分轮感知）
  const { truncated, removedCount, tokensBefore, tokensAfter } = hardTruncate(
    messages,
    options?.keepRecentTokens,
  )

  logger?.info?.(
    `[context] 硬截断完成: 移除 ${removedCount} 条消息 (${tokensBefore} → ${tokensAfter} token)`
  )

  return {
    messages: truncated,
    compacted: true,
    result: { ...result, needsCompression: true },
    method: 'hard-truncate',
  }
}
