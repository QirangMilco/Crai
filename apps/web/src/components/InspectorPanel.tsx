import { useState, useEffect } from 'react'
import { TOKENS, type TokenDef, type ExportedConfig } from '../types/inspector'

interface Props {
  /** 当前是否暗色模式。 */
  dark: boolean
  /** 切换暗色/亮色。 */
  onToggleDark: () => void
  /** 关闭面板。 */
  onClose: () => void
}

/**
 * Crai Inspector — 浮动 DevTools 面板。
 *
 * 列举所有 CSS 变量，提供对应的控件进行实时调节。
 * 可导出配置复现同样的视觉效果。
 */
export function InspectorPanel({ dark, onToggleDark, onClose }: Props) {
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState<string>('theme')

  // 初始化：从 CSS 变量读取当前值
  useEffect(() => {
    const root = document.documentElement
    const values: Record<string, string> = {}
    for (const t of TOKENS) {
      if (t.key.startsWith('_')) continue // 特殊处理
      const val = getComputedStyle(root).getPropertyValue(`--crai-${t.key}`).trim()
      if (val) values[t.key] = val
    }
    setTokenValues(values)
  }, [])

  // 更新 CSS 变量
  function updateToken(key: string, value: string) {
    document.documentElement.style.setProperty(`--crai-${key}`, value)
    setTokenValues((prev) => ({ ...prev, [key]: value }))
  }

  // 导出配置
  function exportConfig() {
    const config: ExportedConfig = {
      tokens: { ...tokenValues },
      darkMode: dark,
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'crai-theme.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // 按分类分组
  const categories = ['theme', 'message', 'layout', 'effects'] as const
  const categoryLabels: Record<string, string> = {
    theme: '主题色', message: '消息气泡', layout: '布局', effects: '动效',
  }

  return (
    <div className="fixed top-0 right-0 h-full w-80 z-50 shadow-2xl flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--crai-bg)',
        color: 'var(--crai-fg)',
        borderLeft: '1px solid var(--crai-border)',
      }}
    >
      {/* ── 标题栏 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--crai-border)' }}>
        <span className="font-semibold text-base">Crai Inspector</span>
        <button onClick={onClose} className="text-lg leading-none opacity-50 hover:opacity-100">✕</button>
      </div>

      {/* ── 工具栏 ── */}
      <div className="flex gap-2 px-4 py-2 border-b flex-wrap"
        style={{ borderColor: 'var(--crai-border)' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeCategory === cat ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
              color: activeCategory === cat ? '#fff' : 'var(--crai-fg-secondary)',
            }}
          >
            {categoryLabels[cat]}
          </button>
        ))}

        <div className="flex-1" />

        {/* 暗色切换 */}
        <button
          onClick={onToggleDark}
          className="px-2 py-1 rounded text-xs"
          style={{ backgroundColor: 'var(--crai-bg-tertiary)' }}
          title="切换暗色/亮色"
        >
          {dark ? '☀' : '☾'}
        </button>

        {/* 导出 */}
        <button
          onClick={exportConfig}
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: 'var(--crai-accent)', color: '#fff' }}
        >
          导出
        </button>
      </div>

      {/* ── 参数列表 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {TOKENS
          .filter((t) => t.category === activeCategory)
          .map((token) => (
            <TokenControl
              key={token.key}
              token={token}
              value={tokenValues[token.key] ?? ''}
              onChange={(v) => updateToken(token.key, v)}
            />
          ))}
      </div>

      {/* ── 底部提示 ── */}
      <div className="px-4 py-2 border-t text-xs"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-tertiary)' }}>
        Crai Inspector · 调整实时生效
      </div>
    </div>
  )
}

// ── 单个参数控件 ──

function TokenControl({ token, value, onChange }: {
  token: TokenDef
  value: string
  onChange: (v: string) => void
}) {
  if (token.key.startsWith('_')) {
    // 特殊控件
    if (token.key === '_radius_preset') {
      return (
        <SelectControl token={token} value={value} onChange={onChange} />
      )
    }
    return null
  }

  switch (token.control) {
    case 'color':
      return <ColorControl token={token} value={value} onChange={onChange} />
    case 'slider':
      return <SliderControl token={token} value={value} onChange={onChange} />
    default:
      return (
        <div className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
          {token.label}: 未实现
        </div>
      )
  }
}

function ColorControl({ token, value, onChange }: { token: TokenDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border-0 p-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium" style={{ color: 'var(--crai-fg)' }}>{token.label}</div>
        <div className="text-xs truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>
          {value || '—'}
        </div>
      </div>
    </div>
  )
}

function SliderControl({ token, value, onChange }: { token: TokenDef; value: string; onChange: (v: string) => void }) {
  const numVal = parseFloat(value) || token.min || 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
        <span style={{ color: 'var(--crai-fg-tertiary)' }}>{value}</span>
      </div>
      <input
        type="range"
        min={token.min}
        max={token.max}
        step={token.step}
        value={numVal}
        onChange={(e) => {
          const v = token.step && token.step < 1 ? parseFloat(e.target.value).toFixed(1) : e.target.value
          onChange(`${v}${value.endsWith('px') ? 'px' : ''}`)
        }}
        className="inspector-slider"
      />
    </div>
  )
}

function SelectControl({ token, value, onChange }: { token: TokenDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs shrink-0" style={{ color: 'var(--crai-fg)' }}>{token.label}</span>
      <select
        value={value}
        onChange={(e) => {
          // 移除旧的 radius class，添加新的
          document.documentElement.classList.remove('radius-none', 'radius-square', 'radius-pill')
          if (e.target.value) document.documentElement.classList.add(e.target.value)
          onChange(e.target.value)
        }}
        className="flex-1 rounded px-2 py-1 text-xs outline-none"
        style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', borderColor: 'var(--crai-border)', borderWidth: 1 }}
      >
        {token.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

/** 将任意颜色字符串转为 #rrggbb 格式，供 <input type="color"> 使用。 */
function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  // 简单处理 oklch / rgb 等格式：返回一个默认色
  const temp = document.createElement('div')
  temp.style.color = color
  document.body.appendChild(temp)
  const computed = getComputedStyle(temp).color
  document.body.removeChild(temp)
  // 从 rgb(r, g, b) 转为 hex
  const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const [_, r, g, b] = match
    return '#' + [r, g, b].map((n) => parseInt(n).toString(16).padStart(2, '0')).join('')
  }
  return '#6366f1'
}
