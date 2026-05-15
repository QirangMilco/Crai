import { memo } from 'react'

interface ToolCall {
  toolCallId: string
  name: string
  args: string
  status: 'running' | 'success' | 'error'
}

interface Props {
  tool: ToolCall
}

const TOOL_LABELS: Record<string, string> = {
  fs_read: '读取文件',
  fs_write: '写入文件',
  fs_grep: '搜索内容',
  fs_list: '列出文件',
  fs_edit: '编辑文件',
  bash: '执行命令',
  web_search: '搜索网络',
  web_fetch: '获取网页',
}

export const ToolBlock = memo(function ToolBlock({ tool }: Props) {
  const label = TOOL_LABELS[tool.name] ?? tool.name
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
          ? (tool.status === 'success' ? 'var(--crai-tool-success, #22c55e)' : 'var(--crai-tool-error, #ef4444)')
          : 'var(--crai-accent)',
        opacity: done ? 1 : 0.5,
        flexShrink: 0,
      }} />
      <span style={{ flex: 1 }}>{label}</span>
      {!done && <span className="crai-thinking-dots" />}
      {done && <span>{tool.status === 'success' ? '✓' : '✗'}</span>}
    </div>
  )
})

/** 工具调用组，多个同时运行时折叠展示。 */
export const ToolGroupBlock = memo(function ToolGroupBlock({ tools }: { tools: ToolCall[] }) {
  if (tools.length === 0) return null

  const allDone = tools.every((t) => t.status !== 'running')

  return (
    <div data-token-group="tool-group" style={{ marginTop: 'var(--crai-tool-group-mt, 4px)', marginBottom: 'var(--crai-tool-group-mb, 4px)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--crai-tool-group-title-size, 12px)',
        color: 'var(--crai-tool-group-title-fg)',
        marginBottom: tools.length > 1 ? 4 : 0,
      }}>
        <span>{allDone ? `工具调用 (${tools.length})` : `正在调用工具 (${tools.filter(t => t.status === 'running').length})`}</span>
        {!allDone && <span className="crai-thinking-dots" />}
      </div>
      {tools.map((tool, i) => (
        <ToolBlock key={`${tool.toolCallId}-${i}`} tool={tool} />
      ))}
    </div>
  )
})
