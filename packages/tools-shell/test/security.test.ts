import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isDangerousCommand, isSelfDestructiveCommand, truncateOutput } from '../src/security'

// ============================================================
// isDangerousCommand
// ============================================================

describe('isDangerousCommand', () => {
  it('rm -rf / 被拦截', () => {
    assert.equal(isDangerousCommand('rm -rf /var/log'), true)
  })

  it('rm 普通文件不拦截', () => {
    assert.equal(isDangerousCommand('rm file.txt'), false)
  })

  it('mkfs 被拦截', () => {
    assert.equal(isDangerousCommand('mkfs.ext4 /dev/sda1'), true)
  })

  it('dd if= 被拦截', () => {
    assert.equal(isDangerousCommand('dd if=/dev/zero of=/dev/sda'), true)
  })

  it('ls 不拦截', () => {
    assert.equal(isDangerousCommand('ls -la'), false)
  })

  it('echo 不拦截', () => {
    assert.equal(isDangerousCommand('echo hello'), false)
  })

  it('空命令不拦截', () => {
    assert.equal(isDangerousCommand(''), false)
  })
})

// ============================================================
// isSelfDestructiveCommand
// ============================================================

describe('isSelfDestructiveCommand', () => {
  it('killall node 被拦截', () => {
    const result = isSelfDestructiveCommand('killall node')
    assert.equal(result.isSelfDestructive, true)
    assert.ok(result.reason)
  })

  it('pkill node 被拦截', () => {
    const result = isSelfDestructiveCommand('pkill -f node')
    assert.equal(result.isSelfDestructive, true)
  })

  it('kill 自身 PID 被拦截', () => {
    const result = isSelfDestructiveCommand(`kill -9 ${process.pid}`)
    assert.equal(result.isSelfDestructive, true)
  })

  it('kill 其他 PID 不拦截', () => {
    const result = isSelfDestructiveCommand('kill -9 12345')
    assert.equal(result.isSelfDestructive, false)
  })

  it('普通命令不拦截', () => {
    const result = isSelfDestructiveCommand('npm run build')
    assert.equal(result.isSelfDestructive, false)
  })
})

// ============================================================
// truncateOutput
// ============================================================

describe('truncateOutput', () => {
  it('短输出不截断', () => {
    assert.equal(truncateOutput('hello', 100), 'hello')
  })

  it('超长输出截断', () => {
    const long = 'a'.repeat(200)
    const result = truncateOutput(long, 100)
    assert.ok(result.length < long.length)
    assert.ok(result.includes('... (输出已截断)'))
  })

  it('空字符串返回空', () => {
    assert.equal(truncateOutput('', 100), '')
  })

  it('恰好等于 maxLength 不截断', () => {
    const text = 'a'.repeat(100)
    assert.equal(truncateOutput(text, 100), text)
  })
})
