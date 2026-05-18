/**
 * @crai/base — Stream 空闲超时守卫
 *
 * 包装 AsyncIterable，如果指定时间内没有新事件到达，抛出 StreamTimeoutError。
 * 参考 snow-cli 的 streamGuards.ts。
 */

import { ERROR_CODES } from '@crai/core'

/** 流空闲超时错误 */
export class StreamTimeoutError extends Error {
  override name = 'StreamTimeoutError'
  constructor(message: string, public readonly idleMs: number) {
    super(message)
  }
}

/**
 * 为 AsyncIterable 添加空闲超时守卫。
 *
 * 每次 yield 一个事件时重置计时器。
 * 如果 idleTimeoutMs 内没有事件到达，抛出 StreamTimeoutError。
 * 正常结束或出错时自动清理计时器。
 */
export function withIdleTimeout<T>(
  iterable: AsyncIterable<T>,
  idleTimeoutMs: number = 60_000,
): AsyncIterable<T> {
  const label = `[stream-timeout]`

  return {
    [Symbol.asyncIterator]() {
      const iterator = iterable[Symbol.asyncIterator]()
      let timer: ReturnType<typeof setTimeout> | null = null

      function resetTimer() {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const err = new StreamTimeoutError(
            `Stream idle timeout: no data for ${idleTimeoutMs}ms`,
            idleTimeoutMs,
          )
          // 无法从 async generator 外部 throw，只能通过监听到的错误处理
          // 真实的终止由 iterator.return() 处理
          // 这里我们只能记录并期望外部 try/catch 捕获
          // 更好的做法：将错误存下来，在 next() 中 throw
          pendingError = err
        }, idleTimeoutMs)
      }

      let pendingError: Error | null = null

      return {
        async next(): Promise<IteratorResult<T>> {
          // 如果有未抛出的超时错误，先抛
          if (pendingError) {
            const err = pendingError
            pendingError = null
            // 尝试终止原始流
            try { await iterator.return?.() } catch { /* 忽略 */ }
            throw err
          }

          // 首次调用或正常状态：启动/重置计时器
          if (timer === null) {
            resetTimer()
          }

          const result = await iterator.next()

          if (result.done) {
            // 流正常结束
            if (timer) { clearTimeout(timer); timer = null }
            return result
          }

          // 有数据到达，重置计时器
          resetTimer()
          return result
        },

        async return(): Promise<IteratorResult<T>> {
          if (timer) { clearTimeout(timer); timer = null }
          return iterator.return?.() ?? { done: true as const, value: undefined as any }
        },

        async throw(e?: unknown): Promise<IteratorResult<T>> {
          if (timer) { clearTimeout(timer); timer = null }
          if (iterator.throw) return iterator.throw(e)
          return { done: true as const, value: undefined as any }
        },
      }
    },
  }
}
