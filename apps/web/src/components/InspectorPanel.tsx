/**
 * InspectorPanel — 主题控制系统。
 *
 * 重组后分三区：
 * 1. 颜色（基色 + 衍生色）
 * 2. 表面层级预览
 * 3. 样式（字号、行高、圆角、间距、布局等非色 token）
 */
import { useState, useEffect, useMemo } from 'react'
import { Select } from './ui'
import {
  TOKENS, setToken, getRawToken, resetGroup, resetAll,
  exportTokens, importTokens, COLOR_PRESETS, STYLE_PRESETS,
  type TokenDef, type TokenGroup,
} from '../theme/tokens'

// ── 基色 token 名（优先级最高的 5 个） ──
const BASE_COLORS = ['--crai-bg', '--crai-fg', '--crai-accent', '--crai-success', '--crai-destructive']

// ── 表面/边框 token（预览用，也可调但非必须） ──
const SURFACE_TOKENS = ['--crai-bg-3', '--crai-bg-5', '--crai-bg-8', '--crai-bg-12', '--crai-fg-40', '--crai-fg-60', '--crai-border', '--crai-border-hover']

const GROUP_LABELS: Record<string, string> = {
  'font-size': '🔤 字号', 'line-height': '📏 行高', radius: '⭕ 圆角', spacing: '↔️ 间距',
  layout: '📐 布局', 'user-msg': '💬 用户消息', 'ai-msg': '🤖 AI 消息',
  'code-block': '📄 代码块', table: '📊 表格', blockquote: '📝 引用', heading: '📰 标题',
  'input-box': '📦 输入框', 'input-bar': '🔧 工具栏', 'thinking-block': '🧠 思考', 'tool-block': '🔧 工具',
  base: '🎨 基础', 'input-field': '🖊️ 文本区',
}

interface Props { onClose: () => void }

