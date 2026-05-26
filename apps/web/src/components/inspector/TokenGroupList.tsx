/**
 * TokenGroupList — Token 分组列表。
 *
 * 根据搜索词显示匹配的 token 组和 token 编辑控件。
 * 包含颜色区（基色+衍生色）、表面层级预览、样式区（分组+搜索）。
 */
import { useState, useEffect } from 'react'
import { TOKENS, type TokenDef } from '../../theme/tokens'
import { ColorSwatches } from './ColorSwatches'
import { toHexCssVar } from './color-utils'

interface Props {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  activeToken: string | null
  onTokenSelect: (tokenName: string) => void
  /** 非色 token 分组数据 */
  nonColorTokens: Record<string, TokenDef[]>
  /** 衍生色 token 列表 */
  derivedColorTokens: TokenDef[]
  /** 基色 token 列表 */
  baseColorTokens: TokenDef[]
  /** 表面 token 列表（用于预览） */
  surfaceTokens: TokenDef[]
  /** 定位模式 */
  locateMode: boolean
  filterLocate: boolean
  targetGroups: string[]
  /** forceUpdate 函数，传给 TokenControl */
  forceUpdate: (n: number) => void
  /** show/hide toggle 状态 */
  showColors: boolean
  showPreview: boolean
  showStyle: boolean
  onShowColorsChange: (v: boolean) => void
  onShowPreviewChange: (v: boolean) => void
  onShowStyleChange: (v: boolean) => void
  /** CollapsibleGroup 分组标签映射 */
  groupLabels: Record<string, string>
  /** CollapsibleGroup 分组图标（svg path d 值） */
  groupIcons?: Record<string, string>
  /** 渲染单个 token 编辑控件 */
  renderTokenControl: (token: TokenDef) => React.ReactNode
}

