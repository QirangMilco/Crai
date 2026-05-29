/**
 * @crai/base — 工具返回结果 Token 限流器。
 *
 * Snow-CLI 模式：限制每个 tool result 的 token 比例，
 * 防止单次工具结果撑爆上下文窗口。
 *
 * 参考 snow-cli 的 tokenLimiter.ts。
 */

import { estimateTokens } from './context-window'
import type { MessagePart, TextPart } from '@crai/core'

export const DEFAULT_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.30
export const MIN_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.10
export const MAX_TOOL_RESULT_TOKEN_LIMIT_RATIO = 0.80

/**
 * 获取配置的工具结果 token 限制（基于上下文窗口的百分比）。
 * 确保限制值在有效范围内。
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
 * 截断工具执行结果的 token 数，使其不超过指定限制。
 *
 * 对 text 类型的 parts 进行逐段截断。
 * 非 text parts（如 image）保持原样。
 * 如果所有 text 截断后仍超标，移除最早的 text parts 直到达标。
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

  // 先尝试截断过长的 text parts
  let result = parts.map((p) => {
    if (p.type !== 'text') return p
    const textPart = p as TextPart
    const tokens = estimateTokens(textPart.text)
    if (tokens <= maxTokens * 0.3) return p // < 30% 限制，不需要截断
    // 超过限制，按字符比例截断
    const ratio = (maxTokens * 0.3) / tokens
    const maxLen = Math.floor(textPart.text.length * Math.min(ratio, 0.5))
    if (maxLen < 50) return p // 太短的文本不截断
    return {
      ...textPart,
      text: textPart.text.slice(0, maxLen) + '\n\n[…结果过长已截断]',
    }
  })

  // 如果仍然超标，移除最早的非关键 text parts
  let totalTokens = result.reduce((sum, p) => {
    if (p.type === 'text') return sum + estimateTokens((p as TextPart).text)
    return sum
  }, 0)

  if (totalTokens <= maxTokens) return result

  // 从前往后移除 text parts
  const filtered: MessagePart[] = []
  let remaining = maxTokens
  let hasTruncated = false
  for (const p of result) {
    if (p.type !== 'text') {
      filtered.push(p)
      continue
    }
    const pt = estimateTokens((p as TextPart).text)
    if (pt <= remaining) {
      filtered.push(p)
      remaining -= pt
    } else if (!hasTruncated) {
      filtered.push({
        ...p,
        text: (p as TextPart).text.slice(0, 100) + '\n\n[…结果过长已截断]',
      })
      hasTruncated = true
      remaining = 0
    }
    // else: 跳过多余的 parts
  }

  return filtered
}

/**
 * 检查单个 tool result 是否超过 token 限制并返回截断后的结果。
 *
 * @param parts 工具结果的 parts 数组
 * @param contextWindow 当前模型的上下文窗口大小
 * @param ratio 允许 tool result 占用的比例（默认 0.30）
 * @returns { truncated: boolean; parts: MessagePart[] }
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
