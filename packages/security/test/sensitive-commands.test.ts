import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createSensitiveCommandChecker,
  loadSensitiveCommandsFromFile,
  DEFAULT_SENSITIVE_COMMANDS,
  type SensitiveCommandEntry,
} from '../src/sensitive-commands'

// ============================================================
// 默认预设
// ============================================================

describe('DEFAULT_SENSITIVE_COMMANDS', () => {
  it('包含 rm 模式', () => {
    const rm = DEFAULT_SENSITIVE_COMMANDS.find(c => c.id === 'rm')
    assert.ok(rm)
    assert.equal(rm.enabled, true)
    assert.equal(rm.isPreset, true)
  })

  it('sudo 默认禁用', () => {
    const sudo = DEFAULT_SENSITIVE_COMMANDS.find(c => c.id === 'sudo')
    assert.ok(sudo)
    assert.equal(sudo.enabled, false)
  })

  it('git-force-push scope 为 project', () => {
    const gfp = DEFAULT_SENSITIVE_COMMANDS.find(c => c.id === 'git-force-push')
    assert.ok(gfp)
    assert.equal(gfp.scope, 'project')
  })

  it('每个 preset 有唯一 id', () => {
    const ids = DEFAULT_SENSITIVE_COMMANDS.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

// ============================================================
// createSensitiveCommandChecker
// ============================================================

describe('createSensitiveCommandChecker', () => {
  it('rm 命令匹配默认预设', () => {
    const checker = createSensitiveCommandChecker()
    const result = checker.check('rm -rf /tmp/foo')
    assert.equal(result.matched, true)
    assert.equal(result.id, 'rm')
  })

  it('普通命令不匹配', () => {
    const checker = createSensitiveCommandChecker()
    const result = checker.check('ls -la')
    assert.equal(result.matched, false)
  })

  it('禁用的模式不参与检测', () => {
    const overrides: SensitiveCommandEntry[] = [
      { id: 'rm', pattern: '\\brm\\s', description: '', enabled: false, isPreset: false, scope: 'global' },
    ]
    const checker = createSensitiveCommandChecker(overrides)
    const result = checker.check('rm file.txt')
    assert.equal(result.matched, false)
  })

  it('多次检查结果一致', () => {
    const checker = createSensitiveCommandChecker()
    assert.equal(checker.check('rm file.txt').matched, true)
    assert.equal(checker.check('ls').matched, false)
    assert.equal(checker.check('rm -rf /').matched, true)
  })

  it('禁用模式不影响正常命令', () => {
    const checker = createSensitiveCommandChecker()
    // sudo 默认禁用，echo 不在任何模式中 → 不匹配
    const result = checker.check('sudo echo hello world')
    assert.equal(result.matched, false)
  })

  it('启用 sudo 后匹配', () => {
    const overrides: SensitiveCommandEntry[] = [
      { id: 'sudo', pattern: '\\bsudo\\s', description: '', enabled: true, isPreset: false, scope: 'global' },
    ]
    const checker = createSensitiveCommandChecker(overrides)
    const result = checker.check('sudo apt install')
    assert.equal(result.matched, true)
    assert.equal(result.id, 'sudo')
  })

  it('git force push 匹配', () => {
    const checker = createSensitiveCommandChecker()
    const result = checker.check('git push origin main --force')
    assert.equal(result.matched, true)
    assert.equal(result.id, 'git-force-push')
  })

  it('getConfig 返回合并后的配置', () => {
    const overrides: SensitiveCommandEntry[] = [
      { id: 'rm', pattern: '\\brm\\s', description: '', enabled: false, isPreset: false, scope: 'project' },
    ]
    const checker = createSensitiveCommandChecker(overrides)
    const config = checker.getConfig()
    const rm = config.find(c => c.id === 'rm')
    assert.ok(rm)
    assert.equal(rm.enabled, false)   // 被用户覆盖
    assert.equal(rm.scope, 'project') // 被用户覆盖
    assert.equal(rm.isPreset, true)   // 仍然是 preset
  })

  it('用户自定义新增模式', () => {
    const custom: SensitiveCommandEntry[] = [
      { id: 'my-dangerous', pattern: '\\bmy-dangerous-cmd\\b', description: '自定义', enabled: true, isPreset: false, scope: 'global' },
    ]
    const checker = createSensitiveCommandChecker(custom)
    const result = checker.check('my-dangerous-cmd do-something')
    assert.equal(result.matched, true)
    assert.equal(result.id, 'my-dangerous')

    const config = checker.getConfig()
    const found = config.find(c => c.id === 'my-dangerous')
    assert.ok(found)
    assert.equal(found.isPreset, false)
  })
})

// ============================================================
// loadSensitiveCommandsFromFile
// ============================================================

describe('loadSensitiveCommandsFromFile', () => {
  it('文件不存在返回空数组', async () => {
    const result = await loadSensitiveCommandsFromFile('/tmp/nonexistent-file-12345.json')
    assert.deepEqual(result, [])
  })

  it('从 JSON 文件加载配置', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const filePath = join(dir, 'sensitive-commands.json')
    writeFileSync(filePath, JSON.stringify({
      commands: [
        { id: 'sudo', enabled: true, scope: 'project' },
      ],
    }))

    const result = await loadSensitiveCommandsFromFile(filePath)
    assert.equal(result.length, 1)
    assert.equal(result[0].id, 'sudo')
    assert.equal(result[0].enabled, true)
  })

  it('JSON 格式错误时返回空数组', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const filePath = join(dir, 'bad.json')
    writeFileSync(filePath, 'not valid json')

    const result = await loadSensitiveCommandsFromFile(filePath)
    assert.deepEqual(result, [])
  })
})
