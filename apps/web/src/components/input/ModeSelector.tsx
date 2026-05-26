/**
 * ModeSelector — 会话模式下拉选择按钮。
 *
 * 四种模式：
 * - execute（操作）
 * - ask（询问）
 * - safe（只读）
 * - plan（计划）
 *
 * 纯样式组件，不含状态管理逻辑。
 */
import { useState, useRef, useEffect } from 'react'
import { Play, HelpCircle, Lock, Clock, ChevronDown } from 'lucide-react'
import { Icon } from '../ui/Icon'

export const MODE_ICONS: Record<string, React.ReactNode> = {
  execute: <Icon icon={Play} size="sm" />,
  ask: <Icon icon={HelpCircle} size="sm" />,
  safe: <Icon icon={Lock} size="sm" />,
  plan: <Icon icon={Clock} size="sm" />,
}

export const MODE_COLORS: Record<string, { base: string; bg: string; border: string }> = {
  execute: { base: 'var(--crai-accent)', bg: 'color-mix(in oklch, var(--crai-accent) 8%, transparent)', border: 'color-mix(in oklch, var(--crai-accent) 20%, transparent)' },
  ask: { base: 'var(--crai-info)', bg: 'color-mix(in oklch, var(--crai-info) 8%, transparent)', border: 'color-mix(in oklch, var(--crai-info) 20%, transparent)' },
  safe: { base: 'var(--crai-success)', bg: 'color-mix(in oklch, var(--crai-success) 8%, transparent)', border: 'color-mix(in oklch, var(--crai-success) 20%, transparent)' },
  plan: { base: 'var(--crai-fg)', bg: 'color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))', border: 'var(--crai-border)' },
}

export const SESSION_MODES = [
  { value: 'execute', label: '操作' },
  { value: 'ask', label: '询问' },
  { value: 'safe', label: '只读' },
  { value: 'plan', label: '计划' },
]

interface ModeSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = SESSION_MODES.find((m) => m.value === value)
  const label = current?.label ?? '模式'
  const mc = MODE_COLORS[value] ?? MODE_COLORS.execute

  function toggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 200)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors duration-150 hover:opacity-80"
        style={{ color: mc.base, backgroundColor: mc.bg, border: `1px solid ${mc.border}`, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {MODE_ICONS[value]}
          <span>{label}</span>
          <Icon icon={ChevronDown} size="xs" />
      </button>
      {open && (
        <div
          className={`absolute z-50 py-1 rounded-lg shadow-lg overflow-hidden ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ minWidth: 130, left: 0, backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}
        >
          {SESSION_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => { onChange(m.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
              style={{ color: m.value === value ? 'var(--crai-accent)' : 'var(--crai-fg)', fontWeight: m.value === value ? 500 : 400, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {MODE_ICONS[m.value]}
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
