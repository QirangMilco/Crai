/**
 * 配置面板。
 *
 * 两栏设计:
 *  - 提供商列表:预设 DeepSeek/OpenAI + 自定义 provider
 *  - 点击展开配置 API key、base URL(预设自带默认值)、模型列表
 *  - "获取模型"按钮调用 Models API 自动填充
 *
 * 重构说明:ConfigPanel 保留为组装器,维护所有状态逻辑,
 * JSX 渲染委托给 config/ 下的子组件。
 */
import { useState, useCallback, useEffect } from 'react'
import { DEFAULT_COMPRESSION_THRESHOLD, DEFAULT_KEEP_RECENT_TOKENS } from '@crai/core'
import { ui } from './ConfigPanel.strings'
import { ProviderList, ProviderEditor, ModelList, ModelEditModal, GlobalModelSettings, GeneralSettingsTab } from './config'

// 由服务端 knownModels prop 提供,见 config:known-models 协议。
function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>): number | undefined {
  // 先按 provider 精确匹配
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.contextWindow
  if (byProvider) return byProvider
  // 跨所有 provider 按模型名搜索
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.contextWindow) return models[model].contextWindow
    }
  }
  return undefined
}

function getKnownModelDisplayName(provider: string, model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>): string | undefined {
  // 先按 provider 精确匹配
  const byProvider = knownModels?.[provider.toLowerCase()]?.[model]?.displayName
  if (byProvider) return byProvider
  // 跨所有 provider 按模型名搜索
  if (knownModels) {
    for (const models of Object.values(knownModels)) {
      if (models[model]?.displayName) return models[model].displayName
    }
  }
  return undefined
}

/** 跨所有 provider 查找已知模型信息。 */
function findModelInfoAcrossProviders(model: string, knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>): { displayName?: string; contextWindow?: number; maxOutput?: number } | undefined {
  if (!knownModels) return undefined
  for (const models of Object.values(knownModels)) {
    if (models[model]) return models[model]
  }
  return undefined
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
  modelsFetchResult?: { providerName: string; models: string[]; error?: string } | null
  onClearModelsResult?: () => void
  configTestResult?: { ok: boolean; error?: string } | null
  onClearTestResult?: () => void
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>>
  firstParty?: Array<{ name: string; label: string; defaultBaseURL: string }>
}

