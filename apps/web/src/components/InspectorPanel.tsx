/**
 * InspectorPanel — 主题控制系统。
 *
 * 重组后分三区：
 * 1. 基色调色（5 个基色 + 表面预览）
 * 2. 样式控制（字号、行高、圆角、间距、布局等非色 token）
 * 3. 高级（衍生色，默认折叠）
 */
import { useState, useEffect, useMemo } from 'react'
import {
  TOKENS, setToken, getRawToken, resetGroup, resetAll,
  exportTokens, importTokens, COLOR_PRESETS, STYLE_PRESETS,
  type TokenDef, type TokenGroup,
} from '../theme/tokens'

// ── 基色 token 名（优先级最高的 5 个） ──
const BASE_COLORS = ['--crai-bg', '--crai-fg', '--crai-accent', '--crai-success', '--crai-destructive']

// ── 表面/边框 token（预览用，也可调但非必须） ──
const SURFACE_TOKENS = ['--crai-bg-3', '--crai-bg-5', '--crai-bg-8', '--crai-bg-12', '--crai-fg-40', '--crai-fg-60', '--crai-border', '--crai-border-hover']

// ── 非色 token 分组（保持现有 group 逻辑） ──
const NON_COLOR_GROUPS = new Set<TokenGroup>(['font-size', 'line-height', 'radius', 'spacing', 'layout'])

const GROUP_LABELS: Record<string, string> = {
  'font-size': '🔤 字号', 'line-height': '📏 行高', radius: '⭕ 圆角', spacing: '↔️ 间距',
  layout: '📐 布局',
}

interface Props { onClose: () => void }

