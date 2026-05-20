import { useEffect, useRef } from 'react'

interface Props {
  id: string
  question: string
  options?: string[]
  meta?: Record<string, unknown>
  onResolve: (id: string, value: string, alwaysAllow?: boolean) => void
}

/** 工具确认弹窗条。悬浮在 ChatInput 上方。 */
export function ConfirmBar({ id, question, options, meta, onResolve }: Props) {
  const toolName = ((meta?.toolName as string) ?? '') as string
  const safetyLevel = ((meta?.safetyLevel as string) ?? '') as string
  const toolArgs = ((meta?.args as Record<string, unknown>) ?? {}) as Record<string, unknown>
  const safetyColor = safetyLevel === 'dangerous' ? 'var(--crai-destructive, #e74c3c)' : safetyLevel === 'restricted' ? 'var(--crai-warning, #f39c12)' : 'var(--crai-fg)'
  const detailParts: string[] = []
  if (toolArgs.path) detailParts.push(`路径: ${toolArgs.path}`)
  if (toolArgs.command) detailParts.push(`命令: ${(toolArgs.command as string).slice(0, 80)}`)
  if (toolArgs.pattern) detailParts.push(`搜索: ${toolArgs.pattern}`)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        margin: '0 auto',
        maxWidth: 'var(--crai-chat-max-width)',
        width: '100%',
        backgroundColor: 'var(--crai-bg-tertiary)',
        borderTop: '1px solid var(--crai-border)',
        gap: 12,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--crai-fg)', fontWeight: 500, marginBottom: 2 }}>{question}</div>
        <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: safetyColor, fontWeight: 600 }}>{toolName}</span>
          {detailParts.length > 0 && (
            <span style={{ color: 'var(--crai-fg-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {detailParts.join(' | ')}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button onClick={() => onResolve(id, 'deny')}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--crai-border)', backgroundColor: 'transparent', color: 'var(--crai-fg-secondary)', fontSize: 12, cursor: 'pointer' }}>
          拒绝
        </button>
        <button onClick={() => onResolve(id, 'allow')}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: 'var(--crai-accent)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          允许
        </button>
        <button onClick={() => onResolve(id, 'allow', true)}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--crai-accent)', backgroundColor: 'transparent', color: 'var(--crai-accent)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          始终允许
        </button>
      </div>
    </div>
  )
}
