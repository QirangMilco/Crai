import { memo, useState, useEffect, useCallback } from 'react'
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

/** 从 toolInput 提取简短的参数展示。 */
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

/** 单个活动行。 */
const ActivityRow = memo(function ActivityRow({
  activity,
  onOpenDetail,
}: {
  activity: ActivityItem
  onOpenDetail?: (a: ActivityItem) => void
}) {
  const [localCollapsed, setLocalCollapsed] = useState(activity.type === 'thinking' && activity.status === 'completed')
  const [elapsed, setElapsed] = useState(activity.elapsedSeconds ?? 0)
  const isDone = activity.status !== 'running'

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
  const dotColor = STATUS_COLORS[activity.status] || 'var(--crai-fg-tertiary)'
  const argLabel = activity.type === 'tool' ? formatToolArg(activity) : ''
  // 检测退出码：content 中有 [退出码: N] 且 N !== 0 视为失败
  const hasExitError = activity.status === 'completed' && !!activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1] && activity.content?.match(/\[退出码:\s*(-?\d+)\]/)?.[1] !== '0'

  const handleClick = useCallback(() => {
    if (activity.type === 'thinking' && isDone) {
      // 思考：切换折叠
      setLocalCollapsed((v) => !v)
    } else if (activity.type === 'tool' && isDone && onOpenDetail) {
      // 工具：打开详情面板
      onOpenDetail(activity)
    }
  }, [activity, isDone, onOpenDetail])

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '3px 0',
        fontSize: 'var(--crai-tool-font-size, 13px)',
        color: 'var(--crai-tool-fg)',
        lineHeight: 'var(--crai-tool-line-height)',
        cursor: (activity.type === 'thinking' && isDone) || isDone ? 'pointer' : 'default',
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: hasExitError ? 'var(--crai-tool-error)' : dotColor,
        flexShrink: 0,
        marginTop: 5,
        opacity: activity.status === 'running' ? 0.6 : 1,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          {/* tool input 参数 */}
          {argLabel && (
            <span style={{
              fontSize: 'calc(var(--crai-tool-font-size, 13px) * 0.88)',
              color: 'var(--crai-fg-tertiary)',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {argLabel.length > 30 ? argLabel.slice(0, 30) + '…' : argLabel}
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {activity.status === 'running' && <>{elapsed > 0 ? `${elapsed}s` : '⋯'}</>}
            {(activity.status === 'completed' && !hasExitError) && '✓'}
            {(activity.status === 'error' || hasExitError) && '✗'}
          </span>
        </div>
        {/* thinking 内容（可折叠） */}
        {activity.type === 'thinking' && activity.content && (
          <div style={{
            fontSize: 'calc(var(--crai-tool-font-size, 13px) * 0.92)',
            color: 'var(--crai-fg-tertiary)',
            marginTop: 2,
            ...(localCollapsed ? {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            } : {}),
          }}>
            {localCollapsed
              ? (activity.content.length > 80 ? activity.content.slice(0, 80) + '…' : activity.content)
              : activity.content
            }
          </div>
        )}
        {/* 意图文本（仅 tool 类型） */}
        {activity.type === 'tool' && activity.intent && activity.status !== 'error' && (
          <div style={{
            fontSize: 'calc(var(--crai-tool-font-size, 13px) * 0.92)',
            color: 'var(--crai-fg-tertiary)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activity.intent}
          </div>
        )}
        {/* 工具结果摘要 */}
        {activity.type === 'tool' && activity.status === 'completed' && activity.content && (
          <div style={{
            fontSize: 'calc(var(--crai-tool-font-size, 13px) * 0.92)',
            color: 'var(--crai-tool-fg)',
            opacity: 0.65,
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            → {activity.content.length > 100 ? activity.content.slice(0, 100) + '…' : activity.content}
          </div>
        )}
        {/* 错误 */}
        {activity.status === 'error' && activity.error && (
          <div style={{
            fontSize: 'calc(var(--crai-tool-font-size, 13px) * 0.92)',
            color: 'var(--crai-tool-error)',
            marginTop: 1,
          }}>
            {activity.error.length > 80 ? activity.error.slice(0, 80) + '…' : activity.error}
          </div>
        )}
      </div>
    </div>
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
    <>
      <div style={{
        marginTop: 12,
        paddingLeft: 12,
        borderLeft: '2px solid var(--crai-border)',
      }}>
        {activities.map((a) => (
          <ActivityRow key={a.id} activity={a} onOpenDetail={setDetailActivity} />
        ))}
      </div>
      {detailActivity && (
        <ActivityDetail activity={detailActivity} onClose={() => setDetailActivity(null)} />
      )}
    </>
  )
})
