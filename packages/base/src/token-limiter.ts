/**
 * @crai/base — 工具返回结果 Token 限流器。
 *
 * Snow-CLI 模式：限制每个 tool result 的 token 比例，
 * 防止单次工具结果撑爆上下文窗口。
 *
 * 参考 snow-cli 的 tokenLimiter.ts 和 subAgentContextCompressor.ts。
 */

import { estimateTokens } from './context-window'
import type { MessagePart, TextPart } from '@crai/core'

export const DEFAULT_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.30
export const MIN_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.10
export const MAX_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.80

/** 截断时保留开头部分的比例 */
const HEAD_RATIO = 0.60
/** 截断时保留结尾部分的比例 */
const TAIL_RATIO = 0.30

/**
 * 获取配置的工具结果 token 限制（基于上下文窗口的百分比）。
 */
export function getToolResultTokenLimit(
  contextWindow: number,
  ratio?: number,
): number {
  const r = ratio ?? DEFAULT_TOOL_RESULT_TOKEN_LIMIT_RATIO
  const clamped = Math.max(
    MIN_TOOL_RESULT_TOKEN_LIMIT_RATIO,
    Math.min(MAX_TOOL_RESULT_TOKEN_LIMIT_RATIO, r),
  )
  return Math.floor(contextWindow * clamped)
}

/**
 * 首尾保留模式截断文本。
 *
 * Snow-CLI 模式：保留开头 60% + 结尾 30%，中间用截断标记替代。
 * 对于工具结果（如文件内容），结尾往往包含关键信息。
 *
 * @param text 原始文本
 * @param maxChars 允许的最大字符数
 * @returns 截断后的文本
 */
function headTailTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const headLen = Math.floor(maxChars * HEAD_RATIO)
  const tailLen = Math.floor(maxChars * TAIL_RATIO)
  const truncatedChars = text.length - headLen - tailLen

  return (
    text.slice(0, headLen) +
    `\n\n[... ${truncatedChars} characters truncated ...]\n\n` +
    text.slice(text.length - tailLen)
  )
}

/**
 * 截断工具执行结果的 token 数，使其不超过指定限制。
 *
 * 雪花模式（Snow-CLI）：首尾保留模式，保留开头 60% + 结尾 30%。
 * 非 text parts（如 image）保持原样。
 * 如果单个 text part 过长，首尾保留截断；如果多个 parts 总体超标，移除早期的。
 *
 * @param parts 工具结果的 parts 数组
 * @param maxTokens 允许的最大 token 数
 * @returns 截断后的 parts 数组
 */
export function truncateToolResult(
  parts: MessagePart[],
  maxTokens: number,
): MessagePart[] {
  if (!parts || parts.length === 0) return parts

  // Snow-CLI 模式：首尾保留截断每个过长的 text part
  let result = parts.map((p) => {
    if (p.type !== 'text') return p
    const textPart = p as TextPart
    const tokens = estimateTokens(textPart.text)
    if (tokens <= maxTokens * 0.3) return p // < 30% 限制，不需要截断

    // 超出限制：按字符比例计算允许保留的字符数
    const ratio = (maxTokens * 0.3) / tokens
    const maxChars = Math.floor(textPart.text.length * Math.min(ratio, 0.5))
    if (maxChars < 100) {
      // 太短无法保留首尾，只保留开头
      return {
        ...textPart,
        text: textPart.text.slice(0, 100) + '\n\n[…结果过长已截断]',
      }
    }

    return {
      ...textPart,
      text: headTailTruncate(textPart.text, maxChars),
    }
  })

  // 检查总体是否超标
  let totalTokens = result.reduce((sum, p) => {
    if (p.type === 'text') return sum + estimateTokens((p as TextPart).text)
    return sum
  }, 0)

  if (totalTokens <= maxTokens) return result

  // 从前往后移除 text parts
  const filtered: MessagePart[] = []
  let remaining = maxTokens
  for (const p of result) {
    if (p.type !== 'text') {
      filtered.push(p)
      continue
    }
    const pt = estimateTokens((p as TextPart).text)
    if (pt <= remaining) {
      filtered.push(p)
      remaining -= pt
    } else if (remaining > 0) {
      // 剩余的 token 只够保留首尾
      const ratio = remaining / pt
      const maxChars = Math.floor((p as TextPart).text.length * Math.min(ratio, 0.5))
      filtered.push({
        ...p,
        text: headTailTruncate((p as TextPart).text, Math.max(maxChars, 50)),
      })
      remaining = 0
    }
    // else: 跳过
  }

  return filtered
}

/**
 * 检查单个 tool result 是否超过 token 限制并返回截断后的结果。
 */
export function limitToolResult(
  parts: MessagePart[],
  contextWindow: number,
  ratio?: number,
): { truncated: boolean; parts: MessagePart[] } {
  const maxTokens = getToolResultTokenLimit(contextWindow, ratio)
  const before = parts.reduce((sum, p) => {
    if (p.type === 'text') return sum + estimateTokens((p as TextPart).text)
    return sum
  }, 0)

  if (before <= maxTokens) {
    return { truncated: false, parts }
  }

  return { truncated: true, parts: truncateToolResult(parts, maxTokens) }
}
