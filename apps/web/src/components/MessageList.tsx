/**
 * MessageList — 消息列表区域。
 *
 * 支持消息交错入场动画（staggered entry）。
 */
import { useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
    <div className={`flex-1 overflow-y-auto px-[var(--crai-chat-padding)] mx-auto ${className}`}
      style={{ maxWidth: 'var(--crai-chat-max-width)', width: '100%', paddingBottom: 'var(--crai-gap, 0px)' }}
    >
      <div className="w-full">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 28,
                // 相邻消息交错 30ms，最多交错 300ms（10 条以上不继续延迟）
                delay: Math.min(idx * 0.03, 0.3),
              }}
            >
              <MessageBubble msg={msg} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
