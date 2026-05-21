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
import { cn } from './cn'

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
}

export function Dropdown<T extends string = string>({
  label,
  items,
  selected,
  onSelect,
  onAction,
  actionLabel,
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
        className="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors duration-150"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-secondary)' }}
      >
        {label} <span className="text-[10px]">▼</span>
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 min-w-[160px] rounded-lg z-50 py-1 shadow-lg"
          style={{
            backgroundColor: 'var(--crai-bg)',
            border: '1px solid var(--crai-border)',
            boxShadow: 'var(--crai-shadow-modal)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2',
                'transition-colors duration-150',
                'hover:bg-[var(--crai-bg-tertiary)]',
              )}
              style={{ color: item.active ? 'var(--crai-accent)' : 'var(--crai-fg)' }}
            >
              {item.active && <span className="text-[10px]">●</span>}
              {item.display}
            </button>
          ))}
          {onAction && actionLabel && (
            <>
              <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--crai-border)' }} />
              <button
                onClick={() => { onAction(); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)]"
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
