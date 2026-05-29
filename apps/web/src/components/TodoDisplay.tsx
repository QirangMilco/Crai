/**
 * TodoDisplay — 会话 TODO 列表展示组件。
 *
 * 三态状态机：
 *   pending       ○ 灰色
 *   in_progress   ⟳ accent 色，显示 activeForm
 *   completed     ✓ 成功色 + 删除线
 *
 * 折叠态：默认折叠，显示第一个 in_progress 或 pending 的预览。
 * 展开态：显示所有项，带状态图标。
 */
import { useState, useRef, useEffect } from 'react'
import { Circle, CheckCircle2, LoaderCircle } from 'lucide-react'
import type { TodoItem } from '../types/messages'

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Circle size={10} />,
  in_progress: <LoaderCircle size={10} className="animate-spin" />,
  completed: <CheckCircle2 size={10} />,
}

function displayText(todo: TodoItem): string {
  if (todo.status === 'in_progress' && todo.activeForm) return todo.activeForm
  return todo.content
}

function pickPreview(todos: TodoItem[]): string {
  const inProgress = todos.find((t) => t.status === 'in_progress')
  if (inProgress) return displayText(inProgress)
  const pending = todos.find((t) => t.status === 'pending')
  if (pending) return displayText(pending)
  return '全部完成 ✓'
}

export function TodoDisplay({ todos }: { todos: TodoItem[] }) {
  const [open, setOpen] = useState(false)

  if (!todos || todos.length === 0) return null

  const completed = todos.filter((t) => t.status === 'completed').length
  const preview = pickPreview(todos)

  return (
    <div
      className="mx-auto mb-2"
      style={{ maxWidth: 'var(--crai-chat-max-width)', paddingLeft: 'var(--crai-chat-padding)', paddingRight: 'var(--crai-chat-padding)' }}
    >
      <div
        className="rounded-lg overflow-hidden text-xs"
        style={{ backgroundColor: 'var(--crai-bg-3)', border: '1px solid var(--crai-border)' }}
      >
        {open && (
          <div className="divide-y" style={{ borderColor: 'var(--crai-border)' }}>
            {todos.map((td) => {
              const isInProgress = td.status === 'in_progress'
              const isCompleted = td.status === 'completed'
              return (
                <div
                  key={td.id}
                  className="flex items-start gap-2 px-3 py-2"
                  style={{
                    color: isCompleted ? 'var(--crai-fg-40)' : 'var(--crai-fg)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}
                >
                  <span
                    className="shrink-0 mt-0.5"
                    style={{
                      color: isInProgress ? 'var(--crai-accent)' : isCompleted ? 'var(--crai-success)' : 'var(--crai-fg-40)',
                    }}
                  >
                    {STATUS_ICON[td.status]}
                  </span>
                  <span className="flex-1">{displayText(td)}</span>
                </div>
              )
            })}
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
          style={{ color: 'var(--crai-fg-secondary)' }}
        >
          <span className="text-sm">☑</span>
          <span className="flex-1 truncate text-left">{preview}</span>
          <span className="shrink-0" style={{ color: 'var(--crai-fg-40)' }}>
            {completed}/{todos.length}
          </span>
          <span className="shrink-0 text-[10px]">{open ? '▼' : '▶'}</span>
        </button>
      </div>
    </div>
  )
}

/** 工具栏紧凑版：始终可见，无 todo 时显示占位。 */
export function TodoBar({ todos, onAddTodo }: { todos: TodoItem[]; onAddTodo?: () => void }) {
  const total = todos.length
  const completed = todos.filter((t) => t.status === 'completed').length
  const preview = total > 0 ? pickPreview(todos) : ''
  const [hovered, setHovered] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPanel = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setHovered(true)
  }

  const hidePanel = () => {
    hideTimerRef.current = setTimeout(() => setHovered(false), 200)
  }

  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  }, [])

  if (total === 0) {
    return (
      <button
        onClick={onAddTodo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all duration-100"
        style={{
          color: 'var(--crai-fg-40)',
          border: '1px solid var(--crai-border)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--crai-accent)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--crai-border)'}
      >
        <CheckCircle2 size={12} />
        <span>添加待办</span>
      </button>
    )
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div
      className="relative"
      onMouseEnter={showPanel}
      onMouseLeave={hidePanel}
    >
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-all duration-100 cursor-default"
        style={{
          color: 'var(--crai-fg-60)',
          border: '1px solid var(--crai-border)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--crai-accent)'}
        onMouseLeave={(e) => { if (!hovered) e.currentTarget.style.borderColor = 'var(--crai-border)' }}
      >
        <CheckCircle2 size={12} />

        {/* 当前任务 */}
        <span className="truncate max-w-[80px]" style={{ color: 'var(--crai-fg)', fontWeight: 500 }}>
          {preview}
        </span>

        {/* 计数徽章 */}
        <span
          className="tabular-nums shrink-0"
          style={{
            fontSize: 10,
            color: 'var(--crai-fg-40)',
            background: 'var(--crai-bg-3)',
            padding: '0 6px',
            borderRadius: 8,
            lineHeight: '16px',
          }}
        >
          {completed}/{total}
        </span>

        {/* 进度条 */}
        <div
          className="rounded-full shrink-0"
          style={{ width: 36, height: 3, background: 'var(--crai-bg-5)', overflow: 'hidden' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              background: completed === total ? 'var(--crai-success)' : 'var(--crai-accent)',
            }}
          />
        </div>

        {/* 箭头 */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: hovered ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--crai-fg-40)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 浮层面板 */}
      {hovered && (
        <div
          onMouseEnter={showPanel}
          onMouseLeave={hidePanel}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg z-50"
          style={{
            width: 280,
            maxHeight: 260,
            background: 'var(--crai-bg)',
            border: '1px solid var(--crai-border)',
            boxShadow: 'var(--crai-shadow-elevated)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 text-xs font-medium shrink-0"
            style={{ color: 'var(--crai-fg)', borderBottom: '1px solid var(--crai-border)' }}
          >
            <span>待办清单</span>
            <span style={{ color: 'var(--crai-fg-40)', fontWeight: 400 }}>{completed}/{total} 已完成</span>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {todos.map((td) => {
              const isInProgress = td.status === 'in_progress'
              const isCompleted = td.status === 'completed'
              return (
                <div
                  key={td.id}
                  className="flex items-start gap-2 px-3 py-1.5 text-xs"
                  style={{
                    color: isCompleted ? 'var(--crai-fg-40)' : 'var(--crai-fg)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}
                >
                  <span
                    className="shrink-0 mt-0.5"
                    style={{
                      color: isInProgress ? 'var(--crai-accent)' : isCompleted ? 'var(--crai-success)' : 'var(--crai-fg-40)',
                    }}
                  >
                    {STATUS_ICON[td.status]}
                  </span>
                  <span>{displayText(td)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
