import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CheckpointManager } from '../src/checkpoint'

function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'checkpoint-test-'))
  mkdirSync(join(d, '.crai'))
  return d
}

describe('CheckpointManager', () => {
  let baseDir: string
  let cm: CheckpointManager

  before(() => {
    baseDir = tmpDir()
    cm = new CheckpointManager(join(baseDir, '.crai', 'checkpoints'))
  })

  after(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('创建并加载检查点', async () => {
    await cm.create('s1', 't1', 5)
    const cp = await cm.load('s1', 't1')
    assert.ok(cp)
    assert.strictEqual(cp.messageCount, 5)
  })

  it('complete 后检查点保留', async () => {
    await cm.create('s2', 't1', 3)
    await cm.complete('s2', 't1')
    const cp = await cm.load('s2', 't1')
    assert.ok(cp)
  })

  it('recordFile 记录原始内容', async () => {
    const f = join(baseDir, 'f.txt')
    writeFileSync(f, 'orig')
    await cm.create('s3', 't1', 2)
    await cm.recordFile('s3', 't1', f)
    writeFileSync(f, 'mod')
    const cp = await cm.load('s3', 't1')
    assert.strictEqual(cp!.files[0].content, 'orig')
  })

  it('rollback 恢复文件', async () => {
    const f = join(baseDir, 'r.txt')
    writeFileSync(f, 'orig')
    await cm.create('s4', 't1', 3)
    await cm.recordFile('s4', 't1', f)
    writeFileSync(f, 'mod')
    assert.strictEqual(await cm.rollback('s4', 't1'), 3)
    assert.strictEqual(readFileSync(f, 'utf-8'), 'orig')
  })

  it('rollbackToMessageIndex 回滚到最近检查点', async () => {
    const f = join(baseDir, 'i.txt')
    writeFileSync(f, 'v0')
    await cm.create('s5', 't1', 5)
    await cm.recordFile('s5', 't1', f)
    writeFileSync(f, 'v1')
    const r = await cm.rollbackToMessageIndex('s5', 6)
    assert.ok(r)
    assert.strictEqual(r.messageCount, 5)
    assert.strictEqual(r.filesRestored, 1)
    assert.strictEqual(readFileSync(f, 'utf-8'), 'v0')
  })

  it('rollbackToMessageIndex 清理失效检查点', async () => {
    await cm.create('s6', 't1', 5)
    await cm.create('s6', 't2', 10)
    await cm.rollbackToMessageIndex('s6', 7)
    const list = await cm.listCheckpoints('s6')
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0].turnId, 't1')
  })

  it('getRollbackPoints 返回每索引快照信息', async () => {
    await cm.create('s7', 't1', 3)
    await cm.create('s7', 't2', 6)
    const pts = await cm.getRollbackPoints('s7')
    assert.ok(pts.length >= 7)
    assert.strictEqual(pts[3].turnId, 't1')
    assert.strictEqual(pts[3].fileCount, 0)
    assert.strictEqual(pts[6].turnId, 't2')
    assert.strictEqual(pts[4].turnId, 't1') // 关联到同一切换点（messageCount + 1）
  })

  it('fork 复制消息', async () => {
    const msgs = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'a' }], createdAt: 100 },
      { id: 'm2', role: 'asst', parts: [{ type: 'text', text: 'b' }], createdAt: 200 },
    ]
    const out: any[] = []
    let created = false
    await cm.create('s8', 't1', 2)
    await cm.fork('s8', 't1', 'f', async () => msgs, async (s) => { created = true }, async (_, m) => out.push(m))
    assert.ok(created)
    assert.strictEqual(out.length, 2)
  })

  it('prune 保留最近 N 个', async () => {
    await cm.create('s9', 't1', 5)
    await cm.create('s9', 't2', 10)
    await cm.create('s9', 't3', 15)
    await cm.prune('s9', 2)
    assert.strictEqual((await cm.listCheckpoints('s9')).length, 2)
  })

  it('clear 删除指定检查点', async () => {
    await cm.create('sA', 't1', 5)
    await cm.clear('sA', 't1')
    assert.strictEqual(await cm.load('sA', 't1'), null)
  })

  it('listCheckpoints 有序', async () => {
    await cm.create('sB', 't1', 1)
    await cm.create('sB', 't2', 2)
    const list = await cm.listCheckpoints('sB')
    assert.strictEqual(list.length, 2)
    assert.strictEqual(list[0].turnId, 't1')
    assert.strictEqual(list[1].turnId, 't2')
  })

  // ── 新增功能测试 ──

  it('clearAll 清理所有检查点', async () => {
    await cm.create('sC', 't1', 1)
    await cm.create('sC', 't2', 2)
    await cm.clearAll('sC')
    assert.strictEqual((await cm.listCheckpoints('sC')).length, 0)
  })

  it('complete 写入 title 和 description', async () => {
    await cm.create('sD', 't1', 3)
    await cm.complete('sD', 't1', { title: 'test title', description: 'test desc' })
    const cp = await cm.load('sD', 't1')
    assert.strictEqual(cp!.title, 'test title')
    assert.strictEqual(cp!.description, 'test desc')
  })

  it('parentTurnId 自动建立链', async () => {
    const cm2 = new CheckpointManager(join(baseDir, '.crai', 'cp2'))
    await cm2.create('sE', 't1', 1)
    await cm2.create('sE', 't2', 2)
    const cp2 = await cm2.load('sE', 't2')
    assert.strictEqual(cp2!.parentTurnId, 't1')
  })

  it('recordFile 接受 changeSource', async () => {
    const cm3 = new CheckpointManager(join(baseDir, '.crai', 'cp3'))
    const f = join(baseDir, 'cs.txt')
    writeFileSync(f, 'test')
    await cm3.create('sF', 't1', 0)
    await cm3.recordFile('sF', 't1', f, 'manual')
    const cp3 = await cm3.load('sF', 't1')
    assert.strictEqual(cp3!.files[0].changeSource, 'manual')
  })

  it('excludePatterns 过滤文件', async () => {
    const cm4 = new CheckpointManager(join(baseDir, '.crai', 'cp4'), { excludePatterns: ['node_modules'] })
    await cm4.create('sG', 't1', 0)
    await cm4.recordFile('sG', 't1', '/workspace/node_modules/pkg/index.js')
    const cp4 = await cm4.load('sG', 't1')
    assert.strictEqual(cp4!.files.length, 0)
  })

  it('getDiff 返回变更条目', async () => {
    const f = join(baseDir, 'diff.txt')
    writeFileSync(f, 'line1\nline2\n')
    const cm5 = new CheckpointManager(join(baseDir, '.crai', 'cp5'))
    await cm5.create('sH', 'ta', 0)
    await cm5.recordFile('sH', 'ta', f)
    writeFileSync(f, 'line1\nline2\nline3\n')
    await cm5.create('sH', 'tb', 1)
    await cm5.recordFile('sH', 'tb', f)
    const entries = await cm5.getDiff('sH', 'ta', 'tb')
    assert.ok(entries.length >= 1)
    assert.ok(entries[0].diff.includes('+line3'))
  })

  it('recordFile 跳过已记录的文件', async () => {
    const f = join(baseDir, 'dup.txt')
    writeFileSync(f, 'v1')
    await cm.create('sI', 't1', 0)
    await cm.recordFile('sI', 't1', f)
    writeFileSync(f, 'v2')
    await cm.recordFile('sI', 't1', f)
    const cp = await cm.load('sI', 't1')
    assert.strictEqual(cp!.files.length, 1)
    assert.strictEqual(cp!.files[0].content, 'v1')
  })
  it('rollbackToMessageIndex 只恢复指定文件', async () => {
    const f1 = join(baseDir, 'a.txt')
    const f2 = join(baseDir, 'b.txt')
    writeFileSync(f1, 'old_a')
    writeFileSync(f2, 'old_b')
    await cm.create('sJ', 't1', 5)
    await cm.recordFile('sJ', 't1', f1)
    await cm.recordFile('sJ', 't1', f2)
    writeFileSync(f1, 'new_a')
    writeFileSync(f2, 'new_b')
    // 只恢复 f1
    const r = await cm.rollbackToMessageIndex('sJ', 6, [f1])
    assert.ok(r)
    assert.strictEqual(r.filesRestored, 1)
    assert.strictEqual(readFileSync(f1, 'utf-8'), 'old_a')
    assert.strictEqual(readFileSync(f2, 'utf-8'), 'new_b') // f2 未恢复
  })

  it('getDiff 输出包含 unified diff 格式', async () => {
    const f = join(baseDir, 'unified.txt')
    writeFileSync(f, 'line1\nline2\nline3\n')
    await cm.create('sK', 'ta', 0)
    await cm.recordFile('sK', 'ta', f)
    writeFileSync(f, 'line1\nline2\nmodified\nline4\n')
    await cm.create('sK', 'tb', 1)
    await cm.recordFile('sK', 'tb', f)
    const entries = await cm.getDiff('sK', 'ta', 'tb')
    assert.ok(entries.length >= 1)
    // 检查 unified diff 格式：必须有 @@ 行
    assert.ok(entries[0].diff.includes('@@'), 'diff 应包含 hunk 头')
    // 检查有删除行和新增行
    assert.ok(entries[0].diff.includes('-line3'), 'diff 应包含删除行')
    assert.ok(entries[0].diff.includes('+modified'), 'diff 应包含新增行')
    // 检查有上下文行
    assert.ok(entries[0].diff.includes(' line2'), 'diff 应包含上下文行')
  })
})
