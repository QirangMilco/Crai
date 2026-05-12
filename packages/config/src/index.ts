/**
 * @crai/config — Crai 配置系统。
 *
 * 全局配置（API keys、默认 provider/模型）由用户管理。
 * 变体配置（variants/{env}.json）定义应用身份和路径：
 *   - dev/prod 使用不同的数据目录，数据互不干扰
 *   - 变体配置不由用户编辑，属于构建/部署决定
 *   - 用户可编辑的配置（API keys 等）存放在变体指定的目录中
 */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// ════════════════════════════════════════════════════════
// 变体配置（App Variant）—— 由应用定义，用户不编辑
// ════════════════════════════════════════════════════════

export interface AppVariant {
  /** 配置目录名（~/.crai 或 ~/.crai-dev），dev/prod 用不同目录。 */
  configDirName: string
  /** 工作区内数据目录名（.crai 或 .crai-dev）。 */
  workspaceDataDirName: string
  server: {
    defaultPort: number
  }
  debug: {
    trace: boolean
    verboseTools: boolean
  }
}

// ════════════════════════════════════════════════════════
// 用户配置（User Config）
// ════════════════════════════════════════════════════════

export interface ProviderConfig {
  apiKey: string
  baseURL?: string
  models?: string[]
}

export interface GlobalConfig {
  providers: Record<string, ProviderConfig>
  defaultProvider?: string
  defaultModel?: string
  recentWorkspaces: string[]
}

export interface WorkspaceSecurityConfig {
  mode?: 'safe' | 'ask' | 'execute'
}

export interface WorkspaceConfig {
  /** 此工作区的安全模式。不设时使用 'ask'。 */
  security?: WorkspaceSecurityConfig
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  providers: {},
  recentWorkspaces: [],
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {}

// ════════════════════════════════════════════════════════
// ConfigManager
// ════════════════════════════════════════════════════════

export class ConfigManager {
  private variant: AppVariant
  private global: GlobalConfig
  private dirty = false

  constructor(variant: AppVariant) {
    this.variant = variant
    this.global = { ...DEFAULT_GLOBAL_CONFIG }
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

  // ── 全局配置 ──

  async loadGlobal(): Promise<GlobalConfig> {
    try {
      const raw = await readFile(this.globalConfigPath, 'utf-8')
      this.global = { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(raw) }
    } catch {
      this.global = { ...DEFAULT_GLOBAL_CONFIG }
      await this.saveGlobal()
    }
    this.dirty = false
    return this.global
  }

  async saveGlobal(): Promise<void> {
    const dir = join(homedir(), this.variant.configDirName)
    await mkdir(dir, { recursive: true })
    await writeFile(this.globalConfigPath, JSON.stringify(this.global, null, 2), 'utf-8')
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