export function InspectorPanel({ onClose }: Props) {
  const [, forceUpdate] = useState(0)
  const [locateMode, setLocateMode] = useState(false)
  const [filterLocate, setFilterLocate] = useState(false)
  const [targetGroups, setTargetGroups] = useState<string[]>([])
  const [activeColor, setActiveColor] = useState<string>('Crai 默认（浅色）')
  const [activeStyle, setActiveStyle] = useState<string>('Crai 默认样式')
  const [userColorPresets, setUserColorPresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [userStylePresets, setUserStylePresets] = useState<Array<{ name: string; tokens: Record<string, string> }>>([])
  const [showColors, setShowColors] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [showStyle, setShowStyle] = useState(true)
  const [styleSearch, setStyleSearch] = useState('')

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
      if (t.type !== 'color') {
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

  // ── 定位模式：点击元素 → 展开对应组 + 高亮 → 跳转 ──
  useEffect(() => {
    // 清理函数：移除高亮
    function clearHighlights() {
      document.querySelectorAll('.crai-locate-highlight').forEach((el) => el.classList.remove('crai-locate-highlight'))
    }
    if (!locateMode) {
      setTargetGroups([])
      setFilterLocate(false)
      clearHighlights()
      return
    }
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      // 点击 Inspector 自身时跳过
      if (target.closest('.crai-inspector-root')) return
      // pointerdown 捕获阶段在 disabled 元素上仍能工作。找到最近有 data-token-group 的祖先。
      const nearest = target.closest('[data-token-group]')
      if (!nearest) return
      const raw = nearest.getAttribute('data-token-group')
      if (!raw) return
      const groups = raw.split(/\s+/).filter(Boolean)
      if (groups.length === 0) return

      clearHighlights()
      for (const g of groups) {
        document.querySelectorAll(`[data-token-group~="${g}"]`).forEach((el) => el.classList.add('crai-locate-highlight'))
      }
      const labels = groups.map((g) => GROUP_LABELS[g] ?? g).filter(Boolean)
      setTargetGroups(labels)
      setShowStyle(true)

      requestAnimationFrame(() => {
        const groupEls = document.querySelectorAll('[data-crai-group]')
        for (const el of groupEls) {
          if (labels.includes(el.getAttribute('data-crai-group') ?? '')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            break
          }
        }
      })
    }
    // 用 capture: true 确保在 disabled 按钮上也能收到事件
    document.addEventListener('pointerdown', handler as any, true)
    return () => {
      document.removeEventListener('pointerdown', handler as any, true)
      clearHighlights()
    }
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
    <div className="fixed top-0 right-0 h-full z-50 flex flex-col text-sm overflow-hidden crai-inspector-root"
      style={{ width: 'var(--crai-panel-width)', backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', borderLeft: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Inspector</span>
        <div className="flex gap-2">
          <button onClick={() => setLocateMode((m) => !m)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: locateMode ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: locateMode ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}>🔍 定位</button>
          {locateMode && targetGroups.length > 0 && (
            <button onClick={() => setFilterLocate((f) => !f)}
              className="text-xs px-2 py-1 rounded"
              style={{ color: filterLocate ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: filterLocate ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}>🔍 过滤</button>
          )}
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
        </div>
      </div>

      {/* 预设栏 */}
      <div className="shrink-0 space-y-1 px-3 py-2 border-b" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>🎨 配色</span>
          <Select
            value={activeColor ?? ''}
            onChange={(v) => { if (v) applyColorPreset(v) }}
            options={[
              { value: '', label: '— 未选择 —' },
              ...COLOR_PRESETS.map((p) => ({ value: p.name, label: p.name })),
              ...userColorPresets.map((p) => ({ value: 'uc-' + p.name, label: p.name })),
            ]}
            placeholder="— 未选择 —"
            className="flex-1"
            style={{
              borderColor: isColorDirty ? 'var(--crai-accent)' : 'var(--crai-border)',
            }}
          />
          <button onClick={saveColorPreset}
            className="text-[10px] px-1.5 py-1 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>+ 保存</button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium shrink-0" style={{ color: 'var(--crai-fg-secondary)' }}>⚙️ 样式</span>
          <Select
            value={activeStyle ?? ''}
            onChange={(v) => { if (v) applyStylePreset(v) }}
            options={[
              { value: '', label: '— 未选择 —' },
              ...STYLE_PRESETS.map((p) => ({ value: p.name, label: p.name })),
              ...userStylePresets.map((p) => ({ value: 'us-' + p.name, label: p.name })),
            ]}
            placeholder="— 未选择 —"
            className="flex-1"
            style={{
              borderColor: isStyleDirty ? 'var(--crai-accent)' : 'var(--crai-border)',
            }}
          />
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
            <div className="space-y-1">
              {/* 搜索框 */}
              <input
                type="text"
                value={styleSearch}
                onChange={(e) => setStyleSearch(e.target.value)}
                placeholder="搜索 token…"
                className="w-full text-[10px] px-2 py-1 rounded outline-none mb-1"
                style={{
                  backgroundColor: 'var(--crai-bg-secondary)',
                  color: 'var(--crai-fg)',
                  border: '1px solid var(--crai-border)',
                }}
              />
              {styleSearch.trim() ? (
                // 搜索结果——跨所有组扁平化展示
                (() => {
                  const q = styleSearch.trim().toLowerCase()
                  const matched = Object.entries(nonColorTokens).flatMap(([group, tokens]) =>
                    tokens.filter((t) =>
                      t.label.toLowerCase().includes(q) ||
                      t.name.toLowerCase().includes(q) ||
                      (t.description ?? '').toLowerCase().includes(q)
                    )
                  )
                  return matched.length === 0
                    ? <div className="text-[10px] py-2 text-center" style={{ color: 'var(--crai-fg-tertiary)' }}>无匹配</div>
                    : matched.map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)
                })()
              ) : (
                Object.entries(nonColorTokens)
                  .filter(([group]) => !filterLocate || targetGroups.length === 0 || targetGroups.includes(GROUP_LABELS[group] ?? group))
                  .map(([group, tokens]) => (
                  <CollapsibleGroup key={group} label={GROUP_LABELS[group] ?? group} locateMode={locateMode} forceOpen={targetGroups.includes(GROUP_LABELS[group] ?? group)}>
                    {tokens.map((token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />)}
                  </CollapsibleGroup>
                ))
              )}
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

function CollapsibleGroup({ label, locateMode, children, defaultOpen = true, forceOpen = false }: { label: string; locateMode: boolean; children: React.ReactNode; defaultOpen?: boolean; forceOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [flash, setFlash] = useState(false)

  // forceOpen 变化时强制展开 + 闪一下高亮
  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1500)
      return () => clearTimeout(t)
    }
  }, [forceOpen])

  return (
    <div className={`mb-1 rounded transition-colors duration-300 ${flash ? 'crai-locate-flash' : ''}`} data-crai-group={label}>
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
  // 继承态时用父 token 的解析值作为可编辑值（替代裸 var() 表达式）
  const editValue = isLinked && token.ref
    ? getComputedStyle(document.documentElement).getPropertyValue(token.ref).trim() || resolved
    : resolved

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
    return <ColorControl token={token} resolved={editValue} raw={raw} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'size') {
    return <SizeControl token={token} resolved={editValue} raw={raw} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'select') {
    return <SelectControl token={token} resolved={editValue} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  if (token.type === 'text') {
    return <TextControl token={token} resolved={editValue} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
  }
  return <NumberControl token={token} resolved={editValue} isLinked={isLinked} parentLabel={parentLabel} onLink={linkParent} onUnlink={unlinkWith} />
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
          <span className="text-[11px] flex items-center gap-1 relative group" style={{ color: 'var(--crai-fg)' }}>
            {token.label}
            {token.description && (
              <span className="absolute top-full left-0 mt-1 px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-card)' }}>
                {token.description}
              </span>
            )}
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
        <span className="text-[11px] flex items-center gap-1 relative group" style={{ color: 'var(--crai-fg)' }}>
          {token.label}
          {token.description && (
            <span className="absolute top-full left-0 mt-1 px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-card)' }}>
              {token.description}
            </span>
          )}
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
      <Select
        value={resolved}
        onChange={(v) => onUnlink(v)}
        options={(token.options ?? []).map((o) => ({ value: o, label: o }))}
        className="min-w-[100px]"
      />
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
