import type { ChatMessage } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'

interface Props {
  msg: ChatMessage
}

export function MessageBubble({ msg }: Props) {
  const isUser = msg.role === 'user'

  return (
    <div
      className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom: 'var(--crai-msg-gap, 8px)' }}
      data-token-group={isUser ? 'user-msg' : 'ai-msg'}
    >
      <div
        style={{
          backgroundColor: isUser ? 'var(--crai-msg-user-bg)' : 'var(--crai-msg-assistant-bg)',
          color: isUser ? 'var(--crai-msg-user-fg)' : 'var(--crai-msg-assistant-fg)',
          borderRadius: isUser ? 'var(--crai-msg-user-radius)' : 'var(--crai-msg-assistant-radius)',
          fontSize: isUser ? 'var(--crai-msg-user-font-size)' : 'var(--crai-msg-ai-font-size)',
          lineHeight: isUser ? 'var(--crai-msg-user-line-height)' : 'var(--crai-msg-ai-line-height)',
          boxShadow: 'var(--crai-shadow-bubble)',
          padding: 'var(--crai-msg-padding-y, 12px) var(--crai-msg-padding-x, 16px)',
          maxWidth: isUser ? 'var(--crai-msg-user-max-width)' : 'var(--crai-msg-max-width)',
        }}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        ) : (
          <MarkdownRenderer content={msg.text} />
        )}
      </div>
    </div>
  )
}
