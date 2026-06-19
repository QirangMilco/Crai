/**
 * Dialog — 轻量模态弹窗。
 *
 * - 遮罩背景跟随主题
 * - Esc 关闭、点击遮罩关闭
 * - 锁定滚动（打开时 body 不可滚动）
 */
import { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Tooltip } from './Tooltip'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** 内容区类名（默认为居中卡片） */
  className?: string
  /** 内容区样式（覆盖默认圆角/宽高/阴影） */
  style?: React.CSSProperties
  /** 是否显示关闭按钮（默认 true） */
  showClose?: boolean
  /** 点击遮罩是否关闭（默认 true） */
  dismissOnBackdrop?: boolean
  title?: string
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  style,
  showClose = true,
  dismissOnBackdrop = true,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Esc 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  // 打开时锁定滚动
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--crai-bg)',
          border: '1px solid var(--crai-border)',
          boxShadow: 'var(--crai-shadow-modal)',
          ...style,
        }}
      >
        {showClose && (
          <div className="flex items-center justify-end shrink-0" style={{ padding: '6px 8px', minHeight: 36 }}>
          <Tooltip tip="关闭" position="bottom">
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-[var(--crai-bg-5)]"
            style={{ color: 'var(--crai-fg-40)', lineHeight: 0 }}
          >
            <Icon icon={X} size="sm" />
          </button>
          </Tooltip>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
