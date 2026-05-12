import type { ChatMessage } from '../types/messages'

interface Props {
  msg: ChatMessage
}

export function MessageBubble({ msg }: Props) {
  const isUser = msg.role === 'user'

  return (
    <div
      class={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      style={{ maxWidth: 'var(--crai-msg-max-width)' }}
    >
      <div
        style={{
          backgroundColor: isUser ? 'var(--crai-msg-user-bg)' : 'var(--crai-msg-assistant-bg)',
          color: isUser ? 'var(--crai-msg-user-fg)' : 'var(--crai-msg-assistant-fg)',
          borderRadius: isUser ? 'var(--crai-msg-user-radius)' : 'var(--crai-msg-assistant-radius)',
          fontSize: 'var(--crai-msg-font-size)',
          lineHeight: 'var(--crai-msg-line-height)',
        }}
        class="px-4 py-3 max-w-[85%] whitespace-pre-wrap break-words shadow-sm"
      >
        {msg.text}
      </div>
    </div>
  )
}