export function ConfigPanel({ config, send, onClose, modelsFetchResult, onClearModelsResult, configTestResult, onClearTestResult, knownModels, firstParty }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editKey, setEditKey] = useState('')
  const [editBaseURL, setEditBaseURL] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editModelsPath, setEditModelsPath] = useState('')
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [localModels, setLocalModels] = useState<string[]>([])
  const [localModelConfigs, setLocalModelConfigs] = useState<Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }>>({})
  const [editingModel, setEditingModel] = useState<string | null>(null)
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
  }, [editingModel]) // eslint-disable-line react-hooks/exhaustive-deps

  // 当 config prop 更新时，同步本地状态
  useEffect(() => {
    if (editing && providers[editing]) {
      const p = providers[editing]
      setLocalModels(p.models ?? [])
      setLocalModelConfigs(p.modelConfigs ?? {})
    }
  }, [config, editing])

  // 自动选中第一个已配置的 provider
  useEffect(() => {
    if (!editing && providerEntries.length > 0) {
      const firstConfigured = providerEntries.find(e => e.configured)
      if (firstConfigured) {
        startEdit(firstConfigured.name)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  // 连接测试结果显示反馈
  const [testButtonState, setTestButtonState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  useEffect(() => {
    if (!configTestResult) return
    setTestButtonState(configTestResult.ok ? 'ok' : 'fail')
    const timer = setTimeout(() => { setTestButtonState('idle'); onClearTestResult?.() }, 2500)
    return () => clearTimeout(timer)
  }, [configTestResult])

  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sandboxEnabled, setSandboxEnabled] = useState(config?.sandboxEnabled ?? false)
  const [configTab, setConfigTab] = useState('providers')
  const defaultThreshold = config?.compressionThreshold != null ? Math.round(config.compressionThreshold * 100) : Math.round(DEFAULT_COMPRESSION_THRESHOLD * 100)
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
    // 优先从 knownModels 预填充发现列表，避免空列表
    const providerKey = name.toLowerCase()
    const known = knownModels?.[providerKey]
    setFetchedModels(known ? Object.keys(known) : [])
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
    if (overrides?.models) setLocalModels(overrides.models)
    if (overrides?.modelConfigs) setLocalModelConfigs(overrides.modelConfigs)
  }

  function fetchModelList() {
    if (!editing) return
    setFetching(true)
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
    setEditing(customName)
    setEditKey(customKey)
    setEditBaseURL(customBaseURL || undefined)
    setEditModel('')
    setEditModelsPath(customModelsPath || '')
    // 从 knownModels 预填充模型发现列表
    const providerKey = customName.toLowerCase()
    const known = knownModels?.[providerKey]
    if (known) setFetchedModels(Object.keys(known))
    send({ type: 'config:get' })
  }

  // 模型操作（在 ProviderEditor 之外调用 saveProviderConfig）
  const addModel = (modelId: string) => {
    // 添加模型时自动从 knownModels 继承设置
    const knownInfo = findModelInfoAcrossProviders(modelId, knownModels)
    const defaultCfg: Record<string, any> = {}
    if (knownInfo?.contextWindow) defaultCfg.contextWindow = knownInfo.contextWindow
    if (knownInfo?.maxOutput) defaultCfg.maxOutput = knownInfo.maxOutput
    if (knownInfo?.displayName) defaultCfg.displayName = knownInfo.displayName
    const hasOverrides = Object.keys(defaultCfg).length > 0

    if (hasOverrides) {
      const updated = { ...localModelConfigs, [modelId]: { ...defaultCfg } }
      saveProviderConfig({ models: [...localModels, modelId], modelConfigs: updated })
    } else {
      saveProviderConfig({ models: [...localModels, modelId] })
    }
  }

  const removeModel = (modelId: string) => {
    saveProviderConfig({ models: localModels.filter(m => m !== modelId) })
  }

  const updateModelConfig = (modelId: string, cfg: { displayName?: string; contextWindow?: number; maxOutput?: number; vision?: boolean }) => {
    const updated = { ...localModelConfigs, [modelId]: { ...localModelConfigs[modelId], ...cfg } }
    saveProviderConfig({ modelConfigs: updated })
  }

  const handleSaveModelEdit = () => {
    if (!editingModel) return
    const cfg: any = {}
    cfg.displayName = editFormName.trim() || undefined
    if (editFormCtx) cfg.contextWindow = parseInt(editFormCtx, 10)
    if (editFormMaxOut) cfg.maxOutput = parseInt(editFormMaxOut, 10)
    cfg.vision = editFormVision
    updateModelConfig(editingModel, cfg)
    setEditingModel(null)
  }

  // 合并预设 + 自定义 provider 列表
  const knownFirstParty = isDev
    ? [...(firstParty ?? []), { name: 'mock', label: ui.mockLabel, defaultBaseURL: '' }]
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

  const currentEntry = editing ? providerEntries.find(e => e.name === editing) : undefined

  // 通用设置回调
  const handleSandboxChange = (next: boolean) => {
    setSandboxEnabled(next)
    send({ type: 'config:set', config: { sandboxEnabled: next } })
  }

  const handleCompressionChange = (v: string) => {
    setCompressionThreshold(v)
    const num = parseInt(v, 10)
    send({ type: 'config:set', config: {
      compressionThreshold: num / 100,
      keepRecentTokens: Math.min(DEFAULT_KEEP_RECENT_TOKENS, Math.max(500, Math.round(DEFAULT_KEEP_RECENT_TOKENS * 0.9375 * (num / Math.round(DEFAULT_COMPRESSION_THRESHOLD * 100)))))
    } })
  }

  return (
    <div className="flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        height: '620px',
        width: '660px',
      }}>

      {/* 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">{ui.configTitle}</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity duration-150">✕</button>
      </div>

      {/* 主体:侧栏 + 内容 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧栏 Tab */}
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
              {{ providers: ui.tabProviders, general: ui.tabGeneral }[tab]}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {configTab === 'providers' && (<>
            <div className="flex-1 flex overflow-hidden">
              {/* 供应商列表 */}
              <ProviderList
                providers={providerEntries}
                editing={editing}
                onSelect={startEdit}
                onAdd={() => {
                  setEditing('__new__')
                  setCustomName('')
                  setCustomKey('')
                  setCustomBaseURL('')
                  setCustomModelsPath('')
                }}
                ui={ui as any}
              />

              {/* 右侧配置区 */}
              <div className="flex-1 overflow-y-auto p-6">
                {editing === '__new__' || !editing ? (
                  <ProviderEditor
                    editing={editing}
                    editKey={editKey}
                    editBaseURL={editBaseURL}
                    editModelsPath={editModelsPath}
                    onKeyChange={setEditKey}
                    onBaseURLChange={setEditBaseURL}
                    onPathChange={setEditModelsPath}
                    testButtonState={testButtonState}
                    isPreset={currentEntry?.isPreset ?? false}
                    customName={customName}
                    customKey={customKey}
                    customBaseURL={customBaseURL}
                    customModelsPath={customModelsPath}
                    onCustomNameChange={setCustomName}
                    onCustomKeyChange={setCustomKey}
                    onCustomBaseURLChange={setCustomBaseURL}
                    onCustomModelsPathChange={setCustomModelsPath}
                    onAddCustom={addCustomProvider}
                    ui={ui as any}
                  />
                ) : (
                  <div className="max-w-md space-y-8">
                    <ProviderEditor
                      editing={editing}
                      entry={currentEntry}
                      editKey={editKey}
                      editBaseURL={editBaseURL}
                      editModelsPath={editModelsPath}
                      onKeyChange={setEditKey}
                      onBaseURLChange={setEditBaseURL}
                      onPathChange={setEditModelsPath}
                      onBlur={() => saveProviderConfig()}
                      onTest={() => {
                        setTestButtonState('testing')
                        send?.({ type: 'config:test', providerName: editing })
                      }}
                      testButtonState={testButtonState}
                      isPreset={currentEntry?.isPreset ?? false}
                      firstPartyDefaultBaseURL={firstPartyDefault(editing)?.defaultBaseURL}
                      onDelete={() => removeProvider(editing)}
                      customName=""
                      customKey=""
                      customBaseURL=""
                      customModelsPath=""
                      onCustomNameChange={() => {}}
                      onCustomKeyChange={() => {}}
                      onCustomBaseURLChange={() => {}}
                      onCustomModelsPathChange={() => {}}
                      onAddCustom={() => {}}
                      ui={ui as any}
                    />

                    <ModelList
                      editing={editing}
                      models={localModels}
                      modelConfigs={localModelConfigs}
                      fetchedModels={fetchedModels}
                      fetching={fetching}
                      knownModels={knownModels}
                      onFetch={fetchModelList}
                      onAddModel={addModel}
                      onRemoveModel={removeModel}
                      onEditModel={setEditingModel}
                      showAddDropdown={showAddDropdown}
                      onToggleAddDropdown={() => {
                        setShowAddDropdown(!showAddDropdown)
                        if (!showAddDropdown) setSearchQuery('')
                      }}
                      onCloseAddDropdown={() => setShowAddDropdown(false)}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      ui={ui as any}
                    />

                    {editingModel && (
                      <ModelEditModal
                        editingModel={editingModel}
                        editing={editing}
                        editFormName={editFormName}
                        editFormCtx={editFormCtx}
                        editFormMaxOut={editFormMaxOut}
                        editFormVision={editFormVision}
                        onNameChange={setEditFormName}
                        onCtxChange={setEditFormCtx}
                        onMaxOutChange={setEditFormMaxOut}
                        onVisionChange={setEditFormVision}
                        onSave={handleSaveModelEdit}
                        onClose={() => setEditingModel(null)}
                        knownModels={knownModels}
                        ui={ui as any}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 全局模型设置 */}
            <GlobalModelSettings
              editModel={editModel}
              editToolModel={editToolModel}
              onDefaultModelChange={v => {
                setEditModel(v)
                send({ type: 'config:set', config: { defaultModel: v || undefined } })
              }}
              onToolModelChange={v => {
                setEditToolModel(v)
                send({ type: 'config:set', config: { toolModel: v || undefined } })
              }}
              allModelOptions={allModelOptions}
              ui={ui as any}
            />
          </>)}

          {configTab === 'general' && (
            <GeneralSettingsTab
              sandboxEnabled={sandboxEnabled}
              onSandboxChange={handleSandboxChange}
              compressionThreshold={compressionThreshold}
              onCompressionChange={handleCompressionChange}
              ui={ui as any}
            />
          )}
        </div>
      </div>

      <div
        className="px-4 py-2 border-t text-xs shrink-0"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}
      >
        {ui.autoSaveHint}
      </div>
    </div>
  )
}
