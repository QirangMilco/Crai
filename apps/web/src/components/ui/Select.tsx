/**
 * Select — 自定义下拉选择器，替代原生 <select>。
 *
 * <Select value={v} onChange={setV} options={[...]} />
 *
 * - style 穿透到按钮元素，用于控制高度/字号/边框等
 * - className 加到外层容器，用于布局（flex-1, w-full 等）
 * - 长文本自动截断，hover 时 title 显示完整内容
 * - 根据按钮在视口中的位置自动向上或向下展开
 * - 每项可带独立 icon 和 color，选中时按钮图标同步切换
 */
import { useState, useRef, useEffect, useCallback, type CSSProperties, type ElementType } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
  /** 该项的 Lucide 图标（可选——有则显示，无则回退到 Select 的 icon prop） */
  icon?: ElementType
  /** 该项图标颜色（可选） */
  iconColor?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  style?: CSSProperties
  /** 按钮上的兜底图标（当选中项没有自己的 icon 时使用） */
  icon?: ElementType
  /** panel 的最小宽度，默认 match 按钮宽度 */
  panelMinWidth?: number
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  style,
  icon: fallbackIcon,
  panelMinWidth,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [btnWidth, setBtnWidth] = useState(0)

  const selected = options.find((o) => o.value === value)
  const displayText = selected?.label ?? placeholder ?? value
  const btnIcon = selected?.icon ?? fallbackIcon
  const btnIconColor = selected?.iconColor

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = useCallback(() => {
    const next = !open
    if (next && btnRef.current) {
      setBtnWidth(btnRef.current.offsetWidth)
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 200)
    }
    setOpen(next)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={toggle}
        title={displayText}
        className="flex items-center gap-1 w-full rounded outline-none cursor-pointer transition-colors duration-150"
        style={{
          backgroundColor: 'var(--crai-bg-secondary)',
          color: selected ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)',
          border: '1px solid var(--crai-border)',
          padding: '4px 8px',
          fontSize: 'var(--crai-toolbar-font-size, 11px)',
          ...style,
        }}
      >
        {btnIcon && <Icon icon={btnIcon} size="xs" className="shrink-0" style={{ color: btnIconColor ?? 'var(--crai-fg-tertiary)' }} />}
        <span className="flex-1 truncate text-left">{displayText}</span>
        <Icon icon={ChevronDown} size="xs" className="shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }} />
      </button>
      {open && (
        <div
          className={`absolute z-50 py-1 rounded-lg shadow-lg overflow-hidden ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{
            left: 0,
            minWidth: panelMinWidth ?? (btnWidth || 160),
            backgroundColor: 'var(--crai-bg)',
            border: '1px solid var(--crai-border)',
            boxShadow: 'var(--crai-shadow-modal)',
          }}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>无选项</div>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              title={opt.label}
              className="w-full text-left px-3 py-1.5 text-xs truncate transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)] flex items-center gap-2"
              style={{
                color: opt.value === value ? 'var(--crai-accent)' : 'var(--crai-fg)',
                fontWeight: opt.value === value ? 500 : 400,
              }}
            >
              {opt.icon && <Icon icon={opt.icon} size="xs" className="shrink-0" style={{ color: opt.iconColor ?? 'var(--crai-fg-tertiary)' }} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
