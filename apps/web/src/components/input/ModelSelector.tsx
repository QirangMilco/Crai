/**
 * ModelSelector — 模型下拉选择器。
 *
 * 按钮只显示当前选中模型名，下拉菜单按 provider 分组排列。
 * 自动根据按钮在视口中的位置决定向上或向下展开。
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon } from '../ui/Icon'

interface Model {
  name: string
  provider: string
}

interface ModelSelectorProps {
  models: Model[]
  value: string
  onChange: (value: string) => void
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = models.find((m) => m.name === value)

  const grouped = useMemo(() => {
    const groups: Record<string, typeof models> = {}
    for (const m of models) {
      const key = m.provider || ''
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
    return groups
  }, [models])

  const providerKeys = Object.keys(grouped)
  const multiProvider = providerKeys.length > 1

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
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
        style={{ color: 'var(--crai-fg)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <span className="max-w-[100px] truncate">{current?.name ?? '选择模型'}</span>
          <Icon icon={ChevronDown} size="xs" />
      </button>
      {open && (
        <div
          className={`absolute z-50 py-1 rounded-lg shadow-lg overflow-hidden ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ minWidth: 180, right: 0, backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}
        >
          {providerKeys.map((provider) => (
            <div key={provider}>
              {multiProvider && (
                <div className="px-3 py-1 text-[10px] font-medium" style={{ color: 'var(--crai-fg-40)' }}>
                  {provider || '—'}
                </div>
              )}
              {grouped[provider].map((m) => (
                <button
                  key={`${m.provider}/${m.name}`}
                  onClick={() => { onChange(m.name); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
                  style={{ color: m.name === value ? 'var(--crai-accent)' : 'var(--crai-fg)', fontWeight: m.name === value ? 500 : 400, backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
