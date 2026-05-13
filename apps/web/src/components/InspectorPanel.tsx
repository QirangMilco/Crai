import { useState, useCallback, useEffect, useRef } from 'react'
import { TOKENS, tokensByGroup, setToken, resetToken, resetGroup, resetAll, exportTokens, importTokens, THEME_PRESETS, type TokenDef, type TokenGroup } from '../theme/tokens'

const GROUP_LABELS: Record<TokenGroup, string> = {
  base: '🎨 基础色', 'user-msg': '💬 用户消息', 'ai-msg': '🤖 AI 消息',
  'code-block': '📄 代码块', table: '📊 表格', blockquote: '📝 引用 & 链接',
  heading: '📰 标题', input: '⌨️ 输入框', 'input-box': '📦 输入框容器', 'input-field': '🖊️ 文本区', 'input-bar': '🔧 工具栏', layout: '📐 布局',
}

interface Props { onClose: () => void }

export function InspectorPanel({ onClose }: Props) {
  const groups = tokensByGroup()
  const [expanded, setExpanded] = useState<Set<TokenGroup>>(new Set(['base']))
  const [locateMode, setLocateMode] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [, forceUpdate] = useState(0)

  function highlightGroup(group: TokenGroup | null) {
    document.querySelectorAll('.crai-locate-highlight, .crai-group-active').forEach((el) => el.classList.remove('crai-locate-highlight', 'crai-group-active'))
    if (group) {
      document.querySelectorAll(`[data-token-group="${group}"]`).forEach((el) => el.classList.add('crai-locate-highlight'))
      document.querySelector(`[data-group-btn="${group}"]`)?.classList.add('crai-group-active')
    }
  }

  useEffect(() => {
    if (!locateMode) { highlightGroup(null); return }
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('[data-token-group]')
      highlightGroup(el?.getAttribute('data-token-group') as TokenGroup | null)
    }
    document.addEventListener('mouseover', handler)
    return () => document.removeEventListener('mouseover', handler)
  }, [locateMode])

  const toggleGroup = useCallback((g: TokenGroup) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })
  }, [])

  function applyPreset(name: string) {
    const p = THEME_PRESETS.find((p) => p.name === name)
    if (!p) return
    importTokens(p.tokens); setActivePreset(name); forceUpdate((n) => n + 1)
  }

  function saveAsPreset() {
    const name = prompt('预设名称：')
    if (!name) return
    try {
      const saved = JSON.parse(localStorage.getItem('crai:userPresets') ?? '[]')
      saved.push({ name, tokens: exportTokens() })
      localStorage.setItem('crai:userPresets', JSON.stringify(saved))
      setActivePreset(name); forceUpdate((n) => n + 1)
    } catch {}
  }

  return (
    <div className="fixed top-0 right-0 h-full z-50 flex flex-col text-sm overflow-hidden"
      style={{ width: 'var(--crai-panel-width)', backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', borderLeft: 'var(--crai-border-width, 1px) solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Inspector</span>
        <div className="flex gap-2">
          <button onClick={() => setLocateMode((m) => !m)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: locateMode ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: locateMode ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}>🔍 定位</button>
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
        </div>
      </div>
      <div className="px-3 py-2 border-b shrink-0 space-y-2" style={{ borderColor: 'var(--crai-border)' }}>
        <select value={activePreset ?? ''} onChange={(e) => { if (e.target.value) applyPreset(e.target.value) }}
          className="w-full text-xs px-2 py-1.5 rounded outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: activePreset ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>
          <option value="">🎨 配色预设…</option>
          {THEME_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={saveAsPreset} className="flex-1 text-xs px-2 py-1.5 rounded"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存当前</button>
          <button onClick={() => { const a = document.createElement('a'); const d = exportTokens(); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = `crai-theme-${Date.now()}.json`; a.click() }}
            className="text-xs px-2 py-1.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>导出</button>
          <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = () => { const f = i.files?.[0]; if (!f) return; new FileReader().onload = (e) => { try { importTokens(JSON.parse(e.target?.result as string)); setActivePreset(null); forceUpdate((n) => n + 1) } catch { alert('无效的配置文件') } }; new FileReader().readAsText(f) }; i.click() }}
            className="text-xs px-2 py-1.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>导入</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {(Object.keys(groups) as TokenGroup[]).map((group) => (
          <div key={group}>
            <button onClick={() => toggleGroup(group)} data-group-btn={group}
              onMouseEnter={() => locateMode && highlightGroup(group)}
              onMouseLeave={() => locateMode && highlightGroup(null)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--crai-fg-secondary)' }}>
              <span>{GROUP_LABELS[group]}</span>
              <span className="text-[10px]">{expanded.has(group) ? '▼' : '▶'}</span>
            </button>
            {expanded.has(group) && (
              <div className="ml-1 pl-2 border-l" style={{ borderColor: 'var(--crai-border)' }}>
                {groups[group].map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)}
                <button onClick={() => { resetGroup(group); forceUpdate((n) => n + 1) }}
                  className="text-[10px] px-2 py-0.5 mt-1 mb-2 rounded"
                  style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>重置分组</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t text-[10px] shrink-0" style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>修改实时生效</div>
    </div>
  )
}

function TokenControl({ token, onChange: _onChange }: { token: TokenDef; onChange: (n: number) => void }) {
  const val = getComputedStyle(document.documentElement).getPropertyValue(token.name).trim() || token.defaultValue
  function change(v: string) { setToken(token.name, v); _onChange(Date.now()) }

  if (token.type === 'color') {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <input type="color" value={toHex(val)} onChange={(e) => change(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] truncate" title={token.description} style={{ color: 'var(--crai-fg)' }}>{token.label}</div>
          <div className="text-[10px] font-mono truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>{val}</div>
        </div>
        <button onClick={() => change(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
    )
  }

  if (token.type === 'size') {
    const num = parseFloat(val)
    const unit = val.replace(/[\d.-]/g, '') || 'px'
    const isMulti = val.includes(' ') && val.split(' ').length === 4
    if (isMulti) {
      const avg = val.split(' ').reduce((s, v) => s + parseFloat(v), 0) / 4
      return (
        <div className="py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px]" title={token.description} style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{Math.round(avg)}{unit}</span>
          </div>
          <input type="range" min={token.min ?? 0} max={token.max ?? 48} step="1" value={isNaN(avg) ? 12 : Math.round(avg)}
            onChange={(e) => { const v = e.target.value + unit; change(`${v} ${v} ${v} ${v}`) }} className="inspector-slider w-full" />
        </div>
      )
    }
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px]" title={token.description} style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{val}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={token.min ?? 0} max={token.max ?? 60} step="1" value={isNaN(num) ? 14 : num}
            onChange={(e) => change(e.target.value + unit)} className="inspector-slider flex-1" />
          <button onClick={() => change(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
        </div>
      </div>
    )
  }

  if (token.type === 'select') {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[11px] flex-1" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
        <select value={val} onChange={(e) => change(e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}>
          {(token.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={() => change(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
    )
  }

  if (token.type === 'text') {
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px]" title={token.description} style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
          <button onClick={() => change(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
        </div>
        <input type="text" value={val} onChange={(e) => change(e.target.value)}
          className="w-full text-xs px-2 py-1 rounded font-mono outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
      </div>
    )
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px]" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
        <input type="number" step="0.1" value={val} onChange={(e) => change(e.target.value)}
          className="w-16 text-xs px-2 py-0.5 rounded text-right font-mono outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
      </div>
    </div>
  )
}

function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  return '#4f46e5'
}
