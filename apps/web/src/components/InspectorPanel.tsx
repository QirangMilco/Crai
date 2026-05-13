/**
 * InspectorPanel — 注册表驱动的样式调优面板。
 *
 * 读取 @/theme/tokens.ts 的 TOKENS 数组，
 * 按 group 分组自动生成色彩选择器、尺寸滑块、数值输入框。
 * 新增组件只需在 tokens.ts 中加一条记录，无需修改此文件。
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TOKENS, tokensByGroup, setToken, resetToken, resetGroup, resetAll,
  exportTokens, importTokens, THEME_PRESETS,
  type TokenDef, type TokenGroup
} from '../theme/tokens'

const GROUP_LABELS: Record<TokenGroup, string> = {
  base: '基础',
  message: '消息气泡',
  markdown: 'Markdown',
  input: '输入框',
  layout: '布局',
}

interface Props {
  dark: boolean
  onToggleDark: () => void
  onClose: () => void
}

export function InspectorPanel({ dark, onToggleDark, onClose }: Props) {
  const groups = tokensByGroup()
  const [expanded, setExpanded] = useState<Set<TokenGroup>>(new Set(['base']))
  const [, forceUpdate] = useState(0)

  const toggleGroup = useCallback((g: TokenGroup) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }, [])

  const handleChange = useCallback((token: TokenDef, value: string) => {
    setToken(token.name, value)
    forceUpdate((n) => n + 1)
  }, [])

  return (
    <div
      className="fixed top-0 right-0 h-full z-50 shadow-2xl flex flex-col text-sm overflow-hidden"
      style={{
        width: 'var(--crai-panel-width)',
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        borderLeft: '1px solid var(--crai-border)',
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Inspector</span>
        <div className="flex gap-2">
          <button onClick={onToggleDark}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            {dark ? '☀ 浅色' : '🌙 深色'}
          </button>
          <button onClick={() => { resetAll(); forceUpdate((n) => n + 1) }}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--crai-destructive)', border: '1px solid var(--crai-destructive)' }}>
            重置全部
          </button>
          <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
        </div>
      </div>

      {/* 预设选择器 */}
      <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex gap-2">
          <select onChange={(e) => {
            if (!e.target.value) return
            const preset = THEME_PRESETS.find((p) => p.name === e.target.value)
            if (preset) { importTokens(preset.tokens); forceUpdate((n) => n + 1) }
            e.target.value = ''
          }}
            className="flex-1 text-xs px-2 py-1.5 rounded outline-none"
            style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}>
            <option value="">🎨 应用预设配色…</option>
            {THEME_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <button onClick={() => {
            const data = exportTokens()
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `crai-theme-${Date.now()}.json`
            a.click()
          }}
            className="text-xs px-2 py-1.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            导出
          </button>
          <button onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = () => {
              const file = input.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string)
                  importTokens(data)
                  forceUpdate((n) => n + 1)
                } catch { alert('无效的配置文件') }
              }
              reader.readAsText(file)
            }
            input.click()
          }}
            className="text-xs px-2 py-1.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            导入
          </button>
        </div>
      </div>

      {/* 分组列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {(Object.keys(groups) as TokenGroup[]).map((group) => (
          <div key={group}>
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--crai-fg-secondary)' }}>
              <span>{GROUP_LABELS[group]}</span>
              <span className="text-[10px]">{expanded.has(group) ? '▼' : '▶'}</span>
            </button>

            {expanded.has(group) && (
              <div className="ml-1 pl-2 border-l" style={{ borderColor: 'var(--crai-border)' }}>
                {groups[group].map((token) => (
                  <TokenControl key={token.name} token={token} onChange={handleChange} />
                ))}
                <button
                  onClick={() => { resetGroup(group); forceUpdate((n) => n + 1) }}
                  className="text-[10px] px-2 py-0.5 mt-1 mb-2 rounded"
                  style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>
                  重置分组
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部 */}
      <div className="px-4 py-2 border-t text-[10px] shrink-0"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>
        修改实时生效，退出时保存
      </div>
    </div>
  )
}

// ── 单个 token 控件 ──

function TokenControl({ token, onChange }: { token: TokenDef; onChange: (t: TokenDef, v: string) => void }) {
  const val = getComputedStyle(document.documentElement).getPropertyValue(token.name).trim() || token.defaultValue

  if (token.type === 'color') {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <input type="color" value={toHex(val)} onChange={(e) => onChange(token, e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] truncate" style={{ color: 'var(--crai-fg)' }}>{token.label}</div>
          <div className="text-[10px] font-mono truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>{val}</div>
        </div>
        <button onClick={() => onChange(token, token.defaultValue)}
          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
    )
  }

  if (token.type === 'size') {
    const num = parseFloat(val)
    const unit = val.replace(/[\d.-]/g, '') || 'px'
    const isMulti = val.includes(' ') && val.split(' ').length === 4

    if (isMulti) {
      const parts = val.split(' ').map((s) => parseFloat(s))
      const avg = parts.reduce((a, b) => a + b, 0) / parts.length
      return (
        <div className="py-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px]" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{val}</span>
          </div>
          <input type="range" min={token.min ?? 0} max={token.max ?? 48} step="1"
            value={isNaN(avg) ? 12 : Math.round(avg)}
            onChange={(e) => {
              const v = e.target.value + unit
              onChange(token, `${v} ${v} ${v} ${v}`)
            }}
            className="inspector-slider w-full" />
        </div>
      )
    }

    return (
      <div className="py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px]" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--crai-fg-tertiary)' }}>{val}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="range" min={token.min ?? 0} max={token.max ?? 60} step="1"
            value={isNaN(num) ? 14 : num}
            onChange={(e) => onChange(token, e.target.value + unit)}
            className="inspector-slider flex-1" />
          <button onClick={() => onChange(token, token.defaultValue)}
            className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
            style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
        </div>
      </div>
    )
  }

  if (token.type === 'select') {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[11px] flex-1" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
        <select value={val} onChange={(e) => onChange(token, e.target.value)}
          className="text-xs px-2 py-1 rounded outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }}>
          {(token.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <button onClick={() => onChange(token, token.defaultValue)}
          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ color: 'var(--crai-fg-tertiary)', border: '1px solid var(--crai-border)' }}>默认</button>
      </div>
    )
  }

  // number
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px]" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
        <input type="number" step="0.1" value={val}
          onChange={(e) => onChange(token, e.target.value)}
          className="w-16 text-xs px-2 py-0.5 rounded text-right font-mono outline-none"
          style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
      </div>
    </div>
  )
}

function toHex(color: string): string {
  // 如果已经是 hex 格式，直接返回
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }
  // 其他格式（rgb, oklch 等）无法直接转为颜色选择器的值，返回默认
  return '#4f46e5'
}
