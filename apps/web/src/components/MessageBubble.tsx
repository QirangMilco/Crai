import type { ChatMessage } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'

interface Props {
  msg: ChatMessage
}

export function MessageBubble({ msg }: Props) {
  const isUser = msg.role === 'user'

  return (
    <div
      className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      data-token-group={isUser ? 'user-msg' : 'ai-msg'}
    >
      <div
        style={{
          backgroundColor: isUser ? 'var(--crai-msg-user-bg)' : 'var(--crai-msg-assistant-bg)',
          color: isUser ? 'var(--crai-msg-user-fg)' : 'var(--crai-msg-assistant-fg)',
          borderRadius: isUser ? 'var(--crai-msg-user-radius)' : 'var(--crai-msg-assistant-radius)',
          fontSize: 'var(--crai-msg-font-size)',
          lineHeight: 'var(--crai-msg-line-height)',
          boxShadow: 'var(--crai-shadow-bubble)',
        }}
        className="px-4 py-3 max-w-[85%]"
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        ) : (
          <MarkdownRenderer content={msg.text} />
        )}
      </div>
    </div>
  )
}
