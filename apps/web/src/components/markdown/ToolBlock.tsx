import { memo, useState, useCallback, useEffect } from 'react'
import { debugLog } from '../../utils/debug'

interface ToolCall {
  toolCallId: string
  name: string
  args: string
  status: 'running' | 'success' | 'error'
}

interface Props {
  tools: ToolCall[]
  collapsed: boolean
  setCollapsed?: (v: boolean) => void
}

/** 从工具名称 + args 提取展示详情（匹配 OpenHanako 的 ToolDetail）。 */
function extractToolDetail(name: string, args: string): { text: string; title?: string } {
  if (!args) return { text: '' }
  try {
    const a = JSON.parse(args)
    switch (name) {
      case 'fs_read':
      case 'fs_write':
      case 'fs_edit': {
        const p = a.path as string
        if (!p) return { text: '' }
        const short = p.split('/').pop() ?? p
        return { text: short, title: p }
      }
      case 'fs_grep':
        const pattern = a.pattern ?? ''
        return { text: pattern.length > 30 ? pattern.slice(0, 30) + '…' : pattern }
      case 'fs_list': {
        const lp = (a.path ?? '') as string
        return lp ? { text: lp.split('/').pop() ?? lp } : { text: '当前目录' }
      }
      case 'bash': {
        const cmd = a.command as string
        return { text: cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd, title: cmd }
      }
      case 'web_search':
        const q = a.query as string
        return { text: q.length > 30 ? q.slice(0, 30) + '…' : q }
      case 'web_fetch': {
        const u = a.url as string
        try { return { text: new URL(u).hostname } } catch { return { text: u.slice(0, 30) } }
      }
      default: {
        const v = Object.values(a).find((x: any) => typeof x === 'string' && x.length > 0)
        return { text: v ? (v as string).slice(0, 30) : '' }
      }
    }
  } catch {
    return { text: '' }
  }
}

const TOOL_LABELS: Record<string, string> = {
  fs_read: '读取文件', fs_write: '写入文件', fs_grep: '搜索内容',
  fs_list: '列出文件', fs_edit: '编辑文件', bash: '执行命令',
  web_search: '搜索网络', web_fetch: '获取网页',
}

export const ToolGroupBlock = memo(function ToolGroupBlock({ tools, collapsed, setCollapsed }: Props) {
  if (tools.length === 0) return null

  const [localCollapsed, setLocalCollapsed] = useState(collapsed)
  useEffect(() => {
    if (collapsed && !localCollapsed) debugLog('timeline', '工具组自动折叠', '')
    setLocalCollapsed(collapsed)
  }, [collapsed])
  const toggle = useCallback(() => setLocalCollapsed((v) => !v), [])

  const allDone = tools.every((t) => t.status !== 'running')
  const isSingle = tools.length === 1
  const runningCount = tools.filter((t) => t.status === 'running').length

  const summaryText = allDone
    ? `${tools.length} 个工具调用完成`
    : runningCount > 0
    ? `正在调用 ${runningCount} 个工具`
    : '工具调用'

  return (
    <div
      data-token-group="tool-group"
      style={{
        marginTop: 'var(--crai-tool-group-mt, 4px)',
        marginBottom: 'var(--crai-tool-group-mb, 4px)',
      }}>
      {!isSingle && (
        <div
          onClick={allDone ? toggle : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--crai-tool-group-title-size, 12px)',
            color: 'var(--crai-tool-group-title-fg)',
            cursor: allDone ? 'pointer' : 'default',
            userSelect: 'none',
            marginBottom: localCollapsed ? 0 : 4,
          }}>
          <span style={{ flex: 1 }}>{summaryText}</span>
          {allDone && (
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: localCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>
              ›
            </span>
          )}
          {!allDone && (
            <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'crai-think-pulse 1.4s ease-in-out infinite' }} />
          )}
        </div>
      )}
      {!localCollapsed && (
        <div>
          {tools.map((tool, i) => (
            <ToolIndicator key={`${tool.toolCallId}-${i}`} tool={tool} />
          ))}
        </div>
      )}
    </div>
  )
})

/** 单个工具指示器（带详情）。 */
const ToolIndicator = memo(function ToolIndicator({ tool }: { tool: ToolCall }) {
  const label = TOOL_LABELS[tool.name] ?? tool.name
  const detail = extractToolDetail(tool.name, tool.args)
  const done = tool.status !== 'running'

  return (
    <div
      data-token-group="tool-block"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crai-tool-gap, 8px)',
        padding: 'var(--crai-tool-padding, 4px 8px)',
        marginTop: 'var(--crai-tool-mt, 2px)',
        marginBottom: 'var(--crai-tool-mb, 2px)',
        borderRadius: 'var(--crai-tool-radius, 6px)',
        backgroundColor: 'var(--crai-tool-bg)',
        color: 'var(--crai-tool-fg)',
        fontSize: 'var(--crai-tool-font-size)',
        lineHeight: 'var(--crai-tool-line-height)',
      }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: done
          ? (tool.status === 'success' ? 'var(--crai-tool-success)' : 'var(--crai-tool-error)')
          : 'var(--crai-accent)',
        opacity: done ? 1 : 0.5,
        flexShrink: 0,
      }} />
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        {detail.text && (
          <span style={{
            fontSize: 'calc(var(--crai-tool-font-size, 14px) * 0.85)',
            color: 'var(--crai-fg-tertiary)',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} title={detail.title}>
            {detail.text}
          </span>
        )}
      </span>
      {!done && <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'crai-think-pulse 1.4s ease-in-out infinite' }} />}
      {done && <span>{tool.status === 'success' ? '✓' : '✗'}</span>}
    </div>
  )
})