export function TokenGroupList({
  searchQuery, onSearchQueryChange,
  activeToken, onTokenSelect,
  nonColorTokens, derivedColorTokens, baseColorTokens, surfaceTokens,
  locateMode, filterLocate, targetGroups,
  forceUpdate,
  showColors, showPreview, showStyle,
  onShowColorsChange, onShowPreviewChange, onShowStyleChange,
  groupLabels, groupIcons,
  renderTokenControl,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* ── 色块选色条 ── */}
      <ColorSwatches
        tokens={baseColorTokens}
        activeToken={activeToken}
        onSelect={onTokenSelect}
      />

      {/* ── 颜色（基色 + 衍生色） ── */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => onShowColorsChange(!showColors)}
          className="w-full flex items-center justify-between text-[11px] font-medium mb-1"
          style={{ color: 'var(--crai-fg-secondary)' }}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--crai-fg-secondary)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            颜色
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showColors ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showColors && (
          <div className="space-y-0.5">
            <CollapsibleGroup label="基色" locateMode={locateMode} defaultOpen>
              {baseColorTokens.map((token) => renderTokenControl(token))}
            </CollapsibleGroup>
            <CollapsibleGroup label="衍生色" locateMode={locateMode} defaultOpen={false}>
              {derivedColorTokens.map((token) => renderTokenControl(token))}
            </CollapsibleGroup>
          </div>
        )}
      </div>

      {/* ── 表面预览 ── */}
      <div className="px-3 py-2">
        <button
          onClick={() => onShowPreviewChange(!showPreview)}
          className="w-full flex items-center justify-between text-[11px] font-medium mb-2"
          style={{ color: 'var(--crai-fg-secondary)' }}
        >
          <span>表面层级预览</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showPreview ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showPreview && <SurfacePreview />}
      </div>

      {/* ── 样式控制（非色 token 分组） ── */}
      <div className="px-3 pb-1">
        <button
          onClick={() => onShowStyleChange(!showStyle)}
          className="w-full flex items-center justify-between text-[11px] font-medium mb-2"
          style={{ color: 'var(--crai-fg-secondary)' }}
        >
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            样式
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showStyle ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {showStyle && (
          <div className="space-y-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="搜索 token…"
              className="w-full text-[10px] px-2 py-1 rounded outline-none mb-1"
              style={{
                backgroundColor: 'var(--crai-bg-secondary)',
                color: 'var(--crai-fg)',
                border: '1px solid var(--crai-border)',
              }}
            />
            {searchQuery.trim() ? (
              (() => {
                const q = searchQuery.trim().toLowerCase()
                const matched = Object.entries(nonColorTokens).flatMap(([_group, tokens]) =>
                  tokens.filter((t) =>
                    t.label.toLowerCase().includes(q) ||
                    t.name.toLowerCase().includes(q) ||
                    (t.description ?? '').toLowerCase().includes(q)
                  )
                )
                return matched.length === 0
                  ? <div className="text-[10px] py-2 text-center" style={{ color: 'var(--crai-fg-tertiary)' }}>无匹配</div>
                  : matched.map((token) => renderTokenControl(token))
              })()
            ) : (
              Object.entries(nonColorTokens)
                .filter(([group]) => !filterLocate || targetGroups.length === 0 || targetGroups.includes(groupLabels[group] ?? group))
                .map(([group, tokens]) => (
                  <CollapsibleGroup
                    key={group}
                    label={groupLabels[group] ?? group}
                    locateMode={locateMode}
                    forceOpen={targetGroups.includes(groupLabels[group] ?? group)}
                    iconPath={groupIcons?.[group]}
                  >
                    {tokens.map((token) => renderTokenControl(token))}
                  </CollapsibleGroup>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 表面预览卡片 ──

function SurfacePreview() {
  const accentHex = toHexCssVar('--crai-accent')
  return (
    <div style={{
      borderRadius: 'var(--crai-radius-sm)',
      border: '1px solid',
      borderColor: 'var(--crai-border)',
      overflow: 'hidden',
      fontSize: 11,
    }}>
      <div style={{ backgroundColor: 'var(--crai-bg)', padding: 12 }}>
        <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--crai-fg)' }}>
          bg <span style={{ color: 'var(--crai-fg-40)' }}>— 最底层背景</span>
        </div>

        <div style={{ backgroundColor: 'var(--crai-bg-3)', borderRadius: 4, padding: '8px 10px', marginBottom: 4 }}>
          <div style={{ color: 'var(--crai-fg)' }}>bg-3 <span style={{ color: 'var(--crai-fg-40)' }}>— 消息/代码/工具背景</span></div>
        </div>

        <div style={{ backgroundColor: 'var(--crai-bg-5)', borderRadius: 4, padding: '6px 10px', marginBottom: 4 }}>
          <div style={{ color: 'var(--crai-fg)' }}>bg-5 <span style={{ color: 'var(--crai-fg-40)' }}>— hover/选中</span></div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: 'var(--crai-bg-3)', color: 'var(--crai-fg)' }}>fg 主要</div>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: 'var(--crai-bg-3)', color: 'var(--crai-fg-40)' }}>fg-40 次要</div>
          <div style={{ flex: 1, padding: '4px 6px', borderRadius: 3, backgroundColor: 'var(--crai-bg-3)', color: 'var(--crai-fg-60)' }}>fg-60 三级</div>
        </div>

        <div style={{ marginTop: 6, padding: '4px 8px', border: '1px solid', borderColor: 'var(--crai-border)', borderRadius: 3, color: 'var(--crai-fg-40)' }}>
          边框 border
        </div>

        <div style={{ marginTop: 6, padding: '4px 10px', borderRadius: 3, backgroundColor: 'var(--crai-accent)', color: '#fff', fontSize: 10, textAlign: 'center' }}>
          强调色 accent — {accentHex}
        </div>
      </div>
    </div>
  )
}

// ── 可折叠分组 ──

function CollapsibleGroup({ label, locateMode, children, defaultOpen = true, forceOpen = false, iconPath }: {
  label: string; locateMode: boolean; children: React.ReactNode; defaultOpen?: boolean; forceOpen?: boolean; iconPath?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [flash, setFlash] = useState(false)

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
        <span className="flex items-center gap-1.5">
          {iconPath && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={iconPath}/>
            </svg>
          )}
          <span>{label}</span>
        </span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="ml-1 pl-2 border-l" style={{ borderColor: 'var(--crai-border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}
