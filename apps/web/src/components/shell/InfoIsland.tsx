/**
 * InfoIsland — 顶栏中间的 Dynamic Island。
 *
 * 常驻：连接状态点 + 上下文进度条 + 轮次数
 * Hover 展开：精确数字 + token 用量 + 成本估算
 */
import { useState } from 'react'

interface Props {
  status?: 'connected' | 'disconnected'
  isProcessing?: boolean
  turnCount?: number
  /** 已使用 token */
  usedTokens?: number
  /** 上下文窗口大小 */
  contextWindow?: number
  /** 最近一次模型调用的用量 */
  lastUsage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number } | null
  /** 会话累计输入 token（未命中缓存） */
  accInputTokens?: number
  /** 会话累计输出 token */
  accOutputTokens?: number
  /** 会话累计命中缓存的输入 token */
  accCachedInputTokens?: number
  /** 货币（显示用）'USD' | 'CNY' */
  currency?: string
  /** 当前模型的定价信息 */
  modelPricing?: { inputPrice?: number; cachedInputPrice?: number; outputPrice?: number }
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

const USD_CNY_RATE = 7.3

function formatCost(cost: number, currency: string): string {
  if (currency === 'CNY') {
    return `¥${(cost * USD_CNY_RATE).toFixed(4)}`
  }
  return `$${cost.toFixed(6)}`
}

/** 将模型结果中的 usage 转换为预估成本 */
function estimateCost(
  usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number } | null | undefined,
  pricing: { inputPrice?: number; cachedInputPrice?: number; outputPrice?: number } | undefined,
): number | null {
  if (!usage || !pricing) return null
  let total = 0
  // 未命中缓存的输入
  const uncached = (usage.inputTokens ?? 0) - (usage.cachedInputTokens ?? 0)
  if (uncached > 0 && pricing.inputPrice) {
    total += (uncached / 1000000) * pricing.inputPrice
  }
  // 命中缓存的输入（使用缓存价格，未设置时回退到 inputPrice）
  if (usage.cachedInputTokens && (pricing.cachedInputPrice ?? pricing.inputPrice)) {
    total += (usage.cachedInputTokens / 1000000) * (pricing.cachedInputPrice ?? pricing.inputPrice!)
  }
  // 输出
  if (usage.outputTokens && pricing.outputPrice) {
    total += (usage.outputTokens / 1000000) * pricing.outputPrice
  }
  return total > 0 ? total : null
}

export function InfoIsland({ status, isProcessing, turnCount, usedTokens, contextWindow, lastUsage, accInputTokens, accOutputTokens, accCachedInputTokens, currency, modelPricing }: Props) {
  const [hovered, setHovered] = useState(false)
  const dotKey = deriveStatus(status, isProcessing)
  const dot = STATUS_DOT[dotKey]
  const percentage = usedTokens !== undefined && contextWindow
    ? Math.min((usedTokens / contextWindow) * 100, 100)
    : undefined
  const isWarning = percentage !== undefined && percentage > 80
  const cost = estimateCost(lastUsage, modelPricing)
  const totalCost = estimateCost(
    { inputTokens: accInputTokens, outputTokens: accOutputTokens, cachedInputTokens: accCachedInputTokens },
    modelPricing,
  )
  const curSymbol = currency === 'CNY' ? '¥' : '$'

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

        {/* 成本（显示会话累积或本轮成本） */}
        {(totalCost !== null || cost !== null) && (
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--crai-fg-40)' }}>
            {totalCost !== null ? formatCost(totalCost, currency ?? 'USD') : formatCost(cost, currency ?? 'USD')}
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
              <tbody>
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
              </tbody>
            </table>

            {/* 本轮 */}
            {lastUsage?.inputTokens !== undefined && (
              <>
                <div className="text-[10px] mt-2 mb-1" style={{ color: 'var(--crai-fg-40)', opacity: 0.7 }}>本轮</div>
                <table><tbody>
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>输入</td>
                    <td className="tabular-nums">{formatToken(lastUsage.inputTokens)} tokens</td>
                  </tr>
                  <tr>
                    <td className="pl-3 pr-5" style={{ color: 'var(--crai-fg-40)' }}>├ 缓存命中</td>
                    <td className="tabular-nums" style={{ color: 'var(--crai-fg-40)' }}>{lastUsage?.cachedInputTokens != null ? formatToken(lastUsage.cachedInputTokens) + ' tokens' : '—'}</td>
                  </tr>
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>输出</td>
                    <td className="tabular-nums">{formatToken(lastUsage.outputTokens)} tokens</td>
                  </tr>
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>成本</td>
                    <td className="tabular-nums">{cost != null ? formatCost(cost, currency ?? 'USD') : '—'}</td>
                  </tr>
                </tbody></table>
              </>
            )}

            {/* 会话累计 */}
            {(accInputTokens ?? 0) > 0 && (
              <>
                <div className="text-[10px] mt-2 mb-1" style={{ color: 'var(--crai-fg-40)', opacity: 0.7 }}>会话累计</div>
                <table><tbody>
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>总成本</td>
                    <td className="tabular-nums">{totalCost !== null ? formatCost(totalCost, currency ?? 'USD') : modelPricing ? '-' : '(未设置定价)'}</td>
                  </tr>
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>输入</td>
                    <td className="tabular-nums">{formatToken(accInputTokens ?? 0)} tokens</td>
                  </tr>
                  {accCachedInputTokens !== undefined && (
                    <tr>
                      <td className="pl-3 pr-5" style={{ color: 'var(--crai-fg-40)' }}>├ 缓存命中</td>
                      <td className="tabular-nums" style={{ color: (accCachedInputTokens ?? 0) > 0 ? 'var(--crai-success)' : 'var(--crai-fg-40)' }}>{formatToken(accCachedInputTokens ?? 0)} tokens</td>
                    </tr>
                  )}
                  <tr>
                    <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>输出</td>
                    <td className="tabular-nums">{formatToken(accOutputTokens ?? 0)} tokens</td>
                  </tr>
                  {turnCount !== undefined && (
                    <tr>
                      <td className="pr-5" style={{ color: 'var(--crai-fg-40)' }}>轮次</td>
                      <td>{turnCount}</td>
                    </tr>
                  )}
                </tbody></table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
