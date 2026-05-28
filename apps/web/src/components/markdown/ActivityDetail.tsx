/**
 * ActivityDetail — 工具详情弹窗。
 *
 * - 头部：状态 + 工具名 + 耗时
 * - Input 区可折叠，Output 区展开，带有语法识别
 * - 复制按钮
 */
import { memo, useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Dialog } from '../ui/Dialog'
import { CodeBlock } from '../markdown/CodeBlock'
import type { ActivityItem } from '../../types/messages'

const toolNameMap: Record<string, string> = {
  fs_read: '读取文件', fs_write: '写入文件', fs_grep: '搜索内容',
  fs_list: '列出文件', fs_edit: '编辑文件', bash: '执行命令',
  web_search: '搜索网络', web_fetch: '获取网页',
}

interface Props {
  activity: ActivityItem
  onClose: () => void
}

/** 尝试将字符串解析为 JSON 并格式化 */
function tryFormatJson(text: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(text)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: text, isJson: false }
  }
}

function SectionCard({
  title,
  defaultOpen,
  error,
  children,
}: {
  title: string
  defaultOpen?: boolean
  error?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const borderColor = error
    ? 'color-mix(in srgb, var(--crai-destructive) 20%, transparent)'
    : 'var(--crai-border)'
  const headerBg = error
    ? 'color-mix(in srgb, var(--crai-destructive) 8%, transparent)'
    : 'var(--crai-bg-3)'

  return (
    <div className="mb-3 rounded-lg border" style={{ borderColor, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 transition-colors"
        style={{ backgroundColor: headerBg, color: error ? 'var(--crai-destructive)' : 'var(--crai-fg-60)', fontSize: 12 }}
      >
        <Icon icon={open ? ChevronDown : ChevronRight} size="xs" />
        <span className="font-medium">{title}</span>
      </button>
      {open && <div className="px-3 py-3">{children}</div>}
    </div>
  )
}

export const ActivityDetail = memo(function ActivityDetail({ activity, onClose }: Props) {
  const isError = activity.status === 'error'
  const label = toolNameMap[activity.toolName ?? ''] ?? activity.displayName ?? activity.toolName ?? '工具'
  const elapsed = activity.elapsedSeconds ?? 0

  // 智能格式化输入：bash 直接取命令，其他显示 JSON
  const inputDisplay = (() => {
    if (!activity.toolInput) return ''
    if (activity.toolName === 'bash') {
      const cmd = (activity.toolInput as Record<string, unknown>).command
      return typeof cmd === 'string' ? cmd : JSON.stringify(activity.toolInput, null, 2)
    }
    return JSON.stringify(activity.toolInput, null, 2)
  })()
  const outputFormatted = activity.content ? tryFormatJson(activity.content) : null

  return (
    <Dialog open onClose={onClose} showClose={false}
      className="rounded-xl"
      style={{ width: '80%', maxWidth: 700, maxHeight: '80vh', padding: 0 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0 px-5 py-3"
        style={{
          borderBottom: '1px solid var(--crai-border)',
          backgroundColor: isError ? 'color-mix(in srgb, var(--crai-destructive) 8%, transparent)' : 'transparent',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Icon
            icon={isError ? XCircle : CheckCircle2}
            size="sm"
            style={{ color: isError ? 'var(--crai-tool-error)' : 'var(--crai-tool-success)' }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--crai-fg)' }}>{label}</span>
          {elapsed > 0 && (
            <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--crai-fg-40)' }}>
              · {elapsed}秒
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors hover:bg-[var(--crai-bg-5)]"
          style={{ color: 'var(--crai-fg-40)', lineHeight: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
        {/* 意图 */}
        {activity.intent && (
          <div
            className="mb-4 px-3 py-2 rounded-lg text-sm leading-relaxed"
            style={{
              backgroundColor: 'var(--crai-bg-3)',
              borderLeft: '3px solid var(--crai-accent)',
              color: 'var(--crai-fg-60)',
            }}
          >
            {activity.intent}
          </div>
        )}

        {inputDisplay && (
          <SectionCard title="输入" defaultOpen={false}>
            <div className="-my-3">
              <CodeBlock code={inputDisplay} language={activity.toolName === 'bash' ? 'bash' : 'json'} />
            </div>
          </SectionCard>
        )}

        {activity.content && outputFormatted && (
          <SectionCard title="输出" defaultOpen={true}>
            <div className="-my-3">
              <CodeBlock code={outputFormatted.formatted} language={outputFormatted.isJson ? 'json' : 'text'} />
            </div>
          </SectionCard>
        )}

        {activity.error && (
          <SectionCard title="错误" defaultOpen={true} error>
            <div className="-my-3">
              <CodeBlock code={activity.error} language="text" />
            </div>
          </SectionCard>
        )}
      </div>
    </Dialog>
  )
})
