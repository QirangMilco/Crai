import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveAllowedPath, validateToolPaths } from '../src/path-validator'

// ============================================================
// resolveAllowedPath
// ============================================================

describe('resolveAllowedPath', () => {
  it('相对路径在工作区内允许', () => {
    const root = '/home/user/project'
    const result = resolveAllowedPath('src/index.ts', root)
    assert.equal(result, '/home/user/project/src/index.ts')
  })

  it('子目录路径允许', () => {
    const root = '/home/user/project'
    const result = resolveAllowedPath('src/sub/deep/file.ts', root)
    assert.equal(result, '/home/user/project/src/sub/deep/file.ts')
  })

  it('绝对路径在工作区外拒绝', () => {
    const root = '/home/user/project'
    assert.throws(() => resolveAllowedPath('/etc/passwd', root), /不在工作区内/)
  })

  it('相对路径逃逸 ../ 拒绝', () => {
    const root = '/home/user/project'
    assert.throws(() => resolveAllowedPath('../other/file', root), /不在工作区内/)
  })

  it('深层 ../ 逃逸拒绝', () => {
    const root = '/home/user/project'
    assert.throws(() => resolveAllowedPath('src/../../../../etc/passwd', root), /不在工作区内/)
  })

  it('rootDir 自身路径允许', () => {
    const root = '/home/user/project'
    const result = resolveAllowedPath('.', root)
    assert.equal(result, '/home/user/project')
  })

  it('空字符串解析为 rootDir', () => {
    const root = '/home/user/project'
    const result = resolveAllowedPath('', root)
    assert.equal(result, '/home/user/project')
  })
})

// ============================================================
// validateToolPaths
// ============================================================

describe('validateToolPaths', () => {
  it('path 参数在工作区内通过', () => {
    const result = validateToolPaths({ path: 'src/file.ts' }, '/home/user/project')
    assert.equal(result, undefined)
  })

  it('path 参数逃逸拒绝', () => {
    const result = validateToolPaths({ path: '/etc/passwd' }, '/home/user/project')
    assert.ok(result)
    assert.equal(result!.argName, 'path')
    assert.ok(result!.reason.includes('不在工作区内'))
  })

  it('file 参数被识别为路径', () => {
    const result = validateToolPaths({ file: '/etc/passwd' }, '/home/user/project')
    assert.ok(result)
    assert.equal(result!.argName, 'file')
  })

  it('非路径参数不校验', () => {
    const result = validateToolPaths({ pattern: 'hello', content: 'text' }, '/home/user/project')
    assert.equal(result, undefined)
  })

  it('已知路径名但值为非字符串跳过', () => {
    const result = validateToolPaths({ path: 123 }, '/home/user/project')
    assert.equal(result, undefined)
  })

  it('空参数不报错', () => {
    const result = validateToolPaths({}, '/home/user/project')
    assert.equal(result, undefined)
  })
})
