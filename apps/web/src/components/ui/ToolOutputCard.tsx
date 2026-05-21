/**
 * ToolOutputCard — 工具输出专用卡片。
 *
 * 根据工具类型和结果内容自动选择合适的展示方式。
 * 当前支持：
 * - file: 文件读写结果（文件名 + 大小）
 * - search: 网络搜索结果
 * - code: 代码执行结果（bash 命令输出）
 * - default: 普通文本摘要
 */
import { FileText, Globe, Terminal, FileOutput } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Card } from '../ui/Card'

interface Props {
  toolName?: string
  result: string
  truncated?: boolean
}

type OutputVariant = 'file' | 'search' | 'code' | 'default'

function detectVariant(toolName?: string, result?: string): OutputVariant {
  if (toolName === 'web_search' || toolName === 'web_fetch') return 'search'
  if (toolName === 'bash') return 'code'
  if (toolName === 'fs_read' || toolName === 'fs_write' || toolName === 'fs_edit' || toolName === 'fs_list') return 'file'
  return 'default'
}

const variantConfig: Record<OutputVariant, { icon: React.ComponentType<any>; label: string; color: string }> = {
  file:   { icon: FileText,   label: '文件',    color: '#6366f1' },
  search: { icon: Globe,      label: '搜索结果', color: '#0ea5e9' },
  code:   { icon: Terminal,   label: '输出',    color: '#10b981' },
  default: { icon: FileOutput, label: '结果',   color: 'var(--crai-fg-tertiary)' },
}

/** 智能截断：保留首尾，中间用 … 省略。 */
function smartTruncate(text: string, maxLen: number = 200): { text: string; truncated: boolean } {
  if (text.length <= maxLen) return { text, truncated: false }
  const head = text.slice(0, Math.floor(maxLen * 0.6))
  const tail = text.slice(-Math.floor(maxLen * 0.3))
  return { text: `${head}\n…\n${tail}`, truncated: true }
}

export function ToolOutputCard({ toolName, result, truncated: forcedTruncated }: Props) {
  const variant = detectVariant(toolName, result)
  const config = variantConfig[variant]
  const { text, truncated } = forcedTruncated ? { text: result, truncated: forcedTruncated } : smartTruncate(result)

  return (
    <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border mt-1"
      style={{
        borderColor: 'var(--crai-border)',
        boxShadow: 'var(--crai-shadow-card)',
      }}
    >
      {/* 左侧色条 */}
      <div className="shrink-0" style={{ width: 3, backgroundColor: config.color }} />

      <div className="flex-1 min-w-0">
        {/* 标题行 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b text-xs font-medium"
          style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-secondary)' }}>
          <Icon icon={config.icon} size="sm" style={{ color: config.color }} />
          {config.label}
          {truncated && <span className="ml-auto text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>截断</span>}
        </div>
        {/* 内容 */}
        <div className="px-2.5 py-1.5 text-xs leading-relaxed overflow-hidden"
          style={{
            color: 'var(--crai-tool-fg)',
            fontFamily: variant === 'code' ? 'var(--crai-font-mono, monospace)' : undefined,
            whiteSpace: variant === 'code' ? 'pre-wrap' : 'pre-wrap',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  )
}
