/**
 * @crai/base — 上下文窗口管理与压缩
 *
 * 改进跟踪：
 * - Token 估算：tiktoken 优先（Snow-CLI 模式），字符近似回退
 * - 分轮感知：截断不切分 user/assistant 对（OpenHanako 模式）
 * - Tool 链保护：压缩时保留正在执行的 tool_calls（Snow-CLI 模式）
 * - 孤立 tool 清理：压缩后清理没有对应结果的 assistant(tool_calls)（Snow-CLI 模式）
 * - AI 摘要：内置摘要生成，失败时重试 + 硬截断回退（Snow-CLI 模式）
 * - 触发时机：每次模型调用前自动检查 + 手动 compact 事件支持
 *
 * 参考 OpenHanako 的 compaction-utils.js 和 Snow-CLI 的 contextCompressor。
 */

import type { Message } from '@crai/core'
import { getContextWindow, DEFAULT_COMPRESSION_THRESHOLD, CONTEXT_RESERVE_RATIO } from '@crai/core'
import type { Logger } from '@crai/core'

// ── Token 估算（Snow-CLI 模式：tiktoken 优先，字符近似回退） ──

let _tiktokenAvailable: boolean | null = null

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

async function tiktokenEstimate(text: string, modelHint?: string): Promise<number | null> {
  try {
    const mod = await import('tiktoken')
    const encodingForModel = (mod as any).encoding_for_model
    if (typeof encodingForModel !== 'function') return null
    const encoder = encodingForModel(modelHint ?? 'gpt-4o')
    if (!encoder) return null
    return encoder.encode(text).length
  } catch {
    return null
  }
}

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

export function estimateTokens(text: string): number {
  return charEstimate(text)
}

export async function estimateTokensAccurate(text: string, modelHint?: string): Promise<number> {
  if (await checkTiktoken()) {
    const result = await tiktokenEstimate(text, modelHint)
    if (result !== null) return result
  }
  return charEstimate(text)
}

export function estimateMessageTokens(msg: Message): number {
  let total = 0
  total += 4
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

export function estimateMessagesTokens(messages: Message[]): number {
  let sum = 0
  for (const m of messages) sum += estimateMessageTokens(m)
  return sum
}

// ── Tool 链保护（Snow-CLI 模式） ───────────────────

/**
 * 找到需要保留的消息起始位置。
 * 如果消息末尾有未完成的工具调用链，保留整个链。
 *
 * 保留策略：
 * - 末尾是 tool 消息 → 向前找到对应的 assistant(tool_calls)，从那里开始保留
 * - 末尾是 assistant(tool_calls) → 保留这条消息（待处理的 tool_use）
 * - 末尾是普通 assistant/user → 全部可压缩（返回 messages.length）
 */
export function findPreserveStartIndex(messages: Message[]): number {
  if (messages.length === 0) return 0

  const lastMsg = messages[messages.length - 1]

  // Case 1: 末尾是 tool 消息 → 保留 assistant(tool_calls) → tool 链
  if (lastMsg.role === 'tool') {
    for (let i = messages.length - 2; i >= 0; i--) {
      const msg = messages[i]
      if (
        msg.role === 'assistant' &&
        msg.parts.some(p => p.type === 'tool-call')
      ) {
        return i
      }
    }
    return messages.length
  }

  // Case 2: 末尾是 assistant(tool_calls) → 保留待处理的 tool_calls
  if (
    lastMsg.role === 'assistant' &&
    lastMsg.parts.some(p => p.type === 'tool-call')
  ) {
    return messages.length - 1
  }

  // Case 3: 末尾是普通 assistant 或 user → 全部可压缩
  return messages.length
}

/**
 * 清理孤立 tool 消息。
 * 移除：
 * 1. 有 tool_calls 但没有对应 tool 结果的 assistant 消息
 * 2. 没有对应 tool_calls 的 tool 结果消息
 *
 * 这防止压缩后向 API（特别是 Anthropic）发送不一致的消息序列。
 */
export function cleanOrphanedToolCalls(messages: Message[]): void {
  const indicesToRemove: number[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]

    // 检查 assistant 消息中的 tool_calls
    if (msg.role === 'assistant' && msg.parts.some(p => p.type === 'tool-call')) {
      const toolCallIds = new Set(
        msg.parts.filter(p => p.type === 'tool-call').map(p => (p as any).toolCallId)
      )

      // 检查紧随其后的消息是否为对应的 tool 结果
      const foundIds = new Set<string>()
      for (let j = i + 1; j < messages.length; j++) {
        const following = messages[j]
        if (following.role === 'tool' && following.toolCallId) {
          foundIds.add(following.toolCallId)
        } else if (following.role !== 'tool') {
          break // 遇到非 tool 消息停止
        }
      }

      const missingIds = [...toolCallIds].filter(id => !foundIds.has(id))
      if (missingIds.length > 0) {
        indicesToRemove.push(i)
      }
    }

    // 检查没有对应 tool_calls 的 tool 结果消息
    if (msg.role === 'tool' && msg.toolCallId) {
      let foundCorresponding = false
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j]
        if (prev.role === 'assistant' && prev.parts.some(p => p.type === 'tool-call' && (p as any).toolCallId === msg.toolCallId)) {
          const tcIdx = prev.parts.findIndex(p => p.type === 'tool-call' && (p as any).toolCallId === msg.toolCallId)
          if (tcIdx >= 0) {
            foundCorresponding = true
            // 验证紧随 assistant 之后（或紧随其他 tool 结果之后）
            let isImmediate = true
            for (let k = j + 1; k < i; k++) {
              if (messages[k].role !== 'tool') {
                isImmediate = false
                break
              }
            }
            if (!isImmediate) {
              indicesToRemove.push(i)
            }
          }
          break
        } else if (prev.role !== 'tool') {
          break
        }
      }
      if (!foundCorresponding) {
        indicesToRemove.push(i)
      }
    }
  }

  // 从后往前删除以保持索引
  indicesToRemove.sort((a, b) => b - a)
  for (const idx of indicesToRemove) {
    messages.splice(idx, 1)
  }
}

