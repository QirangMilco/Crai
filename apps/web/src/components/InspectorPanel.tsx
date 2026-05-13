import { useState, useCallback, useEffect } from 'react'
import {
  TOKENS, tokensByGroup, setToken, getRawToken, resetGroup, resetAll,
  exportTokens, importTokens, COLOR_PRESETS, STYLE_PRESETS,
  type TokenDef, type TokenGroup,
} from '../theme/tokens'

const GROUP_LABELS: Record<string, string> = {
  base: '🎨 基础色', type: '🔤 字号 & 行高', radius: '⭕ 圆角', spacing: '↔️ 间距',
  'user-msg': '💬 用户消息', 'ai-msg': '🤖 AI 消息',
  'code-block': '📄 代码块', table: '📊 表格', blockquote: '📝 引用 & 链接',
  heading: '📰 标题', input: '⌨️ 输入框', 'input-box': '📦 输入框容器', 'input-field': '🖊️ 文本区', 'input-bar': '🔧 工具栏',
  layout: '📐 布局',
}

interface Props { onClose: () => void }

export function InspectorPanel({ onClose }: Props) {
  const groups = tokensByGroup()
  const [expanded, setExpanded] = useState<Set<TokenGroup>>(new Set(['type', 'radius', 'spacing', 'base']))
  const [locateMode, setLocateMode] = useState(false)
  const [activeColor, setActiveColor] = useState<string>('Crai 默认（浅色）')
  const [activeStyle, setActiveStyle] = useState<string>('Crai 默认样式')
  const [userColorPresets, setUserColorPresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [userStylePresets, setUserStylePresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [, forceUpdate] = useState(0)

  // 从 localStorage 加载用户预设
  useEffect(() => {
    try {
      const cp = JSON.parse(localStorage.getItem('crai:colorPresets') ?? '[]')
      setUserColorPresets(cp)
      const sp = JSON.parse(localStorage.getItem('crai:stylePresets') ?? '[]')
      setUserStylePresets(sp)
    } catch {/* ignore */}
  }, [])

  // 脏状态检测：当前 token 是否不同于已选预设
  const isColorDirty = (() => {
    if (!activeColor) return false
    const preset = COLOR_PRESETS.find((c) => c.name === activeColor) ?? userColorPresets.find((c) => 'uc-' + c.name === activeColor)
    if (!preset) return false
    for (const [k, v] of Object.entries(preset.tokens)) {
      if (((getRawToken(k) || TOKENS.find((t) => t.name === k)?.defaultValue) ?? '') !== v) return true
    }
    return false
  })()

  const isStyleDirty = (() => {
    if (!activeStyle) return false
    const preset = STYLE_PRESETS.find((s) => s.name === activeStyle) ?? userStylePresets.find((s) => 'us-' + s.name === activeStyle)
    if (!preset) return false
    for (const [k, v] of Object.entries(preset.tokens)) {
      const cur = (getRawToken(k) || TOKENS.find((t) => t.name === k)?.defaultValue) ?? ''
      if (cur !== v) return true
    }
    return false
  })()

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

  function applyColorPreset(name: string) {
    // userColorPresets 用 'uc-' 前缀区分
    const p = COLOR_PRESETS.find((c) => c.name === name)
    if (p) {
      for (const [k, v] of Object.entries(p.tokens)) setToken(k, v)
      setActiveColor(name)
      forceUpdate((n) => n + 1)
      return
    }
    const up = userColorPresets.find((c) => 'uc-' + c.name === name)
    if (up) {
      for (const [k, v] of Object.entries(up.tokens)) setToken(k, v)
      setActiveColor(name)
      forceUpdate((n) => n + 1)
    }
  }

  function applyStylePreset(name: string) {
    const p = STYLE_PRESETS.find((s) => s.name === name)
    if (p) {
      for (const [k, v] of Object.entries(p.tokens)) setToken(k, v)
      setActiveStyle(name)
      forceUpdate((n) => n + 1)
      return
    }
    const up = userStylePresets.find((s) => 'us-' + s.name === name)
    if (up) {
      for (const [k, v] of Object.entries(up.tokens)) setToken(k, v)
      setActiveStyle(name)
      forceUpdate((n) => n + 1)
    }
  }

  function saveColorPreset() {
    const name = prompt('配色预设名称：')
    if (!name) return
    const colorTokens: Record<string, string> = {}
    for (const t of TOKENS) {
      if (t.type === 'color') colorTokens[t.name] = getRawToken(t.name) || t.defaultValue
    }
    const list = [...userColorPresets, { name, tokens: colorTokens }]
    setUserColorPresets(list)
    localStorage.setItem('crai:colorPresets', JSON.stringify(list))
    setActiveColor('uc-' + name)
    forceUpdate((n) => n + 1)
  }

  function saveStylePreset() {
    const name = prompt('样式预设名称：')
    if (!name) return
    const styleTokens: Record<string, string> = {}
    for (const t of TOKENS) {
      if (t.type !== 'color') styleTokens[t.name] = getRawToken(t.name) || t.defaultValue
    }
    const list = [...userStylePresets, { name, tokens: styleTokens }]
    setUserStylePresets(list)
    localStorage.setItem('crai:stylePresets', JSON.stringify(list))
    setActiveStyle('us-' + name)
    forceUpdate((n) => n + 1)
  }

  function exportAll() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exportTokens(), null, 2)], { type: 'application/json' }))
    a.download = `crai-theme-${Date.now()}.json`
    a.click()
  }

  function importAll() {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = '.json'
    i.onchange = () => {
      const f = i.files?.[0]
      if (!f) return
      new FileReader().onload = (e) => {
        try {
          importTokens(JSON.parse(e.target?.result as string))
          setActiveColor(null)
          setActiveStyle(null)
          forceUpdate((n) => n + 1)
        } catch { alert('无效的配置文件') }
      }
      new FileReader().readAsText(f)
    }
    i.click()
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

      {/* 配色预设 */}
      <div className="px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>🎨 配色</span>
          <div className="flex-1 flex items-center gap-1">
            <select value={activeColor ?? ''} onChange={(e) => { if (e.target.value) applyColorPreset(e.target.value) }}
              className="w-full text-xs px-2 py-1 rounded outline-none"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                color: activeColor ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)',
                border: isColorDirty ? '1px solid var(--crai-accent)' : '1px solid var(--crai-border)',
              }}>
              <option value="">— 未选择 —</option>
              {COLOR_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              {userColorPresets.map((p) => <option key={'uc-' + p.name} value={'uc-' + p.name}>{p.name}</option>)}
            </select>
            {isColorDirty && <span className="text-[10px] shrink-0" style={{ color: 'var(--crai-accent)' }}>◈</span>}
          </div>
          <button onClick={saveColorPreset}
            className="text-[10px] px-1.5 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
        </div>
      </div>

      {/* 样式预设 */}
      <div className="px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>⚙️ 样式</span>
          <div className="flex-1 flex items-center gap-1">
            <select value={activeStyle ?? ''} onChange={(e) => { if (e.target.value) applyStylePreset(e.target.value) }}
              className="w-full text-xs px-2 py-1 rounded outline-none"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                color: activeStyle ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)',
                border: isStyleDirty ? '1px solid var(--crai-accent)' : '1px solid var(--crai-border)',
              }}>
              <option value="">— 未选择 —</option>
              {STYLE_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              {userStylePresets.map((p) => <option key={'us-' + p.name} value={'us-' + p.name}>{p.name}</option>)}
            </select>
            {isStyleDirty && <span className="text-[10px] shrink-0" style={{ color: 'var(--crai-accent)' }}>◈</span>}
          </div>
          <button onClick={saveStylePreset}
            className="text-[10px] px-1.5 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
        </div>
      </div>

      {/* 导出 / 导入 / 重置全部 */}
      <div className="px-3 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex gap-1.5">
          <button onClick={exportAll}
            className="flex-1 text-[10px] px-2 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>📤 导出全部</button>
          <button onClick={importAll}
            className="flex-1 text-[10px] px-2 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>📥 导入全部</button>
          <button onClick={() => { resetAll(); forceUpdate((n) => n + 1) }}
            className="flex-1 text-[10px] px-2 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}>↺ 重置全部</button>
        </div>
      </div>

      {/* 所有控制项 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {(Object.keys(groups) as TokenGroup[]).map((group) => (
          <div key={group}>
            <button onClick={() => toggleGroup(group)} data-group-btn={group}
              onMouseEnter={() => locateMode && highlightGroup(group)}
              onMouseLeave={() => locateMode && highlightGroup(null)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--crai-fg-secondary)' }}>
              <span>{GROUP_LABELS[group] ?? group}</span>
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

/* ============================================================
   TokenControl — 单个控制的渲染
   ============================================================ */

function TokenControl({ token, onChange: _onChange }: { token: TokenDef; onChange: (n: number) => void }) {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token.name).trim() || token.defaultValue
  const raw = getRawToken(token.name) || token.defaultValue
  const isLinked = token.ref != null && raw.startsWith('var(')
  const parentLabel = token.ref ? (TOKENS.find((t) => t.name === token.ref)?.label ?? token.ref) : undefined

  function linkParent() {
    setToken(token.name, `var(${token.ref})`)
    _onChange(Date.now())
  }

  function unlinkWith(v: string) {
    setToken(token.name, v)
    _onChange(Date.now())
  }

  if (token.type === 'color') {
    return <ColorControl token={token} resolved={resolved} raw={raw} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'size') {
    return <SizeControl token={token} resolved={resolved} raw={raw} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'select') {
    return <SelectControl token={token} resolved={resolved} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'text') {
    return <TextControl token={token} resolved={resolved} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  // number fallback
  return <NumberControl token={token} resolved={resolved} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
}

/* ============================================================
   各类型控制组件
   ============================================================ */

/** 继承指示器 */
function LinkBadge({ isLinked, parentLabel, onLink, onUnlink, resolved }: {
  isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void; resolved: string
}) {
  if (isLinked) {
    return (
      <span className="text-[9px] px-1 rounded" title="点击断开继承"
        style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onUnlink(resolved) }}>
        ← {parentLabel ?? '继承'}
      </span>
    )
  }
  return (
    <span className="text-[9px] px-1 rounded" title="恢复继承"
      style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)', cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onLink() }}>
      断开
    </span>
  )
}

