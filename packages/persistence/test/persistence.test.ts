/**
 * @crai/persistence — 会话持久化 extension 测试。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPersistenceExtension } from '../src/index'

describe('createPersistenceExtension', () => {
  it('返回 Extension 对象', () => {
    const ext = createPersistenceExtension()
    assert.notEqual(ext, null)
    assert.notEqual(ext, undefined)
    assert.equal(typeof ext, 'object')
  })

  it('name 为 persistence', () => {
    const ext = createPersistenceExtension()
    assert.equal(ext.name, 'persistence')
  })

  it('setup 是函数', () => {
    const ext = createPersistenceExtension()
    assert.equal(typeof ext.setup, 'function')
  })

  it('setup 注册 TURN_AFTER 钩子', () => {
    const registeredHooks: string[] = []
    const mockCtx = {
      hooks: {
        on: (hook: string) => { registeredHooks.push(hook) },
      },
      registry: {
        storages: { list: () => [] },
      },
    }
    const ext = createPersistenceExtension()
    ext.setup(mockCtx as any)
    assert.ok(registeredHooks.includes('turn:after'))
    assert.ok(registeredHooks.includes('session:afterStop'))
  })

  it('无 storage 时不抛异常', () => {
    const mockCtx = {
      hooks: {
        on: (hook: string, fn: any) => {
          // 模拟无 storage 时触发钩子
          fn({ session: { id: 's1' }, messages: [] })
        },
      },
      registry: {
        storages: { list: () => [] },
      },
    }
    const ext = createPersistenceExtension()
    assert.doesNotThrow(() => ext.setup(mockCtx as any))
  })
})
