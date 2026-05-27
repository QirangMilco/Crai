/**
 * SessionNavPanel — 当前会话跳转导航。
 *
 * 以「用户消息 → AI 回复」为单位的结构化缩略时间线。
 * 每个节点对应一轮完整交互，点击跳转到对话中对应位置。
 */
import { memo, useCallback } from 'react'
import { useChatStore } from '../../store/chat'

interface NavNode {
  /** 用户消息在 messages 中的索引 */
  userIndex: number
  /** 用户消息预览 */
  preview: string
  /** AI 回复摘要（如活动数量、文本预览） */
  summary: string
}

export const SessionNavPanel = memo(function SessionNavPanel() {
  const messages = useChatStore((s) => s.messages)

  // 将 messages 分组为 [用户, AI回复] 对
  const nodes: NavNode[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user') {
      const text = m.text || ''
      const preview = text.length > 40 ? text.slice(0, 40) + '…' : text

      // 找后面的 AI 回复
      let summary = ''
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j]
        if (next.role === 'user') break
        if (next.role === 'assistant') {
          const acts = next.activities?.length ?? 0
          const txt = next.text || ''
          summary = acts > 0
            ? `${acts} 个活动${txt ? ' · ' : ''}${txt.slice(0, 24)}${txt.length > 24 ? '…' : ''}`
            : txt.slice(0, 30) + (txt.length > 30 ? '…' : '')
        }
      }

      nodes.push({ userIndex: i, preview, summary })
    }
  }

  const scrollToMessage = useCallback((userIndex: number) => {
    window.dispatchEvent(new CustomEvent('crai:scroll-to-message', { detail: { index: userIndex } }))
  }, [])

  if (nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-xs select-none"
        style={{ color: 'var(--crai-fg-40)' }}
      >
        尚无对话
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 py-2 px-3 overflow-y-auto h-full select-none">
      {nodes.map((node) => (
        <button
          key={`turn-${node.userIndex}`}
          onClick={() => scrollToMessage(node.userIndex)}
          className="flex items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors duration-100 w-full"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--crai-bg-3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          {/* 指示点 */}
          <div
            className="shrink-0 mt-1 rounded-full"
            style={{
              width: 6,
              height: 6,
              backgroundColor: 'var(--crai-accent)',
              opacity: 0.7,
            }}
          />

          {/* 用户消息 + AI 摘要 */}
          <div className="flex-1 min-w-0 leading-tight">
            <div className="truncate" style={{ color: 'var(--crai-fg)' }}>
              {node.preview || '[新对话]'}
            </div>
            {node.summary && (
              <div className="truncate" style={{ color: 'var(--crai-fg-40)', marginTop: 2 }}>
                {node.summary}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
})
