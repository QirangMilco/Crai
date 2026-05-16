import { memo } from 'react'
import type { ChatMessage, ContentBlock } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { ThinkingBlock } from './markdown/ThinkingBlock'
import { ToolGroupBlock } from './markdown/ToolBlock'

interface Props {
  msg: ChatMessage
}

function Bubble({ msg }: Props) {
  const isUser = msg.role === 'user'
  const blocks = msg.blocks ?? []

  // 空助理消息不渲染外壳，避免残留空白气泡
  if (!isUser && blocks.length === 0 && !msg.text) {
    return null
  }

  const textBlock = blocks.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text')
  const hasThinking = blocks.some((b) => b.type === 'thinking')
  const hasTextBlock = !!textBlock

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
          width: isUser ? undefined : '100%',
          maxWidth: isUser ? 'var(--crai-msg-user-max-width)' : 'var(--crai-msg-max-width)',
        }}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        ) : blocks.length > 0 ? (
          <ContentBlocksRenderer blocks={blocks} autoCollapse={hasTextBlock} />
        ) : hasThinking ? (
          <ThreeDotIndicator />
        ) : null}
      </div>
    </div>
  )
}

export const MessageBubble = memo(Bubble, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.blocks === next.msg.blocks
})

/** 渲染内容块列表：保持插入顺序（thinking 在前，tool_group 在中，text 在后），不排序。 */
function ContentBlocksRenderer({ blocks, autoCollapse }: { blocks: ContentBlock[]; autoCollapse?: boolean }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'thinking':
            return <ThinkingBlock key={`t-${i}`} content={block.content} sealed={block.sealed} autoCollapse={autoCollapse} />
          case 'tool_group':
            return (
              <ToolGroupBlock
                key={`tg-${i}`}
                tools={block.tools}
                collapsed={block.collapsed}
                setCollapsed={(v) => {
                  // 允许用户手动切换折叠；此处只读更新 blocks 非响应式
                  // collapsed 已由 markToolDone 自动设置
                }}
              />
            )
          case 'text':
            return <MarkdownRenderer key={`txt-${i}`} content={block.content} />
          default:
            return null
        }
      })}
    </>
  )
}

/** 三圆点思考指示器（思考中、尚无文本时显示）。 */
function ThreeDotIndicator() {
  const dot: React.CSSProperties = {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--crai-accent)',
    opacity: 0.4,
    animation: 'crai-think-pulse 1.4s ease-in-out infinite',
  }
  return (
    <div className="flex gap-1 items-center py-2">
      <span style={dot} />
      <span style={{ ...dot, animationDelay: '0.2s' }} />
      <span style={{ ...dot, animationDelay: '0.4s' }} />
    </div>
  )
}
