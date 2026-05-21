/**
 * ActivityTimeline — 活动时间线。
 *
 * 工具调用和思考过程的可视化时间线。
 * 每个活动行为一个卡片，运行中/完成/错误三态不同视觉。
 * 已完成思考自动折叠，工具可点击查看详情。
 */
import { memo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, LoaderCircle, ChevronRight, ArrowRight } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { cn } from '../ui/cn'
import type { ActivityItem } from '../../types/messages'
import { ActivityDetail } from './ActivityDetail'
import { ToolOutputCard } from '../ui/ToolOutputCard'

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--crai-accent)',
  completed: 'var(--crai-tool-success)',
  error: 'var(--crai-tool-error)',
  pending: 'var(--crai-fg-tertiary)',
  backgrounded: 'var(--crai-fg-tertiary)',
}

const toolNameMap: Record<string, string> = {
  fs_read: '读取文件', fs_write: '写入文件', fs_grep: '搜索内容',
  fs_list: '列出文件', fs_edit: '编辑文件', bash: '执行命令',
  web_search: '搜索网络', web_fetch: '获取网页',
}

/** 从 toolInput 提取简短的路径/命令展示。 */
function formatToolArg(activity: ActivityItem): string {
  if (!activity.toolInput || typeof activity.toolInput !== 'object') return ''
  const input = activity.toolInput as Record<string, unknown>
  switch (activity.toolName) {
    case 'fs_read':
    case 'fs_write':
    case 'fs_edit': {
      const p = input.path as string
      return p ? p.split('/').pop() ?? p : ''
    }
    case 'fs_grep':
      return (input.pattern as string) ?? ''
    case 'fs_list':
      return (input.path as string) ? (input.path as string).split('/').pop()! : '当前目录'
    case 'bash':
      return (input.command as string) ?? ''
    case 'web_search':
      return (input.query as string) ?? ''
    case 'web_fetch':
      return (input.url as string) ?? ''
    default: {
      const v = Object.values(input).find((x) => typeof x === 'string' && x.length > 0)
      return v ? (v as string).slice(0, 40) : ''
    }
  }
}

/** 工具对应的状态图标。 */
function StatusIcon({ activity }: { activity: ActivityItem }) {
  if (activity.status === 'running') {
    return <Icon icon={LoaderCircle} size="sm" className="animate-spin" style={{ color: 'var(--crai-accent)' }} />
  }
  if (activity.status === 'error') {
    return <Icon icon={XCircle} size="sm" style={{ color: 'var(--crai-tool-error)' }} />
  }
  // completed / pending / backgrounded
  const hasExitError = activity.status === 'completed'
    && !!activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1]
    && activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1] !== '0'
  if (hasExitError) {
    return <Icon icon={XCircle} size="sm" style={{ color: 'var(--crai-tool-error)' }} />
  }
  return <Icon icon={CheckCircle2} size="sm" style={{ color: 'var(--crai-tool-success)' }} />
}

