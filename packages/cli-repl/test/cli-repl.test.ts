/**
 * @crai/cli-repl — CLI REPL 测试。
 *
 * createCliRepl 是交互式 CLI（阻塞 readline 循环），
 * 完整的集成测试需要模拟 stdin/stdout，此处只做轻量验收。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// 确认模块可加载且导出函数
const _require = createRequire(import.meta.url)

describe('@crai/cli-repl 模块', () => {
  it('模块可加载', async () => {
    const mod = await import('../src/index')
    assert.ok(mod)
  })

  it('导出 createCliRepl 函数', async () => {
    const mod = await import('../src/index')
    assert.equal(typeof mod.createCliRepl, 'function')
  })
})
