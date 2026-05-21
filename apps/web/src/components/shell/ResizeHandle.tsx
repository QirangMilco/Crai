/**
 * ResizeHandle — 可拖拽调整宽度的分隔条。
 *
 * 用法：
 *   <ResizeHandle width={sidebarWidth} onResize={setSidebarWidth} minWidth={160} maxWidth={480} />
 *
 * 通过 CSS token 控制外观：
 *   --crai-sidebar-handle-width: 手柄宽度
 *   --crai-sidebar-handle-color: 手柄 hover 颜色
 */
import { useRef, useCallback, useEffect } from 'react'

interface Props {
  width: number
  onResize: (width: number) => void
  minWidth?: number
  maxWidth?: number
  side: 'left' | 'right'
}

export function ResizeHandle({ width, onResize, minWidth = 140, maxWidth = 520, side }: Props) {
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    onResize(Math.max(minWidth, Math.min(maxWidth, side === 'left' ? e.clientX : window.innerWidth - e.clientX)))
  }, [onResize, minWidth, maxWidth, side])

  const onMouseUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div
      onMouseDown={onMouseDown}
      className="shrink-0 relative cursor-col-resize transition-colors"
      style={{
        width: 'var(--crai-sidebar-handle-width, 4px)',
        backgroundColor: 'transparent',
      }}
    >
      {/* 可见 hover 区域 */}
      <div
        className="absolute inset-0 transition-opacity opacity-0 hover:opacity-100"
        style={{
          backgroundColor: 'var(--crai-sidebar-handle-color, var(--crai-border))',
        }}
      />
    </div>
  )
}
