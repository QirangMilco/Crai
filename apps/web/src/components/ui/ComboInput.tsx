import { useState, useRef, useEffect } from 'react'

interface Preset {
  label: string
  value: number
}

interface ComboInputProps {
  presets: Preset[]
  value: string
  onChange: (val: string) => void
  placeholder: string
}

export function ComboInput({ presets, value, onChange, placeholder }: ComboInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  return (
    <div ref={ref} style={{ display: 'flex', position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 rounded text-xs outline-none tabular-nums"
        style={{
          backgroundColor: 'var(--crai-bg-secondary)',
          color: 'var(--crai-fg)',
          border: '1px solid var(--crai-border)',
          borderRight: 'none',
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        }}
      />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="px-1.5 text-[10px] leading-none transition-colors"
        style={{
          backgroundColor: 'var(--crai-bg-secondary)',
          color: 'var(--crai-fg-tertiary)',
          border: '1px solid var(--crai-border)',
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
        }}
      >
        ▾
      </button>
      <div
        className={open ? undefined : undefined}
        style={{
          display: open ? 'block' : 'none',
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          marginBottom: 2,
          backgroundColor: 'var(--crai-bg)',
          border: '1px solid var(--crai-border)',
          borderRadius: 6,
          boxShadow: 'var(--crai-shadow-panel)',
          zIndex: 100,
        }}
      >
        {presets.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={e => {
              e.stopPropagation()
              onChange(String(p.value))
              setOpen(false)
            }}
            className="w-full text-left px-2.5 py-1.5 text-[10px] flex items-center justify-between transition-colors hover:opacity-80"
            style={{ color: 'var(--crai-fg)' }}
          >
            <span>{p.label}</span>
            <span style={{ color: 'var(--crai-fg-tertiary)' }}>{p.value.toLocaleString()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
