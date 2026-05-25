/**
 * Dropdown — 下拉菜单。
 *
 * 通用原语，支持选中态、分隔线、额外操作按钮。
 *
 * 用法：
 *   <Dropdown
 *     label="工作区"
 *     items={workspaces.map(w => ({ id: w.rootDir, display: w.name, active: w.rootDir === current }))}
 *     selected={current}
 *     onSelect={handleSwitch}
 *     onAction={handleAdd}
 *     actionLabel="+ 添加"
 *   />
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Icon } from './Icon'

export interface DropdownItem<T extends string = string> {
  id: T
  display: string
  active: boolean
}

interface DropdownProps<T extends string = string> {
  label: string
  items: DropdownItem<T>[]
  selected: T | null
  onSelect: (id: T) => void
  onAction?: () => void
  actionLabel?: string
  /** 可选的删除回调。每项 hover 时出现 ✕ 按钮。 */
  onDelete?: (id: T) => void
  /** dropdown 面板对齐方向。默认 'right'。 */
  align?: 'left' | 'right'
}

export function Dropdown<T extends string = string>({
  label,
  items,
  selected,
  onSelect,
  onAction,
  actionLabel,
  onDelete,
  align = 'left',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
        style={{ color: 'var(--crai-fg-secondary)', backgroundColor: 'var(--crai-bg-tertiary)', border: 'none', cursor: 'pointer' }}
      >
        {label} <Icon icon={ChevronDown} size="xs" />
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 min-w-[160px] rounded-lg z-50 py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{
            backgroundColor: 'var(--crai-bg)',
            border: '1px solid var(--crai-border)',
            boxShadow: 'var(--crai-shadow-modal)',
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center px-1.5 py-0.5 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-5)] group"
            >
              <button
                onClick={() => { onSelect(item.id); setOpen(false) }}
                className="flex-1 text-left px-1.5 py-1 text-xs flex items-center gap-2 rounded"
                style={{ color: item.active ? 'var(--crai-accent)' : 'var(--crai-fg)' }}
              >
                {item.display}
              </button>
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); setOpen(false) }}
                  className="shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-all duration-150 crai-dropdown-del"
                  style={{ width: 22, height: 22 }}
                  title="删除工作区"
                >
                  <Icon icon={Trash2} size="xs" className="crai-dropdown-del-icon" style={{ color: 'var(--crai-fg-tertiary)' }} />
                </button>
              )}
            </div>
          ))}
          {onAction && actionLabel && (
            <>
              <div className="mx-1.5 my-0.5 border-t" style={{ borderColor: 'var(--crai-border)' }} />
              <button
                onClick={() => { onAction(); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
                style={{ color: 'var(--crai-accent)' }}
              >
                {actionLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
