/**
 * DiffModal — 检查点文件 diff 展示弹窗。
 *
 * 支持 unified（单列）和 split（双列）两种显示模式。
 * 默认 unified。
 */
import { useState, useMemo } from 'react'
import { Dialog } from '../ui/Dialog'
import { Icon } from '../ui/Icon'
import { ChevronDown, ChevronRight, FileCode, Columns2, AlignJustify } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

interface DiffEntry {
  path: string
  diff: string
  changeSource: string
  timestampA: number
  timestampB: number
}

interface Props {
  entries: DiffEntry[]
  onClose: () => void
}

interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  content: string
  oldLine?: number
  newLine?: number
}

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  for (const raw of diff.split('\n')) {
    if (!raw) continue
    const ch = raw[0]
    const content = raw.slice(1)
    if (ch === '+') { newLine++; lines.push({ type: 'add', content, oldLine: undefined, newLine }) }
    else if (ch === '-') { oldLine++; lines.push({ type: 'del', content, oldLine, newLine: undefined }) }
    else if (ch === ' ') { oldLine++; newLine++; lines.push({ type: 'ctx', content, oldLine, newLine }) }
  }
  return lines
}

/** 将 unified diff 行序列转为左右配对行，用于双列渲染。 */
function pairLines(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
  const paired: Array<{ left: DiffLine | null; right: DiffLine | null }> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line) { i++; continue }

    if (line.type === 'del') {
      const next = lines[i + 1]
      if (next?.type === 'add') {
        // 配对删除 + 新增
        paired.push({ left: line, right: next })
        i += 2
        continue
      }
      // 单独删除
      paired.push({ left: line, right: null })
      i++
    } else if (line.type === 'add') {
      // 单独新增
      paired.push({ left: null, right: line })
      i++
    } else {
      // 上下文
      paired.push({ left: line, right: line })
      i++
    }
  }
  return paired
}

// ── Unified 渲染（单列） ──

