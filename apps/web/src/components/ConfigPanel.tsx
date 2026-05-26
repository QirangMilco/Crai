/**
 * 配置面板。
 *
 * 两栏设计：
 *  - 提供商列表：预设 DeepSeek/OpenAI + 自定义 provider
 *  - 点击展开配置 API key、base URL（预设自带默认值）、模型列表
 *  - "获取模型"按钮调用 Models API 自动填充
 */
import { useState, useCallback, useEffect } from 'react'
import { Select } from './ui'

// 由服务端 knownModels prop 提供，见 config:known-models 协议。
// 不再硬编码。
function getModelContextWindow(provider: string, model: string, knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>): number | undefined {
  return knownModels?.[provider]?.[model]?.contextWindow
}

interface Props {
  config: {
    providers: Record<string, { apiKey: string; baseURL?: string; models?: string[] }>
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
  /** 清除模型结果（组件已消费后调用）。 */
  onClearModelsResult?: () => void
  /** 已知模型窗口数据，由服务端提供。 */
  knownModels?: Record<string, Record<string, { contextWindow: number; maxOutput?: number }>>
  /** 第一方 provider 列表，由服务端提供。 */
  firstParty?: Array<{ name: string; label: string; defaultBaseURL: string }>
}

function maskKey(key: string): string {
  if (!key || key.length <= 8) return '********'
  return key.slice(0, 4) + '…' + key.slice(-4)
}

export function ConfigPanel({ config, send, onClose, modelsFetchResult, onClearModelsResult, knownModels, firstParty }: Props) {
  const [editing, setEditing] = useState<string | null>(null)     // 展开编辑的 provider name
  const [editKey, setEditKey] = useState('')                      // 编辑中的 API key
  const [editBaseURL, setEditBaseURL] = useState('')              // 编辑中的 base URL
  const [editModel, setEditModel] = useState('')                  // 编辑中的 default model
  const [editModelsPath, setEditModelsPath] = useState('')        // 编辑中的 models 路径
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  // 每个模型的上下文窗口覆盖（从已保存配置读取）
  const [editContextWindows, setEditContextWindows] = useState<Record<string, string>>(
    () => Object.fromEntries(
      Object.entries(config?.customContextWindows ?? {}).map(([k, v]) => [k, String(v)])
    )
  )
  const [sandboxEnabled, setSandboxEnabled] = useState(config?.sandboxEnabled ?? false)
  const [configTab, setConfigTab] = useState('providers')
  // 压缩阈值（显示为百分比整数，如 80 表示 80%）
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
  // 当前选中的工具模型（格式：provider/model）
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
    setEditModel(p.models?.[0] ?? config?.defaultModel ?? '')
    setEditModelsPath((p as any).modelsPath ?? '')
    setFetchedModels(p.models ?? [])
  }

  function saveEdit() {
    if (!editing) return
    send({ type: 'config:set:provider', name: editing, config: {
      apiKey: editKey,
      baseURL: editBaseURL || undefined,
      models: fetchedModels.length > 0 ? fetchedModels : undefined,
      modelsPath: editModelsPath || undefined,
    }})
    // 设置 defaultModel（格式：provider/model）
    if (editModel && (fetchedModels.length === 0 || fetchedModels.includes(editModel))) {
      send({ type: 'config:set', config: { defaultModel: `${editing}/${editModel}` } })
    }
    // 刷新配置 UI
    send({ type: 'config:get' })
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
    setEditKey('')
    setEditBaseURL('')
    setEditModel('')
    setFetchedModels([])
  }

  function fetchModelList() {
    if (!editing) return
    setFetching(true)
    // 通过 WebSocket 走服务端代理（Mock 无网络、真实 provider 不暴露 API key）
    send({ type: 'config:fetch:models', providerName: editing })
  }

  function removeProvider(name: string) {
    send({ type: 'config:remove:provider', name })
    if (editing === name) cancelEdit()
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
  }

