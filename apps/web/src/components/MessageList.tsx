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
  const isStreaming = messages.some((m) => m.role !== 'user' && m.activities?.some((a) => a.status === 'running'))

  useEffect(() => {
    // 流式传输中立刻跳转到底部（smooth 会与布局变化冲突）
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' })
  })

  const total = messages.length

  return (
    <div className={`flex-1 overflow-y-auto ${className}`}
      style={{ overflowAnchor: 'auto' }}
    >
      <div className="mx-auto px-[var(--crai-chat-padding)]"
        style={{ maxWidth: 'var(--crai-chat-max-width)', width: '100%', paddingBottom: 'var(--crai-gap, 0px)' }}
      >
        <div className="w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] select-none">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--crai-fg-40)', marginBottom: 12, opacity: 0.5 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <div className="text-xs" style={{ color: 'var(--crai-fg-40)' }}>输入消息开始对话</div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isRecent = idx >= total - 2
              return (
                <motion.div
                  key={msg.id}
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
