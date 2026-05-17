/**
 * 配置面板。
 *
 * 两栏设计：
 *  - 提供商列表：预设 DeepSeek/OpenAI + 自定义 provider
 *  - 点击展开配置 API key、base URL（预设自带默认值）、模型列表
 *  - "获取模型"按钮调用 Models API 自动填充
 */
import { useState, useCallback, useEffect } from 'react'

// ── 预设 first-party 提供商 ──

const FIRST_PARTY = [
  { name: 'deepseek', label: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com' },
  { name: 'openai', label: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1' },
] as const

interface Props {
  config: {
    providers: Record<string, { apiKey: string; baseURL?: string; models?: string[] }>
    defaultProvider?: string
    defaultModel?: string
    recentWorkspaces: string[]
  } | null
  send: (msg: any) => void
  onClose: () => void
  /** 服务端返回的模型列表结果。 */
  modelsFetchResult?: { providerName: string; models: string[]; error?: string } | null
  /** 清除模型结果（组件已消费后调用）。 */
  onClearModelsResult?: () => void
}

function maskKey(key: string): string {
  if (!key || key.length <= 8) return '********'
  return key.slice(0, 4) + '…' + key.slice(-4)
}

export function ConfigPanel({ config, send, onClose, modelsFetchResult, onClearModelsResult }: Props) {
  const [editing, setEditing] = useState<string | null>(null)     // 展开编辑的 provider name
  const [editKey, setEditKey] = useState('')                      // 编辑中的 API key
  const [editBaseURL, setEditBaseURL] = useState('')              // 编辑中的 base URL
  const [editModel, setEditModel] = useState('')                  // 编辑中的 default model
  const [editToolModel, setEditToolModel] = useState('')          // 编辑中的 tool model
  const [editModelsPath, setEditModelsPath] = useState('')        // 编辑中的 models 路径
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)

  // 自定义提供商表单
  const [customName, setCustomName] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [customModelsPath, setCustomModelsPath] = useState('')

  const providers = config?.providers ?? {}
  const isDev = (config as any)?.variant === 'dev'

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
    return FIRST_PARTY.some((fp) => fp.name === name) || (name === 'mock' && isDev)
  }, [isDev])

  const firstPartyDefault = useCallback((name: string) => {
    return FIRST_PARTY.find((fp) => fp.name === name)
  }, [])

  function startEdit(name: string) {
    const p = providers[name] ?? { apiKey: '', baseURL: '' }
    setEditing(name)
    setEditKey(p.apiKey)
    setEditBaseURL(p.baseURL || firstPartyDefault(name)?.defaultBaseURL || '')
    setEditModel(p.models?.[0] ?? config?.defaultModel ?? '')
    setEditToolModel(config?.toolModel ?? '')
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
    // 设置 defaultModel（仅当模型确实属于此 provider 时）
    if (editModel && (fetchedModels.length === 0 || fetchedModels.includes(editModel))) {
      send({ type: 'config:set', config: { defaultModel: editModel } })
    }
    // 设置 toolModel（如果不同于 defaultModel）
    if (editToolModel) send({ type: 'config:set', config: { toolModel: editToolModel, toolProvider: editing } })
    // 刷新配置 UI
    send({ type: 'config:get' })
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
    setEditKey('')
    setEditBaseURL('')
    setEditModel('')
    setEditToolModel('')
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
  const firstParty = isDev
    ? [...FIRST_PARTY, { name: 'mock', label: 'Mock（测试）', defaultBaseURL: '' }]
    : FIRST_PARTY
  const providerEntries = [
    ...firstParty.map((fp) => ({
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
    <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        borderLeft: 'var(--crai-border-width, 1px) solid var(--crai-border)',
        boxShadow: 'var(--crai-shadow-modal)',
      }}>

      {/* 标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">配置</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

        {/* ── Provider 列表 ── */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--crai-fg-secondary)' }}>Provider</div>
          {providerEntries.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>暂无 provider。</div>
          )}
          <div className="space-y-1.5">
            {providerEntries.map((entry) => (
              <div key={entry.name}>
                {/* 列表项 */}
                <button
                  onClick={() => startEdit(entry.name)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left"
                  style={{
                    backgroundColor: editing === entry.name ? 'var(--crai-bg-tertiary)' : 'transparent',
                    border: '1px solid var(--crai-border)',
                  }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{entry.label}</div>
                    <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
                      {entry.configured ? maskKey(entry.apiKey) : '未配置'}
                      {entry.models.length > 0 && ` · ${entry.models.length} 个模型`}
                    </div>
                  </div>
                  <span className="text-xs ml-2" style={{ color: 'var(--crai-fg-tertiary)' }}>▶</span>
                </button>

                {/* 展开编辑区 */}
                {editing === entry.name && (
                  <div className="mt-1.5 ml-2 pl-3 border-l-2 space-y-2 py-2"
                    style={{ borderColor: 'var(--crai-accent)' }}>
                    <div>
                      <div className="text-[10px] mb-0.5" style={{ color: 'var(--crai-fg-tertiary)' }}>API Key</div>
                      <input value={editKey} onChange={e => setEditKey(e.target.value)}
                        type="password" placeholder="sk-..."
                        className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
                        style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                    </div>
                    <div>
                      <div className="text-[10px] mb-0.5" style={{ color: 'var(--crai-fg-tertiary)' }}>Base URL</div>
                      <input value={editBaseURL} onChange={e => setEditBaseURL(e.target.value)}
                        placeholder={entry.isPreset ? `默认: ${entry.baseURL}` : 'https://...'}
                        className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
                        style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                    </div>
                    {!entry.isPreset && (
                      <div>
                        <div className="text-[10px] mb-0.5" style={{ color: 'var(--crai-fg-tertiary)' }}>Models API 路径</div>
                        <input value={editModelsPath} onChange={e => setEditModelsPath(e.target.value)}
                          placeholder="/models"
                          className="w-full px-2.5 py-1.5 rounded text-xs outline-none"
                          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                      </div>
                    )}
                    {/* 模型选择和获取按钮 */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>默认模型</span>
                        <button onClick={fetchModelList}
                          disabled={fetching}
                          className="text-[10px] px-2 py-0.5 rounded"
                          style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)' }}>
                          {fetching ? '获取中…' : '获取模型列表'}
                        </button>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {fetchedModels.length > 0 ? fetchedModels.map((m) => (
                          <button key={m} onClick={() => setEditModel(m)}
                            className="text-[10px] px-2 py-0.5 rounded transition-colors"
                            style={{
                              backgroundColor: editModel === m ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
                              color: editModel === m ? '#fff' : 'var(--crai-fg)',
                            }}>
                            {m}
                          </button>
                        )) : entry.configured ? (
                          <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>
                            {entry.models.length > 0 ? '点击模型选择' : '点击"获取模型列表"'}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>
                            请先保存 API key
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 工具模型选择 */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>工具模型（用于工具调用）</span>
                        <span className="text-[9px]" style={{ color: 'var(--crai-fg-tertiary)' }}>未设置时使用默认模型</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {fetchedModels.length > 0 ? (
                          <>
                            <button onClick={() => setEditToolModel('')}
                              className="text-[10px] px-2 py-0.5 rounded transition-colors"
                              style={{
                                backgroundColor: !editToolModel ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
                                color: !editToolModel ? '#fff' : 'var(--crai-fg)',
                              }}>同默认模型</button>
                            {fetchedModels.map((m) => (
                              <button key={m} onClick={() => setEditToolModel(m)}
                                className="text-[10px] px-2 py-0.5 rounded transition-colors"
                                style={{
                                  backgroundColor: editToolModel === m ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
                                  color: editToolModel === m ? '#fff' : 'var(--crai-fg)',
                                }}>
                                {m}
                              </button>
                            ))}
                          </>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>请先获取模型列表</span>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveEdit}
                        className="flex-1 py-1.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: 'var(--crai-accent)' }}>保存</button>
                      <button onClick={cancelEdit}
                        className="px-3 py-1.5 rounded text-xs"
                        style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>取消</button>
                      {!entry.isPreset && (
                        <button onClick={() => removeProvider(entry.name)}
                          className="px-3 py-1.5 rounded text-xs"
                          style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}>删除</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 添加自定义 provider ── */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--crai-fg-secondary)' }}>添加自定义 Provider</div>
          <div className="space-y-2">
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="名称 (如：my-llm)"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <input value={customKey} onChange={e => setCustomKey(e.target.value)}
              placeholder="API Key" type="password"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <input value={customBaseURL} onChange={e => setCustomBaseURL(e.target.value)}
              placeholder="Base URL (必填，如 https://api.xxx.com/v1)"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <input value={customModelsPath} onChange={e => setCustomModelsPath(e.target.value)}
              placeholder="Models API 路径 (可选，默认 /models)"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <button onClick={addCustomProvider}
              disabled={!customName || !customKey}
              className="w-full py-2 rounded text-xs font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--crai-accent)' }}>添加</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t text-xs shrink-0"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>
        配置自动保存 · API key 已加密
      </div>
    </div>
  )
}
