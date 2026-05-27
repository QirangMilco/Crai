/**
 * SessionNavPanel — 当前会话跳转导航。
 *
 * 显示当前对话的结构化缩略时间线：
 * - 每个用户消息 + AI 回复为一个节点
 * - 点击节点跳转到消息列表中对应位置
 * - 用于快速导航长对话
 */
import { memo, useCallback } from 'react'
import { useChatStore } from '../../store/chat'

interface NavNode {
  type: 'user' | 'assistant'
  index: number
  preview: string
}

export const SessionNavPanel = memo(function SessionNavPanel() {
  const messages = useChatStore((s) => s.messages)

  const nodes: NavNode[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user' || m.role === 'assistant') {
      const text = m.text || (m as any).content || ''
      const preview = text.length > 30 ? text.slice(0, 30) + '…' : text
      nodes.push({ type: m.role, index: i, preview })
    }
  }

  const scrollToMessage = useCallback((index: number) => {
    // 通过自定义事件通知 MessageList 滚动到指定索引
    window.dispatchEvent(new CustomEvent('crai:scroll-to-message', { detail: { index } }))
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
          key={`${node.type}-${node.index}`}
          onClick={() => scrollToMessage(node.index)}
          className="flex items-start gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors duration-100 w-full"
          style={{
            color: node.type === 'user' ? 'var(--crai-fg)' : 'var(--crai-fg-40)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--crai-bg-3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          {/* 指示点 */}
          <div
            className="shrink-0 mt-1 rounded-full"
            style={{
              width: 6,
              height: 6,
              backgroundColor: node.type === 'user'
                ? 'var(--crai-accent)'
                : 'var(--crai-fg-40)',
              opacity: node.type === 'user' ? 0.8 : 0.4,
            }}
          />

          {/* 预览文字 */}
          <span className="truncate leading-tight">
            {node.preview || (node.type === 'user' ? '[新对话]' : '[回复]')}
          </span>
        </button>
      ))}
    </div>
  )
})
