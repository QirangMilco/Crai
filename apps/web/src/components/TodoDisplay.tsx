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
import { useState } from 'react'
import type { TodoItem } from '../types/messages'

const STATUS_ICON: Record<string, string> = {
  pending: '○',
  in_progress: '⟳',
  completed: '✓',
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

/** 工具栏紧凑版：只显示折叠态的进度条，hover 时 title 显示完整内容。 */
export function TodoBar({ todos }: { todos: TodoItem[] }) {
  if (!todos || todos.length === 0) return null
  const completed = todos.filter((t) => t.status === 'completed').length
  const total = todos.length
  const preview = pickPreview(todos)
  const tooltip = todos.map((t) => {
    const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '⟳' : '○'
    return `${icon} ${displayText(t)}`
  }).join('\n')
  return (
    <button
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors duration-150 hover:bg-[var(--crai-bg-3)]"
      style={{ color: 'var(--crai-fg-40)', maxWidth: 200 }}
      title={tooltip}
    >
      <span>☑</span>
      <span className="truncate max-w-[100px]">{preview}</span>
      <span className="shrink-0 tabular-nums">{completed}/{total}</span>
    </button>
  )
}
