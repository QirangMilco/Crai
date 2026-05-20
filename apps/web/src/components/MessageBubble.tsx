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
      <div
        style={{
          backgroundColor: isError
            ? 'var(--crai-tool-error)'
            : isUser
              ? 'var(--crai-msg-user-bg)'
              : 'var(--crai-msg-assistant-bg)',
          color: isError
            ? '#fff'
            : isUser
              ? 'var(--crai-msg-user-fg)'
              : 'var(--crai-msg-assistant-fg)',
          borderRadius: isUser ? 'var(--crai-msg-user-radius)' : 'var(--crai-msg-assistant-radius)',
          fontSize: isUser ? 'var(--crai-msg-user-font-size)' : 'var(--crai-msg-ai-font-size)',
          lineHeight: isUser ? 'var(--crai-msg-user-line-height)' : 'var(--crai-msg-ai-line-height)',
          boxShadow: 'var(--crai-shadow-bubble)',
          padding: 'var(--crai-msg-padding-y, 12px) var(--crai-msg-padding-x, 16px)',
          width: isUser ? undefined : '100%',
          maxWidth: isUser ? 'var(--crai-msg-user-max-width)' : isError ? '100%' : 'var(--crai-msg-max-width)',
        }}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        ) : isError ? (
          <div style={{ fontSize: 13 }}>{msg.text}</div>
        ) : (
          <>
            {msg.activities && msg.activities.length > 0 && (
              <ActivityTimeline activities={msg.activities} />
            )}
            {msg.text ? (
              <MarkdownRenderer content={msg.text} />
            ) : msg.activities?.some((a) => a.status === 'running') ? (
              <ThreeDotIndicator />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export const MessageBubble = memo(Bubble, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.text === next.msg.text
    && prev.msg.activities === next.msg.activities
})

/** 三圆点思考指示器（思考中、尚无文本时显示）。 */
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
