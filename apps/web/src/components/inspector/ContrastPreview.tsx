/**
 * ContrastPreview — Inspector 中的对比度预览面板。
 *
 * 自动检测前景/背景组合并计算 WCAG 对比度。
 * 低于 AA 标准的组合显示警告。
 */
import { useState, useEffect, useCallback } from 'react'
import {
  contrastRatio,
  wcagLevel,
  resolvePairs,
  DEFAULT_CONTRAST_PAIRS,
  type ContrastPair,
  type WcagLevel,
} from './contrast-utils'

const LEVEL_COLORS: Record<WcagLevel, string> = {
  AAA: 'var(--crai-success)',
  AA: 'var(--crai-success)',
  'AA-Large': 'var(--crai-info)',
  Fail: 'var(--crai-destructive)',
}

function LevelBadge({ level }: { level: WcagLevel }) {
  return (
    <span
      className="text-[10px] font-medium px-1 rounded shrink-0"
      style={{
        backgroundColor: `color-mix(in srgb, ${LEVEL_COLORS[level]} 15%, transparent)`,
        color: LEVEL_COLORS[level],
      }}
    >
      {level === 'AA-Large' ? 'AA(L)' : level}
    </span>
  )
}

export function ContrastPreview() {
  const [pairs, setPairs] = useState<ContrastPair[]>(() => resolvePairs(DEFAULT_CONTRAST_PAIRS))
  const [collapsed, setCollapsed] = useState(false)

  const refresh = useCallback(() => {
    setPairs(resolvePairs(DEFAULT_CONTRAST_PAIRS))
  }, [])

  // 每次组件挂载和 tab 切换时刷新
  useEffect(() => {
    refresh()
    // 每 2 秒自动刷新（适应 Inspector 实时修改）
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [refresh])

  const failCount = pairs.filter((p) => {
    if (!p.fgValue || !p.bgValue) return false
    const r = contrastRatio(p.fgValue, p.bgValue)
    return r !== null && r < 3
  }).length

  const copyResults = useCallback(() => {
    const lines = pairs.map((p) => {
      if (!p.fgValue || !p.bgValue) return `${p.label}: 无法解析`
      const r = contrastRatio(p.fgValue, p.bgValue)
      if (r === null) return `${p.label}: 无法计算`
      const level = wcagLevel(r)
      return `${p.label}  ${r.toFixed(1)}:1  ${level}`
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }, [pairs])

  return (
    <div className="border-t" style={{ borderColor: 'var(--crai-border)' }}>
      {/* 折叠头 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs font-medium transition-colors"
        style={{ color: failCount > 0 ? 'var(--crai-destructive)' : 'var(--crai-fg-secondary)' }}
      >
        <span className="flex items-center gap-2">
          对比度
          {failCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--crai-destructive) 15%, transparent)', color: 'var(--crai-destructive)' }}
            >
              {failCount} 项风险
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); refresh() }}
            className="opacity-40 hover:opacity-100 transition-opacity ml-1"
            title="刷新"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); copyResults() }}
            className="opacity-40 hover:opacity-100 transition-opacity ml-1"
            title="复制结果"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </span>
        <span>{collapsed ? '展开' : '折叠'}</span>
      </button>

      {/* 内容 */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1">
          {pairs.map((pair) => {
            if (!pair.fgValue || !pair.bgValue) return null
            const ratio = contrastRatio(pair.fgValue, pair.bgValue)
            if (ratio === null) return null

            const level = wcagLevel(ratio)
            const isFail = level === 'Fail'

            return (
              <div
                key={pair.label}
                className="flex items-center gap-2 py-1 px-2 rounded text-[11px]"
                style={{
                  backgroundColor: isFail ? 'color-mix(in srgb, var(--crai-destructive) 6%, transparent)' : 'transparent',
                }}
              >
                {/* 色块预览 */}
                <div
                  className="shrink-0 rounded"
                  style={{
                    width: 20,
                    height: 14,
                    backgroundColor: pair.bgValue,
                    border: '1px solid color-mix(in srgb, var(--crai-fg) 8%, transparent)',
                  }}
                >
                  <div
                    className="w-full h-full flex items-center justify-center text-[6px] font-bold"
                    style={{ color: pair.fgValue }}
                  >
                    Aa
                  </div>
                </div>

                {/* 标签 */}
                <span className="flex-1 truncate" style={{ color: 'var(--crai-fg)' }}>
                  {pair.label}
                </span>

                {/* 比例 */}
                <span
                  className="tabular-nums shrink-0"
                  style={{ color: isFail ? 'var(--crai-destructive)' : 'var(--crai-fg-40)' }}
                >
                  {ratio.toFixed(1)}:1
                </span>

                {/* 评级 */}
                <LevelBadge level={level} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
