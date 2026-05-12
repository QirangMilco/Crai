import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createSensitiveCommandChecker,
  loadSensitiveCommandsFromFile,
  DEFAULT_PRESETS,
  splitCommand,
  type SensitiveCommandEntry,
} from '../src/sensitive-commands'

// ============================================================
// 默认预设
// ============================================================

describe('DEFAULT_PRESETS', () => {
  it('包含 rm 模式', () => {
    const rm = DEFAULT_PRESETS.find(c => c.id === 'rm')
    assert.ok(rm)
    assert.equal(rm.enabled, true)
    assert.equal(rm.isPreset, true)
  })

  it('sudo 默认禁用', () => {
    const sudo = DEFAULT_PRESETS.find(c => c.id === 'sudo')
    assert.ok(sudo)
    assert.equal(sudo.enabled, false)
  })

  it('每个 preset 有唯一 id', () => {
    const ids = DEFAULT_PRESETS.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

// ============================================================
// splitCommand
// ============================================================

describe('splitCommand', () => {
  it('单条命令返回自身', () => {
    assert.deepEqual(splitCommand('ls -la'), ['ls -la'])
  })

  it('&& 分隔', () => {
    const result = splitCommand('echo a && rm file.txt')
    assert.equal(result.length, 2)
    assert.equal(result[0], 'echo a')
    assert.equal(result[1], 'rm file.txt')
  })

  it('|| 分隔', () => {
    const result = splitCommand('cd x || echo fail')
    assert.equal(result.length, 2)
  })

  it('分号分隔', () => {
    const result = splitCommand('echo a; rm file.txt')
    assert.equal(result.length, 2)
  })

  it('管道分隔', () => {
    const result = splitCommand('echo a | grep test')
    assert.equal(result.length, 2)
  })

  it('空命令返回空数组', () => {
    assert.deepEqual(splitCommand(''), [])
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

  it('管道命令拆分后匹配', () => {
    const checker = createSensitiveCommandChecker()
    const result = checker.check('echo hello && rm file.txt')
    assert.equal(result.matched, true)
    assert.equal(result.id, 'rm')
  })

  it('禁用的模式不参与检测', () => {
    const globalOverrides: SensitiveCommandEntry[] = [
      { id: 'rm', pattern: '\\brm\\s', description: '', enabled: false, isPreset: false, scope: 'global' },
    ]
    const checker = createSensitiveCommandChecker(globalOverrides)
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
    const result = checker.check('sudo echo hello world')
    assert.equal(result.matched, false)
  })

  it('启用 sudo 后匹配', () => {
    const globalOverrides: SensitiveCommandEntry[] = [
      { id: 'sudo', pattern: '\\bsudo\\s', description: '', enabled: true, isPreset: false, scope: 'global' },
    ]
    const checker = createSensitiveCommandChecker(globalOverrides)
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

  it('全局禁用 + 项目启用，以项目为准', () => {
    const globalOverrides: SensitiveCommandEntry[] = [
      { id: 'rm', pattern: '\\brm\\s', description: '', enabled: false, isPreset: false, scope: 'global' },
    ]
    const projectOverrides: SensitiveCommandEntry[] = [
      { id: 'rm', pattern: '\\brm\\s', description: '', enabled: true, isPreset: false, scope: 'project' },
    ]
    const checker = createSensitiveCommandChecker(globalOverrides, projectOverrides)
    const result = checker.check('rm file.txt')
    assert.equal(result.matched, true)
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
