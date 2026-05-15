import { memo } from 'react'
import type { ChatMessage, ContentBlock } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { ThinkingBlock } from './markdown/ThinkingBlock'
import { ToolBlock, ToolGroupBlock } from './markdown/ToolBlock'

interface Props {
  msg: ChatMessage
}

function Bubble({ msg }: Props) {
  const isUser = msg.role === 'user'

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
        ) : (
          <>
            {msg.blocks && msg.blocks.length > 0 && (
              <ContentBlocksRenderer blocks={msg.blocks} />
            )}
            {msg.text ? <MarkdownRenderer content={msg.text} /> : <div style={{ minHeight: '1em' }} />}
          </>
        )}
      </div>
    </div>
  )
}

export const MessageBubble = memo(Bubble, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.text === next.msg.text
    && prev.msg.blocks === next.msg.blocks
})

/** 渲染内容块列表：思考过程 → 工具调用 → 文本 */
function ContentBlocksRenderer({ blocks }: { blocks: ContentBlock[] }) {
  const thinkingBlocks = blocks.filter((b): b is ContentBlock & { type: 'thinking' } => b.type === 'thinking')
  const toolBlocks = blocks.filter((b): b is ContentBlock & { type: 'tool' } => b.type === 'tool')

  return (
    <>
      {thinkingBlocks.map((b, i) => (
        <ThinkingBlock key={`thinking-${i}`} content={b.content} sealed={b.sealed} />
      ))}
      {toolBlocks.length > 0 && <ToolGroupBlock tools={toolBlocks.map((t) => ({ toolCallId: t.toolCallId, name: t.name, args: t.args, status: t.status }))} />}
    </>
  )
}
