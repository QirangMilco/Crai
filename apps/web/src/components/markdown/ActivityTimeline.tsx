/**
 * ActivityTimeline — 活动时间线。
 *
 * 工具调用和思考过程的可视化时间线。
 * 每个活动行为一个卡片，运行中/完成/错误三态不同视觉。
 * 已完成思考自动折叠，工具可点击查看详情。
 */
import { memo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, LoaderCircle, ChevronRight } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { cn } from '../ui/cn'
import type { ActivityItem } from '../../types/messages'
import { ActivityDetail } from './ActivityDetail'

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

/** 单个活动行。 */
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
  const isThinking = activity.type === 'thinking'
  const isTool = activity.type === 'tool'

  // 自动折叠思考（完成后）
  useEffect(() => {
    if (isThinking && activity.status === 'completed') {
      setLocalCollapsed(true)
    }
  }, [isThinking, activity.status])

  // 运行中计时
  useEffect(() => {
    if (activity.status !== 'running') return
    const start = Date.now()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [activity.status])

  const toolLabel = toolNameMap[activity.toolName ?? ''] ?? activity.displayName ?? activity.toolName ?? '工具'
  const argLabel = isTool ? formatToolArg(activity) : ''
  const statusColor = isError ? 'var(--crai-tool-error)' : STATUS_COLORS[activity.status] || 'var(--crai-border)'

  const handleClick = useCallback(() => {
    if (isThinking && isDone) {
      setLocalCollapsed((v) => !v)
    } else if (isTool && isDone && onOpenDetail) {
      onOpenDetail(activity)
    }
  }, [isThinking, isTool, isDone, activity, onOpenDetail])

  // ── Thinking 行 ──
  if (isThinking) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={handleClick}
        className={cn(
          'group cursor-pointer rounded-md transition-colors duration-150',
        )}
      >
        {/* 顶栏：展开收起指示器 + 状态文字 */}
        <div className="flex items-center gap-1.5">
          {/* 指示器列（14px，与工具行 StatusIcon 对齐） */}
          {isDone ? (
            <motion.div
              initial={false}
              animate={{ rotate: localCollapsed ? 0 : 90 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="shrink-0 flex items-center justify-center"
              style={{ width: 14, height: 14, color: 'var(--crai-fg-40)' }}
            >
              <Icon icon={ChevronRight} size="xs" />
            </motion.div>
          ) : (
            <div className="shrink-0" style={{ width: 14 }} />
          )}

          {/* 状态文字 */}
          <div className="flex-1 text-xs" style={{ color: 'var(--crai-fg-40)' }}>
            {activity.status === 'running' ? (
              <span>
                思考中
                {elapsed > 0 && <span className="tabular-nums">（{elapsed}s）</span>}
              </span>
            ) : (
              <span>
                思考完毕
                <span className="tabular-nums">（{elapsed}s）</span>
              </span>
            )}
          </div>
        </div>

        {/* 内容区：左侧竖条对齐指示器 */}
        {activity.content && (
          <motion.div
            initial={false}
            animate={{ height: localCollapsed ? '1.4em' : 'auto', opacity: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden text-xs mr-1.5 pb-1"
            style={{
              marginLeft: 6,
              paddingLeft: 10,
              color: 'var(--crai-fg-40)',
              borderLeft: '1px solid color-mix(in srgb, var(--crai-fg) 12%, transparent)',
              whiteSpace: localCollapsed ? 'nowrap' : 'pre-wrap',
            }}
          >
            {localCollapsed
              ? (activity.content.length > 80 ? activity.content.slice(0, 80) + '…' : activity.content)
              : activity.content
            }
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ── Tool 行 ──
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={handleClick}
      className={cn(
        'group cursor-pointer rounded-md transition-colors duration-150',
        'hover:bg-[var(--crai-bg-3)]',
        isDone && 'cursor-pointer',
      )}
    >
      {/* 顶栏：图标 + 标签 + 参数 + 耗时 */}
      <div className="flex items-center gap-1.5">
        {/* 状态图标（14px 列） */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: 14, color: statusColor }}>
          <StatusIcon activity={activity} />
        </div>

        {/* 标签 + 参数 */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 text-xs"
          style={{ color: 'var(--crai-fg)' }}
        >
          <span className="font-medium shrink-0">{toolLabel}</span>
          {argLabel && (
            <span className="truncate text-xs" style={{ color: 'var(--crai-fg-40)' }}>
              <Icon icon={ChevronRight} size="xs" className="inline mr-0.5" />
              {argLabel.length > 28 ? argLabel.slice(0, 28) + '…' : argLabel}
            </span>
          )}
        </div>

        {/* 耗时（运行中） */}
        <div className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--crai-fg-40)' }}>
          {activity.status === 'running' ? (
            <>{elapsed > 0 ? `${elapsed}s` : <Icon icon={LoaderCircle} size="xs" className="animate-spin inline" />}</>
          ) : null}
        </div>
      </div>

      {/* 下方内容区 */}
      <div className="ml-[20px] pb-1 pr-1.5">
        {/* 意图文本 */}
        {isTool && activity.intent && !isError && (
          <div className="text-xs truncate" style={{ color: 'var(--crai-fg-40)' }}>
            {activity.intent}
          </div>
        )}

        {/* 错误 */}
        {isError && activity.error && (
          <div className="text-xs" style={{ color: 'var(--crai-tool-error)' }}>
            {activity.error.length > 80 ? activity.error.slice(0, 80) + '…' : activity.error}
          </div>
        )}
      </div>
    </motion.div>
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
