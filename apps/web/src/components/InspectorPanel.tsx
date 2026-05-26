/**
 * InspectorPanel — 主题控制系统。
 *
 * 重组后分三区：
 * 1. 颜色（基色 + 衍生色）
 * 2. 表面层级预览
 * 3. 样式（字号、行高、圆角、间距、布局等非色 token）
 *
 * 子组件：
 * - ColorSwatches      行首色块栏
 * - PresetManager      配色/样式预设管理
 * - TokenGroupList     可滚动 token 分组列表
 * - ImportExportBar    导入/导出操作栏
 */
import { useState, useEffect, useMemo } from 'react'
import { Select } from './ui'
import {
  TOKENS, setToken, getRawToken, resetAll,
  exportTokens, importTokens, COLOR_PRESETS, STYLE_PRESETS,
  type TokenDef,
} from '../theme/tokens'
import { parseDesignMd, generateDesignMd } from '../theme/design-md'
import { clearHexCache, toHexCssVar } from './inspector/color-utils'
import { PresetManager } from './inspector/PresetManager'
import { ImportExportBar } from './inspector/ImportExportBar'
import { TokenGroupList } from './inspector/TokenGroupList'

// ── 基色 token 名（优先级最高的 5 个） ──
const BASE_COLORS = ['--crai-bg', '--crai-fg', '--crai-accent', '--crai-success', '--crai-destructive']

// ── 表面/边框 token（预览用，也可调但非必须） ──
const SURFACE_TOKENS = ['--crai-bg-3', '--crai-bg-5', '--crai-bg-8', '--crai-bg-12', '--crai-fg-40', '--crai-fg-60', '--crai-border', '--crai-border-hover']

const GROUP_LABELS: Record<string, string> = {
  'font-size': '字号', 'line-height': '行高', radius: '圆角', spacing: '间距',
  layout: '布局', 'user-msg': '用户消息', 'ai-msg': 'AI 消息',
  'code-block': '代码块', table: '表格', blockquote: '引用', heading: '标题',
  'input-box': '输入框', 'input-bar': '工具栏', 'thinking-block': '思考', 'tool-block': '工具',
  base: '基础', 'input-field': '文本区', 'z-index': 'Z 层级',
}

