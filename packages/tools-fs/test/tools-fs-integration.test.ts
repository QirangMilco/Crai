import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFsTools } from '../src/index'
import type { ExtensionContext } from '@crai/core'

// ── 模拟工具执行 ────────────────────────────────────
// 直接从工具的 execute handler 中调用，不经过完整 runtime

let registeredTools: any[] = []

function mockCtx(): ExtensionContext {
  registeredTools = []
  return {
    registerTool: (tool: any) => {
      registeredTools.push(tool)
      return { dispose: () => {} }
    },
    registry: { tools: {} as any } as any,
    hooks: { on: () => ({ dispose: () => {} }) } as any,
    events: { on: () => ({ dispose: () => {} }) } as any,
    bus: { on: () => ({ dispose: () => {} }) } as any,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    config: { get: () => undefined, set: async () => {}, delete: async () => {} },
    dataDir: '/tmp',
    register: () => {},
    registerModelMiddleware: () => ({ dispose: () => {} }),
  } as any
}

function executeTool(name: string, args: any, session: any = { id: 'test-session' }) {
  const tool = registeredTools.find(t => t.name === name)
  if (!tool) throw new Error(`Tool ${name} not found`)
  return tool.execute({
    session,
    toolCall: { name, arguments: args, toolCallId: 'tc-1', type: 'tool_call' },
    messages: [],
  }, { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }, session })
}

describe('tools-fs integration', () => {
  it('fs_read 读取文件', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    const filePath = join(dir, 'test.txt')
    writeFileSync(filePath, 'hello')

    createFsTools({ rootDir: dir }).setup(mockCtx())
    const result = await executeTool('fs_read', { path: 'test.txt' })
    assert.ok(!result.isError)
    assert.ok(result.content[0].text.includes('hello'))

    rmSync(dir, { recursive: true, force: true })
  })

  it('fs_write 创建新文件', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    createFsTools({ rootDir: dir }).setup(mockCtx())

    const result = await executeTool('fs_write', { path: 'newfile.txt', content: 'new content' })
    assert.ok(!result.isError)
    assert.equal(readFileSync(join(dir, 'newfile.txt'), 'utf-8'), 'new content')

    rmSync(dir, { recursive: true, force: true })
  })

  it('fs_write 拒绝覆盖（不传 overwrite）', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    writeFileSync(join(dir, 'existing.txt'), 'original')
    createFsTools({ rootDir: dir }).setup(mockCtx())

    const result = await executeTool('fs_write', { path: 'existing.txt', content: 'new' })
    assert.equal(result.isError, true)
    assert.equal(readFileSync(join(dir, 'existing.txt'), 'utf-8'), 'original')

    rmSync(dir, { recursive: true, force: true })
  })

  it('fs_write 覆盖时快照备份', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    writeFileSync(join(dir, 'existing.txt'), 'original')
    createFsTools({ rootDir: dir, snapshotsDir: join(dir, 'snapshots') }).setup(mockCtx())

    const result = await executeTool('fs_write', { path: 'existing.txt', content: 'modified', overwrite: true }, { id: 's1' })
    assert.ok(!result.isError)
    assert.equal(readFileSync(join(dir, 'existing.txt'), 'utf-8'), 'modified')

    // 确认快照存在
    const snapDir = join(dir, 'snapshots')
    const snapFiles = await import('fs').then(fs => fs.promises.readdir(snapDir))
    assert.ok(snapFiles.length > 0)

    rmSync(dir, { recursive: true, force: true })
  })

  it('fs_list 列出目录', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    writeFileSync(join(dir, 'a.txt'), 'a')
    writeFileSync(join(dir, 'b.txt'), 'b')
    mkdirSync(join(dir, 'subdir'))

    createFsTools({ rootDir: dir }).setup(mockCtx())
    const result = await executeTool('fs_list', { path: '.' })
    assert.ok(!result.isError)
    assert.ok(result.content[0].text.includes('a.txt'))
    assert.ok(result.content[0].text.includes('subdir/'))

    rmSync(dir, { recursive: true, force: true })
  })

  it('路径逃逸被拒绝', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crai-test-'))
    createFsTools({ rootDir: dir }).setup(mockCtx())

    const result = await executeTool('fs_read', { path: '/etc/passwd' })
    assert.equal(result.isError, true)
    assert.ok(result.content[0].text.includes('不在工作区内'))

    rmSync(dir, { recursive: true, force: true })
  })
})
