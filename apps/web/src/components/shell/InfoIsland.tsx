/**
 * InfoIsland — 顶栏中间的 Dynamic Island。
 *
 * 常驻：连接状态点 + 上下文进度条 + 轮次数
 * Hover 展开：精确数字
 */
import { useState } from 'react'

interface Props {
  status?: 'connected' | 'disconnected'
  isProcessing?: boolean
  turnCount?: number
  /** 已使用 token（服务端推送后生效） */
  usedTokens?: number
  /** 上下文窗口大小 */
  contextWindow?: number
}

function formatToken(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  idle: { color: 'var(--crai-success)', label: '空闲' },
  processing: { color: 'var(--crai-info)', label: '处理中' },
  disconnected: { color: 'var(--crai-fg-40)', label: '断开' },
  error: { color: 'var(--crai-destructive)', label: '错误' },
}

function deriveStatus(status?: string, isProcessing?: boolean): keyof typeof STATUS_DOT {
  if (status === 'disconnected') return 'disconnected'
  if (isProcessing) return 'processing'
  return 'idle'
}

export function InfoIsland({ status, isProcessing, turnCount, usedTokens, contextWindow }: Props) {
  const [hovered, setHovered] = useState(false)
  const dotKey = deriveStatus(status, isProcessing)
  const dot = STATUS_DOT[dotKey]
  const percentage = usedTokens !== undefined && contextWindow
    ? Math.min((usedTokens / contextWindow) * 100, 100)
    : undefined
  const isWarning = percentage !== undefined && percentage > 80

  return (
    <div
      className="relative select-none inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 胶囊 */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md cursor-default transition-all duration-150"
        style={{
          backgroundColor: hovered ? 'var(--crai-bg-5)' : 'var(--crai-bg-tertiary)',
          border: '1px solid var(--crai-border)',
        }}
      >
        {/* 状态点 */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dot.color }}
        />

        {/* 进度条 */}
        <div
          className="rounded-full shrink-0"
          style={{ width: 48, height: 4, backgroundColor: 'var(--crai-bg-5)', overflow: 'hidden' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(percentage ?? 15, 2)}%`,
              backgroundColor: isWarning ? 'var(--crai-info)' : 'var(--crai-accent)',
            }}
          />
        </div>

        {/* token */}
        <span
          className="text-[11px] tabular-nums font-medium"
          style={{ color: isWarning ? 'var(--crai-info)' : 'var(--crai-fg-60)' }}
        >
          {usedTokens !== undefined ? formatToken(usedTokens) : '?'}
          {contextWindow ? `/${formatToken(contextWindow)}` : ''}
        </span>

        {/* 轮次 */}
        {turnCount !== undefined && turnCount > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--crai-fg-40)' }}>
            {turnCount}轮
          </span>
        )}
      </div>

      {/* 弹出 */}
      {hovered && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 pt-2"
          style={{ zIndex: 200 }}
        >
          <div
            className="rounded-lg text-xs whitespace-nowrap leading-relaxed"
            style={{
              backgroundColor: 'var(--crai-bg)',
              border: '1px solid var(--crai-border)',
              boxShadow: 'var(--crai-shadow-elevated)',
              padding: '10px 14px',
              color: 'var(--crai-fg)',
            }}
          >
            <table>
              <tr>
                <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>状态</td>
                <td style={{ color: dot.color }}>{dot.label}</td>
              </tr>
              {percentage !== undefined && (
                <tr>
                  <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>上下文</td>
                  <td className="tabular-nums">{percentage.toFixed(1)}%</td>
                </tr>
              )}
              {usedTokens !== undefined && contextWindow !== undefined && (
                <tr>
                  <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>Tokens</td>
                  <td className="tabular-nums">{formatToken(usedTokens)} / {formatToken(contextWindow)}</td>
                </tr>
              )}
              {turnCount !== undefined && (
                <tr>
                  <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>轮次</td>
                  <td>{turnCount}</td>
                </tr>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
