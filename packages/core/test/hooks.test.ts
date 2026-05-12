import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HOOKS, EVENTS } from '@crai/core'

/**
 * HOOKS / EVENTS 常量完整性测试。
 *
 * 测试不依赖手动维护的名单，全部从常量自身推导。
 * 映射验证只检查 namespace 前缀（key 的第一个 _ 分段），
 * 因为后续分段可能采用 camelCase 而非全冒号/点号分隔。
 */

describe('HOOKS 常量', () => {
  it('所有常量值为字符串', () => {
    for (const val of Object.values(HOOKS)) {
      assert.equal(typeof val, 'string')
    }
  })

  it('常量值 namespace 前缀正确', () => {
    for (const [key, val] of Object.entries(HOOKS)) {
      const firstSegment = key.split('_')[0]!.toLowerCase()
      assert.ok(val.startsWith(`${firstSegment}:`),
        `HOOKS.${key} 值 "${val}" 应以 "${firstSegment}:" 开头`)
    }
  })

  it('数量和唯一性', () => {
    const entries = Object.entries(HOOKS)
    assert.ok(entries.length >= 10)
    const values = entries.map(([, v]) => v)
    assert.equal(new Set(values).size, values.length, '每条 HOOKS 常量值应唯一')
  })
})

describe('EVENTS 常量', () => {
  it('所有常量值为字符串', () => {
    for (const val of Object.values(EVENTS)) {
      assert.equal(typeof val, 'string')
    }
  })

  it('常量值 namespace 前缀正确', () => {
    for (const [key, val] of Object.entries(EVENTS)) {
      const firstSegment = key.split('_')[0]!.toLowerCase()
      assert.ok(val.startsWith(`${firstSegment}.`),
        `EVENTS.${key} 值 "${val}" 应以 "${firstSegment}." 开头`)
    }
  })

  it('数量和唯一性', () => {
    const entries = Object.entries(EVENTS)
    assert.ok(entries.length >= 15)
    const values = entries.map(([, v]) => v)
    assert.equal(new Set(values).size, values.length, '每条 EVENTS 常量值应唯一')
  })
})
