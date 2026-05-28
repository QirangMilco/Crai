/**
 * ShellLayout — 主布局容器。
 *
 * 左侧：固定内容区侧栏。触发区为屏幕左侧 6px 宽不可见区域，鼠标移入展开。
 *   侧栏内有标签页（会话 / 文件 / 等）和 Pin 按钮。
 *
 * 右侧：浮动悬浮侧栏。触发区为屏幕右侧 6px 宽不可见区域。
 *   展开后覆盖在内容区之上（不推挤布局），仿 OpenHanako 风格。
 *
 * Pin 左右独立：左侧固定在展开状态，右侧固定在展开状态，互不影响。
 *
 * CSS tokens：
 *   --crai-sidebar-trigger-width: 触发区宽度（默认 6px）
 *   --crai-sidebar-header-height: 面板头部高度（默认 36px）
 *   --crai-sidebar-tab-width: 标签宽度（默认 32px）
 *   --crai-sidebar-min-width: 侧栏最小宽度（默认 160px）
 *   --crai-sidebar-max-width: 侧栏最大宽度（默认 520px）
 *   --crai-sidebar-max-height: 右侧浮栏最大高度（默认 70vh）
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pin, PinOff } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { getAllSidePanels } from './PanelRegistry'

interface Props {
  children: React.ReactNode
  send: (msg: any) => void
}

// ── 持久化键 ──

const SIDEBAR_WIDTH_KEY = 'crai:sidebarWidth'
const PIN_KEY = 'crai:sidebarPin'
const TAB_KEY = 'crai:sidebarTab'

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

function loadPin(side: 'left' | 'right'): boolean {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed[side] === true
    }
  } catch {}
  return false
}

function savePin(side: 'left' | 'right', val: boolean): void {
  try {
    const raw = localStorage.getItem(PIN_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[side] = val
    localStorage.setItem(PIN_KEY, JSON.stringify(parsed))
  } catch {}
}

function loadActiveTab(side: 'left' | 'right'): string | null {
  try {
    const raw = localStorage.getItem(TAB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const t = parsed[side]
      if (typeof t === 'string') return t
    }
  } catch {}
  return null
}

function saveActiveTab(side: 'left' | 'right', tabId: string | null): void {
  try {
    const raw = localStorage.getItem(TAB_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[side] = tabId
    localStorage.setItem(TAB_KEY, JSON.stringify(parsed))
  } catch {}
}

// ── ShellLayout ──

export function ShellLayout({ children, send }: Props) {
  const [leftWidth, setLeftWidth] = useState(() => loadWidth('left', 260))
  const [rightWidth, setRightWidth] = useState(() => loadWidth('right', 220))
  const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null)
  const [leftPinned, setLeftPinned] = useState(() => loadPin('left'))
  const [rightPinned, setRightPinned] = useState(() => loadPin('right'))
  const [activeTab, setActiveTab] = useState<string | null>(() => loadActiveTab('left'))
  const [activeRightTab, setActiveRightTab] = useState<string | null>(() => loadActiveTab('right'))

  const leftExpanded = leftPinned || hoveredSide === 'left'
  const rightExpanded = rightPinned || hoveredSide === 'right'

  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── 固定切换 ──

  const toggleLeftPin = useCallback(() => {
    setLeftPinned((v) => { const n = !v; savePin('left', n); return n })
  }, [])

  const toggleRightPin = useCallback(() => {
    setRightPinned((v) => { const n = !v; savePin('right', n); return n })
  }, [])

  // ── 展开/收起 ──

  const handleTriggerEnter = useCallback((side: 'left' | 'right') => {
    return () => {
      if (side === 'left' && leftPinned) return
      if (side === 'right' && rightPinned) return
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current)
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
      setHoveredSide(side)
    }
  }, [leftPinned, rightPinned])

  const handleSidebarLeave = useCallback((side: 'left' | 'right') => {
    return () => {
      const pinned = side === 'left' ? leftPinned : rightPinned
      if (pinned) return
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = setTimeout(() => {
        setHoveredSide((prev) => prev === side ? null : prev)
      }, 300)
    }
  }, [leftPinned, rightPinned])

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current)
    }
  }, [])

  const leftPanels = getAllSidePanels('left')
  const rightPanels = getAllSidePanels('right')

  // 首次展开时自动选中第一个 tab
  useEffect(() => {
    if (leftExpanded && !activeTab && leftPanels.length > 0) {
      const firstId = leftPanels[0].def.id
      setActiveTab(firstId)
      saveActiveTab('left', firstId)
    }
    if (rightExpanded && !activeRightTab && rightPanels.length > 0) {
      const firstId = rightPanels[0].def.id
      setActiveRightTab(firstId)
      saveActiveTab('right', firstId)
    }
  }, [leftExpanded, rightExpanded, activeTab, activeRightTab, leftPanels, rightPanels])

  const handleTabClick = useCallback((side: 'left' | 'right', panelId: string) => {
    return () => {
      if (side === 'left') { setActiveTab(panelId) }
      else { setActiveRightTab(panelId) }
      saveActiveTab(side, panelId)
    }
  }, [])

  // ── 渲染左侧栏（内容区，推挤布局） ──

  const renderLeftContent = useCallback(() => {
    const panels = leftPanels
    if (panels.length === 0) return null
    const width = leftWidth
    const currentTab = activeTab ?? panels[0]?.def.id
    const activePanel = panels.find((p) => p.def.id === currentTab)

    return (
      <div
        className="flex flex-col overflow-hidden rounded-xl"
        style={{
          width,
          height: '100%',
          backgroundColor: 'var(--crai-bg)',
          border: '1px solid var(--crai-border)',
          boxShadow: 'var(--crai-shadow-elevated)',
          position: 'relative',
        }}
      >
        {/* Tab 栏（仅 2+ 面板时显示标签） */}
        {panels.length >= 2 && (
          <div
            className="flex items-center shrink-0 gap-1 px-2"
            style={{
              height: 'var(--crai-sidebar-header-height, 36px)',
              borderBottom: '1px solid var(--crai-border)',
            }}
          >
            {panels.map(({ def }) => (
              <button
                key={def.id} title={def.label}
                onClick={handleTabClick('left', def.id)}
                className="flex items-center justify-center rounded transition-all shrink-0"
                style={{
                  width: 'var(--crai-sidebar-tab-width, 32px)', height: 28, fontSize: 15,
                  color: def.id === currentTab ? 'var(--crai-fg)' : 'var(--crai-fg-40)',
                  backgroundColor: def.id === currentTab ? 'var(--crai-bg-tertiary)' : 'transparent',
                }}
              >
                {def.icon}
              </button>
            ))}
            <div className="flex-1" />
            <button title={leftPinned ? '解锁左侧' : '固定左侧'}
              onClick={toggleLeftPin}
              className="flex items-center justify-center rounded transition-colors shrink-0"
              style={{ width: 24, height: 24, color: leftPinned ? 'var(--crai-accent)' : 'var(--crai-fg-40)' }}
            >
              <Icon icon={leftPinned ? PinOff : Pin} size="xs" />
            </button>
          </div>
        )}
        {/* 仅 1 面板时，Pin 按钮位于右上角 */}
        {panels.length === 1 && (
          <button title={leftPinned ? '解锁左侧' : '固定左侧'}
            onClick={toggleLeftPin}
            className="absolute top-1 right-1 z-10 flex items-center justify-center rounded transition-colors"
            style={{ width: 24, height: 24, color: leftPinned ? 'var(--crai-accent)' : 'var(--crai-fg-40)' }}
          >
            <Icon icon={leftPinned ? PinOff : Pin} size="xs" />
          </button>
        )}

        {/* 面板内容 */}
        {activePanel && (
          <div key={activePanel.def.id} className="flex-1 overflow-y-auto min-h-0">
            {activePanel.def.render({ width, hovered: true, send })}
          </div>
        )}
      </div>
    )
  }, [leftPanels, leftWidth, activeTab, send, leftPinned, toggleLeftPin, handleTabClick])

  // ── 渲染右侧栏（悬浮，不推挤布局） ──

  const renderRightContent = useCallback(() => {
    const panels = rightPanels
    if (panels.length === 0) return null
    const width = rightWidth
    const currentTab = activeRightTab ?? panels[0]?.def.id
    const activePanel = panels.find((p) => p.def.id === currentTab)

    return (
      <div
        className="flex flex-col overflow-hidden rounded-xl"
        style={{
          width,
          maxHeight: 'min(70vh, calc(100vh - 96px))',
          backgroundColor: 'var(--crai-bg)',
          border: '1px solid var(--crai-border)',
          boxShadow: 'var(--crai-shadow-elevated)',
        }}
      >
        {/* Tab 栏（右，仅 2+ 面板时显示标签） */}
        {panels.length >= 2 && (
          <div
            className="flex items-center shrink-0 gap-1 px-2"
            style={{
              height: 'var(--crai-sidebar-header-height, 36px)',
              borderBottom: '1px solid var(--crai-border)',
            }}
          >
            {panels.map(({ def }) => (
              <button
                key={def.id} title={def.label}
                onClick={handleTabClick('right', def.id)}
                className="flex items-center justify-center rounded transition-all shrink-0"
                style={{
                  width: 'var(--crai-sidebar-tab-width, 32px)', height: 28, fontSize: 15,
                  color: def.id === currentTab ? 'var(--crai-fg)' : 'var(--crai-fg-40)',
                  backgroundColor: def.id === currentTab ? 'var(--crai-bg-tertiary)' : 'transparent',
                }}
              >
                {def.icon}
              </button>
            ))}
            <div className="flex-1" />
            <button title={rightPinned ? '解锁右侧' : '固定右侧'}
              onClick={toggleRightPin}
              className="flex items-center justify-center rounded transition-colors shrink-0"
              style={{ width: 24, height: 24, color: rightPinned ? 'var(--crai-accent)' : 'var(--crai-fg-40)' }}
            >
              <Icon icon={rightPinned ? PinOff : Pin} size="xs" />
            </button>
          </div>
        )}
        {/* 仅 1 面板时无额外控件 */}
        {panels.length === 1 && null}

        {/* 面板内容 */}
        {activePanel && (
          <div key={activePanel.def.id} className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(min(70vh, 100vh - 96px) - 37px)' }}>
            {activePanel.def.render({ width, hovered: true, send })}
          </div>
        )}
      </div>
    )
  }, [rightPanels, rightWidth, activeRightTab, send, rightPinned, toggleRightPin, handleTabClick])

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 relative">
      {/* 左侧触发区（两级） */}
      {leftPanels.length > 0 && (
        <>
          {/* 第一级：提示区（40px，显示蓝线，不展开侧栏） */}
          <div
            onMouseEnter={() => {
              if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
              collapseTimerRef.current = null
            }}
            onMouseLeave={handleSidebarLeave('left')}
            className="absolute left-0 top-0 bottom-0 cursor-default group"
            style={{ width: 80, zIndex: 5 }}
          >
            {/* 蓝线：40px 区 hover 时显示 */}
            <div
              className="absolute transition-all duration-150 ease-out opacity-0 group-hover:opacity-50"
              style={{
                left: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'var(--crai-accent)',
                width: 2,
              }}
            />{/* group-hover: 不用额外配宽度变化，1px 线够用 */}

            {/* 第二级：触发区（12px，嵌套在提示区内，展开侧栏） */}
            <div
              onMouseEnter={handleTriggerEnter('left')}
              className="absolute left-0 top-0 bottom-0 cursor-default"
              style={{ width: 12, zIndex: 6 }}
            />
          </div>
        </>
      )}

      {/* 中间消息区域 */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>


      {/* 左侧浮动侧栏 */}
      <AnimatePresence>
        {leftExpanded && leftPanels.length > 0 && (
          <motion.div
            key="left-panel"
            initial={{ opacity: 0, x: -20, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.9 /* ← crai-spring-* tokens */ }}
            onMouseEnter={() => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); collapseTimerRef.current = null; setHoveredSide('left') }}
            onMouseLeave={handleSidebarLeave('left')}
            className="absolute"
            style={{
              left: 8,
              top: 0,
              bottom: 0,
              zIndex: 50,
            }}
          >
            {renderLeftContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右侧拖拽手柄（浮动侧栏不需要） */}

      {/* 右侧触发区（两级） */}
      {rightPanels.length > 0 && (
        <>
          {/* 第一级：提示区（40px，显示蓝线，不展开侧栏） */}
          <div
            onMouseEnter={() => {
              if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
              collapseTimerRef.current = null
            }}
            onMouseLeave={handleSidebarLeave('right')}
            className="absolute right-0 top-0 bottom-0 cursor-default group"
            style={{ width: 80, zIndex: 5 }}
          >
            <div
              className="absolute transition-all duration-150 ease-out opacity-0 group-hover:opacity-50"
              style={{
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'var(--crai-accent)',
                width: 2,
              }}
            />

            {/* 第二级：触发区（12px，嵌套在提示区内） */}
            <div
              onMouseEnter={handleTriggerEnter('right')}
              className="absolute right-0 top-0 bottom-0 cursor-default"
              style={{ width: 12, zIndex: 6 }}
            />
          </div>
        </>
      )}

      {/* 右侧浮动侧栏 */}
      <AnimatePresence>
        {rightExpanded && rightPanels.length > 0 && (
          <motion.div
            key="right-panel"
            initial={{ opacity: 0, x: 20, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.9 }}
            onMouseEnter={() => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); collapseTimerRef.current = null; setHoveredSide('right') }}
            onMouseLeave={handleSidebarLeave('right')}
            className="absolute"
            style={{
              right: 8,
              top: 48,
              zIndex: 50,
            }}
          >
            {renderRightContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
