import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
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

  const total = messages.length

  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      <div className="mx-auto px-[var(--crai-chat-padding)]"
        style={{ maxWidth: 'var(--crai-chat-max-width)', width: '100%', paddingBottom: 'var(--crai-gap, 0px)' }}
      >
        <div className="w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] opacity-30 select-none">
              <div className="text-3xl mb-3">💬</div>
              <div className="text-xs">开始对话，在下方输入消息</div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isRecent = idx >= total - 2
              return (
                <motion.div
                  key={msg.id}
                  layout={isRecent}
                  initial={isRecent ? { opacity: 0, y: 12 } : undefined}
                  animate={isRecent ? { opacity: 1, y: 0 } : undefined}
                  transition={isRecent ? { type: 'spring', stiffness: 300, damping: 28 } : undefined}
                >
                  <MessageBubble msg={msg} />
                </motion.div>
              )
            })
          )}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
