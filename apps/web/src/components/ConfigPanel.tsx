/**
 * 配置面板。
 *
 * 两栏设计:
 *  - 提供商列表:预设 DeepSeek/OpenAI + 自定义 provider
 *  - 点击展开配置 API key、base URL(预设自带默认值)、模型列表
 *  - "获取模型"按钮调用 Models API 自动填充
 */
import { useState, useCallback, useEffect } from 'react'
import { Select } from './ui'

// 由服务端 knownModels prop 提供,见 config:known-models 协议。
// 不再硬编码。
function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>): number | undefined {
  return knownModels?.[provider]?.[model]?.contextWindow
}

function getKnownModelDisplayName(provider: string, model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>): string | undefined {
  return knownModels?.[provider]?.[model]?.displayName
}

interface Props {
  config: {
    providers: Record<string, {
      apiKey: string
      baseURL?: string
      models?: string[]
      modelConfigs?: Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }>
    }>
    defaultProvider?: string
    defaultModel?: string
    sandboxEnabled?: boolean
    recentWorkspaces: string[]
    customContextWindows?: Record<string, number>
    compressionThreshold?: number
    toolModel?: string
  } | null
  send: (msg: any) => void
  onClose: () => void
  /** 服务端返回的模型列表结果。 */
  modelsFetchResult?: { providerName: string; models: string[]; error?: string } | null
  /** 清除模型结果(组件已消费后调用)。 */
  onClearModelsResult?: () => void
  /** 已知模型窗口数据,由服务端提供。 */
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>
  /** 第一方 provider 列表,由服务端提供。 */
  firstParty?: Array<{ name: string; label: string; defaultBaseURL: string }>
}

function maskKey(key: string): string {
  if (!key || key.length <= 8) return '********'
  return key.slice(0, 4) + '...' + key.slice(-4)
}

