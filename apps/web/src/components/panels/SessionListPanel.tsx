/**
 * SessionListPanel — 左侧栏会话列表面板。
 *
 * 功能：
 * - 时间分组（今天/昨天/本周/本月/更早）
 * - 搜索过滤
 * - 排序（按创建时间升/降，按标题）
 * - 新建/删除/选中会话
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { X, ArrowDown, ArrowUp } from 'lucide-react'
import { Icon } from '../ui/Icon'

interface SessionSummary {
  id: string
  title?: string
  createdAt: number
}

type SortKey = 'createdAt' | 'title'
type SortDir = 'asc' | 'desc'

interface Props {
  sessions: SessionSummary[]
  currentSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  width: number
  hovered: boolean
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

/** Sort sessions array in place by sortKey and sortDir */
function sortSessions(sessions: SessionSummary[], key: SortKey, dir: SortDir): SessionSummary[] {
  return [...sessions].sort((a, b) => {
    let cmp: number
    if (key === 'createdAt') {
      cmp = a.createdAt - b.createdAt
    } else {
      cmp = (a.title ?? a.id).localeCompare(b.title ?? b.id)
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

/** Group time labels sorted by recency */
function sortedGroupLabels(groups: Map<string, SessionSummary[]>): string[] {
  const priority: Record<string, number> = { '今天': 0, '昨天': 1, '本周': 2, '本月': 3, '更早': 4 }
  return Array.from(groups.keys()).sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99))
}

export function SessionListPanel({ sessions, currentSessionId, onSelect, onNew, onDelete, width, hovered }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // 当侧栏展开时自动聚焦搜索框
  useEffect(() => {
    if (hovered) searchRef.current?.focus()
  }, [hovered])

  // 搜索过滤
  const filtered = useMemo(() => {
    let list = sessions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) => (s.title ?? s.id).toLowerCase().includes(q))
    }
    return sortSessions(list, sortKey, sortDir)
  }, [sessions, search, sortKey, sortDir])

  // 时间分组
  const groups = useMemo(() => groupSessions(filtered), [filtered])
  const groupKeys = useMemo(() => sortedGroupLabels(groups), [groups])

  const handleDelete = useCallback((id: string) => {
    if (confirmDelete === id) {
      onDelete(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }, [confirmDelete, onDelete])

  const toggleSortDir = useCallback(() => {
    setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ minWidth: 0 }}>
      {/* 顶部操作栏 */}
      <div className="shrink-0 px-2 pt-1 pb-1 space-y-1">
        {/* 搜索 */}
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话…"
            className="w-full text-xs px-2 py-1.5 rounded outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: 'var(--crai-fg)',
              border: '1px solid var(--crai-border)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 opacity-50 hover:opacity-100 transition-opacity duration-150"
              style={{ color: 'var(--crai-fg-tertiary)' }}
            >
              <Icon icon={X} size="xs" />
            </button>
          )}
        </div>

        {/* 排序 + 新建 */}
        <div className="flex items-center gap-1">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="flex-1 text-[10px] px-1.5 py-1 rounded outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: 'var(--crai-fg-secondary)',
              border: '1px solid var(--crai-border)',
            }}
          >
            <option value="createdAt">时间</option>
            <option value="title">标题</option>
          </select>
          <button
            onClick={toggleSortDir}
            className="text-[10px] px-1.5 py-1 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)]"
            style={{
              color: 'var(--crai-fg-secondary)',
              border: '1px solid var(--crai-border)',
            }}
            title={sortDir === 'desc' ? '降序' : '升序'}
          >
            <Icon icon={sortDir === 'desc' ? ArrowDown : ArrowUp} size="xs" />
          </button>
          <button
            onClick={onNew}
            className="text-[10px] px-2 py-1 rounded font-medium text-white"
            style={{ backgroundColor: 'var(--crai-accent)' }}
          >
            + 新建
          </button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {groupKeys.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: 'var(--crai-fg-tertiary)' }}>
            {search ? '无匹配会话' : '暂无会话'}
          </div>
        ) : (
          groupKeys.map((label) => (
            <div key={label} className="mb-2">
              <div className="text-[10px] font-medium px-1 py-1" style={{ color: 'var(--crai-fg-tertiary)' }}>
                {label}
              </div>
              {(groups.get(label) ?? []).map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors duration-150"
                  style={{
                    backgroundColor: s.id === currentSessionId ? 'var(--crai-bg-tertiary)' : 'transparent',
                    color: 'var(--crai-fg)',
                  }}
                  onClick={() => onSelect(s.id)}
                >
                  <span className="flex-1 text-xs truncate">
                    {s.title ?? s.id.slice(0, 12)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    className="p-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity duration-150"
                    style={{ color: confirmDelete === s.id ? 'var(--crai-destructive)' : 'var(--crai-fg-tertiary)' }}
                  >
                    {confirmDelete === s.id ? <span className="text-[10px]">确认?</span> : <Icon icon={X} size="xs" />}
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
