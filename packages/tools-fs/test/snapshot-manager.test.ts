import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SnapshotManager } from '../src/snapshot-manager'

const SESSION_ID = 'test-snapshot-session'
const FILE_CONTENT = 'hello world'

function sandbox(): { dir: string; snapshotsDir: string; rootDir: string; manager: SnapshotManager } {
  const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
  const snapshotsDir = join(dir, 'snapshots')
  const rootDir = join(dir, 'workspace')
  mkdirSync(rootDir, { recursive: true })
  const manager = new SnapshotManager(snapshotsDir)
  return { dir, snapshotsDir, rootDir, manager }
}

describe('SnapshotManager', () => {
  it('新建文件快照记录 content 和 existed=true', async () => {
    const { dir, rootDir, manager } = sandbox()
    const filePath = join(rootDir, 'hello.txt')
    writeFileSync(filePath, 'hello world')

    const opIndex = await manager.snapshot(SESSION_ID, rootDir, [filePath])
    assert.equal(opIndex, 1)

    const snap = await manager.loadSnapshot(SESSION_ID, 1)
    assert.ok(snap)
    assert.equal(snap.sessionId, SESSION_ID)
    assert.equal(snap.files.length, 1)
    assert.equal(snap.files[0].content, 'hello world')
    assert.equal(snap.files[0].existed, true)
    assert.ok(snap.files[0].contentHash)

    rmSync(dir, { recursive: true, force: true })
  })

  it('不存在的文件快照记录 content=null 和 existed=false', async () => {
    const { dir, rootDir, manager } = sandbox()
    const filePath = join(rootDir, 'nonexistent.txt')

    const opIndex = await manager.snapshot(SESSION_ID, rootDir, [filePath])
    const snap = await manager.loadSnapshot(SESSION_ID, opIndex)
    assert.ok(snap)
    assert.equal(snap.files[0].content, null)
    assert.equal(snap.files[0].existed, false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('操作序号递增', async () => {
    const { dir, rootDir, manager } = sandbox()
    const fileA = join(rootDir, 'a.txt')
    const fileB = join(rootDir, 'b.txt')
    writeFileSync(fileA, 'a')
    writeFileSync(fileB, 'b')

    const idx1 = await manager.snapshot(SESSION_ID, rootDir, [fileA])
    const idx2 = await manager.snapshot(SESSION_ID, rootDir, [fileB])

    assert.equal(idx1, 1)
    assert.equal(idx2, 2)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rollback 恢复文件内容', async () => {
    const { dir, rootDir, manager } = sandbox()
    const filePath = join(rootDir, 'data.txt')
    writeFileSync(filePath, 'original content')

    await manager.snapshot(SESSION_ID, rootDir, [filePath])
    writeFileSync(filePath, 'modified content')

    const restored = await manager.rollback(SESSION_ID, 1, rootDir)
    assert.equal(restored.length, 1)
    assert.equal(readFileSync(filePath, 'utf-8'), 'original content')

    rmSync(dir, { recursive: true, force: true })
  })

  it('rollback 不存在的文件将其删除', async () => {
    const { dir, rootDir, manager } = sandbox()
    const filePath = join(rootDir, 'temp.txt')

    // 文件还不存在，快照
    await manager.snapshot(SESSION_ID, rootDir, [filePath])
    writeFileSync(filePath, 'should be deleted')
    const restored = await manager.rollback(SESSION_ID, 1, rootDir)
    assert.equal(restored.length, 1)
    assert.equal(existsSync(filePath), false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('listSnapshots 返回按序号排序的元数据', async () => {
    const { dir, rootDir, manager } = sandbox()
    const f = join(rootDir, 'f.txt')
    writeFileSync(f, 'v1')
    await manager.snapshot(SESSION_ID, rootDir, [f])
    writeFileSync(f, 'v2')
    await manager.snapshot(SESSION_ID, rootDir, [f])
    writeFileSync(f, 'v3')
    await manager.snapshot(SESSION_ID, rootDir, [f])

    const metas = await manager.listSnapshots(SESSION_ID)
    assert.equal(metas.length, 3)
    assert.equal(metas[0].operationIndex, 1)
    assert.equal(metas[1].operationIndex, 2)
    assert.equal(metas[2].operationIndex, 3)

    rmSync(dir, { recursive: true, force: true })
  })

  it('clearSnapshots 清空指定 session 的快照', async () => {
    const { dir, rootDir, manager } = sandbox()
    const f = join(rootDir, 'f.txt')
    writeFileSync(f, 'v1')
    await manager.snapshot(SESSION_ID, rootDir, [f])
    await manager.snapshot(SESSION_ID, rootDir, [f])

    await manager.clearSnapshots(SESSION_ID)
    const metas = await manager.listSnapshots(SESSION_ID)
    assert.equal(metas.length, 0)

    rmSync(dir, { recursive: true, force: true })
  })

  it('不同 session 的快照互不干扰', async () => {
    const { dir, rootDir, manager } = sandbox()
    writeFileSync(join(rootDir, 'common.txt'), 'shared')

    await manager.snapshot('session-a', rootDir, [join(rootDir, 'common.txt')])
    await manager.snapshot('session-b', rootDir, [join(rootDir, 'common.txt')])

    const metasA = await manager.listSnapshots('session-a')
    const metasB = await manager.listSnapshots('session-b')
    assert.equal(metasA.length, 1)
    assert.equal(metasB.length, 1)

    rmSync(dir, { recursive: true, force: true })
  })
})
