import { useState, useMemo, useCallback } from 'react'

interface SessionSummary {
  id: string
  title?: string
  createdAt: number
}

interface Props {
  sessions: SessionSummary[]
  currentSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const day = 86400000

  if (diff < day) return '今天'
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return '本周'
  if (diff < 30 * day) return '本月'
  return '更早'
}

function groupSessions(sessions: SessionSummary[]): Map<string, SessionSummary[]> {
  const groups = new Map<string, SessionSummary[]>()
  for (const s of sessions) {
    const label = formatTime(s.createdAt)
    const list = groups.get(label) ?? []
    list.push(s)
    groups.set(label, list)
  }
  return groups
}

/** 会话管理面板。覆盖在右侧。 */
export function SessionPanel({ sessions, currentSessionId, onSelect, onNew, onDelete, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter((s) => (s.title ?? s.id).toLowerCase().includes(q))
  }, [sessions, search])

  const groups = useMemo(() => groupSessions(filtered), [filtered])

  const handleDelete = useCallback((id: string) => {
    if (confirmDelete === id) {
      onDelete(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }, [confirmDelete, onDelete])

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        backgroundColor: 'var(--crai-msg-assistant-bg)',
        color: 'var(--crai-msg-assistant-fg)',
        borderLeft: '1px solid var(--crai-border)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
      }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>会话</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--crai-fg-tertiary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Search + New */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
        <input
          placeholder="搜索会话…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--crai-border)',
            backgroundColor: 'var(--crai-bg)',
            color: 'var(--crai-fg)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={onNew}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--crai-border)',
            backgroundColor: 'var(--crai-bg)',
            color: 'var(--crai-fg)',
            fontSize: 13,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          + 新
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {Array.from(groups.entries()).map(([label, items]) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crai-fg-tertiary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </div>
            {items.map((s) => {
              const isActive = s.id === currentSessionId
              const display = s.title ?? s.id.slice(0, 16)
              return (
                <div
                  key={s.id}
                  onClick={() => { if (!isActive) onSelect(s.id) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: isActive ? 'default' : 'pointer',
                    backgroundColor: isActive ? 'var(--crai-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--crai-msg-assistant-fg)',
                    fontSize: 13,
                  }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {display}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--crai-fg-tertiary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '2px 4px',
                      opacity: confirmDelete === s.id ? 1 : 0.5,
                    }}>
                    {confirmDelete === s.id ? '确认?' : '✕'}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--crai-fg-tertiary)', fontSize: 13 }}>
            {search ? '无匹配会话' : '暂无会话'}
          </div>
        )}
      </div>
    </div>
  )
}
