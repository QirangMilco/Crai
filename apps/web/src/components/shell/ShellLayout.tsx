/**
 * ShellLayout — 主布局容器。
 *
 * 管理左右侧栏的展开/收起状态机：
 * - 鼠标悬停在 FixedBar 上 → 侧栏展开（推开内容区）
 * - 鼠标离开侧栏区域（含 FixedBar + 侧栏内容）→ 侧栏收起
 * - 侧栏宽度可拖拽调整，宽度持久化到 localStorage
 *
 * 布局结构：
 *   [FixedBar][Sidebar Content][ResizeHandle][Message Area][ResizeHandle][Sidebar Content][FixedBar]
 *
 * CSS tokens（Inspector 管理）：
 *   --crai-sidebar-fixed-bar-width: 固定栏宽度（默认 36px）
 *   --crai-sidebar-min-width: 侧栏最小宽度（默认 160px）
 *   --crai-sidebar-max-width: 侧栏最大宽度（默认 520px）
 *   --crai-sidebar-handle-width: 拖拽手柄宽度（默认 4px）
 *   --crai-sidebar-handle-color: 拖拽手柄颜色（默认 border）
 *   --crai-sidebar-header-height: 面板头部高度（默认 36px）
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FixedBar } from './FixedBar'
import { ResizeHandle } from './ResizeHandle'
import { getAllSidePanels } from './PanelRegistry'

interface Props {
  /** 消息区域（主内容） */
  children: React.ReactNode
  /** 发送 WS 消息的回调 */
  send: (msg: any) => void
}

// ── 侧栏宽度持久化 ──

const SIDEBAR_WIDTH_KEY = 'crai:sidebarWidth'

function loadWidth(side: 'left' | 'right', fallback: number): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const v = parsed[side]
      if (typeof v === 'number' && v >= 140) return v
    }
  } catch {}
  return fallback
}

function saveWidth(side: 'left' | 'right', width: number): void {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[side] = width
    localStorage.setItem(SIDEBAR_WIDTH_KEY, JSON.stringify(parsed))
  } catch {}
}

// ── ShellLayout ──

export function ShellLayout({ children, send }: Props) {
  const [leftWidth, setLeftWidth] = useState(() => loadWidth('left', 260))
  const [rightWidth, setRightWidth] = useState(() => loadWidth('right', 260))
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null)
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null)

  // 展开状态：有悬浮的 panel（用 panelId 精确标记）就展开对应侧
  const leftExpanded = hoveredSide === 'left'
  const rightExpanded = hoveredSide === 'right'

  // 悬浮计时器：避免鼠标经过时频繁闪烁
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 展开/收起状态机 ──
  // 鼠标进入 FixedBar 区 → 展开
  // 鼠标离开整个侧栏区 → 延迟 300ms 收起

  const handleFixedBarHover = useCallback((side: 'left' | 'right') => {
    return (panelId: string | null) => {
      if (panelId) {
        // 展开
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
        collapseTimerRef.current = null
        setHoveredPanelId(panelId)
        setHoveredSide(side)
      }
      // mouse leave from fixed bar — don't collapse immediately,
      // wait for the whole sidebar area
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLeftFixedBarHover = useCallback((panelId: string | null) => handleFixedBarHover('left')(panelId), [handleFixedBarHover])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRightFixedBarHover = useCallback((panelId: string | null) => handleFixedBarHover('right')(panelId), [handleFixedBarHover])

  const handleSidebarEnter = useCallback((side: 'left' | 'right') => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
      setHoveredSide(side)
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLeftEnter = useCallback(handleSidebarEnter('left'), [handleSidebarEnter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRightEnter = useCallback(handleSidebarEnter('right'), [handleSidebarEnter])

  const handleSidebarLeave = useCallback(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = setTimeout(() => {
        setHoveredSide(null)
        setHoveredPanelId(null)
      }, 300)
    }
  }, [])
  const handleLeftLeave = useCallback(handleSidebarLeave(), [handleSidebarLeave])
  const handleRightLeave = useCallback(handleSidebarLeave(), [handleSidebarLeave])

  // cleanup timers
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    }
  }, [])

  const leftPanels = getAllSidePanels('left')
  const rightPanels = getAllSidePanels('right')

  // 根据 panel config 渲染侧栏内容
  const renderSideContent = useCallback((side: 'left' | 'right') => {
    if (!hoveredSide) return null
    if (side !== hoveredSide) return null
    const panels = side === 'left' ? leftPanels : rightPanels
    return (
      <motion.div
        key={side}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="flex flex-col h-full overflow-hidden"
        style={{ backgroundColor: 'var(--crai-bg)', width: side === 'left' ? leftWidth : rightWidth }}
      >
        {panels.map(({ def }) => (
          <div key={def.id} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="shrink-0 flex items-center px-3 border-b text-xs font-medium"
              style={{
                height: 'var(--crai-sidebar-header-height, 36px)',
                borderColor: 'var(--crai-border)',
                color: 'var(--crai-fg-secondary)',
              }}
            >
              {def.icon} <span className="ml-1.5">{def.label}</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {def.render({
                width: side === 'left' ? leftWidth : rightWidth,
                hovered: true,
                send,
              })}
            </div>
          </div>
        ))}
      </motion.div>
    )
  }, [hoveredSide, leftPanels, rightPanels, leftWidth, rightWidth, send])

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* 左侧固定栏 */}
      {leftPanels.length > 0 && (
        <FixedBar
          side="left"
          panels={leftPanels}
          expandedPanelId={leftExpanded ? hoveredPanelId : null}
          onHoverPanel={handleLeftFixedBarHover}
        />
      )}

      {/* 左侧栏内容 */}
      <div
        onMouseEnter={handleLeftEnter}
        onMouseLeave={handleLeftLeave}
        className="overflow-hidden shrink-0"
        style={{
          width: leftExpanded ? leftWidth : 0,
          minWidth: 0,
          overflow: 'hidden',
          transition: 'width 100ms ease-out',
        }}
      >
        {renderSideContent('left')}
      </div>

      {/* 左侧拖拽手柄 */}
      {leftExpanded && (
        <ResizeHandle
          side="left"
          width={leftWidth}
          onResize={(w) => { setLeftWidth(w); saveWidth('left', w) }}
        />
      )}

      {/* 中间消息区域 */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>

      {/* 右侧拖拽手柄 */}
      {rightExpanded && (
        <ResizeHandle
          side="right"
          width={rightWidth}
          onResize={(w) => { setRightWidth(w); saveWidth('right', w) }}
        />
      )}

      {/* 右侧栏内容 */}
      <div
        onMouseEnter={handleRightEnter}
        onMouseLeave={handleRightLeave}
        className="overflow-hidden shrink-0"
        style={{
          width: rightExpanded ? rightWidth : 0,
          minWidth: 0,
          overflow: 'hidden',
          transition: 'width 100ms ease-out',
        }}
      >
        {renderSideContent('right')}
      </div>

      {/* 右侧固定栏 */}
      {rightPanels.length > 0 && (
        <FixedBar
          side="right"
          panels={rightPanels}
          expandedPanelId={rightExpanded ? hoveredPanelId : null}
          onHoverPanel={handleRightFixedBarHover}
        />
      )}
    </div>
  )
}
