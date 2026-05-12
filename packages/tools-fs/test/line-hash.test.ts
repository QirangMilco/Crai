import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { lineHash } from '../src/line-hash'

describe('lineHash', () => {
  it('相同内容产生相同 hash', () => {
    const h1 = lineHash('const x = 1')
    const h2 = lineHash('const x = 1')
    assert.equal(h1, h2)
  })

  it('不同内容产生不同 hash', () => {
    const h1 = lineHash('const x = 1')
    const h2 = lineHash('const y = 2')
    assert.notEqual(h1, h2)
  })

  it('空行产生有效 hash', () => {
    const h = lineHash('')
    assert.ok(h)
    assert.equal(h.length, 4)
  })

  it('hash 为 4 位 hex', () => {
    const h = lineHash('some code here')
    assert.ok(/^[0-9a-f]{4}$/.test(h), `hash "${h}" 应为 4 位 hex`)
  })

  it('空格差异产生不同 hash', () => {
    const h1 = lineHash('const x=1')
    const h2 = lineHash('const x = 1')
    assert.notEqual(h1, h2)
  })

  it('Unicode 字符正常处理', () => {
    const h = lineHash('// 测试中文')
    assert.ok(/^[0-9a-f]{4}$/.test(h))
  })
})
