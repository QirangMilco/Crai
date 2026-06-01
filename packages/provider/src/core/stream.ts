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
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        // reader.read() 可能在 fetch abort 时抛出。此时 signal.aborted 已为 true，
        // 直接退出循环，不抛到上层。
        break
      }
      if (chunk.done) break

      buffer += decoder.decode(chunk.value, { stream: true })
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
    // 流结束或中止后，产出缓冲区剩余数据
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith(SSE.DATA_PREFIX)) {
        const data = trimmed.slice(SSE.DATA_PREFIX.length)
        if (data !== SSE.DONE_SENTINEL) yield data
      }
    }
  } finally {
    reader.releaseLock()
  }
}
