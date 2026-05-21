import { memo } from 'react'
import { X } from 'lucide-react'
import { Icon } from '../ui/Icon'
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

/** 活动详情面板——完整 tool input/output，半透明遮罩层。 */
export const ActivityDetail = memo(function ActivityDetail({ activity, onClose }: Props) {
  const label = toolNameMap[activity.toolName ?? ''] ?? activity.displayName ?? activity.toolName ?? '工具'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--crai-msg-assistant-bg)',
          color: 'var(--crai-msg-assistant-fg)',
          borderRadius: 12,
          padding: 24,
          width: '80%',
          maxWidth: 700,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: 'var(--crai-shadow-elevated)',
        }}>
        {/* 标题行 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: activity.status === 'completed' ? 'var(--crai-tool-success)' : 'var(--crai-tool-error)',
            }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>{label}</span>
            {activity.intent && (
              <span style={{ fontSize: 13, color: 'var(--crai-fg-tertiary)' }}>— {activity.intent}</span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--crai-fg-tertiary)',
              cursor: 'pointer', padding: '0 4px', display: 'flex',
            }}>
            <Icon icon={X} size="md" />
          </button>
        </div>

        {/* Input */}
        {activity.toolInput && (
          <Section title="输入">
            <pre style={codeStyle}>{JSON.stringify(activity.toolInput, null, 2)}</pre>
          </Section>
        )}

        {/* Output */}
        {activity.content && (
          <Section title="输出">
            <pre style={codeStyle}>{activity.content}</pre>
          </Section>
        )}

        {/* Error */}
        {activity.error && (
          <Section title="错误">
            <pre style={{ ...codeStyle, color: 'var(--crai-tool-error)' }}>{activity.error}</pre>
          </Section>
        )}
      </div>
    </div>
  )
})

const codeStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: 8,
  backgroundColor: 'var(--crai-bg)',
  fontSize: 13,
  lineHeight: 1.5,
  overflow: 'auto',
  maxHeight: 300,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--crai-fg-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  )
}
