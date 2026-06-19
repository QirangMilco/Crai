/**
 * VersionPanel — 版本树侧栏面板。
 *
 * 请求 versioning:version-tree 数据，渲染可展开的版本节点列表。
 * 每个节点显示标题、文件变更列表。
 */
import { memo, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, FileCode } from 'lucide-react'
import { Icon } from '../ui/Icon'

interface VersionNode {
  turnId: string
  title?: string
  description?: string
  timestamp: number
  parentTurnId?: string
  files: Array<{ path: string; changeSource: string; timestamp: number }>
}

interface Props {
  nodes: VersionNode[] | null
  send: (msg: any) => void
  sessionId: string | null
}

export const VersionPanel = memo(function VersionPanel({ nodes, send, sessionId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (!requested && sessionId) {
      setRequested(true)
      send({ type: 'versioning:version-tree', sessionId })
    }
  }, [sessionId, send, requested])

  if (!sessionId) {
    return (
      <div className="p-3 text-xs" style={{ color: 'var(--crai-fg-40)' }}>
        无活跃会话
      </div>
    )
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-3 text-xs" style={{ color: 'var(--crai-fg-40)' }}>
        暂无版本数据
      </div>
    )
  }

  const toggleNode = (turnId: string) => {
    const next = new Set(expanded)
    if (next.has(turnId)) next.delete(turnId)
    else next.add(turnId)
    setExpanded(next)
  }

  return (
    <div className="flex flex-col overflow-y-auto" style={{ height: '100%' }}>
      <div className="px-3 py-2 text-[11px] font-medium border-b shrink-0" style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-40)' }}>
        版本树
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {[...nodes].reverse().map((node) => (
          <div key={node.turnId}>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs hover:opacity-80 transition-opacity"
              style={{ color: 'var(--crai-fg)' }}
              onClick={() => toggleNode(node.turnId)}
            >
              <Icon icon={expanded.has(node.turnId) ? ChevronDown : ChevronRight} size="xs" style={{ color: 'var(--crai-fg-40)' }} />
              <span className="truncate flex-1">
                {node.title || '(无标题)'}
              </span>
              {node.files.length > 0 && (
                <span className="text-[10px]" style={{ color: 'var(--crai-fg-40)' }}>
                  {node.files.length}
                </span>
              )}
            </div>

            {expanded.has(node.turnId) && (
              <div className="ml-5 space-y-0.5">
                {node.description && (
                  <div className="text-[10px] px-2 py-1" style={{ color: 'var(--crai-fg-40)' }}>
                    {node.description}
                  </div>
                )}
                {node.files.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded hover:opacity-80 transition-opacity cursor-pointer"
                    style={{ color: 'var(--crai-fg-40)' }}
                    onClick={() => {/* TODO: request diff */}}
                  >
                    <Icon icon={FileCode} size="xs" style={{ color: 'var(--crai-fg-40)' }} />
                    <span className="truncate">{f.path.split('/').pop()}</span>
                    {f.changeSource === 'agent' ? (
                      <span className="ml-auto px-1 rounded" style={{ backgroundColor: 'var(--crai-bg-5)', color: 'var(--crai-fg-40)' }}>AI</span>
                    ) : f.changeSource === 'manual' ? (
                      <span className="ml-auto px-1 rounded" style={{ backgroundColor: 'var(--crai-bg-5)', color: 'var(--crai-warning)' }}>手动</span>
                    ) : null}
                  </div>
                ))}
                <div className="flex gap-2 px-2 pt-1">
                  <button
                    onClick={() => send({ type: 'checkpoint:rollback', sessionId, turnId: node.turnId })}
                    className="text-[10px] px-2 py-0.5 rounded transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'var(--crai-bg-tertiary)', color: 'var(--crai-accent)' }}>
                    回滚到此
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
})
