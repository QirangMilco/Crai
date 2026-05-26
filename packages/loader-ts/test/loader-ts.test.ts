/**
 * @crai/loader-ts — TypeScript 扩展加载器测试。
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadExtension, reloadExtension } from '../src/index'

let tmpDir = ''
let goodExtPath = ''
let badExtPath = ''

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'crai-loader-test-'))
  mkdirSync(join(tmpDir, 'node_modules'), { recursive: true })

  // 创建一个合法的扩展文件
  goodExtPath = join(tmpDir, 'good-ext.ts')
  writeFileSync(goodExtPath, `
    export default {
      name: 'test-extension',
      setup(ctx) {
        ctx.hooks.on('test', () => {})
      },
    }
  `)

  // 创建一个不合法的文件（无 default export）
  badExtPath = join(tmpDir, 'bad-ext.ts')
  writeFileSync(badExtPath, `
    export const foo = 'bar'
  `)
})

after(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadExtension', () => {
  it('加载合法扩展文件返回 Extension 对象', async () => {
    const ext = await loadExtension(goodExtPath)
    assert.ok(ext)
    assert.equal(ext.name, 'test-extension')
    assert.equal(typeof ext.setup, 'function')
  })

  it('不合法扩展文件抛出错误', async () => {
    await assert.rejects(
      () => loadExtension(badExtPath),
      { message: /缺少 default export/ },
    )
  })
})

describe('reloadExtension', () => {
  it('重新加载后返回更新后的 Extension', async () => {
    const ext = await reloadExtension(goodExtPath)
    assert.ok(ext)
    assert.equal(ext.name, 'test-extension')
  })
})
