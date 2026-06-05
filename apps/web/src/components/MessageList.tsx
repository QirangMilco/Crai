import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '../types/messages'
import { MessageBubble } from './MessageBubble'
import { useChatStore } from '../store/chat'

interface Props {
  messages: ChatMessage[]
  className?: string
  rollbackPoints?: Map<number, { turnId: string; fileCount: number }>
}

export function MessageList({ messages, className = '', rollbackPoints }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const setActiveTurnIndex = useChatStore((s) => s.setActiveTurnIndex)
  const isStreaming = messages.some((m) => m.role !== 'user' && m.activities?.some((a) => a.status === 'running'))


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' })
  })

  // 会话导航跳转
  useEffect(() => {
    const handler = (e: CustomEvent<{ index: number }>) => {
      const container = listRef.current
      if (!container) return
      const children = container.children
      const target = children[e.detail.index] as HTMLElement | undefined
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('crai:scroll-to-message', handler as EventListener)
    return () => window.removeEventListener('crai:scroll-to-message', handler as EventListener)
  }, [])

  // 滚动时更新导航高亮
  useEffect(() => {
    const scrollEl = scrollRef.current
    const listEl = listRef.current
    if (!scrollEl || !listEl) return

    const onScroll = () => {
      const scrollCenter = scrollEl.scrollTop + scrollEl.clientHeight / 2
      const children = listEl.children
      const scrollRect = scrollEl.getBoundingClientRect()
      let closestUser: number | null = null
      let closestDist = Infinity
      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement
        const rect = el.getBoundingClientRect()
        const mid = rect.top - scrollRect.top + scrollEl.scrollTop + rect.height / 2
        const dist = Math.abs(mid - scrollCenter)
        if (dist < closestDist) {
          closestDist = dist
          if (messages[i]?.role === 'user') {
            closestUser = i
          }
        }
      }
      if (closestUser !== null) {
        setActiveTurnIndex(closestUser)
      }
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [messages, setActiveTurnIndex, scrollRef])

  const total = messages.length

  return (
    <div className={`flex-1 overflow-y-auto ${className}`}
      ref={scrollRef}
      style={{ overflowAnchor: 'auto' }}
    >
      <div className="mx-auto px-[var(--crai-chat-padding)]"
        style={{ maxWidth: 'var(--crai-chat-max-width)', width: '100%', paddingBottom: 'var(--crai-gap, 0px)' }}
      >
        <div className="w-full" ref={listRef}>
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
              // 轮次分割线：上一个消息是 assistant 且当前是 user → 新轮次开始
              const isTurnBoundary = idx > 0 && messages[idx - 1]?.role === 'assistant' && msg.role === 'user'
              return (
                <motion.div
                  key={msg.id}
                  initial={isRecent ? { opacity: 0, y: 12 } : undefined}
                  animate={isRecent ? { opacity: 1, y: 0 } : undefined}
                  transition={isRecent ? { type: 'spring', stiffness: 300, damping: 28 } : undefined}
                >
                  {/* 轮次分割线 */}
                  {isTurnBoundary && (
                    <div
                      className="w-full my-4"
                      style={{
                        height: '1px',
                        backgroundColor: 'color-mix(in srgb, var(--crai-fg) 6%, transparent)',
                      }}
                    />
                  )}
                  <MessageBubble msg={msg} fileCount={rollbackPoints?.get(idx)?.fileCount} messageIndex={idx} />
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