// ── 上下文检查 ──────────────────────────────────────

export interface ContextCheckResult {
  currentTokens: number
  effectiveWindow: number
  needsCompression: boolean
  usageRatio: number
}

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

// ── 分轮感知硬截断 ─────────────────────────────────

function adjustForTurnBoundary(messages: Message[], cutIndex: number): number {
  if (cutIndex <= 0 || cutIndex >= messages.length) return cutIndex
  for (let i = cutIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i
  }
  return cutIndex
}

/**
 * 硬截断：保留最近 keepRecentTokens 的消息，前面的替换为摘要占位符。
 *
 * 改进（相对于 Crai v1）：
 * - Tool 链保护：调用 findPreserveStartIndex 检测正在执行的工具链，避免截断
 * - 孤立工具清理：截断后执行 cleanOrphanedToolCalls
 * - 分轮感知：截断点不会切分 user/assistant 对
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

  // Tool 链保护：检测在执行的工具链，跳过压缩
  const preserveIndex = findPreserveStartIndex(messages)
  if (preserveIndex < messages.length) {
    // 有需要保留的 tool 链 → 只压缩 preserveIndex 之前的消息
    if (preserveIndex <= 1) {
      return { truncated: messages, removedCount: 0, tokensBefore: totalTokens, tokensAfter: totalTokens, summary: '' }
    }
    const kept = messages.slice(preserveIndex)
    const removed = messages.slice(0, preserveIndex)
    const removedTokens = estimateMessagesTokens(removed)

    // 清理孤立消息
    const cleanedKept = [...kept]
    cleanOrphanedToolCalls(cleanedKept)

    const removedUserCount = removed.filter(m => m.role === 'user').length
    const removedAsstCount = removed.filter(m => m.role === 'assistant').length
    const summary = `[早期对话历史已被截断：移除了 ${removed.length} 条消息（${removedUserCount} 条用户消息，${removedAsstCount} 条 AI 回复），约 ${removedTokens} token]`
    const summaryMsg: Message = {
      id: 'ctx-compaction',
      role: 'system',
      createdAt: Date.now(),
      parts: [{ type: 'text' as const, text: summary }],
    }
    const truncated = [summaryMsg, ...cleanedKept]
    return {
      truncated,
      removedCount: removed.length,
      tokensBefore: totalTokens,
      tokensAfter: estimateMessagesTokens(truncated),
      summary,
    }
  }

  // 没有 tool 链需要保留，按 token 数从尾往前截断
  let accumulated = 0
  let cutIndex = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    accumulated += estimateMessageTokens(messages[i])
    if (accumulated >= keepRecentTokens) {
      cutIndex = i
      break
    }
  }

  if (cutIndex <= 0) {
    return { truncated: messages, removedCount: 0, tokensBefore: totalTokens, tokensAfter: totalTokens, summary: '' }
  }

  const adjustedCut = adjustForTurnBoundary(messages, cutIndex)
  if (adjustedCut <= 0) {
    return { truncated: messages, removedCount: 0, tokensBefore: totalTokens, tokensAfter: totalTokens, summary: '' }
  }

  const removed = messages.slice(0, adjustedCut)
  const kept = messages.slice(adjustedCut)
  const removedTokens = estimateMessagesTokens(removed)

  // 清理孤立消息
  cleanOrphanedToolCalls(kept)

  const removedUserCount = removed.filter(m => m.role === 'user').length
  const removedAsstCount = removed.filter(m => m.role === 'assistant').length
  const summary = `[早期对话历史已被截断：移除了 ${removed.length} 条消息（${removedUserCount} 条用户消息，${removedAsstCount} 条 AI 回复），约 ${removedTokens} token]`
  const summaryMsg: Message = {
    id: 'ctx-compaction',
    role: 'system',
    createdAt: Date.now(),
    parts: [{ type: 'text' as const, text: summary }],
  }

  const truncated = [summaryMsg, ...kept]
  return {
    truncated,
    removedCount: removed.length,
    tokensBefore: totalTokens,
    tokensAfter: estimateMessagesTokens(truncated),
    summary,
  }
}

// ── AI 摘要（Snow-CLI 模式） ────────────────────────

export type Summarizer = (removedMessages: Message[]) => Promise<string | null>

export async function generateSummary(
  messages: Message[],
  summarize: Summarizer,
  _systemPrompt?: string,
): Promise<string | null> {
  try {
    return await summarize(messages)
  } catch {
    return null
  }
}

// ── 压缩守卫（供 turnRunner 调用） ──────────────────

const COMPRESSION_MAX_RETRIES = 3
const COMPRESSION_RETRY_BASE_DELAY = 1000

/**
 * 压缩配置。可从全局配置读取，也可通过代码注入。
 */