/** 单个活动行（卡片模式）。 */
const ActivityRow = memo(function ActivityRow({
  activity,
  onOpenDetail,
}: {
  activity: ActivityItem
  onOpenDetail?: (a: ActivityItem) => void
}) {
  const [localCollapsed, setLocalCollapsed] = useState(
    activity.type === 'thinking' && activity.status === 'completed'
  )
  const [elapsed, setElapsed] = useState(activity.elapsedSeconds ?? 0)
  const isDone = activity.status !== 'running'
  const isError = activity.status === 'error'

  // 自动折叠思考（完成后）
  useEffect(() => {
    if (activity.type === 'thinking' && activity.status === 'completed') {
      setLocalCollapsed(true)
    }
  }, [activity.type, activity.status])

  // 运行中计时
  useEffect(() => {
    if (activity.status !== 'running') {
      setElapsed(activity.elapsedSeconds ?? 0)
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [activity.status, activity.elapsedSeconds])

  const label = activity.type === 'tool'
    ? (toolNameMap[activity.toolName ?? ''] ?? activity.displayName ?? activity.toolName ?? '工具')
    : '思考'
  const argLabel = activity.type === 'tool' ? formatToolArg(activity) : ''
  const borderColor = isError ? 'var(--crai-tool-error)' : STATUS_COLORS[activity.status] || 'var(--crai-border)'

  const handleClick = useCallback(() => {
    if (activity.type === 'thinking' && isDone) {
      setLocalCollapsed((v) => !v)
    } else if (activity.type === 'tool' && isDone && onOpenDetail) {
      onOpenDetail(activity)
    }
  }, [activity, isDone, onOpenDetail])

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-stretch gap-0 rounded-lg overflow-hidden cursor-pointer',
        'transition-shadow duration-150',
        'hover:shadow-[var(--crai-shadow-card)]',
        isDone && 'cursor-pointer',
      )}
      style={{ border: '1px solid var(--crai-border)' }}
    >
      {/* 左侧状态色条 */}
      <div
        className="shrink-0 transition-colors duration-150"
        style={{ width: 3, backgroundColor: borderColor }}
      />

      {/* 内容区 */}
      <div className="flex-1 flex items-start gap-2.5 px-3 py-2.5 min-w-0"
        style={{
          fontSize: 'var(--crai-tool-font-size, 13px)',
          color: 'var(--crai-tool-fg)',
          lineHeight: 'var(--crai-tool-line-height)',
        }}
      >
        {/* 状态图标 */}
        <div className="shrink-0 mt-0.5">
          <StatusIcon activity={activity} />
        </div>

        {/* 详情 */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* 标题行 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm">{label}</span>
            {argLabel && (
              <span className="truncate max-w-[160px] text-xs"
                style={{ color: 'var(--crai-fg-tertiary)' }}>
                <Icon icon={ChevronRight} size="xs" className="inline mr-0.5" />
                {argLabel.length > 28 ? argLabel.slice(0, 28) + '…' : argLabel}
              </span>
            )}
            {/* 右上角状态 */}
            <span className="ml-auto text-xs shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {activity.status === 'running' && (
                <>{elapsed > 0 ? `${elapsed}s` : <Icon icon={LoaderCircle} size="xs" className="animate-spin inline" />}</>
              )}
            </span>
          </div>

          {/* 思考内容（可折叠，带 height 动画） */}
          {activity.type === 'thinking' && activity.content && (
            <motion.div
              layout
              initial={false}
              className="text-xs overflow-hidden"
              style={{
                color: 'var(--crai-fg-tertiary)',
                whiteSpace: localCollapsed ? 'nowrap' : 'pre-wrap',
              }}
              animate={{
                height: localCollapsed ? '1.4em' : 'auto',
                opacity: 1,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              {localCollapsed
                ? (activity.content.length > 80 ? activity.content.slice(0, 80) + '…' : activity.content)
                : activity.content
              }
            </motion.div>
          )}

          {/* 意图文本（仅 tool） */}
          {activity.type === 'tool' && activity.intent && !isError && (
            <div className="text-xs truncate" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {activity.intent}
            </div>
          )}

          {/* 工具结果卡片 */}
          {activity.type === 'tool' && activity.status === 'completed' && activity.content && (
            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
              <ToolOutputCard
                toolName={activity.toolName}
                result={activity.content}
              />
            </div>
          )}

          {/* 错误 */}
          {isError && activity.error && (
            <div className="text-xs" style={{ color: 'var(--crai-tool-error)' }}>
              {activity.error.length > 80 ? activity.error.slice(0, 80) + '…' : activity.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

/** 活动时间线组件（包裹在 Card 容器中）。 */
export const ActivityTimeline = memo(function ActivityTimeline({
  activities,
}: {
  activities: ActivityItem[]
}) {
  const [detailActivity, setDetailActivity] = useState<ActivityItem | null>(null)

  if (!activities || activities.length === 0) return null

  return (
    <div className="mt-3 space-y-1">
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} onOpenDetail={setDetailActivity} />
      ))}
      {detailActivity && (
        <ActivityDetail activity={detailActivity} onClose={() => setDetailActivity(null)} />
      )}
    </div>
  )
})