  // 合并预设 + 自定义 provider 列表
  const knownFirstParty = isDev
    ? [...(firstParty ?? []), { name: 'mock', label: 'Mock（测试）', defaultBaseURL: '' }]
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
        height: '600px', // 固定高度
        width: '800px',  // 增加宽度以适应内部双栏
      }}>

      {/* 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">配置</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity duration-150">✕</button>
      </div>

      {/* 主体：侧栏 + 内容 */}
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
          {configTab === 'providers' && (
            <div className="flex-1 flex overflow-hidden">
              {/* 供应商列表（内部左侧栏） */}
              <div className="w-48 shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--crai-border)' }}>
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

              {/* 具体配置（内部右侧内容区） */}
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
                            placeholder="如：my-llm"
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

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">API Key</label>
                          <input value={editKey} onChange={e => setEditKey(e.target.value)}
                            type="password" placeholder="sk-..."
                            autoComplete="new-password"
                            spellCheck={false}
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium opacity-60">Base URL</label>
                          <input value={editBaseURL} onChange={e => setEditBaseURL(e.target.value)}
                            placeholder={providerEntries.find(e => e.name === editing)?.isPreset ? `默认: ${firstPartyDefault(editing)?.defaultBaseURL}` : 'https://...'}
                            className="w-full px-3 py-2 rounded text-xs outline-none"
                            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                        </div>
                        {!providerEntries.find(e => e.name === editing)?.isPreset && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium opacity-60">Models API 路径</label>
                            <input value={editModelsPath} onChange={e => setEditModelsPath(e.target.value)}
                              placeholder="/v1/models"
                              className="w-full px-3 py-2 rounded text-xs outline-none"
                              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 模型设置 */}
                    <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--crai-border)' }}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider opacity-60">模型列表</h4>
                        <button onClick={fetchModelList}
                          disabled={fetching}
                          className="text-[10px] px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)' }}>
                          {fetching ? '获取中…' : '刷新列表'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-medium opacity-60">默认对话模型</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {fetchedModels.length > 0 ? fetchedModels.map((m) => (
                              <div key={m} className="flex items-center gap-1">
                                <button onClick={() => setEditModel(m)}
                                  className="text-[10px] px-2 py-1 rounded transition-colors whitespace-nowrap"
                                  style={{
                                    backgroundColor: editModel === m ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
                                    color: editModel === m ? '#fff' : 'var(--crai-fg)',
                                  }}>
                                  {m}
                                </button>
                                <input
                                  value={editContextWindows[`${editing}/${m}`] ?? ''}
                                  onChange={e => {
                                    const v = e.target.value.replace(/[^0-9]/g, '')
                                    setEditContextWindows(prev => ({ ...prev, [`${editing}/${m}`]: v }))
                                  }}
                                  onBlur={() => {
                                    const cleaned: Record<string, number> = {}
                                    for (const [k, val] of Object.entries(editContextWindows)) {
                                      const n = parseInt(val, 10)
                                      if (n > 0) cleaned[k] = n
                                    }
                                    send({ type: 'config:set', config: { customContextWindows: cleaned } })
                                  }}
                                  placeholder={getModelContextWindow(editing, m, knownModels) ? String(getModelContextWindow(editing, m, knownModels)) : '128000'}
                                  className="w-14 px-1 py-0.5 rounded text-[9px] outline-none text-center"
                                  style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}
                                  title="上下文窗口（token）"
                                />
                              </div>
                            )) : (
                              <span className="text-[10px] opacity-40">点击“刷新列表”获取可用模型</span>
                            )}
                          </div>
                        </div>

                        {/* 工具模型设置集成在此 */}
                        <div className="space-y-2 pt-2">
                          <label className="text-[11px] font-medium opacity-60">工具模型 (用于摘要等任务)</label>
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
                          <p className="text-[9px] opacity-40">用于标题生成、对话摘要等辅助任务。不设置时使用对话默认模型。</p>
                        </div>
                      </div>
                    </div>

                    {/* 保存按钮 */}
                    <div className="pt-4">
                      <button onClick={saveEdit}
                        className="w-full py-2.5 rounded text-xs font-medium text-white shadow-sm"
                        style={{ backgroundColor: 'var(--crai-accent)' }}>保存当前配置</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {configTab === 'general' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              <div className="max-w-md space-y-8">
                {/* ── OS 沙箱开关 ── */}
                <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: 'var(--crai-border)', backgroundColor: 'var(--crai-bg-secondary)' }}>
                  <div>
                    <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--crai-fg)' }}>OS 沙箱模式</div>
                    <div className="text-[10px] opacity-60 leading-relaxed">启用后 bash 命令在隔离环境 (sandbox-exec/bwrap) 中执行，更安全。</div>
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
