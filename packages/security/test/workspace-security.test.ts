import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHookBus } from '@crai/runtime'
import type { HookBus, HookMap } from '@crai/core'
import type { ExtensionContext, Disposable } from '@crai/core'
import { HOOKS, TOOL_SAFETY_LEVELS, PERMISSION_MODES } from '@crai/core'
import { createWorkspaceSecurity } from '../src/workspace-security'

const SESSION_ID = 'test-session'
const TOOL_CALL_ID = 'tc-1'

// ── Mock ExtensionContext ───────────────────────────

function mockCtx(hooks: HookBus<HookMap>): ExtensionContext {
  return {
    hooks,
    events: { on: () => ({ dispose: () => {} }), emit: async () => {} } as any,
    bus: { on: () => ({ dispose: () => {} }) } as any,
    registry: { tools: {} as any, models: {} as any, storages: {} as any } as any,
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    config: { get: () => undefined, set: async () => {}, delete: async () => {} },
    dataDir: '/tmp',
    register: (_d: Disposable) => {},
    registerTool: () => ({ dispose: () => {} }),
    registerModelMiddleware: () => ({ dispose: () => {} }),
  } as any
}

function makeToolCall(name: string, safetyLevel: string, args: Record<string, unknown> = {}) {
  return {
    session: { id: SESSION_ID },
    toolCall: { name, arguments: args, toolCallId: TOOL_CALL_ID, type: 'tool_call' as const },
    definition: { name, description: '', inputSchema: {}, safetyLevel: safetyLevel as any },
    mode: PERMISSION_MODES.ASK,
  }
}

// ============================================================
// workspace-security hook tests
// ============================================================

describe('workspace-security', () => {
  it('safe 工具路径校验通过', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/home/user/project', mode: 'ask' }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('fs_read', 'safe', { path: 'src/file.ts' }), {} as any)
    assert.equal((result as any).stop, undefined)
  })

  it('safe 工具路径逃逸拦截', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/home/user/project', mode: 'ask' }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('fs_read', 'safe', { path: '/etc/passwd' }), {} as any)
    assert.equal((result as any).stop, true)
    assert.ok((result as any).reason)
  })

  it('restricted 工具路径校验也生效', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/home/user/project', mode: 'ask' }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('fs_write', 'restricted', { path: '/etc/passwd' }), {} as any)
    assert.equal((result as any).stop, true)
  })

  it('dangerous 工具在 safe 模式下拦截', async () => {
    const hooks = createHookBus()
    const value = makeToolCall('bash', 'dangerous', { command: 'ls' })
    value.mode = PERMISSION_MODES.SAFE as any
    createWorkspaceSecurity({ rootDir: '/tmp', mode: 'safe' }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, value, {} as any)
    assert.equal((result as any).stop, true)
  })

  it('dangerous 工具无 askHandler 时放行', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/tmp', mode: 'ask' }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('bash', 'dangerous', { command: 'ls' }), {} as any)
    assert.equal((result as any).stop, undefined)
  })

  it('dangerous 工具 askHandler 返回 false 时拦截', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/tmp', mode: 'ask', askHandler: async () => false }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('bash', 'dangerous', { command: 'ls' }), {} as any)
    assert.equal((result as any).stop, true)
  })

  it('dangerous 工具 askHandler 返回 true 时放行', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/tmp', mode: 'ask', askHandler: async () => true }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('bash', 'dangerous', { command: 'ls' }), {} as any)
    assert.equal((result as any).stop, undefined)
  })

  it('YOLO 模式非敏感命令自动放行', async () => {
    const hooks = createHookBus()
    createWorkspaceSecurity({ rootDir: '/tmp', mode: 'ask', yoloMode: true }).setup(mockCtx(hooks))

    const result = await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('bash', 'dangerous', { command: 'ls -la' }), {} as any)
    assert.equal((result as any).stop, undefined)
  })

  it('YOLO 模式敏感命令仍调用 askHandler', async () => {
    const hooks = createHookBus()
    let asked = false
    createWorkspaceSecurity({
      rootDir: '/tmp', mode: 'ask', yoloMode: true,
      askHandler: async () => { asked = true; return true },
    }).setup(mockCtx(hooks))

    await hooks.run(HOOKS.TOOL_SAFETY_CHECK, makeToolCall('bash', 'dangerous', { command: 'rm -rf /tmp/foo' }), {} as any)
    assert.equal(asked, true)
  })
})
