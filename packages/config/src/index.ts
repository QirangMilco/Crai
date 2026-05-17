/**
 * @crai/config — Crai 配置系统。
 *
 * 全局配置（API keys、默认 provider/模型）由用户管理。
 * 变体配置（variants/{env}.json）定义应用身份和路径：
 *   - dev/prod 使用不同的数据目录，数据互不干扰
 *   - 变体配置不由用户编辑，属于构建/部署决定
 *   - 用户可编辑的配置（API keys 等）存放在变体指定的目录中
 *
 * 类型定义（GlobalConfig、ProviderConfig、ConfigStore 等）在 @crai/core 中，
 * 方便 transport 等包引用类型而不产生跨扩展依赖。
 * 此包提供的是 JSON 文件实现和 ConfigManager 管理类。
 */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { AppVariant, GlobalConfig, ProviderConfig, WorkspaceConfig, ConfigStore } from '@crai/core'
import { encrypt, decrypt } from './crypto'

// ════════════════════════════════════════════════════════
// 默认值
// ════════════════════════════════════════════════════════

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  providers: {},
  recentWorkspaces: [],
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {}

// ════════════════════════════════════════════════════════
// ConfigManager（JSON 文件实现）
// ════════════════════════════════════════════════════════

export class ConfigManager implements ConfigStore {
  private variant: AppVariant
  private global: GlobalConfig
  private dirty = false
  private _keyDir: string

  constructor(variant: AppVariant) {
    this.variant = variant
    this.global = { ...DEFAULT_GLOBAL_CONFIG }
    this._keyDir = join(homedir(), variant.configDirName)
  }

  getVariant(): AppVariant {
    return this.variant
  }

  get globalConfigPath(): string {
    return join(homedir(), this.variant.configDirName, 'config.json')
  }

  workspaceDir(rootDir: string): string {
    return join(rootDir, this.variant.workspaceDataDirName)
  }

  workspaceConfigPath(rootDir: string): string {
    return join(this.workspaceDir(rootDir), 'config.json')
  }

  workspaceDataDir(rootDir: string): string {
    return this.workspaceDir(rootDir)
  }

  // ── ConfigStore 接口 ──

  async load(): Promise<GlobalConfig> {
    return this.loadGlobal()
  }

  async save(config: GlobalConfig): Promise<void> {
    this.global = { ...config }
    await this.saveGlobal()
  }

  // ── 全局配置 ──

  async loadGlobal(): Promise<GlobalConfig> {
    try {
      const raw = await readFile(this.globalConfigPath, 'utf-8')
      this.global = { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(raw) }
      console.log(`[config] 已加载配置: ${this.globalConfigPath} (${Object.keys(this.global.providers).length} 个 provider, ${this.global.recentWorkspaces.length} 个工作区)`)
    } catch (err) {
      // 文件不存在或解析失败时用默认值，但不覆盖现有文件（避免误删已有配置）
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        // 文件不存在：首次启动，写入默认配置
        this.global = { ...DEFAULT_GLOBAL_CONFIG }
        await this.saveGlobal()
        console.log(`[config] 首次启动，已创建默认配置: ${this.globalConfigPath}`)
      } else {
        // 文件存在但解析失败：保留文件不覆盖，仅内存中使用默认值
        console.error(`[config] 配置加载失败（保留文件）: ${(err as Error).message}`)
        this.global = { ...DEFAULT_GLOBAL_CONFIG }
      }
    }
    // 解密所有已保存的 API keys
    for (const name of Object.keys(this.global.providers)) {
      const p = this.global.providers[name]
      if (p.apiKey) {
        try {
          p.apiKey = decrypt(p.apiKey, this._keyDir)
        } catch (decErr) {
          console.error(`[config] provider "${name}" API key 解密失败: ${(decErr as Error).message}`)
          delete p.apiKey
        }
      }
    }
    this.dirty = false
    return this.global
  }

  async saveGlobal(): Promise<void> {
    // 加密所有 API keys 后存盘
    const toSave = { ...this.global, providers: { ...this.global.providers } }
    for (const name of Object.keys(toSave.providers)) {
      if (toSave.providers[name].apiKey) {
        toSave.providers[name] = { ...toSave.providers[name], apiKey: encrypt(toSave.providers[name].apiKey, this._keyDir) }
      }
    }
    const dir = this._keyDir
    await mkdir(dir, { recursive: true })
    await writeFile(this.globalConfigPath, JSON.stringify(toSave, null, 2), 'utf-8')
    console.log(`[config] 已保存配置: ${this.globalConfigPath}`)
    this.dirty = false
  }

  getGlobal(): GlobalConfig {
    return this.global
  }

  setProvider(name: string, config: ProviderConfig): void {
    this.global.providers[name] = config
    if (!this.global.defaultProvider) this.global.defaultProvider = name
    this.dirty = true
  }

  removeProvider(name: string): void {
    delete this.global.providers[name]
    if (this.global.defaultProvider === name) {
      this.global.defaultProvider = Object.keys(this.global.providers)[0]
      // 切到别的 provider 时清除旧模型的 defaultModel，避免 provider/model 不匹配
      delete this.global.defaultModel
    }
    this.dirty = true
  }

  async saveIfDirty(): Promise<void> {
    if (this.dirty) await this.saveGlobal()
  }

  // ── 工作区配置 ──

  async loadWorkspace(rootDir: string): Promise<WorkspaceConfig> {
    try {
      const raw = await readFile(this.workspaceConfigPath(rootDir), 'utf-8')
      return { ...DEFAULT_WORKSPACE_CONFIG, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULT_WORKSPACE_CONFIG }
    }
  }

  async saveWorkspace(rootDir: string, config: WorkspaceConfig): Promise<void> {
    const dir = this.workspaceDir(rootDir)
    await mkdir(dir, { recursive: true })
    await writeFile(this.workspaceConfigPath(rootDir), JSON.stringify(config, null, 2), 'utf-8')
  }

  async addRecentWorkspace(rootDir: string): Promise<void> {
    rootDir = resolve(rootDir)
    this.global.recentWorkspaces = [
      rootDir,
      ...this.global.recentWorkspaces.filter((p) => resolve(p) !== rootDir),
    ].slice(0, 10)
    this.dirty = true
    await this.saveIfDirty()
  }

  getEffectiveConfig(
    global: GlobalConfig,
    _workspace: WorkspaceConfig,
  ): { apiKey: string; baseURL?: string; model: string; provider: string } {
    const providerName = global.defaultProvider ?? Object.keys(global.providers)[0]
    const provider = providerName ? global.providers[providerName] : undefined
    return {
      apiKey: provider?.apiKey ?? '',
      baseURL: provider?.baseURL,
      model: global.defaultModel ?? provider?.models?.[0] ?? '',
      provider: providerName ?? '',
    }
  }
}

// ════════════════════════════════════════════════════════
// 加密工具
// ════════════════════════════════════════════════════════

export { encrypt, decrypt } from './crypto'
