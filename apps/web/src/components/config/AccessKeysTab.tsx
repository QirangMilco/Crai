/**
 * AccessKeysTab — 访问密钥管理面板。
 *
 * 使用 request-response 模式: 发送请求后等待下一次消息响应。
 * 通过 send 发送请求，通过全局 WebSocket 消息回调接收响应。
 *
 * 基于 OpenHanako device-registry 设计理念。
 */
import { useState, useCallback, useEffect, useRef } from 'react'

interface AuthKey {
  id: string
  description: string
  createdAt: string
  lastUsedAt: string | null
  status: 'active' | 'revoked'
}

interface Props {
  send: (msg: any) => void
  ui: Record<string, string>
}

// 模块级消息匹配器：AccessKeysTab 注册回调，全局 WebSocket 消息 handler 调用这些回调
const pendingCallbacks = new Map<string, (payload: any) => void>()

/** 由 ChatView 或 ConfigPanel 在收到 WebSocket 消息时调用 */
export function dispatchAuthResponse(msg: any) {
  const cb = pendingCallbacks.get(msg.type)
  if (cb) {
    cb(msg)
    if (msg.type !== 'config:auth:list:data') {
      // 列表响应可重复触发（刷新），其他是一次性的
      pendingCallbacks.delete(msg.type)
    }
  }
}

function waitForResponse<T>(type: string, timeout = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCallbacks.delete(type)
      reject(new Error('响应超时'))
    }, timeout)
    pendingCallbacks.set(type, (payload) => {
      clearTimeout(timer)
      resolve(payload as T)
    })
  })
}

export function AccessKeysTab({ send, ui }: Props) {
  const [keys, setKeys] = useState<AuthKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState<{ rawToken: string; info: AuthKey } | null>(null)
  const [genDesc, setGenDesc] = useState('')
  const [copied, setCopied] = useState(false)
  const tokenRef = useRef<HTMLInputElement>(null)

  // 加载密钥列列表
  const loadKeys = useCallback(async () => {
    setLoading(true)
    send({ type: 'config:auth:list' })
    try {
      const data = await waitForResponse<{ keys: AuthKey[] }>('config:auth:list:data')
      setKeys(data.keys)
    } catch {
      // 超时或错误，保持现有数据
    }
    setLoading(false)
  }, [send])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const copyToken = useCallback(() => {
    if (!newKey) return
    navigator.clipboard.writeText(newKey.rawToken).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [newKey])

  const handleGenerate = useCallback(async () => {
    if (!genDesc.trim()) return
    send({ type: 'config:auth:generate', description: genDesc.trim() })
    try {
      const data = await waitForResponse<{ rawToken: string; info: AuthKey }>('config:auth:generated')
      setNewKey({ rawToken: data.rawToken, info: data.info })
      setGenDesc('')
      loadKeys()
    } catch {
      // 错误处理
    }
  }, [genDesc, send, loadKeys])

  const handleRevoke = useCallback(async (id: string) => {
    if (!window.confirm('删除后将断开所有使用该密钥的连接，确定继续？')) return
    send({ type: 'config:auth:revoke', id })
    try {
      await waitForResponse('config:auth:revoked')
      loadKeys()
    } catch {
      // 错误处理
    }
  }, [send, loadKeys])

  const formatTime = (ts: string | null) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  if (loading) {
    return <div className="text-sm" style={{ color: 'var(--crai-fg-secondary)' }}>加载中…</div>
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* 新生成的密钥 */}
      {newKey && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--crai-bg-3)', border: '1px solid var(--crai-accent)' }}>
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--crai-accent)' }}>
            {ui.authNewKeyGenerated}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={tokenRef}
              readOnly
              value={newKey.rawToken}
              className="flex-1 px-3 py-2 rounded text-xs font-mono outline-none"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copyToken}
              className="px-3 py-2 rounded text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--crai-accent)', color: '#fff' }}
            >
              {copied ? ui.authCopySuccess : ui.authCopy}
            </button>
          </div>
          <div className="text-xs" style={{ color: 'var(--crai-fg-40)' }}>
            {newKey.info.description} · {formatTime(newKey.info.createdAt)}
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs underline"
            style={{ color: 'var(--crai-fg-40)' }}
          >
            关闭
          </button>
        </div>
      )}

      {/* 密钥列表 */}
      {keys.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--crai-fg-40)' }}>{ui.authNoKeys || '暂无访问密钥'}</div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ backgroundColor: 'var(--crai-bg-secondary)', border: '1px solid var(--crai-border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{key.description}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: key.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: key.status === 'active' ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                    }}
                  >
                    {key.status === 'active' ? (ui.authKeyActive || '活跃') : (ui.authKeyRevoked || '已吊销')}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--crai-fg-40)' }}>
                  {ui.authKeyCreated || '创建时间'}: {formatTime(key.createdAt)}
                  {key.lastUsedAt ? ` · ${ui.authKeyLastUsed || '上次使用'}: ${formatTime(key.lastUsedAt)}` : ''}
                </div>
              </div>
              {key.status === 'active' && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="px-2.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}
                >
                  {ui.authRevoke || '吊销'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 刷新 */}
      <button
        onClick={loadKeys}
        className="text-xs underline"
        style={{ color: 'var(--crai-fg-40)' }}
      >
        刷新
      </button>

      {/* 生成新密钥 */}
      <div className="pt-2 border-t" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="text-sm font-medium mb-2">{ui.authGenerate || '生成新密钥'}</div>
        <div className="flex items-center gap-2">
          <input
            value={genDesc}
            onChange={(e) => setGenDesc(e.target.value)}
            placeholder={ui.authKeyNamePrompt || '输入密钥名称…'}
            className="flex-1 px-3 py-2 rounded text-sm outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && genDesc.trim()) handleGenerate() }}
          />
          <button
            onClick={handleGenerate}
            disabled={!genDesc.trim()}
            className="px-4 py-2 rounded text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: 'var(--crai-accent)' }}
          >
            {ui.authGenerate || '生成'}
          </button>
        </div>
      </div>
    </div>
  )
}