export interface CompressionConfig {
  /** 压缩阈值（0~1），默认 0.8。触发压缩的上下文使用率 */
  threshold?: number
  /** 保留最近多少 token，默认 32000。硬截断时保留的最后 token 数 */
  keepRecentTokens?: number
  /** 启用 AI 摘要重试（Snow-CLI 模式），默认 true */
  retryEnabled?: boolean
  /** AI 摘要最大重试次数，默认 3 */
  maxRetries?: number
  /** 自定义摘要系统提示词，覆盖默认的结构化模板 */
  summarySystemPrompt?: string
  /**
   * 压缩进度回调。每次压缩阶段变化时调用。
   * step: 'checking' | 'summarizing' | 'retrying' | 'truncating' | 'done' | 'skipped'
   */
  onProgress?: (status: { step: string; message?: string; tokensBefore?: number; tokensAfter?: number }) => void
}

export interface CompactionGuardOptions extends CompressionConfig {
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
  method?: 'ai' | 'hard-truncate' | 'none' | 'ai-retry'
  /** 压缩前 token 数。仅 compacted=true 时有效。 */
  tokensBefore?: number
  /** 压缩后 token 数。仅 compacted=true 时有效。 */
  tokensAfter?: number
}

/**
 * 上下文守卫：检查消息列表是否超限，必要时自动压缩。
 *
 * Snow-CLI 模式改进（相对于 Crai v1）：
 * - AI 摘要失败时指数退避重试（最多 3 次，1s/2s/4s）
 * - 硬截断前先检查 tool 链保护（findPreserveStartIndex）
 * - 压缩后清理孤立 tool 消息（cleanOrphanedToolCalls）
 * - OpenHanako 模式：硬截断时分轮感知
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

  // 从 options 读取配置，合并默认值
  const cfg: CompressionConfig = {
    threshold: options?.threshold ?? DEFAULT_COMPRESSION_THRESHOLD,
    keepRecentTokens: options?.keepRecentTokens ?? 32000,
    retryEnabled: options?.retryEnabled ?? true,
    maxRetries: options?.maxRetries ?? 3,
  }

  options?.onProgress?.({ step: 'checking', message: `${(result.usageRatio * 100).toFixed(0)}% used` })

  if (!result.needsCompression) {
    return { messages, compacted: false, result, method: 'none' }
  }

  options?.onProgress?.({ step: 'checking', message: `compressing (${(result.usageRatio * 100).toFixed(0)}% > ${(cfg.threshold! * 100).toFixed(0)}%)` })

  logger?.info?.(
    `[context] 超过压缩阈值 (${(result.usageRatio * 100).toFixed(0)}% > ${((options?.threshold ?? DEFAULT_COMPRESSION_THRESHOLD) * 100).toFixed(0)}%)，触发压缩`
  )

  // Snow-CLI 模式：AI 摘要优先，失败时重试
  if (options?.summarize && cfg.retryEnabled) {
    let lastError: string | null = null
    for (let attempt = 0; attempt <= cfg.maxRetries!; attempt++) {
      try {
        const summaryText = await generateSummary(messages, options.summarize)
        if (summaryText && summaryText.length > 0) {
          const summaryMsg: Message = {
            id: 'ctx-compaction',
            role: 'system' as const,
            createdAt: Date.now(),
            parts: [{ type: 'text' as const, text: summaryText }],
          }
          // 保留最近的 2 轮 + 摘要
          const keepMessages: Message[] = []
          let roundsKept = 0
          for (let i = messages.length - 1; i >= 0 && roundsKept < 2; i--) {
            keepMessages.unshift(messages[i])
            if (messages[i].role === 'user') roundsKept++
          }
          // 清理保留消息中的孤立 tool 调用
          cleanOrphanedToolCalls(keepMessages)
          const truncated = [summaryMsg, ...keepMessages]
          const afterTokens = estimateMessagesTokens(truncated)
          options?.onProgress?.({ step: 'done', message: `AI 摘要完成: ${result.currentTokens} → ${afterTokens} token`, tokensBefore: result.currentTokens, tokensAfter: afterTokens })
          logger?.info?.(
            `[context] AI 压缩完成${attempt > 0 ? ` (第${attempt + 1}次尝试)` : ''}: ${result.currentTokens} → ${afterTokens} token`
          )
          return {
            messages: truncated,
            compacted: true,
            result: { ...result, needsCompression: true },
            method: attempt > 0 ? 'ai-retry' : 'ai',
            tokensBefore: result.currentTokens,
            tokensAfter: afterTokens,
          }
        }
        lastError = '摘要内容为空'
      } catch (err: any) {
        lastError = err?.message ?? '未知错误'
      }

      if (attempt < COMPRESSION_MAX_RETRIES) {
        const delay = COMPRESSION_RETRY_BASE_DELAY * Math.pow(2, attempt)
        logger?.warn?.(`[context] AI 摘要失败（${lastError}），${delay}ms 后第${attempt + 2}次重试`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        logger?.warn?.(`[context] AI 摘要 ${cfg.maxRetries! + 1} 次均失败，回退硬截断: ${lastError}`)
      }
    }
  } else if (options?.summarize) {
    // 一次尝试（retryDisabled = true）
    try {
      const summaryText = await generateSummary(messages, options.summarize)
      if (summaryText && summaryText.length > 0) {
        const summaryMsg: Message = {
          id: 'ctx-compaction',
          role: 'system' as const,
          createdAt: Date.now(),
          parts: [{ type: 'text' as const, text: summaryText }],
        }
        const keepMessages: Message[] = []
        let roundsKept = 0
        for (let i = messages.length - 1; i >= 0 && roundsKept < 2; i--) {
          keepMessages.unshift(messages[i])
          if (messages[i].role === 'user') roundsKept++
        }
        cleanOrphanedToolCalls(keepMessages)
        const truncated = [summaryMsg, ...keepMessages]
        const afterTokens = estimateMessagesTokens(truncated)
        logger?.info?.(`[context] AI 压缩完成: ${result.currentTokens} → ${afterTokens} token`)
        return {
          messages: truncated,
          compacted: true,
          result: { ...result, needsCompression: true },
          method: 'ai',
        }
      }
    } catch {
      logger?.warn?.('[context] AI 摘要失败，回退硬截断')
    }
  }

  // 回退：硬截断（含 tool 链保护）
  options?.onProgress?.({ step: 'truncating', message: '硬截断回退' })
  const { truncated, removedCount, tokensBefore, tokensAfter, summary } = hardTruncate(
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
