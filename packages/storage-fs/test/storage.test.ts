import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FileStorageAdapter } from '../src/adapter'
import type { Message } from '@crai/core'

// 临时目录栈，afterEach 统一清理
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

function makeStorage() {
  const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
  tempDirs.push(dir)
  return { storage: new FileStorageAdapter({ baseDir: dir }), dir }
}

describe('FileStorage', () => {
  it('create / get session 往返', async () => {
    const { storage } = makeStorage()

    const session = { id: 'test-session-1', createdAt: Date.now(), updatedAt: Date.now() }
    await storage.createSession(session as any)

    const loaded = await storage.getSession('test-session-1')
    assert.ok(loaded)
    assert.equal(loaded.id, 'test-session-1')
  })

  it('append / list messages', async () => {
    const { storage } = makeStorage()
    const sessionId = 'test-msg-session'

    await storage.createSession({ id: sessionId, createdAt: Date.now(), updatedAt: Date.now() } as any)

    const msg1 = { id: 'msg-1', role: 'user', createdAt: Date.now(), parts: [{ type: 'text', text: 'hello' }] }
    const msg2 = { id: 'msg-2', role: 'assistant', createdAt: Date.now(), parts: [{ type: 'text', text: 'world' }] }

    await storage.appendMessage(sessionId, msg1 as any)
    await storage.appendMessage(sessionId, msg2 as any)

    const messages = await storage.listMessages(sessionId)
    assert.equal(messages.length, 2)
    assert.equal(messages[0].id, 'msg-1')
    assert.equal(messages[1].id, 'msg-2')
  })

  it('updateSession 更新 updatedAt', async () => {
    const { storage } = makeStorage()

    const session = { id: 'update-test', createdAt: 1000, updatedAt: 1000 }
    await storage.createSession(session as any)

    session.updatedAt = 2000
    await storage.updateSession(session as any)

    const loaded = await storage.getSession('update-test')
    assert.equal(loaded?.updatedAt, 2000)
  })

  it('不存在的 session 返回 undefined', async () => {
    const { storage } = makeStorage()

    const loaded = await storage.getSession('nonexistent')
    assert.equal(loaded, undefined)
  })

  it('不存在的 session listMessages 返回空数组', async () => {
    const { storage } = makeStorage()

    const messages = await storage.listMessages('nonexistent')
    assert.deepEqual(messages, [])
  })

  it('truncateMessages: 截断到指定数量', async () => {
    const { storage } = makeStorage()
    const sid = 'test_truncate'
    const msg1: Message = { id: 'm1', role: 'user', createdAt: 100, parts: [{ type: 'text', text: 'a' }] }
    const msg2: Message = { id: 'm2', role: 'assistant', createdAt: 200, parts: [{ type: 'text', text: 'b' }] }
    const msg3: Message = { id: 'm3', role: 'user', createdAt: 300, parts: [{ type: 'text', text: 'c' }] }
    await storage.appendMessage(sid, msg1)
    await storage.appendMessage(sid, msg2)
    await storage.appendMessage(sid, msg3)

    await storage.truncateMessages(sid, 2)
    const msgs = await storage.listMessages(sid)
    assert.strictEqual(msgs.length, 2)
    assert.strictEqual(msgs[0].id, 'm1')
    assert.strictEqual(msgs[1].id, 'm2')
  })

  it('truncateMessages: 数量不足时不截断', async () => {
    const { storage } = makeStorage()
    const sid = 'test_truncate_short'
    const msg1: Message = { id: 'm1', role: 'user', createdAt: 100, parts: [{ type: 'text', text: 'x' }] }
    await storage.appendMessage(sid, msg1)

    await storage.truncateMessages(sid, 10)
    const msgs = await storage.listMessages(sid)
    assert.strictEqual(msgs.length, 1)
  })
})