const GROUP_ICONS: Record<string, string> = {
  'font-size': 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
  'line-height': 'M17 10H3M21 6H3M21 14H3M17 18H3',
  radius: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z',
  spacing: 'M8 3v2M16 3v2M8 19v2M16 19v2M4 7h16M4 17h16',
  layout: 'M3 9h18M3 15h18M9 3v18M15 3v18',
  'user-msg': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'ai-msg': 'M12 8V4m0 16v-4M8 12H4m16 0h-4m-6.34-5.66l-2.83-2.83m14.14 14.14l-2.83-2.83M6.34 17.66l-2.83 2.83M20.48 4.52l-2.83 2.83',
  'code-block': 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  table: 'M3 3h18v18H3zM21 9H3M21 15H3M12 3v18',
  blockquote: 'M4 12l4-4-4-4M20 12l-4-4 4-4',
  heading: 'M6 4v16M18 4v16M6 12h12',
  'input-box': 'M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'input-bar': 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a1 1 0 0 0 0-1.42l-1.58-1.58a1 1 0 0 0-1.42 0L14.7 6.3z',
  'thinking-block': 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  'tool-block': 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a1 1 0 0 0 0-1.42l-1.58-1.58a1 1 0 0 0-1.42 0L14.7 6.3z',
  base: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'z-index': 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
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
  const [locateActiveToken, setLocateActiveToken] = useState<string | null>(null)

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

  // ── 基色 token 定义 ──
  const baseColorTokens = useMemo(() => {
    return BASE_COLORS.map((name) => TOKENS.find((t) => t.name === name)!).filter(Boolean) as TokenDef[]
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
      if (target.closest('.crai-inspector-root')) return
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

  function exportDesignMd() {
    const tokens = exportTokens()
    const md = generateDesignMd('Crai 主题', `导出时间: ${new Date().toLocaleString()}`, tokens)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = `crai-design-${Date.now()}.md`
    a.click()
  }

  function importDesignMd() {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = '.md,.markdown'
    i.onchange = () => {
      const f = i.files?.[0]
      if (!f) return
      new FileReader().onload = (e) => {
        try {
          const overrides = parseDesignMd(e.target?.result as string)
          if (Object.keys(overrides).length === 0) { alert('未找到可识别的 token'); return }
          importTokens(overrides)
          clearHexCache()
          setActiveColor(null)
          setActiveStyle(null)
          forceUpdate((n) => n + 1)
        } catch { alert('无效的设计文件') }
      }
      new FileReader().readAsText(f)
    }
    i.click()
  }

  function handleReset() {
    resetAll()
    clearHexCache()
    forceUpdate((n) => n + 1)
  }

  // ── 组合预设列表（包含内置 + 用户自定义，用户自定义加前缀） ──
  const allColorPresets = useMemo(() => [
    ...COLOR_PRESETS.map((p) => ({ name: p.name })),
    ...userColorPresets.map((p) => ({ name: 'uc-' + p.name })),
  ], [userColorPresets])

  const allStylePresets = useMemo(() => [
    ...STYLE_PRESETS.map((p) => ({ name: p.name })),
    ...userStylePresets.map((p) => ({ name: 'us-' + p.name })),
  ], [userStylePresets])

  return (
    <div className="fixed top-0 right-0 h-full z-50 flex flex-col text-sm overflow-hidden crai-inspector-root"
      style={{ width: 'var(--crai-panel-width)', backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)', borderLeft: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Inspector</span>
        <div className="flex gap-2">
          <button onClick={() => setLocateMode((m) => !m)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
            style={{ color: locateMode ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: locateMode ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}
            title="定位元素">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            定位
          </button>
          {locateMode && targetGroups.length > 0 && (
            <button onClick={() => setFilterLocate((f) => !f)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: filterLocate ? '#fff' : 'var(--crai-fg-secondary)', backgroundColor: filterLocate ? 'var(--crai-accent)' : 'transparent', border: '1px solid var(--crai-border)' }}
              title="过滤匹配项">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              过滤
            </button>
          )}
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity">✕</button>
        </div>
      </div>

      {/* 预设栏 */}
      <PresetManager
        activeColor={activeColor}
        activeStyle={activeStyle}
        colorPresets={allColorPresets}
        stylePresets={allStylePresets}
        isColorDirty={isColorDirty}
        isStyleDirty={isStyleDirty}
        onColorPresetChange={applyColorPreset}
        onStylePresetChange={applyStylePreset}
        onSaveColor={saveColorPreset}
        onSaveStyle={saveStylePreset}
      />

      {/* 导入/导出操作栏 */}
      <ImportExportBar
        onExportJson={exportAll}
        onImportJson={importAll}
        onExportMd={exportDesignMd}
        onImportMd={importDesignMd}
        onReset={handleReset}
      />

      {/* Token 分组列表 */}
      <TokenGroupList
        searchQuery={styleSearch}
        onSearchQueryChange={setStyleSearch}
        activeToken={locateActiveToken}
        onTokenSelect={setLocateActiveToken}
        nonColorTokens={nonColorTokens}
        derivedColorTokens={derivedColorTokens}
        baseColorTokens={baseColorTokens}
        surfaceTokens={[]}
        locateMode={locateMode}
        filterLocate={filterLocate}
        targetGroups={targetGroups}
        forceUpdate={forceUpdate}
        showColors={showColors}
        showPreview={showPreview}
        showStyle={showStyle}
        onShowColorsChange={setShowColors}
        onShowPreviewChange={setShowPreview}
        onShowStyleChange={setShowStyle}
        groupLabels={GROUP_LABELS}
        groupIcons={GROUP_ICONS}
        renderTokenControl={(token) => <TokenControl key={token.name} token={token} onChange={forceUpdate as any} />}
      />

      <div className="px-4 py-2 border-t text-[10px] shrink-0" style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>修改实时生效</div>
    </div>
  )
}

// ── TokenControl 及其子组件（保持原样） ──

function TokenControl({ token, onChange: _onChange }: { token: TokenDef; onChange: (n: number) => void }) {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(token.name).trim() || token.defaultValue
  const raw = getRawToken(token.name) || token.defaultValue
  const isLinked = token.ref != null && raw.startsWith('var(')
  const parentLabel = token.ref ? (TOKENS.find((t) => t.name === token.ref)?.label ?? token.ref) : undefined
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
