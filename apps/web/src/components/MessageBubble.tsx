/**
 * MessageBubble — 消息气泡组件。
 *
 * 用户消息：彩色气泡，右对齐。
 * AI 消息：无气泡背景，直接展示在消息流中（类 CrystalAgents 风格）。
 * 错误消息：警告样式。
 */
import { memo } from 'react'
import type { ChatMessage } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { ActivityTimeline } from './markdown/ActivityTimeline'

interface Props {
  msg: ChatMessage
}

function Bubble({ msg }: Props) {
  const isUser = msg.role === 'user'
  const isError = msg.role === 'system'

  if (!isUser && !isError && !msg.text && !msg.activities?.length) {
    return null
  }

  return (
    <div
      className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom: 'var(--crai-msg-gap, 8px)' }}
      data-token-group={isUser ? 'user-msg' : 'ai-msg'}
    >
      {isUser ? (
        <div
          style={{
            backgroundColor: 'var(--crai-msg-user-bg)',
            color: 'var(--crai-msg-user-fg)',
            borderRadius: 'var(--crai-msg-user-radius)',
            fontSize: 'var(--crai-msg-user-font-size)',
            lineHeight: 'var(--crai-msg-user-line-height)',
            boxShadow: 'var(--crai-shadow-bubble)',
            padding: 'var(--crai-msg-padding-y, 12px) var(--crai-msg-padding-x, 16px)',
            maxWidth: 'var(--crai-msg-user-max-width)',
          }}
        >
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        </div>
      ) : isError ? (
        <div
          style={{
            backgroundColor: 'var(--crai-tool-error)',
            color: '#fff',
            borderRadius: 'var(--crai-msg-assistant-radius)',
            fontSize: 13,
            padding: '8px 14px',
            width: '100%',
          }}
        >
          {msg.text}
        </div>
      ) : (
        <div
          style={{
            fontSize: 'var(--crai-msg-ai-font-size)',
            lineHeight: 'var(--crai-msg-ai-line-height)',
            paddingLeft: 'var(--crai-msg-padding-x, 16px)',
            paddingRight: 'var(--crai-msg-padding-x, 16px)',
            maxWidth: 'var(--crai-msg-max-width)',
          }}
        >
          {msg.activities && msg.activities.length > 0 && (
            <ActivityTimeline activities={msg.activities} />
          )}
          {msg.text ? (
            <div className="prose prose-sm max-w-none" style={{ fontFamily: 'var(--crai-font-serif)' }}>
              <MarkdownRenderer content={msg.text} />
            </div>
          ) : msg.activities?.some((a) => a.status === 'running') ? (
            <ThreeDotIndicator />
          ) : null}
        </div>
      )}
    </div>
  )
}

export const MessageBubble = memo(Bubble, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.text === next.msg.text
    && prev.msg.activities === next.msg.activities
})

function ThreeDotIndicator() {
  const dot: React.CSSProperties = {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--crai-accent)',
    opacity: 0.4,
    animation: 'crai-think-pulse 1.4s ease-in-out infinite',
  }
  return (
    <div className="flex gap-1 items-center py-2">
      <span style={dot} />
      <span style={{ ...dot, animationDelay: '0.2s' }} />
      <span style={{ ...dot, animationDelay: '0.4s' }} />
    </div>
  )
}
