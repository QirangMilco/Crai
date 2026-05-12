/** 配置面板组件。 */
import { useState, useEffect } from 'react'

interface ProviderEntry {
  name: string
  apiKey: string
  baseURL?: string
  models?: string[]
}

interface Props {
  /** 当前全局配置。 */
  config: {
    providers: Record<string, { apiKey: string; baseURL?: string; models?: string[] }>
    defaultProvider?: string
    defaultModel?: string
    recentWorkspaces: string[]
  } | null
  /** 发送配置相关消息到 server。 */
  send: (msg: any) => void
  onClose: () => void
}

export function ConfigPanel({ config, send, onClose }: Props) {
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderKey, setNewProviderKey] = useState('')
  const [newProviderBaseURL, setNewProviderBaseURL] = useState('')

  useEffect(() => {
    if (config) {
      setProviders(
        Object.entries(config.providers).map(([name, p]) => ({
          name,
          apiKey: maskKey(p.apiKey),
          baseURL: p.baseURL,
          models: p.models,
        })),
      )
    }
  }, [config])

  function addProvider() {
    if (!newProviderName || !newProviderKey) return
    send({ type: 'config:set:provider', name: newProviderName, config: { apiKey: newProviderKey, baseURL: newProviderBaseURL || undefined } })
    setNewProviderName('')
    setNewProviderKey('')
    setNewProviderBaseURL('')
  }

  function removeProvider(name: string) {
    send({ type: 'config:remove:provider', name })
  }

  return (
    <div
      className="fixed top-0 right-0 h-full w-80 z-50 shadow-2xl flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        borderLeft: '1px solid var(--crai-border)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">配置</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* 已有 provider */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--crai-fg-secondary)' }}>Provider</div>
          {providers.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>暂无 provider。请添加。 </div>
          )}
          {providers.map((p) => (
            <div key={p.name} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--crai-border)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>{p.apiKey}</div>
              </div>
              <button onClick={() => removeProvider(p.name)} className="text-xs px-2 py-1 rounded shrink-0 ml-2"
                style={{ color: 'var(--crai-destructive)' }}>删除</button>
            </div>
          ))}
        </div>

        {/* 添加新 provider */}
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: 'var(--crai-fg-secondary)' }}>添加 Provider</div>
          <div className="space-y-2">
            <input value={newProviderName} onChange={e => setNewProviderName(e.target.value)}
              placeholder="名称 (openai / deepseek)"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <input value={newProviderKey} onChange={e => setNewProviderKey(e.target.value)}
              placeholder="API Key"
              type="password"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <input value={newProviderBaseURL} onChange={e => setNewProviderBaseURL(e.target.value)}
              placeholder="Base URL (可选，留空使用默认)"
              className="w-full px-3 py-2 rounded text-xs outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
            <button onClick={addProvider}
              disabled={!newProviderName || !newProviderKey}
              className="w-full py-2 rounded text-xs font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--crai-accent)' }}>添加</button>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t text-xs" style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>
        配置自动保存到 ~/.crai/config.json
      </div>
    </div>
  )
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}
