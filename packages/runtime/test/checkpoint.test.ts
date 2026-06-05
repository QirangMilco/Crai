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
    assert.strictEqual(pts[4].turnId, '')
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
})
