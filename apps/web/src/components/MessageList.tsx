import { useRef, useEffect } from 'react'
import type { ChatMessage } from '../types/messages'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: ChatMessage[]
  className?: string
}

export function MessageList({ messages, className = '' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className={`flex-1 overflow-y-auto px-[var(--crai-chat-padding)] ${className}`}>
      <div
        className="mx-auto"
        style={{ maxWidth: 'var(--crai-chat-max-width)' }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