function UnifiedDiff({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{
              backgroundColor:
                line.type === 'add' ? 'color-mix(in srgb, var(--crai-tool-success) 8%, transparent)' :
                line.type === 'del' ? 'color-mix(in srgb, var(--crai-tool-error) 8%, transparent)' :
                'transparent',
            }}>
              <td className="text-right px-2 select-none" style={{ width: 48, minWidth: 48, color: 'var(--crai-fg-40)', opacity: line.type === 'add' ? 0.3 : 1, userSelect: 'none' }}>{line.oldLine ?? ''}</td>
              <td className="text-right px-2 select-none" style={{ width: 48, minWidth: 48, color: 'var(--crai-fg-40)', opacity: line.type === 'del' ? 0.3 : 1, userSelect: 'none' }}>{line.newLine ?? ''}</td>
              <td className="px-2 select-none" style={{ width: 20, minWidth: 20, fontWeight: 600, color: line.type === 'add' ? 'var(--crai-tool-success)' : line.type === 'del' ? 'var(--crai-tool-error)' : 'transparent', userSelect: 'none' }}>{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</td>
              <td className="px-2 whitespace-pre" style={{ color: line.type === 'add' ? 'var(--crai-tool-success)' : line.type === 'del' ? 'var(--crai-tool-error)' : 'var(--crai-fg)' }}>{line.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Split 渲染（双列） ──

function SplitDiff({ lines }: { lines: DiffLine[] }) {
  const paired = useMemo(() => pairLines(lines), [lines])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="text-right px-2 text-[10px] font-normal" style={{ width: 48, color: 'var(--crai-fg-40)' }}>旧</th>
            <th className="px-2 text-[10px] font-normal text-left" style={{ color: 'var(--crai-fg-40)' }}>旧内容</th>
            <th className="text-right px-2 text-[10px] font-normal" style={{ width: 48, color: 'var(--crai-fg-40)' }}>新</th>
            <th className="px-2 text-[10px] font-normal text-left" style={{ color: 'var(--crai-fg-40)' }}>新内容</th>
          </tr>
        </thead>
        <tbody>
          {paired.map((pair, i) => (
            <tr key={i}>
              {/* 左侧：旧行号 + 内容 */}
              {pair.left ? (
                <>
                  <td className="text-right px-2 select-none" style={{ width: 48, minWidth: 48, color: 'var(--crai-fg-40)', userSelect: 'none' }}>{pair.left.oldLine ?? ''}</td>
                  <td className="px-2 whitespace-pre truncate" style={{
                    backgroundColor: pair.left.type === 'del' ? 'color-mix(in srgb, var(--crai-tool-error) 8%, transparent)' : 'transparent',
                    color: pair.left.type === 'del' ? 'var(--crai-tool-error)' : 'var(--crai-fg)',
                  }}>{pair.left.content}</td>
                </>
              ) : (
                <>
                  <td style={{ width: 48 }} />
                  <td />
                </>
              )}
              {/* 右侧：新行号 + 内容 */}
              {pair.right ? (
                <>
                  <td className="text-right px-2 select-none" style={{ width: 48, minWidth: 48, color: 'var(--crai-fg-40)', userSelect: 'none' }}>{pair.right.newLine ?? ''}</td>
                  <td className="px-2 whitespace-pre truncate" style={{
                    backgroundColor: pair.right.type === 'add' ? 'color-mix(in srgb, var(--crai-tool-success) 8%, transparent)' : 'transparent',
                    color: pair.right.type === 'add' ? 'var(--crai-tool-success)' : 'var(--crai-fg)',
                  }}>{pair.right.content}</td>
                </>
              ) : (
                <>
                  <td style={{ width: 48 }} />
                  <td />
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 单文件 diff ──

function FileDiff({ path, diff, changeSource, sideBySide }: { path: string; diff: string; changeSource: string; sideBySide: boolean }) {
  const [collapsed, setCollapsed] = useState(false)
  const lines = useMemo(() => parseDiff(diff), [diff])
  const addCount = lines.filter((l) => l.type === 'add').length
  const delCount = lines.filter((l) => l.type === 'del').length

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--crai-border)' }}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none text-xs font-medium"
        style={{ backgroundColor: 'var(--crai-bg-tertiary)', borderBottom: collapsed ? 'none' : '1px solid var(--crai-border)', color: 'var(--crai-fg)' }}
        onClick={() => setCollapsed(!collapsed)}>
        <Icon icon={collapsed ? ChevronRight : ChevronDown} size="xs" />
        <Icon icon={FileCode} size="xs" style={{ color: 'var(--crai-fg-40)' }} />
        <span className="truncate">{path.split('/').pop()}</span>
        <span className="text-[10px] truncate" style={{ color: 'var(--crai-fg-40)' }}>{path}</span>
        <span className="ml-auto text-[10px] tabular-nums">
          <span style={{ color: 'var(--crai-tool-success)' }}>+{addCount}</span>
          {' '}
          <span style={{ color: 'var(--crai-tool-error)' }}>-{delCount}</span>
          {changeSource === 'agent' && <span className="ml-2 px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--crai-bg-5)', color: 'var(--crai-fg-40)' }}>AI</span>}
          {changeSource === 'manual' && <span className="ml-2 px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--crai-bg-5)', color: 'var(--crai-warning)' }}>手动</span>}
        </span>
      </div>
      {!collapsed && (sideBySide ? <SplitDiff lines={lines} /> : <UnifiedDiff lines={lines} />)}
    </div>
  )
}

// ── 主组件 ──

export function DiffModal({ entries, onClose }: Props) {
  const [sideBySide, setSideBySide] = useState(false)
  if (!entries.length) return null

  return (
    <Dialog open={true} onClose={onClose} className="rounded-xl flex flex-col overflow-hidden"
      style={{ width: 'min(95vw, 1200px)', height: 'min(85vh, 750px)', backgroundColor: 'var(--crai-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--crai-fg)' }}>
          文件变更（共 {entries.length} 个文件）
        </span>
        <div className="flex items-center gap-1" style={{ marginRight: 28 }}>
          <Tooltip tip={sideBySide ? '单列视图' : '双列视图'} position="bottom">
            <button onClick={() => setSideBySide(!sideBySide)}
              className="p-1 rounded transition-colors hover:bg-[var(--crai-bg-5)]"
              style={{ color: 'var(--crai-fg-40)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
              <Icon icon={sideBySide ? AlignJustify : Columns2} size="sm" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.map((entry) => (
          <FileDiff key={entry.path} path={entry.path} diff={entry.diff} changeSource={entry.changeSource} sideBySide={sideBySide} />
        ))}
      </div>
    </Dialog>
  )
}
