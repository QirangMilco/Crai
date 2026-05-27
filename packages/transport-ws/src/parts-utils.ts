/**
 * 从消息 parts 重建活动列表（CrystalAgents 模式）。
 * text parts 在 tool-call 之前 → activity.intent
 * text parts 在 tool-call 之后 → 消息正文（由 extractResponseText 处理）
 */
export function buildActivitiesFromParts(parts: any[]): any[] {
  const activities: any[] = []
  let pendingIntent = ''

  for (const p of parts) {
    if (p.type === 'thinking') {
      activities.push({
        id: `think-${activities.length}`,
        type: 'thinking',
        status: 'completed',
        content: p.thinking,
        elapsedSeconds: p.elapsedSeconds,
        timestamp: Date.now(),
      })
    } else if (p.type === 'text') {
      pendingIntent = (pendingIntent + p.text).trim()
    } else if (p.type === 'tool-call') {
      activities.push({
        id: `tool-${p.toolCallId}`,
        type: 'tool',
        status: 'completed',
        toolName: p.name,
        toolCallId: p.toolCallId,
        toolInput: p.arguments,
        intent: pendingIntent || undefined,
        timestamp: Date.now(),
      })
      pendingIntent = ''
    }
  }
  return activities
}

/**
 * 从消息 parts 提取「最终文本」。
 * 最后一个 tool-call 之后的 text parts 作为消息正文。
 * thinking 对正文提取透明（thinking 在 parts 末尾，不应阻断文本提取）。
 * text before tool = intent（由 buildActivitiesFromParts 处理）。
 */
export function extractResponseText(parts: any[]): string {
  const textParts: string[] = []
  let hasToolCall = false
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (p.type === 'tool-call') {
      hasToolCall = true
      break
    }
    if (p.type === 'text') {
      textParts.unshift(p.text)
    }
  }
  if (!hasToolCall) {
    // 无 tool-call：取所有 text（排除 thinking）
    return parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
  }
  return textParts.join('\n')
}
