import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { ConfigManager } from '../src/index'
import type { AppVariant, GlobalConfig, WorkspaceConfig } from '@crai/core'

// ── 测试用变体 ──

function testVariant(tmp: string): AppVariant {
  return {
    configDirName: tmp,
    workspaceDataDirName: '.crai-test',
    server: { defaultPort: 9999 },
    debug: { trace: false },
  }
}

// globalConfigPath = join(homedir(), configDirName, 'config.json')
// 测试用的 configDirName = tmpDir（绝对路径），所以实际文件在 ~/<tmpDir>/ 下
function globalDir(tmp: string): string {
  return join(homedir(), tmp)
}

// ── 配置路径 ──

describe('ConfigManager', () => {
  let tmpDir: string
  let variant: AppVariant
  let mgr: ConfigManager

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'crai-config-test-'))
    variant = testVariant(tmpDir)
    mgr = new ConfigManager(variant)
  })

  afterEach(() => {
    // 清理两个位置：tmpDir（workspace 配置），globalDir（全局配置在 ~/<tmpDir>/ 下）
    const gd = globalDir(tmpDir)
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
    if (existsSync(gd)) rmSync(gd, { recursive: true, force: true })
  })

  // ── 构造 ──

  describe('constructor', () => {
    it('保存 variant 引用', () => {
      assert.strictEqual(mgr.getVariant(), variant)
    })

    it('初始 global 为默认值', () => {
      const g = mgr.getGlobal()
      assert.deepStrictEqual(g.providers, {})
      assert.deepStrictEqual(g.recentWorkspaces, [])
    })
  })

  // ── 路径 ──

  describe('路径方法', () => {
    it('globalConfigPath 使用 variant.configDirName', () => {
      assert.ok(mgr.globalConfigPath.endsWith(`${tmpDir}/config.json`))
    })

    it('workspaceDir 返回 variant.workspaceDataDirName 目录', () => {
      assert.strictEqual(mgr.workspaceDir('/home/user/proj'), '/home/user/proj/.crai-test')
    })

    it('workspaceConfigPath 返回配置文件名', () => {
      assert.strictEqual(mgr.workspaceConfigPath('/home/user/proj'), '/home/user/proj/.crai-test/config.json')
    })

    it('workspaceDataDir 返回 workspaceDir 相同', () => {
      assert.strictEqual(mgr.workspaceDataDir('/home/user/proj'), mgr.workspaceDir('/home/user/proj'))
    })
  })

  // ── 全局配置持久化 ──

  describe('全局配置 I/O', () => {
    it('loadGlobal 从零创建默认配置并写入文件', async () => {
      const cfg = await mgr.loadGlobal()
      assert.deepStrictEqual(cfg.providers, {})
      assert.deepStrictEqual(cfg.recentWorkspaces, [])
      assert.ok(existsSync(mgr.globalConfigPath))
    })

    it('loadGlobal 读取已有配置', async () => {
      const data: GlobalConfig = {
        providers: { openai: { apiKey: 'sk-test', models: ['gpt-4'] } },
        defaultModel: 'openai/gpt-4',
        recentWorkspaces: ['/home/user/proj'],
      } as GlobalConfig
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync(globalDir(tmpDir), { recursive: true })
      writeFileSync(mgr.globalConfigPath, JSON.stringify(data), 'utf-8')

      const loaded = await mgr.loadGlobal()
      assert.strictEqual(loaded.defaultModel, 'openai/gpt-4')
      assert.strictEqual(loaded.providers.openai.apiKey, 'sk-test')
    })

    it('saveGlobal 写入文件后再加载一致', async () => {
      const cfg = await mgr.loadGlobal()
      cfg.providers.deepseek = { apiKey: 'ds-key', models: ['deepseek-chat'] }
      cfg.defaultModel = 'deepseek/deepseek-chat'
      await mgr.saveGlobal()

      const reloaded = await mgr.loadGlobal()
      assert.strictEqual(reloaded.defaultModel, 'deepseek/deepseek-chat')
      assert.strictEqual(reloaded.providers.deepseek.apiKey, 'ds-key')
    })
  })

  // ── provider 管理（纯逻辑） ──

  describe('provider 管理', () => {
    beforeEach(async () => { await mgr.loadGlobal() })

    it('setProvider 添加 provider', () => {
      mgr.setProvider('openai', { apiKey: 'sk-xxx' })
      assert.strictEqual(mgr.getGlobal().providers.openai.apiKey, 'sk-xxx')
    })

    it('添加第一个 provider 时自动设 defaultModel', () => {
      mgr.setProvider('openai', { apiKey: 'sk-xxx', models: ['gpt-4'] })
      assert.strictEqual(mgr.getGlobal().defaultModel, 'openai/gpt-4')
    })

    it('后续添加不修改 defaultModel', () => {
      mgr.setProvider('openai', { apiKey: 'sk-xxx', models: ['gpt-4'] })
      mgr.setProvider('deepseek', { apiKey: 'ds-xxx', models: ['deepseek-chat'] })
      assert.strictEqual(mgr.getGlobal().defaultModel, 'openai/gpt-4')
    })

    it('removeProvider 删除 provider', () => {
      mgr.setProvider('openai', { apiKey: 'sk-xxx' })
      mgr.removeProvider('openai')
      assert.strictEqual(mgr.getGlobal().providers.openai, undefined)
    })

    it('删除 provider 后清除对应的 defaultModel', () => {
      mgr.setProvider('openai', { apiKey: 'sk-xxx', models: ['gpt-4'] })
      mgr.setProvider('deepseek', { apiKey: 'ds-xxx', models: ['deepseek-chat'] })
      mgr.removeProvider('openai')
      // defaultModel 从 "openai/gpt-4" 被清除
      assert.strictEqual(mgr.getGlobal().defaultModel, undefined)
    })
  })

  // ── getEffectiveConfig ──

  describe('getEffectiveConfig', () => {
    it('没有 provider 时返回空值', () => {
      const eff = mgr.getEffectiveConfig(
        { providers: {}, recentWorkspaces: [] },
        {},
      )
      assert.strictEqual(eff.apiKey, '')
      assert.strictEqual(eff.provider, '')
      assert.strictEqual(eff.model, '')
    })

    it('使用 defaultModel 的 provider 前缀', () => {
      const eff = mgr.getEffectiveConfig(
        {
          providers: { openai: { apiKey: 'sk-xxx', models: ['gpt-4'] } },
          defaultModel: 'openai/gpt-4',
          recentWorkspaces: [],
        },
        {},
      )
      assert.strictEqual(eff.apiKey, 'sk-xxx')
      assert.strictEqual(eff.provider, 'openai')
      assert.strictEqual(eff.model, 'gpt-4')
    })

    it('没有 defaultModel 时使用第一个 provider 的第一个 model', () => {
      const eff = mgr.getEffectiveConfig(
        {
          providers: { deepseek: { apiKey: 'ds-xxx', models: ['deepseek-chat'] } },
          recentWorkspaces: [],
        },
        {},
      )
      assert.strictEqual(eff.apiKey, 'ds-xxx')
      assert.strictEqual(eff.provider, 'deepseek')
      assert.strictEqual(eff.model, 'deepseek-chat')
    })

    it('defaultModel 中 model 部分优先于 provider.models[0]', () => {
      const eff = mgr.getEffectiveConfig(
        {
          providers: { openai: { apiKey: 'sk-xxx', models: ['gpt-4', 'gpt-4o'] } },
          defaultModel: 'openai/gpt-4o',
          recentWorkspaces: [],
        },
        {},
      )
      assert.strictEqual(eff.model, 'gpt-4o')
    })

    it('没有 defaultModel 时使用第一个 model', () => {
      const eff = mgr.getEffectiveConfig(
        {
          providers: { openai: { apiKey: 'sk-xxx', models: ['gpt-4'] } },
          recentWorkspaces: [],
        },
        {},
      )
      assert.strictEqual(eff.model, 'gpt-4')
    })
  })

  // ── 最近工作区 ──

  describe('addRecentWorkspace', () => {
    beforeEach(async () => { await mgr.loadGlobal() })

    it('添加新工作区到最前', async () => {
      await mgr.addRecentWorkspace('/home/user/a')
      await mgr.addRecentWorkspace('/home/user/b')
      assert.deepStrictEqual(mgr.getGlobal().recentWorkspaces, ['/home/user/b', '/home/user/a'])
    })

    it('重复添加不产生重复', async () => {
      await mgr.addRecentWorkspace('/home/user/a')
      await mgr.addRecentWorkspace('/home/user/b')
      await mgr.addRecentWorkspace('/home/user/a')
      assert.deepStrictEqual(mgr.getGlobal().recentWorkspaces, ['/home/user/a', '/home/user/b'])
    })

    it('最多保留 10 条', async () => {
      for (let i = 0; i < 15; i++) {
        await mgr.addRecentWorkspace(`/home/user/proj-${i}`)
      }
      assert.strictEqual(mgr.getGlobal().recentWorkspaces.length, 10)
    })
  })

  // ── 工作区配置 ──

  describe('工作区配置 I/O', () => {
    const projDir = '/tmp/test-project'

    it('loadWorkspace 不存在时返回默认值', async () => {
      const ws = await mgr.loadWorkspace(projDir)
      assert.deepStrictEqual(ws, {})
    })

    it('saveWorkspace + loadWorkspace 一致', async () => {
      const wsCfg: WorkspaceConfig = { security: { mode: 'safe' } }
      await mgr.saveWorkspace(tmpDir, wsCfg) // 用 tmpDir 作为项目目录
      const loaded = await mgr.loadWorkspace(tmpDir)
      assert.strictEqual(loaded.security?.mode, 'safe')
    })

    it('保存后再读取能恢复 security 配置', async () => {
      await mgr.saveWorkspace(tmpDir, { security: { mode: 'execute' } })
      const loaded = await mgr.loadWorkspace(tmpDir)
      assert.strictEqual(loaded.security?.mode, 'execute')
    })

    it('覆盖已有配置', async () => {
      await mgr.saveWorkspace(tmpDir, { security: { mode: 'safe' } })
      await mgr.saveWorkspace(tmpDir, { security: { mode: 'execute' } })
      const loaded = await mgr.loadWorkspace(tmpDir)
      assert.strictEqual(loaded.security?.mode, 'execute')
    })
  })
})
