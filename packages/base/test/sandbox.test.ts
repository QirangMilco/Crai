/**
 * sandbox.test.ts — 沙箱执行隔离测试
 */
import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSandbox, wrapCommand } from '../src/sandbox'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'crai-sandbox-test-'))
  tempDirs.push(dir)
  return dir
}

// ── createSandbox ──

describe('createSandbox', () => {
  it('disabled 时返回 noop provider', () => {
    const root = tempDir()
    const provider = createSandbox({ rootDir: root, enabled: false })
    assert.equal(provider.isAvailable, false)
    assert.equal(provider.name, 'none')
  })

  it('noop provider 直通命令和参数', () => {
    const root = tempDir()
    const provider = createSandbox({ rootDir: root, enabled: false })
    const wrapped = provider.wrap('ls', ['-la', '.'], root)
    assert.equal(wrapped.command, 'ls')
    assert.deepEqual(wrapped.args, ['-la', '.'])
    // cleanup 不应抛异常
    wrapped.cleanup()
  })

  it('noop provider cleanup 不抛异常', () => {
    const root = tempDir()
    const provider = createSandbox({ rootDir: root, enabled: false })
    const wrapped = provider.wrap('echo', ['hi'], root)
    // 多次调用 cleanup 安全
    wrapped.cleanup()
    wrapped.cleanup()
  })

  it('enabled 时尝试检测平台沙箱工具', () => {
    const root = tempDir()
    const provider = createSandbox({ rootDir: root, enabled: true })
    // 结果取决于平台，但 isAvailable 是布尔值，不抛异常
    assert.equal(typeof provider.isAvailable, 'boolean')
    assert.equal(typeof provider.name, 'string')
  })
})

// ── wrapCommand ──

describe('wrapCommand', () => {
  it('enabled=false 时直通', () => {
    const root = tempDir()
    const wrapped = wrapCommand('cat', ['file.txt'], { rootDir: root, enabled: false })
    assert.equal(wrapped.command, 'cat')
    assert.deepEqual(wrapped.args, ['file.txt'])
    wrapped.cleanup()
  })

  it('enabled=true 且沙箱可用时返回沙箱命令', () => {
    const root = tempDir()
    const wrapped = wrapCommand('sh', ['-c', 'echo hi'], { rootDir: root, enabled: true })
    // 平台可能不支持沙箱，此时直通
    if (wrapped.command === 'sh') {
      assert.deepEqual(wrapped.args, ['-c', 'echo hi'])
    } else {
      // macOS seatbelt: sandbox-exec -f <profile> sh -c 'echo hi'
      assert.equal(wrapped.command, 'sandbox-exec')
      assert.ok(wrapped.args.includes('sh'))
    }
    wrapped.cleanup()
  })
})
