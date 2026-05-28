/**
 * ActivityTimeline — 活动时间线。
 *
 * - 每个活动为独立浮卡，圆角 + 轻微阴影
 * - 工具行：单行 [图标] 中文名 → 参数
 * - 思考行：折叠态单行 [箭头] 状态 · 预览，展开态 [箭头] 状态 + 竖线内容
 */
import { memo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, LoaderCircle, ChevronRight } from 'lucide-react'
import { Icon } from '../ui/Icon'
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
  const hasExitError = activity.status === 'completed'
    && !!activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1]
    && activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1] !== '0'
  if (hasExitError) {
    return <Icon icon={XCircle} size="sm" style={{ color: 'var(--crai-tool-error)' }} />
  }
  return <Icon icon={CheckCircle2} size="sm" style={{ color: 'var(--crai-tool-success)' }} />
}

/** 思考内容截断预览（40 字） */
function thinkingPreview(content: string): string {
  return content.length > 40 ? content.slice(0, 40) + '…' : content
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
      <>
    <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={handleClick}
          className="cursor-pointer select-none rounded-lg px-3 py-2.5"
          style={{
            backgroundColor: 'var(--crai-bg)',
            boxShadow: 'var(--crai-shadow-minimal)',
          }}
        >
          {/* 顶栏：指示器 + 状态 + 预览（单行） */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* 指示器列 */}
            {isDone ? (
              <motion.div
                initial={false}
                animate={{ rotate: localCollapsed ? 0 : 90 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="shrink-0 flex items-center justify-center"
                style={{ width: 14, height: 14, color: 'var(--crai-fg)' }}
              >
                <Icon icon={ChevronRight} size="xs" />
              </motion.div>
            ) : (
              <div className="shrink-0" style={{ width: 14 }} />
            )}

            {/* 状态 + 预览 */}
            <div className="flex-1 flex items-center gap-1 min-w-0 text-xs" style={{ color: 'var(--crai-fg)' }}>
              {activity.status === 'running' ? (
                <span className="shrink-0">
                  思考中
                  {elapsed > 0 && <span className="tabular-nums">（{elapsed}s）</span>}
                </span>
              ) : (
                <span className="shrink-0">
                  思考完毕
                  <span className="tabular-nums">（{elapsed}s）</span>
                </span>
              )}
              {/* 折叠预览 */}
              {localCollapsed && activity.content && (
                <span className="truncate" style={{ color: 'var(--crai-fg-40)' }}>
                  <span className="mx-1">·</span>
                  {thinkingPreview(activity.content)}
                </span>
              )}
            </div>
          </div>

          {/* 展开内容区（带竖线） */}
          {activity.content && !localCollapsed && (
            <motion.div
              initial={false}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden text-xs"
              style={{
                marginLeft: 6,
                paddingLeft: 10,
                marginTop: 2,
                color: 'var(--crai-fg-40)',
                borderLeft: '1px solid color-mix(in srgb, var(--crai-fg) 12%, transparent)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {activity.content}
            </motion.div>
          )}
        </motion.div>
      </>
    )
  }

  // ── Tool 行 ──
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={handleClick}
        className="cursor-pointer select-none rounded-lg px-3 py-2.5"
        style={{
          backgroundColor: 'var(--crai-bg)',
          boxShadow: 'var(--crai-shadow-minimal)',
        }}
      >
        {/* 单行：图标 + 标签 → 参数 */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 状态图标 */}
          <div className="shrink-0 flex items-center justify-center" style={{ width: 14, color: statusColor }}>
            <StatusIcon activity={activity} />
          </div>

          {/* 标签 + 参数 */}
          <div className="flex-1 flex items-center gap-1 min-w-0 text-xs"
            style={{ color: 'var(--crai-fg)' }}
          >
            <span className="font-medium shrink-0">{toolLabel}</span>
            {argLabel && (
              <span className="truncate" style={{ color: 'var(--crai-fg-40)' }}>
                <span className="mx-0.5">→</span>
                {argLabel.length > 28 ? argLabel.slice(0, 28) + '…' : argLabel}
              </span>
            )}
          </div>

          {/* 耗时 */}
          <div className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--crai-fg-40)' }}>
            {activity.status === 'running' ? (
              <>{elapsed > 0 ? `${elapsed}s` : <Icon icon={LoaderCircle} size="xs" className="animate-spin inline" />}</>
            ) : null}
          </div>
        </div>
      </motion.div>
    </>
  )
})

/** 活动时间线组件。 */
export const ActivityTimeline = memo(function ActivityTimeline({
  activities,
}: {
  activities: ActivityItem[]
}) {
  const [detailActivity, setDetailActivity] = useState<ActivityItem | null>(null)

  if (!activities || activities.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      {activities.map((a) => (
        <ActivityRow
          key={a.id}
          activity={a}
          onOpenDetail={setDetailActivity}
        />
      ))}
      {detailActivity && (
        <ActivityDetail activity={detailActivity} onClose={() => setDetailActivity(null)} />
      )}
    </div>
  )
})