function ColorControl({ token, resolved, isLinked, parentLabel, onLink, onUnlink }: {
  token: TokenDef; resolved: string; raw: string; isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void
}) {
  const hex = toHex(resolved)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input type="color" value={hex} onChange={(e) => onUnlink(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate flex items-center gap-1" title={token.description} style={{ color: 'var(--crai-fg)' }}>
          {token.label}
          {token.ref && <LinkBadge isLinked={isLinked} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
        </div>
        <div className="text-[10px] font-mono truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>{resolved}</div>
      </div>
      <button onClick={() => onUnlink(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
        style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
    </div>
  )
}

function SizeControl({ token, resolved, isLinked, parentLabel, onLink, onUnlink }: {
  token: TokenDef; resolved: string; isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void
}) {
  const num = parseFloat(resolved)
  const unit = resolved.replace(/[\d.-]/g, '') || 'px'

  const isMulti = resolved.includes(' ') && resolved.split(' ').length === 4
  if (isMulti) {
    const avg = resolved.split(' ').reduce((s, v) => s + parseFloat(v), 0) / 4
    const cleanUnit = resolved.split(' ')[0].replace(/[\d.-]/g, '') || 'px'
    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] flex items-center gap-1" title={token.description} style={{ color: 'var(--crai-fg)' }}>
            {token.label}
            {token.ref && <LinkBadge isLinked={isLinked} parentLabel={parentLabel} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{Math.round(avg)}{cleanUnit}</span>
        </div>
        <input type="range" min={token.min ?? 0} max={token.max ?? 48} step="1" value={isNaN(avg) ? 12 : Math.round(avg)}
          onChange={(e) => { const v = e.target.value + cleanUnit; onUnlink(`${v} ${v} ${v} ${v}`) }} className="inspector-slider w-full" />
      </div>
    )
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] flex items-center gap-1" title={token.description} style={{ color: 'var(--crai-fg)' }}>
          {token.label}
          {token.ref && <LinkBadge isLinked={isLinked} parentLabel={parentLabel} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{resolved}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={token.min ?? 0} max={token.max ?? 60} step="1" value={isNaN(num) ? 14 : num}
          onChange={(e) => onUnlink(e.target.value + unit)} className="inspector-slider flex-1" />
        <button onClick={() => onUnlink(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
    </div>
  )
}

function SelectControl({ token, resolved, isLinked, parentLabel, onLink, onUnlink }: {
  token: TokenDef; resolved: string; isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[11px] flex-1 flex items-center gap-1" style={{ color: 'var(--crai-fg)' }}>
        {token.label}
        {token.ref && <LinkBadge isLinked={isLinked} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
      </span>
      <select value={resolved} onChange={(e) => onUnlink(e.target.value)}
        className="text-xs px-2 py-1 rounded outline-none"
        style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}>
        {(token.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <button onClick={() => onUnlink(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
        style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
    </div>
  )
}

function TextControl({ token, resolved, isLinked, parentLabel, onLink, onUnlink }: {
  token: TokenDef; resolved: string; isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] flex items-center gap-1" title={token.description} style={{ color: 'var(--crai-fg)' }}>
          {token.label}
          {token.ref && <LinkBadge isLinked={isLinked} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
        </span>
        <button onClick={() => onUnlink(token.defaultValue)} className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
      <input type="text" value={resolved} onChange={(e) => onUnlink(e.target.value)}
        className="w-full text-xs px-2 py-1 rounded font-mono outline-none"
        style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
    </div>
  )
}

function NumberControl({ token, resolved, isLinked, parentLabel, onLink, onUnlink }: {
  token: TokenDef; resolved: string; isLinked: boolean; parentLabel?: string; onLink: () => void; onUnlink: (v: string) => void
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--crai-fg)' }}>
          {token.label}
          {token.ref && <LinkBadge isLinked={isLinked} parentLabel={parentLabel} onLink={onLink} onUnlink={onUnlink} resolved={resolved} />}
        </span>
        <input type="number" step="0.1" value={resolved} onChange={(e) => onUnlink(e.target.value)}
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
