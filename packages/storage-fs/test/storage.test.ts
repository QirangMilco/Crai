import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FileStorageAdapter } from '../src/adapter'

describe('FileStorage', () => {
  it('create / get session 往返', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const storage = new FileStorageAdapter({ baseDir: dir })

    const session = { id: 'test-session-1', createdAt: Date.now(), updatedAt: Date.now() }
    await storage.createSession(session as any)

    const loaded = await storage.getSession('test-session-1')
    assert.ok(loaded)
    assert.equal(loaded.id, 'test-session-1')

    rmSync(dir, { recursive: true, force: true })
  })

  it('append / list messages', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const storage = new FileStorageAdapter({ baseDir: dir })
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

    rmSync(dir, { recursive: true, force: true })
  })

  it('updateSession 更新 updatedAt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const storage = new FileStorageAdapter({ baseDir: dir })

    const session = { id: 'update-test', createdAt: 1000, updatedAt: 1000 }
    await storage.createSession(session as any)

    session.updatedAt = 2000
    await storage.updateSession(session as any)

    const loaded = await storage.getSession('update-test')
    assert.equal(loaded?.updatedAt, 2000)

    rmSync(dir, { recursive: true, force: true })
  })

  it('不存在的 session 返回 undefined', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const storage = new FileStorageAdapter({ baseDir: dir })

    const loaded = await storage.getSession('nonexistent')
    assert.equal(loaded, undefined)

    rmSync(dir, { recursive: true, force: true })
  })

  it('不存在的 session listMessages 返回空数组', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const storage = new FileStorageAdapter({ baseDir: dir })

    const messages = await storage.listMessages('nonexistent')
    assert.deepEqual(messages, [])

    rmSync(dir, { recursive: true, force: true })
  })
})
