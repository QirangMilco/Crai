/**
 * Tooltip — 悬浮提示浮窗。
 *
 * 使用 createPortal 渲染到 document.body，避免被父容器 overflow:hidden 裁剪。
 * 延迟 400ms 显示，防止鼠标扫过时闪烁。
 *
 * 用法：
 *   <Tooltip tip="复制消息">
 *     <button><Icon icon={Copy} /></button>
 *   </Tooltip>
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  tip: string
  children: React.ReactNode
  /** 位置（默认 'top'） */
  position?: 'top' | 'bottom'
}

export function Tooltip({ tip, children, position = 'top' }: Props) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const handleEnter = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCoords({
          x: rect.left + rect.width / 2,
          y: position === 'top' ? rect.top : rect.bottom,
        })
        setShow(true)
      }
    }, 400)
  }, [position])

  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current)
    setShow(false)
  }, [])

  return (
    <span ref={containerRef} className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onFocus={handleEnter} onBlur={handleLeave}>
      {children}
      {show && createPortal(
        <span
          className="pointer-events-none whitespace-nowrap z-[9999]"
          style={{
            position: 'fixed',
            left: coords.x,
            top: position === 'top' ? coords.y - 8 : coords.y + 8,
            transform: 'translateX(-50%) translateY(0)',
            padding: '3px 7px',
            borderRadius: 5,
            fontSize: 11,
            lineHeight: 1.3,
            backgroundColor: 'var(--crai-fg)',
            color: 'var(--crai-bg)',
            boxShadow: 'var(--crai-shadow-modal)',
          }}
        >
          {tip}
        </span>,
        document.body,
      )}
    </span>
  )
}
