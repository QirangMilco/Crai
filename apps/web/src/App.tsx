import { useState, useEffect, useCallback } from 'react'
import { ChatView } from './components/ChatView'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Eye, EyeOff } from 'lucide-react'
import { applyTokens } from './theme/tokens'

// ── Connection Profile ──

interface ConnectionProfile {
  id: string
  label: string
  url: string
  token: string
  lastConnected: number
}

const STORAGE_KEY = 'crai:connections'
const LAST_CONNECTED_KEY = 'crai:last-connected'

function loadProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveProfiles(profiles: ConnectionProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

function buildWsUrl(url: string, token: string): string {
  const u = new URL(url.startsWith('ws') ? url : `ws://${url}`)
  if (token) u.searchParams.set('token', token)
  return u.toString()
}

// ── Utility Components ──

// ── Connect Screen ──

function ConnectScreen({ onConnect }: { onConnect: (wsUrl: string) => void }) {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formUrl, setFormUrl] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formToken, setFormToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    const loaded = loadProfiles()
    setProfiles(loaded)

    // 尝试自动连接到最后使用的连接
    const lastId = localStorage.getItem(LAST_CONNECTED_KEY)
    if (lastId) {
      const lastProfile = loaded.find((p) => p.id === lastId)
      if (lastProfile) {
        onConnect(buildWsUrl(lastProfile.url, lastProfile.token))
        return
      }
    }
    // 如果只有一个已保存连接，自动连接
    if (loaded.length === 1) {
      onConnect(buildWsUrl(loaded[0].url, loaded[0].token))
    }
  }, [onConnect])

  const addProfile = useCallback(() => {
    if (!formUrl.trim()) return
    const url = formUrl.trim()
    const label = formLabel.trim() || url
    const id = `conn_${Date.now()}`
    const profile: ConnectionProfile = { id, label, url, token: formToken.trim(), lastConnected: Date.now() }
    const updated = [...profiles, profile]
    setProfiles(updated)
    saveProfiles(updated)
    setShowNew(false)
    setFormUrl('')
    setFormLabel('')
    setFormToken('')
    setConnecting(id)
    setTimeout(() => onConnect(buildWsUrl(url, profile.token)), 0)
  }, [profiles, formUrl, formLabel, formToken, onConnect])

  const updateProfile = useCallback(() => {
    if (!editId || !formUrl.trim()) return
    const url = formUrl.trim()
    const label = formLabel.trim() || url
    const updated = profiles.map((p) =>
      p.id === editId ? { ...p, label, url, token: formToken.trim() } : p
    )
    setProfiles(updated)
    saveProfiles(updated)
    setEditId(null)
    setFormUrl('')
    setFormLabel('')
    setFormToken('')
  }, [editId, formUrl, formLabel, formToken, profiles])

  const deleteProfile = useCallback((id: string) => {
    const updated = profiles.filter((p) => p.id !== id)
    setProfiles(updated)
    saveProfiles(updated)
    if (editId === id) { setEditId(null); setFormUrl(''); setFormLabel(''); setFormToken('') }
  }, [profiles, editId])

  const handleConnect = useCallback((profile: ConnectionProfile) => {
    setConnecting(profile.id)
    localStorage.setItem(LAST_CONNECTED_KEY, profile.id)
    // 更新 lastConnected
    const updated = profiles.map((p) =>
      p.id === profile.id ? { ...p, lastConnected: Date.now() } : p
    )
    setProfiles(updated)
    saveProfiles(updated)
    onConnect(buildWsUrl(profile.url, profile.token))
  }, [profiles, onConnect])

  const startEdit = useCallback((profile: ConnectionProfile) => {
    setEditId(profile.id)
    setFormUrl(profile.url)
    setFormLabel(profile.label)
    setFormToken(profile.token)
    setShowNew(false)
  }, [])

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div
      className="h-dvh flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color: 'var(--crai-accent)' }}>Crai</div>
          <p className="text-sm mt-1" style={{ color: 'var(--crai-fg-secondary)' }}>
            连接到 Crai Runtime
          </p>
        </div>

        {/* 已保存连接列表 */}
        {!showNew && !editId && (
          <div className="flex flex-col gap-1.5">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'var(--crai-bg-secondary)',
                  border: '1px solid var(--crai-border)',
                }}
                onClick={() => handleConnect(p)}
              >
                <span style={{ fontSize: 16 }}>🖥</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{p.label}</div>
                  <div className="text-xs" style={{ color: 'var(--crai-fg-40)' }}>
                    {p.url} · {formatDate(p.lastConnected)}
                  </div>
                </div>
                {connecting === p.id ? (
                  <span className="text-xs" style={{ color: 'var(--crai-accent)' }}>连接中…</span>
                ) : null}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => startEdit(p)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:opacity-80"
                    style={{ color: 'var(--crai-fg-secondary)' }}
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => deleteProfile(p.id)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:opacity-80"
                    style={{ color: 'var(--crai-destructive)' }}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => { setShowNew(true); setEditId(null); setFormUrl(''); setFormLabel(''); setFormToken('') }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                border: '1px dashed var(--crai-border)',
                color: 'var(--crai-fg-secondary)',
              }}
            >
              <span>➕</span> 添加连接
            </button>
          </div>
        )}

        {/* 添加/编辑表单 */}
        {(showNew || editId) && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium" style={{ color: 'var(--crai-fg-secondary)' }}>
              {editId ? '编辑连接' : '新连接'}
            </div>
            <input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="标签（可选）"
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                color: 'var(--crai-fg)',
                border: '1px solid var(--crai-border)',
              }}
            />
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="ws://127.0.0.1:8080"
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                color: 'var(--crai-fg)',
                border: '1px solid var(--crai-border)',
              }}
            />
            <div className="relative">
              <input
                value={formToken}
                onChange={(e) => setFormToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="访问密钥（可选）"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--crai-bg-secondary)',
                  color: 'var(--crai-fg)',
                  border: '1px solid var(--crai-border)',
                }}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: 'var(--crai-fg-40)' }}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={editId ? updateProfile : addProfile}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--crai-accent)' }}
              >
                {editId ? '保存' : '连接'}
              </button>
              <button
                onClick={() => { setShowNew(false); setEditId(null); setFormUrl(''); setFormLabel(''); setFormToken('') }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  color: 'var(--crai-fg-secondary)',
                  border: '1px solid var(--crai-border)',
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── App ──

export default function App() {
  useEffect(() => { applyTokens() }, [])
  const [wsUrl, setWsUrl] = useState<string | null>(null)

  const handleConnect = useCallback((url: string) => {
    setWsUrl(url)
  }, [])

  if (!wsUrl) {
    return <ConnectScreen onConnect={handleConnect} />
  }

  return (
    <ErrorBoundary onError={() => console.warn('ErrorBoundary caught an error, user can retry')}>
      <ChatView wsUrl={wsUrl} onDisconnect={(url?: string) => { if (url) setWsUrl(url); else setWsUrl(null) }} />
    </ErrorBoundary>
  )
}