export function ConfigPanel({ config, send, onClose, modelsFetchResult, onClearModelsResult, knownModels, firstParty }: Props) {
  const [editing, setEditing] = useState<string | null>(null)     // 展开编辑的 provider name
  const [editKey, setEditKey] = useState('')                      // 编辑中的 API key
  const [editBaseURL, setEditBaseURL] = useState('')              // 编辑中的 base URL
  const [editModel, setEditModel] = useState('')                  // 编辑中的 default model
  const [editModelsPath, setEditModelsPath] = useState('')        // 编辑中的 models 路径
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  // 当前编辑中的 provider 的模型列表（本地状态，避免等待 config prop 更新）
  const [localModels, setLocalModels] = useState<string[]>([])
  // 当前编辑中的 provider 的模型配置（本地状态）
  const [localModelConfigs, setLocalModelConfigs] = useState<Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }>>({})
  // 正在编辑的模型 ID（打开模态框）
  const [editingModel, setEditingModel] = useState<string | null>(null)
  // 模型编辑弹窗表单状态
  const [editFormName, setEditFormName] = useState('')
  const [editFormCtx, setEditFormCtx] = useState('')
  const [editFormMaxOut, setEditFormMaxOut] = useState('')
  const [editFormVision, setEditFormVision] = useState(false)

  // 打开模型编辑弹窗时填充表单
  useEffect(() => {
    if (editingModel && editing) {
      const mc = localModelConfigs[editingModel] || {}
      const knownCtx = getModelContextWindow(editing, editingModel, knownModels)
      setEditFormName(mc.displayName || getKnownModelDisplayName(editing, editingModel, knownModels) || '')
      setEditFormCtx(String(mc.contextWindow ?? knownCtx ?? ''))
      setEditFormMaxOut(String(mc.maxOutput ?? ''))
      setEditFormVision(mc.vision ?? false)
    }
  }, [editingModel])

  // 当 config prop 更新时，同步本地状态
  useEffect(() => {
    if (editing && providers[editing]) {
      const p = providers[editing]
      setLocalModels(p.models ?? [])
      setLocalModelConfigs(p.modelConfigs ?? {})
    }
  }, [config, editing])

  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // 每个模型的上下文窗口覆盖(从已保存配置读取)
  const [editContextWindows, setEditContextWindows] = useState<Record<string, string>>(
    () => Object.fromEntries(
      Object.entries(config?.customContextWindows ?? {}).map(([k, v]) => [k, String(v)])
    )
  )
  const [sandboxEnabled, setSandboxEnabled] = useState(config?.sandboxEnabled ?? false)
  const [configTab, setConfigTab] = useState('providers')
  // 压缩阈值(显示为百分比整数,如 80 表示 80%)
  const defaultThreshold = config?.compressionThreshold != null ? Math.round(config.compressionThreshold * 100) : 80
  const [compressionThreshold, setCompressionThreshold] = useState(String(defaultThreshold))

  // 自定义提供商表单
  const [customName, setCustomName] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [customModelsPath, setCustomModelsPath] = useState('')

  const providers = config?.providers ?? {}
  const isDev = (config as any)?.variant === 'dev'

  // 从所有 provider 收集模型列表
  const allModelOptions = Object.entries(providers).flatMap(([provider, p]) =>
    (p.models ?? []).map(m => ({ provider, model: m, label: `${provider}/${m}` }))
  )
  // 当前选中的工具模型(格式:provider/model)
  const [editToolModel, setEditToolModel] = useState(config?.toolModel ?? '')

  // 处理服务端返回的模型列表
  useEffect(() => {
    if (!modelsFetchResult || !editing) return
    if (modelsFetchResult.providerName === editing) {
      if (modelsFetchResult.error) {
        alert(modelsFetchResult.error)
      } else {
        setFetchedModels(modelsFetchResult.models)
      }
      setFetching(false)
      onClearModelsResult?.()
    }
  }, [modelsFetchResult])

  // 判断是否是预设提供商
  const isFirstParty = useCallback((name: string) => {
    return (firstParty ?? []).some((fp) => fp.name === name) || (name === 'mock' && isDev)
  }, [firstParty, isDev])

  const firstPartyDefault = useCallback((name: string) => {
    return (firstParty ?? []).find((fp) => fp.name === name)
  }, [firstParty])

  function startEdit(name: string) {
    const p = providers[name] ?? { apiKey: '', baseURL: '' }
    setEditing(name)
    setEditKey(p.apiKey)
    setEditBaseURL(p.baseURL || firstPartyDefault(name)?.defaultBaseURL || '')
    setEditModel(config?.defaultModel ?? '')
    setEditModelsPath((p as any).modelsPath ?? '')
    setFetchedModels([])
    setShowAddDropdown(false)
    setLocalModels(p.models ?? [])
    setLocalModelConfigs(p.modelConfigs ?? {})
  }

  function saveProviderConfig(overrides?: { models?: string[]; modelConfigs?: Record<string, any> }) {
    if (!editing) return
    const p = providers[editing] ?? {}
    send({ type: 'config:set:provider', name: editing, config: {
      apiKey: editKey,
      baseURL: editBaseURL || undefined,
      models: overrides?.models ?? p.models,
      modelConfigs: overrides?.modelConfigs ?? p.modelConfigs,
      modelsPath: editModelsPath || undefined,
    }})
    // 同步本地状态（避免等待 config prop 更新）
    if (overrides?.models) setLocalModels(overrides.models)
    if (overrides?.modelConfigs) setLocalModelConfigs(overrides.modelConfigs)
  }

  function fetchModelList() {
    if (!editing) return
    setFetching(true)
    // 通过 WebSocket 走服务端代理(Mock 无网络、真实 provider 不暴露 API key)
    send({ type: 'config:fetch:models', providerName: editing })
  }

  function removeProvider(name: string) {
    send({ type: 'config:remove:provider', name })
    if (editing === name) {
      setEditing(null)
      setEditKey('')
      setEditBaseURL('')
      setEditModel('')
      setFetchedModels([])
    }
  }

  function addCustomProvider() {
    if (!customName || !customKey) return
    send({ type: 'config:set:provider', name: customName, config: {
      apiKey: customKey,
      baseURL: customBaseURL || undefined,
      modelsPath: customModelsPath || undefined,
    }})
    setCustomName('')
    setCustomKey('')
    setCustomBaseURL('')
    setCustomModelsPath('')
    // 自动选中新添加的供应商
    setEditing(customName)
    setEditKey(customKey)
    setEditBaseURL(customBaseURL || undefined)
    setEditModel('')
    setEditModelsPath(customModelsPath || '')
  }

  // 合并预设 + 自定义 provider 列表
  const knownFirstParty = isDev
    ? [...(firstParty ?? []), { name: 'mock', label: 'Mock(测试)', defaultBaseURL: '' }]
    : (firstParty ?? [])
  const providerEntries = [
    ...knownFirstParty.map((fp) => ({
      name: fp.name,
      label: fp.label,
      configured: !!providers[fp.name],
      isPreset: true,
      apiKey: providers[fp.name]?.apiKey ?? '',
      baseURL: providers[fp.name]?.baseURL ?? fp.defaultBaseURL,
      models: providers[fp.name]?.models ?? [],
    })),
    ...Object.keys(providers)
      .filter((name) => !isFirstParty(name))
      .map((name) => ({
        name,
        label: name,
        configured: true,
        isPreset: false,
        apiKey: providers[name]?.apiKey ?? '',
        baseURL: providers[name]?.baseURL ?? '',
        models: providers[name]?.models ?? [],
      })),
  ]

  return (
    <div className="flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        height: '620px', // 固定高度
        width: '660px',  // 增加宽度以适应内部双栏
      }}>

      {/* 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">配置</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity duration-150">✕</button>
      </div>

      {/* 主体:侧栏 + 内容 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧栏 */}
        <div className="w-32 shrink-0 border-r py-2 overflow-y-auto" style={{ borderColor: 'var(--crai-border)' }}>
          {['providers', 'general'].map((tab) => (
            <button
              key={tab}
              onClick={() => setConfigTab(tab)}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors duration-150"
              style={{
                color: configTab === tab ? 'var(--crai-accent)' : 'var(--crai-fg-secondary)',
                backgroundColor: configTab === tab ? 'var(--crai-bg-3)' : 'transparent',
                fontWeight: configTab === tab ? 500 : 400,
              }}
            >
              {{ providers: '供应商', general: '通用' }[tab]}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {configTab === 'providers' && (<>
            <div className="flex-1 flex overflow-hidden">
              {/* 供应商列表(内部左侧栏) */}
              <div className="w-40 shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--crai-border)' }}>
                <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
                  <div className="text-[10px] font-medium px-2 py-1 uppercase tracking-wider opacity-40">预设</div>
                  {providerEntries.filter(e => e.isPreset).map((entry) => (
                    <button
                      key={entry.name}
                      onClick={() => startEdit(entry.name)}
                      className="w-full text-left px-2 py-2 rounded transition-colors text-xs flex items-center justify-between group"
                      style={{
                        backgroundColor: editing === entry.name ? 'var(--crai-bg-tertiary)' : 'transparent',
                        color: editing === entry.name ? 'var(--crai-accent)' : 'var(--crai-fg)',
                      }}>
                      <span className="truncate">{entry.label}</span>
                      {entry.configured && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="已配置" />}
                    </button>
                  ))}

                  <div className="text-[10px] font-medium px-2 py-1 mt-4 uppercase tracking-wider opacity-40">自定义</div>
                  {providerEntries.filter(e => !e.isPreset).map((entry) => (
                    <button
                      key={entry.name}
                      onClick={() => startEdit(entry.name)}
                      className="w-full text-left px-2 py-2 rounded transition-colors text-xs flex items-center justify-between group"
                      style={{
                        backgroundColor: editing === entry.name ? 'var(--crai-bg-tertiary)' : 'transparent',
                        color: editing === entry.name ? 'var(--crai-accent)' : 'var(--crai-fg)',
                      }}>
                      <span className="truncate">{entry.label}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="已配置" />
                    </button>
                  ))}
                </div>

                {/* 添加自定义按钮 */}
                <div className="p-2 border-t" style={{ borderColor: 'var(--crai-border)' }}>
                  <button
                    onClick={() => setEditing('__new__')}
                    className="w-full py-1.5 rounded border border-dashed text-[11px] transition-colors"
                    style={{
                      borderColor: editing === '__new__' ? 'var(--crai-accent)' : 'var(--crai-border)',
                      color: editing === '__new__' ? 'var(--crai-accent)' : 'var(--crai-fg-secondary)',
                      backgroundColor: editing === '__new__' ? 'var(--crai-bg-3)' : 'transparent',
                    }}>
                    + 添加供应商
                  </button>
                </div>
              </div>

              {/* 具体配置(内部右侧内容区) */}
              <div className="flex-1 overflow-y-auto p-6">
                {!editing ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-2">
                    <div className="text-4xl">⚙️</div>
                    <div className="text-xs">选择一个供应商进行配置</div>
                  </div>
                ) : editing === '__new__' ? (
                  <div className="max-w-md space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-4">添加自定义供应商</h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">名称</label>
                          <input value={customName} onChange={e => setCustomName(e.target.value)}
                            placeholder="如:my-llm"
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">API Key</label>
                          <input value={customKey} onChange={e => setCustomKey(e.target.value)}
                            placeholder="sk-..." type="password"
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">Base URL</label>
                          <input value={customBaseURL} onChange={e => setCustomBaseURL(e.target.value)}
                            placeholder="https://api.xxx.com/v1"
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">Models API 路径 (可选)</label>
                          <input value={customModelsPath} onChange={e => setCustomModelsPath(e.target.value)}
                            placeholder="默认 /v1/models"
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        <button onClick={addCustomProvider}
                          disabled={!customName || !customKey}
                          className="w-full py-2.5 rounded text-xs font-medium text-white disabled:opacity-40 mt-2"
                          style={{ backgroundColor: 'var(--crai-accent)' }}>添加供应商</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md space-y-8">
                    {/* 基础配置 */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{providerEntries.find(e => e.name === editing)?.label || editing} 配置</h3>
                        {!providerEntries.find(e => e.name === editing)?.isPreset && (
                          <button onClick={() => removeProvider(editing)}
                            className="text-[10px] px-2 py-1 rounded border transition-colors"
                            style={{ color: 'var(--crai-destructive)', borderColor: 'var(--crai-destructive)' }}>
                            删除供应商
                          </button>
                        )}
                      </div>

                      {/* API Key 行 */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">API Key</span>
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            value={editKey}
                            onChange={e => setEditKey(e.target.value)}
                            onBlur={() => saveProviderConfig()}
                            type="password" placeholder="sk-..."
                            autoComplete="new-password"
                            spellCheck={false}
                            className="flex-1 px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                          <button
                            onClick={() => send?.({ type: 'config:test', providerName: editing })}
                            className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                            style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}
                            title="测试连接"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Base URL 行 */}
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">Base URL</span>
                        <input
                          value={editBaseURL}
                          onChange={e => setEditBaseURL(e.target.value)}
                          onBlur={() => saveProviderConfig()}
                          placeholder={providerEntries.find(e => e.name === editing)?.isPreset ? `默认: ${firstPartyDefault(editing)?.defaultBaseURL}` : 'https://...'}
                          className="flex-1 px-3 py-2 rounded text-xs outline-none"
                          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                      </div>

                      {/* Models API 路径（仅自定义 provider） */}
                      {!providerEntries.find(e => e.name === editing)?.isPreset && (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-medium opacity-60 shrink-0 w-20">API 路径</span>
                          <input value={editModelsPath} onChange={e => setEditModelsPath(e.target.value)}
                            placeholder="/v1/models"
                            className="flex-1 px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                      )}
                      </div>

                      {/* 模型列表 */}
                      {editing && (() => {
                      const models = localModels
                      const modelConfigs = localModelConfigs

                      const addModel = (modelId: string) => {
                        saveProviderConfig({ models: [...models, modelId] })
                      }

                      const removeModel = (modelId: string) => {
                        saveProviderConfig({ models: models.filter(m => m !== modelId) })
                      }

                      const updateModelConfig = (modelId: string, cfg: { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }) => {
                        const updated = { ...modelConfigs, [modelId]: { ...modelConfigs[modelId], ...cfg } }
                        saveProviderConfig({ modelConfigs: updated })
                      }

                      return (
                        <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--crai-border)' }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider opacity-60">已添加模型</h4>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--crai-bg-tertiary)', color: 'var(--crai-fg-tertiary)' }}>{models.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setShowAddDropdown(!showAddDropdown)
                                  if (!showAddDropdown) setSearchQuery('')
                                }}
                                className="px-2.5 py-1 rounded text-[10px] transition-colors flex items-center gap-1"
                                style={{ backgroundColor: 'var(--crai-bg-secondary)', border: '1px solid var(--crai-border)', color: 'var(--crai-fg)' }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                添加模型
                              </button>
                              <button onClick={fetchModelList}
                                disabled={fetching}
                                className="px-2.5 py-1 rounded text-[10px] transition-colors flex items-center gap-1"
                                style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)' }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                                {fetching ? '获取中…' : '获取模型'}
                              </button>
                            </div>
                          </div>

                          {/* 已添加模型列表 */}
                          {models.length > 0 ? (
                            <div className="space-y-1">
                              {models.map(m => {
                                const mc = modelConfigs[m] || {}
                                const knownCtx = getModelContextWindow(editing!, m, knownModels)
                                const ctx = mc.contextWindow ?? knownCtx
                                const displayName = mc.displayName || getKnownModelDisplayName(editing!, m, knownModels) || m
                                return (
                                  <div
                                    key={m}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
                                    style={{
                                      backgroundColor: editModel === m ? 'color-mix(in oklch, var(--crai-accent) 6%, transparent)' : 'var(--crai-bg-secondary)',
                                      border: editModel === m ? '1px solid var(--crai-accent)' : '1px solid transparent',
                                    }}
                                  >
                                    {/* 显示名 */}
                                    <span className="text-xs font-medium truncate max-w-[120px]">{displayName || m}</span>

                                    {/* 原始 ID（显示名与 ID 不同时显示） */}
                                    {displayName !== m && (
                                      <span
                                        className="text-[9px] px-1 py-0.5 rounded shrink-0 max-w-[80px] truncate"
                                        style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg-tertiary)' }}
                                      >
                                        {m}
                                      </span>
                                    )}

                                    {/* 上下文长度 */}
                                    <span className="text-[9px] opacity-50 tabular-nums shrink-0">
                                      {ctx ? `${(ctx / 1000).toFixed(0)}k` : '—'} ctx
                                    </span>

                                    {/* 视觉标记 */}
                                    {mc.vision && <span className="text-[9px] opacity-50 shrink-0">🖼</span>}

                                    {/* 操作按钮 */}
                                    <div className="flex items-center gap-1 ml-auto shrink-0">
                                      <button
                                        onClick={() => setEditingModel(m)}
                                        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:opacity-80"
                                        style={{ color: 'var(--crai-fg-tertiary)' }}
                                        title="编辑模型"
                                      >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => removeModel(m)}
                                        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:opacity-80"
                                        style={{ color: 'var(--crai-destructive)' }}
                                        title="移除模型"
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-[10px] opacity-40 py-4 text-center rounded-lg" style={{ backgroundColor: 'var(--crai-bg-secondary)' }}>
                              尚未添加模型。点击上方"添加模型"或"获取模型"。
                            </div>
                          )}

                          {/* 添加模型下拉面板 */}
                          {showAddDropdown && (
                              <div
                                className="fixed z-50 rounded-xl border overflow-hidden"
                                style={{
                                  backgroundColor: 'var(--crai-bg)',
                                  borderColor: 'var(--crai-border)',
                                  boxShadow: 'var(--crai-shadow-modal)',
                                  width: 320,
                                }}
                                onMouseDown={e => e.stopPropagation()}
                              >
                                {/* 搜索框 */}
                                <div className="px-3 pt-3 pb-2">
                                  <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索模型…"
                                    className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
                                    style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
                                  />
                                </div>

                                {/* 模型列表 */}
                                <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                                  {fetchedModels.length > 0 ? (
                                    fetchedModels.filter(m => !searchQuery || m.toLowerCase().includes(searchQuery.toLowerCase())).map(m => {
                                      const alreadyAdded = models.includes(m)
                                      const knownCtx = getModelContextWindow(editing!, m, knownModels)
                                      const mc = modelConfigs[m]
                                      const ctx = mc?.contextWindow ?? knownCtx
                                      const displayName = mc?.displayName || getKnownModelDisplayName(editing!, m, knownModels) || m
                                      return (
                                        <button
                                          key={m}
                                          onClick={() => { if (!alreadyAdded) { addModel(m); setShowAddDropdown(false) } }}
                                          className="w-full text-left px-3 py-1.5 text-[10px] transition-colors flex items-center gap-2"
                                          style={{
                                            color: alreadyAdded ? 'var(--crai-fg-tertiary)' : 'var(--crai-fg)',
                                            opacity: alreadyAdded ? 0.5 : 1,
                                          }}
                                        >
                                          <span className="flex-1 truncate">{displayName}</span>
                                          {displayName !== m && (
                                            <span className="text-[9px] opacity-40 truncate max-w-[80px]">{m}</span>
                                          )}
                                          {alreadyAdded && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--crai-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                          )}
                                          {!alreadyAdded && ctx && (
                                            <span className="text-[9px] opacity-40 tabular-nums shrink-0">
                                              {(ctx / 1000).toFixed(0)}k
                                            </span>
                                          )}
                                        </button>
                                      )
                                    })
                                  ) : (
                                    <div className="text-[10px] opacity-40 text-center py-4">
                                      先点击"获取模型"发现模型
                                    </div>
                                  )}
                                </div>

                                {/* 手动输入 */}
                                <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--crai-border)' }}>
                                  <input
                                    id="custom-model-input"
                                    placeholder="输入模型 ID"
                                    className="flex-1 px-2.5 py-1.5 rounded text-[10px] outline-none"
                                    style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        const val = (e.target as HTMLInputElement).value.trim()
                                        if (val && !models.includes(val)) {
                                          addModel(val)
                                          setShowAddDropdown(false)
                                        }
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const input = document.getElementById('custom-model-input') as HTMLInputElement
                                      const val = input?.value?.trim()
                                      if (val && !models.includes(val)) {
                                        addModel(val)
                                        setShowAddDropdown(false)
                                      }
                                    }}
                                    className="px-2 py-1.5 rounded text-[10px] text-white"
                                    style={{ backgroundColor: 'var(--crai-accent)' }}
                                  >
                                    添加
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 背景遮罩 */}
                            {showAddDropdown && (
                              <div
                                className="fixed inset-0 z-40"
                                style={{ backgroundColor: 'transparent' }}
                                onClick={() => setShowAddDropdown(false)}
                              />
                            )}

                          {/* 模型编辑弹窗 */}
                          {editingModel && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
                                onClick={() => setEditingModel(null)}
                              />
                              <div
                                className="fixed z-50 rounded-xl p-5 space-y-4"
                                style={{
                                  left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                                  width: 360,
                                  backgroundColor: 'var(--crai-bg)',
                                  border: '1px solid var(--crai-border)',
                                  boxShadow: 'var(--crai-shadow-modal)',
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">编辑模型</span>
                                  <button onClick={() => setEditingModel(null)} className="opacity-40 hover:opacity-100 text-sm">✕</button>
                                </div>

                                <div className="space-y-0.5">
                                  <label className="text-[10px] opacity-50">模型 ID</label>
                                  <div className="text-xs py-1.5 px-2 rounded" style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg-tertiary)' }}>
                                    {editingModel}
                                  </div>
                                </div>

                                <div className="space-y-0.5">
                                  <label className="text-[10px] opacity-50">显示名称（可选）</label>
                                  <input
                                    value={editFormName}
                                    onChange={e => setEditFormName(e.target.value)}
                                    placeholder={editingModel}
                                    className="w-full px-2 py-1.5 rounded text-xs outline-none"
                                    style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
                                  />
                                </div>

                                <div className="flex gap-3">
                                  <div className="flex-1 space-y-0.5">
                                    <label className="text-[10px] opacity-50">输入上下文</label>
                                    <input
                                      value={editFormCtx}
                                      onChange={e => setEditFormCtx(e.target.value.replace(/[^0-9]/g, ''))}
                                      placeholder={String(getModelContextWindow(editing!, editingModel, knownModels) || 128000)}
                                      className="w-full px-2 py-1.5 rounded text-xs outline-none tabular-nums"
                                      style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
                                    />
                                  </div>
                                  <div className="flex-1 space-y-0.5">
                                    <label className="text-[10px] opacity-50">输出上限</label>
                                    <input
                                      value={editFormMaxOut}
                                      onChange={e => setEditFormMaxOut(e.target.value.replace(/[^0-9]/g, ''))}
                                      placeholder="16384"
                                      className="w-full px-2 py-1.5 rounded text-xs outline-none tabular-nums"
                                      style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] opacity-50">支持视觉</span>
                                  <button
                                    onClick={() => setEditFormVision(!editFormVision)}
                                    className="w-8 h-4 rounded-full relative transition-colors"
                                    style={{ backgroundColor: editFormVision ? 'var(--crai-accent)' : 'var(--crai-border)' }}
                                  >
                                    <div
                                      className="w-3 h-3 rounded-full absolute top-0.5 transition-all"
                                      style={{
                                        left: editFormVision ? 'calc(100% - 16px)' : '4px',
                                        backgroundColor: '#fff',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                      }}
                                    />
                                  </button>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    onClick={() => setEditingModel(null)}
                                    className="px-3 py-1.5 rounded text-[10px]"
                                    style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={() => {
                                      const cfg: any = {}
                                      if (editFormName.trim()) cfg.displayName = editFormName.trim()
                                      if (editFormCtx) cfg.contextWindow = parseInt(editFormCtx, 10)
                                      if (editFormMaxOut) cfg.maxOutput = parseInt(editFormMaxOut, 10)
                                      cfg.vision = editFormVision
                                      updateModelConfig(editingModel!, cfg)
                                      setEditingModel(null)
                                    }}
                                    className="px-3 py-1.5 rounded text-[10px] font-medium text-white"
                                    style={{ backgroundColor: 'var(--crai-accent)' }}
                                  >
                                    保存
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}

                    {/* 保存当前配置（已移除：配置自动保存） */
                    null}
                  </div>
                )}
              </div>
            </div>

            {/* ── 全局模型设置 ── */}
            <div className="shrink-0 px-5 py-3 border-t" style={{ borderColor: 'var(--crai-border)' }}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium opacity-50 mb-1">默认对话模型</div>
                  <Select
                    value={editModel}
                    onChange={v => {
                      setEditModel(v)
                      send({ type: 'config:set', config: { defaultModel: v || undefined } })
                    }}
                    options={[
                      { value: '', label: '自动选择' },
                      ...allModelOptions.map(opt => ({ value: opt.label, label: opt.label })),
                    ]}
                    placeholder="自动选择"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium opacity-50 mb-1">工具模型</div>
                  <Select
                    value={editToolModel}
                    onChange={v => {
                      setEditToolModel(v)
                      send({ type: 'config:set', config: { toolModel: v || undefined } })
                    }}
                    options={[
                      { value: '', label: '使用默认模型' },
                      ...allModelOptions.map(opt => ({ value: opt.label, label: opt.label })),
                    ]}
                    placeholder="使用默认模型"
                  />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] opacity-40">用于对话的主模型</span>
                <span className="text-[9px] opacity-40">用于标题生成、对话摘要等辅助任务</span>
              </div>
            </div>
          </>)}

          {configTab === 'general' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              <div className="max-w-md space-y-8">
                {/* ── OS 沙箱开关 ── */}
                <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: 'var(--crai-border)', backgroundColor: 'var(--crai-bg-secondary)' }}>
                  <div>
                    <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--crai-fg)' }}>OS 沙箱模式</div>
                    <div className="text-[10px] opacity-60 leading-relaxed">启用后 bash 命令在隔离环境 (sandbox-exec/bwrap) 中执行,更安全。</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !sandboxEnabled
                      setSandboxEnabled(next)
                      send({ type: 'config:set', config: { sandboxEnabled: next } })
                    }}
                    className={'relative w-9 h-5 rounded-full transition-colors shrink-0 ' + (sandboxEnabled ? 'bg-green-500' : 'bg-gray-400')}>
                    <span className={'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ' + (sandboxEnabled ? 'translate-x-4' : 'translate-x-0')} />
                  </button>
                </div>

                {/* ── 上下文压缩 ── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-60">上下文压缩</h3>
                  </div>
                  <div className="p-4 rounded-lg border space-y-4" style={{ borderColor: 'var(--crai-border)', backgroundColor: 'var(--crai-bg-secondary)' }}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">触发阈值</span>
                        <span className="text-xs font-mono">{compressionThreshold}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={compressionThreshold}
                        onChange={e => {
                          const v = e.target.value
                          setCompressionThreshold(v)
                          const num = parseInt(v, 10)
                          send({ type: 'config:set', config: {
                            compressionThreshold: num / 100,
                            keepRecentTokens: Math.min(32000, Math.max(500, Math.round(30000 * (num / 80))))
                          } })
                        }}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--crai-accent)]"
                        style={{ backgroundColor: 'var(--crai-border)' }}
                      />
                      <p className="text-[10px] opacity-40 leading-relaxed">超过上下文窗口的此比例时自动触发压缩。较低的值会更频繁地移除旧消息以节省 Token。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="px-4 py-2 border-t text-xs shrink-0"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}
      >
        配置自动保存 · API key 已加密
      </div>
    </div>
  )
}
