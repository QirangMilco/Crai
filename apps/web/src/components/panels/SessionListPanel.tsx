/**
 * SessionListPanel — 左侧栏会话列表面板。
 *
 * 时间分组 + 搜索 + 右键/菜单操作（置顶/重命名/归档/删除）
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { X, MoreHorizontal, Pin, PinOff, Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import { Icon } from '../ui'

interface SessionSummary {
  id: string
  title?: string
  createdAt: number
  pinned?: boolean
  archived?: boolean
}

interface Props {
  sessions: SessionSummary[]
  currentSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onUpdate?: (id: string, updates: { title?: string; pinned?: boolean; archived?: boolean }) => void
  width: number
  hovered: boolean
  loading?: boolean
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60000; const hour = 3600000; const day = 86400000
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  const d = new Date(ts)
  const now = new Date()
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function timeGroup(ts: number): string {
  const diff = Date.now() - ts
  const day = 86400000
  if (diff < day) return '今天'
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return '本周'
  if (diff < 30 * day) return '本月'
  return '更早'
}

const GROUP_PRIORITY: Record<string, number> = { '置顶': -1, '今天': 0, '昨天': 1, '本周': 2, '本月': 3, '更早': 4 }

export function SessionListPanel({ sessions, currentSessionId, onSelect, onNew, onDelete, onUpdate, width, hovered, loading }: Props) {
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuSession, setMenuSession] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [archivedView, setArchivedView] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hovered) searchRef.current?.focus()
  }, [hovered])

  // 所有归档会话（搜索时也匹配）
  const archivedList = useMemo(() => {
    let list = sessions.filter(s => s.archived)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => (s.title ?? s.id).toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt)
  }, [sessions, search])

  const archivedCount = useMemo(() => sessions.filter(s => s.archived).length, [sessions])

  // 根据模式决定显示的会话
  const filtered = useMemo(() => {
    if (archivedView) return archivedList
    let list = sessions.filter(s => !s.archived)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => (s.title ?? s.id).toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
  }, [sessions, search, archivedView, archivedList])

  // 分组
  const groups = useMemo(() => {
    const g = new Map<string, SessionSummary[]>()
    for (const s of filtered) {
      const label = s.pinned ? '置顶' : timeGroup(s.createdAt)
      const list = g.get(label) ?? []
      list.push(s)
      g.set(label, list)
    }
    return g
  }, [filtered])

  const groupKeys = useMemo(() =>
    Array.from(groups.keys()).sort((a, b) => (GROUP_PRIORITY[a] ?? 99) - (GROUP_PRIORITY[b] ?? 99)),
  [groups])

  const closeMenu = useCallback(() => { setMenuSession(null); setMenuPos(null); setRenameId(null) }, [])

  const startRename = useCallback((id: string, title?: string) => {
    setRenameId(id); setRenameValue(title ?? ''); setMenuSession(null); setMenuPos(null)
  }, [])

  const commitRename = useCallback((id: string) => {
    onUpdate?.(id, { title: renameValue || undefined })
    setRenameId(null)
  }, [renameValue, onUpdate])

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setRenameId(null)
    setMenuSession(id)
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    if (!menuPos) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuPos, closeMenu])

  const handleDelete = useCallback((id: string) => {
    if (confirmDelete === id) { onDelete(id); setConfirmDelete(null); closeMenu() }
    else { setConfirmDelete(id) }
  }, [confirmDelete, onDelete, closeMenu])

  return (
    <div className="flex flex-col h-full select-none" style={{ minWidth: 0 }}>
      {/* 搜索 + 新建 */}
      <div className="shrink-0 flex items-center gap-1 px-3 pt-2 pb-2">
        <div className="relative flex-1">
          <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话…"
            className="w-full text-xs px-2 py-1.5 rounded outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--crai-fg-tertiary)' }}>
              <Icon icon={X} size="xs" />
            </button>
          )}
        </div>
        {!archivedView && archivedCount > 0 && (
          <button onClick={() => { setArchivedView(true); setSearch('') }}
            className="text-[10px] px-2 py-1.5 rounded flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors duration-100"
            style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--crai-accent)'}
            onMouseLeave={(e) => e.currentTarget.style.border = '1px solid var(--crai-border)'}>
            <Archive size={10} />
            归档{archivedCount}
          </button>
        )}
        <button onClick={onNew}
          className="text-[10px] px-2 py-1.5 rounded font-medium text-white shrink-0"
          style={{ backgroundColor: 'var(--crai-accent)' }}>+ 新建</button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <LoaderSpinner />
            <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>加载会话列表…</div>
          </div>
        ) : archivedView ? (
          <>
            <div className="flex items-center gap-1 px-1 py-1 mb-1">
              <button onClick={() => setArchivedView(false)}
                className="text-[10px] font-medium"
                style={{ color: 'var(--crai-accent)' }}>
                ← 返回
              </button>
              <span className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>
                归档会话
              </span>
            </div>
            {archivedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
                  {search ? '无匹配归档' : '暂无归档'}
                </div>
              </div>
            ) : (
              archivedList.map((s) => {
                const isRenaming = renameId === s.id
                return (
                  <div key={s.id}
                    onContextMenu={(e) => handleContextMenu(e, s.id)}
                    className="group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors duration-150"
                    style={{
                      backgroundColor: s.id === currentSessionId ? 'var(--crai-bg-tertiary)' : 'transparent',
                      color: 'var(--crai-fg)',
                      opacity: 0.65,
                    }}
                    onClick={() => { if (!isRenaming) onSelect(s.id) }}>
                    {isRenaming ? (
                      <input autoFocus value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(s.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenameId(null) }}
                        className="flex-1 text-xs px-1 py-0.5 rounded outline-none min-w-0"
                        style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', border: '1px solid var(--crai-accent)' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-xs truncate">{s.title ?? s.id.slice(0, 12)}</span>
                    )}
                    {!isRenaming && (
                      <span className="shrink-0 text-[10px] tabular-nums opacity-70" style={{ color: 'var(--crai-fg-40)' }}>
                        {relativeTime(s.createdAt)}
                      </span>
                    )}
                    {!isRenaming && (
                      <button onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuSession(menuSession === s.id ? null : s.id)
                        setMenuPos(menuSession === s.id ? null : { x: rect.right - 140, y: rect.bottom + 2 })
                      }}
                        className="p-0.5 opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity duration-150 shrink-0"
                        style={{ color: 'var(--crai-fg-40)' }}>
                        <Icon icon={MoreHorizontal} size="xs" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </>
        ) : groupKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
              style={{ color: 'var(--crai-fg-40)', opacity: 0.4 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {search ? '无匹配会话' : '暂无会话'}
            </div>
            {!search && archivedCount > 0 && (
              <button onClick={() => setArchivedView(true)}
                className="text-[10px] mt-1 px-2 py-0.5 rounded"
                style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-border)' }}>
                查看 {archivedCount} 个归档会话 ↗
              </button>
            )}
          </div>
        ) : (
          <>
            {groupKeys.map((label) => (
            <div key={label} className="mb-2">
                {label === '置顶' ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-1 py-1" style={{ color: 'var(--crai-fg-tertiary)' }}>
                    <Pin size={10} />
                    已置顶
                  </span>
                ) : (
                  <div className="text-[10px] font-medium px-1 py-1" style={{ color: 'var(--crai-fg-tertiary)' }}>
                    {label}
                  </div>
                )}
              {(groups.get(label) ?? []).map((s) => {
                const isRenaming = renameId === s.id
                return (
                  <div key={s.id}
                    onContextMenu={(e) => handleContextMenu(e, s.id)}
                    className="group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors duration-150"
                    style={{
                      backgroundColor: s.id === currentSessionId ? 'var(--crai-bg-tertiary)' : 'transparent',
                      color: 'var(--crai-fg)',
                    }}
                    onClick={() => { if (!isRenaming) onSelect(s.id) }}>
                    {isRenaming ? (
                      <input autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(s.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenameId(null) }}
                        className="flex-1 text-xs px-1 py-0.5 rounded outline-none min-w-0"
                        style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', border: '1px solid var(--crai-accent)' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-xs truncate opacity-70">{s.title ?? s.id.slice(0, 12)}</span>
                    )}

                    {/* 时间 */}
                    {!isRenaming && (
                      <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--crai-fg-40)' }}>
                        {relativeTime(s.createdAt)}
                      </span>
                    )}

                    {/* 菜单按钮 */}
                    {!isRenaming && (
                      <button onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuSession(menuSession === s.id ? null : s.id)
                        setMenuPos(menuSession === s.id ? null : { x: rect.right - 140, y: rect.bottom + 2 })
                      }}
                        className="p-0.5 opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity duration-150 shrink-0"
                        style={{ color: 'var(--crai-fg-40)' }}>
                        <Icon icon={MoreHorizontal} size="xs" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          </>
        )}
      </div>

      {/* 浮动菜单（按钮/右键统一） */}
      {menuPos && menuSession && (
        <div ref={menuRef}
          className="fixed rounded-lg py-1 z-[100]"
          style={{
            left: menuPos.x, top: menuPos.y,
            backgroundColor: 'var(--crai-bg)',
            border: '1px solid var(--crai-border)',
            boxShadow: 'var(--crai-shadow-elevated)',
            minWidth: 140,
          }}
        >
          <MenuContent
            sessionId={menuSession}
            session={sessions.find(s => s.id === menuSession)}
            onClose={closeMenu}
            onUpdate={onUpdate}
            onDelete={handleDelete}
            onRename={startRename}
          />
        </div>
      )}
    </div>
  )
}

function MenuContent({ sessionId, session, onClose, onUpdate, onDelete, onRename }: {
  sessionId: string
  session?: SessionSummary
  onClose: () => void
  onUpdate?: (id: string, updates: { title?: string; pinned?: boolean; archived?: boolean }) => void
  onDelete: (id: string) => void
  onRename: (id: string, title?: string) => void
}) {
  const isArchived = session?.archived
  return (
    <div>
      {!isArchived && (
        <>
          <MenuItem icon={<Icon icon={session?.pinned ? PinOff : Pin} size="xs" />}
            label={session?.pinned ? '取消置顶' : '置顶'}
            onClick={() => { onUpdate?.(sessionId, { pinned: !session?.pinned }); onClose() }} />
          <MenuItem icon={<Icon icon={Pencil} size="xs" />}
            label="重命名"
            onClick={() => { onRename(sessionId, session?.title); onClose() }} />
        </>
      )}
      <MenuItem icon={<Icon icon={isArchived ? ArchiveRestore : Archive} size="xs" />}
        label={isArchived ? '取消归档' : '归档'}
        onClick={() => { onUpdate?.(sessionId, { archived: !isArchived }); onClose() }} />
      <div className="mx-2 my-1" style={{ height: 1, backgroundColor: 'var(--crai-border)' }} />
      <MenuItem icon={<Icon icon={Trash2} size="xs" />}
        label="删除"
        onClick={() => { onDelete(sessionId); onClose() }}
        danger />
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors duration-100"
      style={{ color: danger ? 'var(--crai-destructive)' : 'var(--crai-fg)' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--crai-bg-3)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {icon}
      {label}
    </button>
  )
}

function LoaderSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-spin"
      style={{ color: 'var(--crai-accent)', opacity: 0.6 }}>
      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}
