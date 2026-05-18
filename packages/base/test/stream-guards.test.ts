/**
 * stream-guards.test.ts — Stream 空闲超时守卫测试
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { StreamTimeoutError, withIdleTimeout } from '../src/stream-guards'

// ── 辅助：创建异步迭代器 ──

async function* numbersWithDelay(values: number[], delayMs: number): AsyncIterable<number> {
  for (const v of values) {
    await new Promise((r) => setTimeout(r, delayMs))
    yield v
  }
}

async function* neverEnds(): AsyncIterable<number> {
  await new Promise(() => {}) // 挂起
  yield 1
}

function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  return (async () => {
    for await (const v of iterable) {
      result.push(v)
    }
    return result
  })()
}

// ── 测试 ──

describe('StreamTimeoutError', () => {
  it('继承 Error，name 为 StreamTimeoutError', () => {
    const err = new StreamTimeoutError('超时', 5000)
    assert.ok(err instanceof Error)
    assert.equal(err.name, 'StreamTimeoutError')
    assert.equal(err.message, '超时')
    assert.equal(err.idleMs, 5000)
  })
})

describe('withIdleTimeout', () => {
  it('正常流完成不超时', async () => {
    const source = numbersWithDelay([1, 2, 3], 10)
    const guarded = withIdleTimeout(source, 500)
    const result = await collect(guarded)
    assert.deepEqual(result, [1, 2, 3])
  })

  it('空流完成不超时', async () => {
    async function* empty() {}
    const guarded = withIdleTimeout(empty(), 500)
    const result = await collect(guarded)
    assert.deepEqual(result, [])
  })

  it('空闲超时抛 StreamTimeoutError', async () => {
    // 延迟 100ms，超时 50ms
    const source = numbersWithDelay([1], 100)
    const guarded = withIdleTimeout(source, 50)

    try {
      for await (const _ of guarded) {
        // 应该在第 1 个值到达前超时
      }
      assert.fail('应抛出 StreamTimeoutError')
    } catch (err) {
      assert.ok(err instanceof StreamTimeoutError)
    }
  })

  it('第一个值到达后重置计时器', async () => {
    const source = numbersWithDelay([1, 2], 10)
    const guarded = withIdleTimeout(source, 200)

    // 先取 1（10ms 内到达），然后等 100ms（< 200ms timeout），再取 2
    const result: number[] = []
    const it = guarded[Symbol.asyncIterator]()
    result.push((await it.next()).value!)
    await new Promise((r) => setTimeout(r, 100))
    result.push((await it.next()).value!)
    await it.return?.()

    assert.deepEqual(result, [1, 2])
  })

  it('return() 正常清理计时器', async () => {
    const source = numbersWithDelay([1, 2, 3], 1000)
    const guarded = withIdleTimeout(source, 100)

    const it = guarded[Symbol.asyncIterator]()
    const first = await it.next()
    assert.equal(first.value, 1)

    // 提前结束
    const result = await it.return?.()
    assert.ok(result?.done)
  })
})
