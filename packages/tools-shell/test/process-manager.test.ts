import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execCommand, processManager } from '../src/process-manager'

// 每个测试创建独立的沙箱目录，测试间无共享状态
let sandboxDir = ''

beforeEach(() => {
  sandboxDir = mkdtempSync(join(tmpdir(), 'crai-test-'))
})

afterEach(() => {
  try { rmSync(sandboxDir, { recursive: true, force: true }) } catch {}
})

describe('execCommand', () => {
  it('echo 输出正确', async () => {
    const result = await execCommand('echo hello world', { cwd: sandboxDir, timeout: 5000 })
    assert.equal(result.stdout.trim(), 'hello world')
    assert.equal(result.exitCode, 0)
  })

  it('非零退出码保留输出（不报错）', async () => {
    const result = await execCommand('ls nonexistent-dir-12345', { cwd: sandboxDir, timeout: 5000 })
    assert.equal(result.exitCode, 1)
    assert.ok(result.stderr)
  })

  it('工作区内的文件操作', async () => {
    const filePath = join(sandboxDir, 'test-data.txt')
    writeFileSync(filePath, 'file content')
    const result = await execCommand('cat test-data.txt', { cwd: sandboxDir, timeout: 5000 })
    assert.equal(result.stdout.trim(), 'file content')
    assert.equal(result.exitCode, 0)
  })

  it('超时 kill', async () => {
    const start = Date.now()
    const result = await execCommand('sleep 10', { cwd: sandboxDir, timeout: 200 })
    const elapsed = Date.now() - start
    assert.ok(elapsed < 5000, `应在 5000ms 内完成，实际 ${elapsed}ms`)
    assert.ok(result.exitCode !== 0)
  })
})

describe('processManager', () => {
  it('killAll 不报错', () => {
    processManager.killAll()
  })
})
