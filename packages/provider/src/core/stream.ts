/**
 * SSE (Server-Sent Events) 行解析器。
 * 任何使用 SSE 流式响应的 provider 均可复用。
 */
export const SSE = {
  DATA_PREFIX: 'data: ',
  DONE_SENTINEL: '[DONE]',
} as const

/** 从 ReadableStream 中逐步产出 SSE data 行。 */
export async function* sseLines(
  body: ReadableStream<Uint8Array> | null,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!body) return

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith(SSE.DATA_PREFIX)) continue
        const data = trimmed.slice(SSE.DATA_PREFIX.length)
        if (data === SSE.DONE_SENTINEL) return
        yield data
      }
    }
  } finally {
    reader.releaseLock()
  }
}
