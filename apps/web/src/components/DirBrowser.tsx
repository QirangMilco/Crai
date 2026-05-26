/**
 * DirBrowser — 目录选择器弹窗。
 *
 * 纯展示组件。数据通过 props 传入，导航操作通过 onNavigate 回调传给 ChatView。
 */
import { useState } from 'react'

interface DirEntry {
  path: string
  dirs: string[]
  parent?: string
  error?: string
}

interface Props {
  data: DirEntry
  onNavigate: (path: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

export function DirBrowser({ data, onNavigate, onSelect, onClose }: Props) {
  const [history, setHistory] = useState<string[]>([])
  const isEmpty = data.path === '' && data.dirs.length === 0 && !data.error

  function navigate(dir: string) {
    const newPath = data.path.endsWith('/') || data.path === '' ? data.path + dir : data.path + '/' + dir
    setHistory((prev) => [...prev, data.path])
    onNavigate(newPath)
  }

  function goUp() {
    if (data.parent) {
      setHistory((prev) => [...prev, data.path])
      onNavigate(data.parent)
    }
  }

  function goBack() {
    if (history.length > 0) {
      const prevPath = history[history.length - 1]
      setHistory((prev) => prev.slice(0, -1))
      onNavigate(prevPath)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="w-[420px] max-h-[400px] rounded-xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--crai-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--crai-fg)' }}>选择工作区目录</span>
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100" style={{ color: 'var(--crai-fg)' }}>✕</button>
        </div>
        <div className="px-4 py-2 text-[10px] font-mono truncate shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }}>
          {data.path || '请选择一个目录'}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: '200px' }}>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 select-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--crai-fg-40)', opacity: 0.4 }}>
                <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>加载中…</div>
            </div>
          ) : data.error ? (
            <div className="text-xs text-center py-8" style={{ color: 'var(--crai-destructive)' }}>{data.error}</div>
          ) : data.dirs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 select-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--crai-fg-40)', opacity: 0.4 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>此目录下没有子目录</div>
            </div>
          ) : (
            data.dirs.map((d) => (
              <button key={d} onClick={() => navigate(d)}
                className="w-full text-left px-3 py-1.5 rounded text-xs hover:opacity-80"
                style={{ color: 'var(--crai-fg)' }}>
                📁 {d}
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
          <button onClick={goUp} disabled={!data.parent}
            className="px-3 py-1.5 rounded text-xs disabled:opacity-30"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            ⬆ 上级
          </button>
          <button onClick={goBack} disabled={history.length === 0}
            className="px-3 py-1.5 rounded text-xs disabled:opacity-30"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            ⬅ 返回
          </button>
          <div className="flex-1" />
          <button onClick={() => onSelect(data.path)}
            className="px-4 py-1.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--crai-accent)' }}>
            选择此目录
          </button>
        </div>
      </div>
    </div>
  )
}
