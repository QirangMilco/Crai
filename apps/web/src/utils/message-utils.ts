/** 从消息的 parts 数组中提取纯文本。 */
export function extractTextFromParts(parts: any[] | undefined): string {
  if (!parts) return ''
  return parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
}

/**
 * 从消息 parts 重建活动列表。
 * 与服务端 buildActivitiesFromParts 逻辑一致。
 * 用于 message.appended 到达时直接从 parts 构建 activities，不依赖占位消息。
 */
export function buildActivitiesFromParts(parts: any[], stopReason?: string): any[] {
  const activities: any[] = []
  let pendingIntent = ''
  const defaultStatus = stopReason === 'aborted' ? 'aborted' : 'completed'

  for (const p of parts) {
    if (p.type === 'thinking') {
      activities.push({
        id: `think-${activities.length}`,
        type: 'thinking',
        status: defaultStatus,
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
        status: defaultStatus,
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
