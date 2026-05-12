import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { editBySearch, editByHashline } from '../src/edit'
import { SnapshotManager } from '../src/snapshot-manager'

const SESSION_ID = 'test-edit-session'

function sandbox(content: string): { dir: string; filePath: string; rootDir: string; snapshots: SnapshotManager } {
  const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
  const snapshotsDir = join(dir, 'snapshots')
  const rootDir = join(dir, 'workspace')
  mkdirSync(rootDir, { recursive: true })
  const filePath = join(rootDir, 'test.ts')
  writeFileSync(filePath, content)
  const snapshots = new SnapshotManager(snapshotsDir)
  return { dir, filePath, rootDir, snapshots }
}

const SAMPLE = `import { foo } from './bar'

function greet(name: string) {
  console.log(\`Hello, \${name}!\`)
}

function add(a: number, b: number): number {
  return a + b
}
`

// ============================================================
// editBySearch
// ============================================================

describe('editBySearch', () => {
  it('精确匹配替换', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    const result = await editBySearch(filePath, '  return a + b', '  return a * b', 1, snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    assert.ok(result.linesChanged >= 1)
    rmSync(dir, { recursive: true, force: true })
  })

  it('归一化空格匹配替换', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    // searchContent 中的 console.log 后多空格
    const result = await editBySearch(filePath, 'console.log(  `Hello, ${name}!`)', 'console.error(`Hello, ${name}!`)', 1, snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    const content = readFileSync(filePath, 'utf-8')
    assert.ok(content.includes('console.error'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('模糊匹配替换', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    // typo: strng → string
    const result = await editBySearch(filePath, 'function greet(name: strng)', 'function greet(name: string, age?: number)', 1, snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    const content = readFileSync(filePath, 'utf-8')
    assert.ok(content.includes('age?: number'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('不存在的文本返回失败', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    const result = await editBySearch(filePath, 'this does not exist', 'replacement', 1, snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('occurrence 参数选择第几处匹配', async () => {
    const content = 'a\nb\na\nb\na'
    const { dir, filePath, rootDir, snapshots } = sandbox(content)
    const result = await editBySearch(filePath, 'a', 'X', 2, snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    const after = readFileSync(filePath, 'utf-8')
    assert.equal(after, 'a\nb\nX\nb\na')
    rmSync(dir, { recursive: true, force: true })
  })

  it('快照被正确创建', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    await editBySearch(filePath, 'function add', 'function multiply', 1, snapshots, rootDir, SESSION_ID)
    const metas = await snapshots.listSnapshots(SESSION_ID)
    assert.equal(metas.length, 1)
    assert.equal(metas[0].files.length, 1)
    rmSync(dir, { recursive: true, force: true })
  })
})

// ============================================================
// editByHashline
// ============================================================

describe('editByHashline', () => {
  it('有效锚点替换单行', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    const lines = SAMPLE.split('\n')
    // 替换第 5 行（0-indexed 4）console.log 那行
    const lineNum = 5
    const hash = await import('../src/line-hash').then(m => m.lineHash(lines[lineNum - 1]))

    const result = await editByHashline(filePath, `${lineNum}:${hash}`, `${lineNum}:${hash}`, '  console.log("edited")', snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    const content = readFileSync(filePath, 'utf-8')
    assert.ok(content.includes('"edited"'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('无效锚点拒绝', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    const result = await editByHashline(filePath, '5:dead', '5:dead', 'replacement', snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, false)
    assert.ok(result.message.includes('锚点'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('多行替换', async () => {
    const { dir, filePath, rootDir, snapshots } = sandbox(SAMPLE)
    const lines = SAMPLE.split('\n')
    const startLine = 4
    const endLine = 6
    const startHash = await import('../src/line-hash').then(m => m.lineHash(lines[startLine - 1]))
    const endHash = await import('../src/line-hash').then(m => m.lineHash(lines[endLine - 1]))

    const result = await editByHashline(filePath, `${startLine}:${startHash}`, `${endLine}:${endHash}`, '  // replaced block', snapshots, rootDir, SESSION_ID)
    assert.equal(result.success, true)
    const content = readFileSync(filePath, 'utf-8')
    assert.ok(content.includes('replaced block'))
    assert.ok(!content.includes('console.log'))
    rmSync(dir, { recursive: true, force: true })
  })
})
