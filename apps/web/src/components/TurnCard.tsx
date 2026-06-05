/**
 * TurnCard — 活跃 turn 的渲染组件。
 *
 * 显示正在流式的 AI 回复（独立于 messages，不存在占位消息）。
 * 包含：
 * - 活动条（思考、工具调用）
 * - 流式文本
 * - 复制按钮（流式完成后显示）
 */
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { TurnState } from '../store/chat'
import { ActivityTimeline } from './markdown/ActivityTimeline'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { ThreeDotIndicator } from './markdown/ThreeDotIndicator'
import { Icon } from './ui/Icon'

interface Props {
  turn: TurnState
}

export function TurnCard({ turn }: Props) {
  const [copied, setCopied] = useState(false)
  const hasActivities = turn.activities.length > 0
  const hasText = turn.streamedText.length > 0

  return (
    <div className="flex flex-col items-start w-full"
      style={{ paddingLeft: 'var(--crai-msg-padding-x, 16px)', paddingRight: 'var(--crai-msg-padding-x, 16px)' }}
    >
      {hasActivities && (
        <ActivityTimeline activities={turn.activities} />
      )}
      <div
        style={{
          fontSize: 'var(--crai-msg-ai-font-size)',
          lineHeight: 'var(--crai-msg-ai-line-height)',
          maxWidth: 'var(--crai-msg-max-width)',
          width: '100%',
        }}
      >
        {hasText ? (
          <div className="prose prose-sm max-w-none" style={{ fontFamily: 'var(--crai-font-serif)' }}>
            <MarkdownRenderer content={turn.streamedText} />
          </div>
        ) : hasActivities ? (
          <ThreeDotIndicator />
        ) : null}
      </div>
      {hasText && (
        <div className="flex items-center gap-1 mt-1" style={{ opacity: 0.5 }}>
          <button onClick={() => { navigator.clipboard.writeText(turn.streamedText); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="hover:opacity-100 transition-opacity"
            style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            title={copied ? '已复制' : '复制消息'}>
            <Icon icon={copied ? Check : Copy} size="xs" />
          </button>
        </div>
      )}
    </div>
  )
}
