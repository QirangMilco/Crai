import { memo, useState, useCallback, useRef, useEffect } from 'react'

interface Props {
  content: string
  sealed: boolean
  /** 自动折叠（用于文本到达后收起思考块）。 */
  autoCollapse?: boolean
}

export const ThinkingBlock = memo(function ThinkingBlock({ content, sealed, autoCollapse }: Props) {
  const [open, setOpen] = useState(true)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (autoCollapse) setOpen(false)
  }, [autoCollapse])

  useEffect(() => {
    if (sealed) {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      return
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [sealed])

  const label = sealed
    ? `思考完毕（${Math.max(elapsed, 1)}s）`
    : `思考中（${Math.max(elapsed, 1)}s）`

  return (
    <details
      data-token-group="thinking-block"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{
        marginTop: 'var(--crai-thinking-mt, 4px)',
        marginBottom: 'var(--crai-thinking-mb, 4px)',
        fontSize: 'var(--crai-thinking-font-size)',
        lineHeight: 'var(--crai-thinking-line-height)',
      }}>
      <summary
        onClick={(e) => { e.preventDefault(); toggle() }}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--crai-thinking-fg)',
          fontWeight: 500,
        }}>
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          fontSize: 12,
        }}>›</span>
        {label}
      </summary>
      {open && content && (
        <div
          data-token-group="thinking-content"
          style={{
            marginTop: 6,
            padding: 'var(--crai-thinking-padding, 8px 12px)',
            borderRadius: 'var(--crai-thinking-radius, 6px)',
            backgroundColor: 'var(--crai-thinking-bg)',
            color: 'var(--crai-thinking-content-fg)',
            fontSize: 'var(--crai-thinking-content-font-size)',
            lineHeight: 'var(--crai-thinking-content-line-height)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
          {content}
        </div>
      )}
    </details>
  )
})
