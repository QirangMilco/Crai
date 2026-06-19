/**
 * MessageBubble — 消息气泡组件。
 *
 * 用户消息：彩色气泡，右对齐。
 * AI 消息：无气泡背景，直接展示在消息流中（类 CrystalAgents 风格）。
 * 错误消息：警告样式。
 */
import { memo, useState } from 'react'
import type { ChatMessage } from '../types/messages'
import { MarkdownRenderer } from './markdown/MarkdownRenderer'
import { ActivityTimeline } from './markdown/ActivityTimeline'
import { ThreeDotIndicator } from './markdown/ThreeDotIndicator'

interface Props {
  msg: ChatMessage
}

function Bubble({ msg, fileCount, agentFileCount, filePaths, messageIndex, onShowDiff }: Props & { fileCount?: number; agentFileCount?: number; filePaths?: string[]; messageIndex?: number; onShowDiff?: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const isUser = msg.role === 'user'
  const isError = msg.role === 'system'

  if (!isUser && !isError && !msg.text && !msg.activities?.length) {
    return null
  }

  return (
    <div
      className={`msg-enter flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ marginBottom: 'calc(var(--crai-msg-gap, 8px) + 24px)' }}
      data-token-group={isUser ? 'user-msg' : 'ai-msg'}
    >
      {isUser ? (
        <div className="flex flex-col items-end" style={{ maxWidth: 'var(--crai-msg-user-max-width)' }}>
          <div
            style={{
              backgroundColor: 'var(--crai-msg-user-bg)',
              color: 'var(--crai-msg-user-fg)',
              borderRadius: 'var(--crai-msg-user-radius)',
              fontSize: 'var(--crai-msg-user-font-size)',
              lineHeight: 'var(--crai-msg-user-line-height)',
              boxShadow: 'var(--crai-shadow-bubble)',
              padding: 'var(--crai-msg-padding-y, 12px) var(--crai-msg-padding-x, 16px)',
            }}
          >
            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
          </div>
          <div className="flex items-center gap-1 mt-1" style={{ opacity: 0.5 }}>
            <Tooltip tip={copiedId === 'user-copy' ? '已复制' : '复制消息'} position="bottom">
            <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopiedId('user-copy'); setTimeout(() => setCopiedId(null), 1500) }}
              className="hover:opacity-100 transition-opacity"
              style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Icon icon={copiedId === 'user-copy' ? Check : Copy} size="xs" />
            </button>
            </Tooltip>
            {onShowDiff && <Tooltip tip="查看文件变更" position="bottom">
              <button onClick={onShowDiff}
                className="hover:opacity-100 transition-opacity"
                style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Icon icon={FileCode} size="xs" />
              </button>
            </Tooltip>}
            <Tooltip tip="回滚到此处" position="bottom">
            <button onClick={() => window.dispatchEvent(new CustomEvent('crai:rollback', { detail: { messageIndex } }))}
              className="hover:opacity-100 transition-opacity"
              style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Icon icon={Undo2} size="xs" />
            </button>
            </Tooltip>
            <Tooltip tip="从此分叉" position="bottom">
            <button onClick={() => window.dispatchEvent(new CustomEvent('crai:fork', { detail: { msgId: msg.id, messageIndex } }))}
              className="hover:opacity-100 transition-opacity"
              style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Icon icon={GitBranch} size="xs" />
            </button>
            </Tooltip>
          </div>
        </div>) : isError && msg.id === 'ctx-compaction' ? (
        <CompactMessage msg={msg} />
      ) : isError ? (
        <div
          style={{
            backgroundColor: 'var(--crai-bg-tertiary)',
            color: 'var(--crai-fg)',
            borderRadius: 'var(--crai-msg-assistant-radius)',
            fontSize: 12,
            padding: '8px 16px',
            borderLeft: '3px solid var(--crai-error)',
          }}
        >
          {msg.text}
        </div>
      ) : (
        <div className="flex flex-col items-stretch w-full" style={{ paddingLeft: 'var(--crai-msg-padding-x, 16px)', paddingRight: 'var(--crai-msg-padding-x, 16px)' }}>
          {msg.activities && msg.activities.length > 0 && (
            <ActivityTimeline activities={msg.activities} />
          )}
          <div
            style={{
              fontSize: 'var(--crai-msg-ai-font-size)',
              lineHeight: 'var(--crai-msg-ai-line-height)',
              maxWidth: 'var(--crai-msg-max-width)',
              width: '100%',
            }}
          >
            {msg.text ? (
              <div className="prose prose-sm max-w-none" style={{ fontFamily: 'var(--crai-font-serif)' }}>
                <MarkdownRenderer content={msg.text} />
              </div>
            ) : msg.activities && msg.activities.length > 0 ? (
              <ThreeDotIndicator />
            ) : null}
          </div>
          {msg.text && !msg.activities?.some((a) => a.status === 'running') && (
            <div className="flex items-center gap-1 mt-1" style={{ opacity: 0.5 }}>
              <Tooltip tip={copiedId === 'ai-copy' ? '已复制' : '复制消息'} position="bottom">
              <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopiedId('ai-copy'); setTimeout(() => setCopiedId(null), 1500) }}
                className="hover:opacity-100 transition-opacity"
                style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Icon icon={copiedId === 'ai-copy' ? Check : Copy} size="xs" />
              </button>
            </Tooltip>
              {onShowDiff && <Tooltip tip="查看文件变更" position="bottom">
                <button onClick={onShowDiff}
                  className="hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Icon icon={FileCode} size="xs" />
                </button>
              </Tooltip>}


            </div>
          )}
        </div>
          )}
    </div>
  )
}

export const MessageBubble = memo(Bubble as React.FC<Props & { fileCount?: number; agentFileCount?: number; filePaths?: string[]; messageIndex?: number; onShowDiff?: () => void }>, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.text === next.msg.text
    && prev.msg.activities === next.msg.activities
    && prev.fileCount === next.fileCount
    && prev.agentFileCount === next.agentFileCount
    && prev.messageIndex === next.messageIndex
    && prev.onShowDiff === next.onShowDiff
})

import { ChevronDown, ChevronRight, Archive, Copy, Undo2, GitBranch, Check, FileCode } from 'lucide-react'
import { Tooltip } from './ui/Tooltip'
import { Icon } from './ui/Icon'

/** 压缩摘要消息：可折叠，显示压缩前后 token 数。 */
function CompactMessage({ msg }: { msg: ChatMessage }) {
  const [collapsed, setCollapsed] = useState(true)
  // 从 metadata 读取压缩前后的 token 数
  const tokensBefore = msg.metadata?.tokensBefore
  const tokensAfter = msg.metadata?.tokensAfter
  const infoParts: string[] = []
  if (tokensBefore != null && tokensAfter != null) {
    infoParts.push(`${tokensBefore} → ${tokensAfter} tokens`)
  }
  const infoText = infoParts.length > 0 ? ' · ' + infoParts.join(' · ') : ''
  
  return (
    <div
      style={{
        backgroundColor: 'var(--crai-bg-tertiary)',
        color: 'var(--crai-fg)',
        borderRadius: 'var(--crai-msg-assistant-radius)',
        fontSize: 12,
        width: '100%',
        borderLeft: '3px solid var(--crai-accent)',
        overflow: 'hidden',
      }}
    >
      {/* 标题栏：始终可见 */}
      <div
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors hover:opacity-80"
        style={{ backgroundColor: 'var(--crai-bg-3)' }}
      >
        <Icon icon={collapsed ? ChevronRight : ChevronDown} size="xs" />
        <Icon icon={Archive} size="xs" style={{ color: 'var(--crai-accent)' }} />
        <span className="font-medium">上下文已压缩</span>
        {infoText && (
          <span style={{ color: 'var(--crai-fg-40)', fontSize: 11 }}>{infoText}</span>
        )}
      </div>
      {/* 摘要正文：折叠收起，支持 Markdown */}
      {!collapsed && (
        <div className="prose prose-xs max-w-none px-3 py-2 leading-relaxed" style={{ color: 'var(--crai-fg-60)' }}>
          <MarkdownRenderer content={msg.text} />
        </div>
      )}
    </div>
  )
}