export function InspectorPanel({ onClose }: Props) {
  const [, forceUpdate] = useState(0)
  const [locateMode, setLocateMode] = useState(false)
  const [activeColor, setActiveColor] = useState<string>('Crai 默认（浅色）')
  const [activeStyle, setActiveStyle] = useState<string>('Crai 默认样式')
  const [userColorPresets, setUserColorPresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [userStylePresets, setUserStylePresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showColors, setShowColors] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [showStyle, setShowStyle] = useState(true)

  // 从 localStorage 加载用户预设
  useEffect(() => {
    try {
      const cp = JSON.parse(localStorage.getItem('crai:colorPresets') ?? '[]')
      setUserColorPresets(cp)
      const sp = JSON.parse(localStorage.getItem('crai:stylePresets') ?? '[]')
      setUserStylePresets(sp)
    } catch {/* ignore */}
  }, [])

  // ── 分组 ──
  const nonColorTokens = useMemo(() => {
    const groups: Record<string, TokenDef[]> = {}
    for (const t of TOKENS) {
      if (NON_COLOR_GROUPS.has(t.group) && t.type !== 'color') {
        if (!groups[t.group]) groups[t.group] = []
        groups[t.group].push(t)
      }
    }
    return groups
  }, [])

  // ── 衍生色（非基色、非表面的 color token） ──
  const derivedColorTokens = useMemo(() => {
    return TOKENS.filter((t) => t.type === 'color' && !BASE_COLORS.includes(t.name) && !SURFACE_TOKENS.includes(t.name))
  }, [])

  // ── 脏状态 ──
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

  // ── 定位模式 ──
  useEffect(() => {
    if (!locateMode) return
    const handler = (e: MouseEvent) => {
      document.querySelectorAll('.crai-locate-highlight').forEach((el) => el.classList.remove('crai-locate-highlight'))
      const el = (e.target as HTMLElement).closest('[data-token-group]')
      if (el) {
        const group = el.getAttribute('data-token-group')
        document.querySelectorAll(`[data-token-group="${group}"]`).forEach((el2) => el2.classList.add('crai-locate-highlight'))
      }
    }
    document.addEventListener('mouseover', handler)
    return () => document.removeEventListener('mouseover', handler)
  }, [locateMode])

  // ── 预设操作 ──
  function applyColorPreset(name: string) {
    const p = COLOR_PRESETS.find((c) => c.name === name) ?? userColorPresets.find((c) => 'uc-' + c.name === name)
    if (!p) return
    for (const [k, v] of Object.entries(p.tokens)) setToken(k, v)
    clearHexCache()
    setActiveColor(name)
    forceUpdate((n) => n + 1)
  }

  function applyStylePreset(name: string) {
    const p = STYLE_PRESETS.find((s) => s.name === name) ?? userStylePresets.find((s) => 'us-' + s.name === name)
    if (!p) return
    for (const [k, v] of Object.entries(p.tokens)) setToken(k, v)
    setActiveStyle(name)
    forceUpdate((n) => n + 1)
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
          clearHexCache()
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
      style={{ width: 'var(--crai-panel-width)', backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', borderLeft: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Inspector</span>
        <div className="flex gap-2">
          <button onClick={() => setLocateMode((m) => !m)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: locateMode ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: locateMode ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}>🔍 定位</button>
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
        </div>
      </div>

      {/* 预设栏 */}
      <div className="shrink-0 space-y-1 px-3 py-2 border-b" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>🎨 配色</span>
          <select value={activeColor ?? ''} onChange={(e) => { if (e.target.value) applyColorPreset(e.target.value) }}
            className="flex-1 text-xs px-2 py-1 rounded outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: activeColor ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)',
              border: isColorDirty ? '1px solid var(--crai-accent)' : '1px solid var(--crai-border)',
            }}>
            <option value="">— 未选择 —</option>
            {COLOR_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            {userColorPresets.map((p) => <option key={'uc-' + p.name} value={'uc-' + p.name}>{p.name}</option>)}
          </select>
          <button onClick={saveColorPreset}
            className="text-[10px] px-1.5 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>⚙️ 样式</span>
          <select value={activeStyle ?? ''} onChange={(e) => { if (e.target.value) applyStylePreset(e.target.value) }}
            className="flex-1 text-xs px-2 py-1 rounded outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: activeStyle ? 'var(--crai-fg)' : 'var(--crai-fg-tertiary)',
              border: isStyleDirty ? '1px solid var(--crai-accent)' : '1px solid var(--crai-border)',
            }}>
            <option value="">— 未选择 —</option>
            {STYLE_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            {userStylePresets.map((p) => <option key={'us-' + p.name} value={'us-' + p.name}>{p.name}</option>)}
          </select>
          <button onClick={saveStylePreset}
            className="text-[10px] px-1.5 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
        </div>
        <div className="flex gap-1">
          <button onClick={exportAll}
            className="flex-1 text-[10px] px-2 py-1 rounded"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>📤 导出</button>
          <button onClick={importAll}
            className="flex-1 text-[10px] px-2 py-1 rounded"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>📥 导入</button>
          <button onClick={() => { resetAll(); clearHexCache(); forceUpdate((n) => n + 1) }}
            className="flex-1 text-[10px] px-2 py-1 rounded"
            style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}>↺ 重置</button>
        </div>
      </div>

      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── 颜色（基色 + 衍生色） ── */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setShowColors((s) => !s)}
            className="w-full flex items-center justify-between text-[11px] font-medium mb-1"
            style={{ color: 'var(--crai-fg-secondary)' }}
          >
            <span>🎨 颜色</span>
            <span className="text-[10px]">{showColors ? '▼' : '▶'}</span>
          </button>
          {showColors && (
            <div className="space-y-0.5">
              {/* 基色 */}
              <CollapsibleGroup label="基色" locateMode={locateMode} defaultOpen={true}>
                {BASE_COLORS.map((name) => {
                  const token = TOKENS.find((t) => t.name === name)!
                  return <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />
                })}
              </CollapsibleGroup>
              {/* 衍生色 */}
              <CollapsibleGroup label="衍生色" locateMode={locateMode} defaultOpen={false}>
                {derivedColorTokens.map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)}
              </CollapsibleGroup>
            </div>
          )}
        </div>

        {/* ── 表面预览 ── */}
        <div className="px-3 py-2">
          <button
            onClick={() => setShowPreview((s) => !s)}
            className="w-full flex items-center justify-between text-[11px] font-medium mb-2"
            style={{ color: 'var(--crai-fg-secondary)' }}
          >
            <span>表面层级预览</span>
            <span className="text-[10px]">{showPreview ? '▼' : '▶'}</span>
          </button>
          {showPreview && <SurfacePreview />}
        </div>

        {/* ── 样式控制（非色 token 分组） ── */}
        <div className="px-3 pb-1">
          <button
            onClick={() => setShowStyle((s) => !s)}
            className="w-full flex items-center justify-between text-[11px] font-medium mb-2"
            style={{ color: 'var(--crai-fg-secondary)' }}
          >
            <span>⚙️ 样式</span>
            <span className="text-[10px]">{showStyle ? '▼' : '▶'}</span>
          </button>
          {showStyle && (
            <>{Object.entries(nonColorTokens).map(([group, tokens]) => (
              <CollapsibleGroup key={group} label={GROUP_LABELS[group] ?? group} locateMode={locateMode}>
                {tokens.map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)}
              </CollapsibleGroup>
            ))}</>
          )}
        </div>

        {/* ── 4. 高级：衍生色 ── */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium"
            style={{ color: 'var(--crai-fg-secondary)' }}
          >
            <span>高级 · 衍生色</span>
            <span className="text-[10px]">{showAdvanced ? '▼' : '▶'}</span>
          </button>
          {showAdvanced && (
            <div className="space-y-0.5">
              {derivedColorTokens.map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t text-[10px] shrink-0" style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>修改实时生效</div>
    </div>
  )
}

// ── 表面预览卡片 ──

function SurfacePreview() {
  function resolve(cssVar: string): string {
    // 直接使用 CSS 变量，让浏览器渲染引擎自己算
    return `var(${cssVar})`
  }
  // Resolve the accent color for display
  const accentHex = toHexCssVar('--crai-accent')
  return (
    <div style={{
      borderRadius: 'var(--crai-radius-sm)',
      border: '1px solid',
      borderColor: resolve('--crai-border'),
      overflow: 'hidden',
      fontSize: 11,
    }}>
      {/* 最底层 bg */}
      <div style={{ backgroundColor: resolve('--crai-bg'), padding: 12 }}>
        <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--crai-fg)' }}>bg <span style={{ color: resolve('--crai-fg-40') }}>— 最底层背景</span></div>

        {/* bg-3 → msg / code / tool 背景 */}
        <div style={{ backgroundColor: resolve('--crai-bg-3'), borderRadius: 4, padding: '8px 10px', marginBottom: 4 }}>
          <div style={{ color: 'var(--crai-fg)' }}>bg-3 <span style={{ color: resolve('--crai-fg-40') }}>— 消息/代码/工具背景</span></div>
        </div>

        {/* bg-5 → hover 背景 */}
        <div style={{ backgroundColor: resolve('--crai-bg-5'), borderRadius: 4, padding: '6px 10px', marginBottom: 4 }}>
          <div style={{ color: 'var(--crai-fg)' }}>bg-5 <span style={{ color: resolve('--crai-fg-40') }}>— hover/选中</span></div>
        </div>

        {/* 文字预览 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: resolve('--crai-bg-3'), color: resolve('--crai-fg') }}>fg 主要</div>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: resolve('--crai-bg-3'), color: resolve('--crai-fg-40') }}>fg-40 次要</div>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: resolve('--crai-bg-3'), color: resolve('--crai-fg-60') }}>fg-60 三级</div>
        </div>

        {/* border */}
        <div style={{ marginTop: 6, padding: '4px 8px', border: '1px solid', borderColor: resolve('--crai-border'), borderRadius: 3, color: resolve('--crai-fg-40') }}>
          边框 border
        </div>

        {/* accent 色块 */}
        <div style={{ marginTop: 6, padding: '4px 10px', borderRadius: 3, backgroundColor: resolve('--crai-accent'), color: '#fff', fontSize: 10, textAlign: 'center' }}>
          强调色 accent — {accentHex}
        </div>
      </div>
    </div>
  )
}

// ── 可折叠分组 ──

function CollapsibleGroup({ label, locateMode, children, defaultOpen = true }: { label: string; locateMode: boolean; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium"
        style={{ color: 'var(--crai-fg-secondary)' }}
      >
        <span>{label}</span>
        <span className="text-[10px]">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="ml-1 pl-2 border-l" style={{ borderColor: 'var(--crai-border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── 以下是 TokenControl 及其子组件（不改动） ──

function TokenControl({ token, onChange: _onChange }: { token: TokenDef; onChange: (n: number) => void }) {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token.name).trim() || token.defaultValue
  const raw = getRawToken(token.name) || token.defaultValue
  const isLinked = token.ref != null && raw.startsWith('var(')
  const parentLabel = token.ref ? (TOKENS.find((t) => t.name === token.ref)?.label ?? token.ref) : undefined

  function linkParent() {
    setToken(token.name, `var(${token.ref})`)
    clearHexCache()
    _onChange(Date.now())
  }

  function unlinkWith(v: string) {
    setToken(token.name, v)
    clearHexCache()
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
  return <NumberControl token={token} resolved={resolved} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
}

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
  const hex = toHexCssVar(token.name)
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

// ── 颜色解析：用 canvas 渲染 1px 像素并读取实际 RGBA ──

const _hexCache = new Map<string, string>()
function toHexCssVar(cssVar: string): string {
  const cached = _hexCache.get(cssVar)
  if (cached) return cached
  // ... compute and cache
  return computeHex(cssVar)
}
/** 清空缓存（颜色变更后调用） */
function clearHexCache() { _hexCache.clear() }

function computeHex(cssVar: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  if (!raw) { _hexCache.set(cssVar, '#4f46e5'); return '#4f46e5' }

  const canvas = document.createElement('canvas')
  canvas.width = 1; canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) { _hexCache.set(cssVar, '#4f46e5'); return '#4f46e5' }

  let colorValue = raw
  if (raw.includes('var(') || raw.startsWith('color-mix')) {
    const proxy = document.createElement('div')
    const rootStyle = document.documentElement.style
    const vars = Array.from(rootStyle).map((k) => `${k}:${rootStyle.getPropertyValue(k)}`).join(';')
    proxy.style.cssText = vars
    document.body.appendChild(proxy)
    proxy.style.backgroundColor = `var(${cssVar})`
    colorValue = getComputedStyle(proxy).backgroundColor
    document.body.removeChild(proxy)
  }

  ctx.fillStyle = colorValue
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
  _hexCache.set(cssVar, hex)
  return hex
}
