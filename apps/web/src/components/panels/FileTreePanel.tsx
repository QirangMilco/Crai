/**
 * FileTreePanel — 工作区文件树面板。
 *
 * 使用 server 的 dir:browse 协议懒加载目录树。
 * 功能：
 * - 从当前工作区根目录展开，显示文件和目录
 * - 懒加载子目录（点击展开/折叠）
 * - 路径面包屑导航
 * - 搜索过滤（文件名/目录名）
 * - 文件大小、修改时间显示
 * - 点击目录展开/折叠，点击文件可选中
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ChevronRight, Folder, File, FileCode, FileImage, FileJson, FileText,
  Terminal, ArrowUp, X, LoaderCircle,
} from 'lucide-react'
import { Icon, cn } from '../ui'

interface DirEntry {
  path: string
  dirs: string[]
  files?: Array<{
    name: string
    path: string
    size: number
    mtime: number
    isDirectory: boolean
  }>
  parent?: string
  error?: string
}

interface TreeNode {
  path: string
  name: string
  isDirectory: boolean
  expanded: boolean
  loading: boolean
  children: TreeNode[] | null
  size?: number
  mtime?: number
}

interface Props {
  send: (msg: any) => void
  /** 当前工作区根目录 */
  workspaceRoot?: string | null
  /** 收到 dir:browse:data 时由父组件调用 */
  onBrowseResultRef: React.MutableRefObject<((data: DirEntry) => void) | null>
  width: number
  hovered: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400000) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return !!ext && ['md', 'txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'yml', 'yaml', 'toml', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'rb', 'php', 'sh', 'bash', 'zsh', 'fish', 'xml', 'svg', 'vue', 'svelte', 'astro', 'sql', 'graphql', 'env', 'gitignore', 'editorconfig', 'prettierrc', 'eslintrc'].includes(ext)
}

function fileIconComponent(name: string, isDirectory: boolean): React.ReactNode {
  if (isDirectory) return <Icon icon={Folder} size="sm" className="shrink-0" style={{ color: 'var(--crai-accent)' }} />
  const ext = name.split('.').pop()?.toLowerCase()
  if (['js', 'ts', 'tsx', 'jsx', 'vue', 'svelte'].includes(ext ?? ''))
    return <Icon icon={FileCode} size="sm" className="shrink-0" style={{ color: '#22c55e' }} />
  if (['json', 'yml', 'yaml', 'toml', 'xml'].includes(ext ?? ''))
    return <Icon icon={FileJson} size="sm" className="shrink-0" style={{ color: '#f59e0b' }} />
  if (['md', 'txt', 'rst'].includes(ext ?? ''))
    return <Icon icon={FileText} size="sm" className="shrink-0" style={{ color: '#6366f1' }} />
  if (['css', 'scss', 'less', 'html', 'svg'].includes(ext ?? ''))
    return <Icon icon={FileImage} size="sm" className="shrink-0" style={{ color: '#ec4899' }} />
  if (['py', 'rb', 'rs', 'go', 'java'].includes(ext ?? ''))
    return <Icon icon={Terminal} size="sm" className="shrink-0" style={{ color: '#0ea5e9' }} />
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'].includes(ext ?? ''))
    return <Icon icon={FileImage} size="sm" className="shrink-0" style={{ color: '#8b5cf6' }} />
  if (['sh', 'bash', 'zsh', 'fish'].includes(ext ?? ''))
    return <Icon icon={Terminal} size="sm" className="shrink-0" style={{ color: '#10b981' }} />
  if (['env', 'gitignore', 'editorconfig'].includes(ext ?? ''))
    return <Icon icon={File} size="sm" className="shrink-0" style={{ color: '#94a3b8' }} />
  return <Icon icon={File} size="sm" className="shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }} />
}

function buildTree(path: string, dirs: string[], files: DirEntry['files'], existingChildren: TreeNode[] | null): TreeNode[] {
  const result: TreeNode[] = []

  // 目录
  for (const name of dirs) {
    const childPath = path === '/' ? `/${name}` : `${path}/${name}`
    const existing = existingChildren?.find((c) => c.path === childPath && c.isDirectory)
    result.push({
      path: childPath,
      name,
      isDirectory: true,
      expanded: existing?.expanded ?? false,
      loading: existing?.loading ?? false,
      children: existing?.children ?? null,
    })
  }

  // 文件
  if (files) {
    for (const f of files) {
      result.push({
        path: f.path,
        name: f.name,
        isDirectory: false,
        expanded: false,
        loading: false,
        children: null,
        size: f.size,
        mtime: f.mtime,
      })
    }
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return result
}

export function FileTreePanel({ send, workspaceRoot, onBrowseResultRef, width, hovered }: Props) {
  const [root, setRoot] = useState<TreeNode[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hovered) searchRef.current?.focus()
  }, [hovered])

  // 初始化/切换 workspace
  useEffect(() => {
    if (workspaceRoot) {
      setCurrentPath(workspaceRoot)
      send({ type: 'dir:browse', path: workspaceRoot, showFiles: true })
    }
  }, [workspaceRoot, send])

  // 注册 browse 回调
  useEffect(() => {
    onBrowseResultRef.current = (data: DirEntry) => {
      setError(data.error ?? null)
      if (data.error) return

      if (data.path === currentPath) {
        setRoot(buildTree(data.path, data.dirs, data.files, root))
      } else {
        setRoot((prev) => updateTreeNode(prev, data.path, (node) => ({
          ...node,
          loading: false,
          expanded: true,
          children: buildTree(data.path, data.dirs, data.files, node.children),
        })))
      }
    }
    return () => {
      onBrowseResultRef.current = null
    }
  }, [currentPath, onBrowseResultRef, root])

  const handleToggle = useCallback((path: string, isDirectory: boolean) => {
    if (!isDirectory) return // 文件不可展开

    setRoot((prev) => updateTreeNode(prev, path, (node) => {
      if (node.expanded) {
        return { ...node, expanded: false }
      }
      if (node.children === null && !node.loading) {
        send({ type: 'dir:browse', path, showFiles: true })
        return { ...node, loading: true }
      }
      return { ...node, expanded: true }
    }))
  }, [send])

  const currentDirName = currentPath.split('/').filter(Boolean).pop() || currentPath

  // 过滤
  const filterTree = useCallback((nodes: TreeNode[]): TreeNode[] => {
    if (!search.trim()) return nodes
    const q = search.toLowerCase()
    return nodes.filter((n) => {
      const nameMatch = n.name.toLowerCase().includes(q)
      const childrenMatch = n.children ? filterTree(n.children) : []
      return nameMatch || childrenMatch.length > 0
    }).map((n) => ({
      ...n,
      children: n.children ? filterTree(n.children) : null,
      expanded: search.trim() ? true : n.expanded,
    }))
  }, [search])

  const displayTree = search.trim() ? filterTree(root) : root

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.isDirectory && node.children && node.children.length > 0
    const isOpen = node.isDirectory && node.expanded

    if (!node.isDirectory) {
      // 文件节点
      return (
        <div key={node.path} className="flex items-center gap-1 px-1 rounded cursor-default hover:opacity-80 transition-opacity duration-150"
          style={{
            paddingLeft: `${12 + depth * 14}px`,
            paddingTop: 2,
            paddingBottom: 2,
            color: 'var(--crai-fg)',
          }}
          title={`${node.path}\n${node.size ? formatSize(node.size) : ''}${node.mtime ? `  ${formatTime(node.mtime)}` : ''}`}
        >
          <span className="shrink-0 text-[10px] w-3 text-center" style={{ color: 'var(--crai-fg-tertiary)' }} />
          {fileIconComponent(node.name, false)}
          <span className="flex-1 text-xs truncate ml-1">{node.name}</span>
          {node.size != null && (
            <span className="text-[9px] shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {formatSize(node.size)}
            </span>
          )}
        </div>
      )
    }

    // 目录节点
    return (
      <div key={node.path}>
        <div className="flex items-center gap-1 px-1 rounded cursor-pointer hover:opacity-80 transition-opacity duration-150"
          style={{
            paddingLeft: `${8 + depth * 14}px`,
            paddingTop: 2,
            paddingBottom: 2,
            color: 'var(--crai-fg)',
          }}
          onClick={() => handleToggle(node.path, true)}
          title={node.path}
        >
          <span className="shrink-0 text-[10px] w-3 flex items-center justify-center" style={{ color: 'var(--crai-fg-tertiary)' }}>
            {node.loading
              ? <Icon icon={LoaderCircle} size="xs" className="animate-spin" />
              : <Icon icon={ChevronRight} size="xs" className={cn(isOpen && 'rotate-90', 'transition-transform duration-150')} />
            }
          </span>
          {fileIconComponent(node.name, true)}
          <span className="text-xs truncate ml-1">{node.name}</span>
        </div>
        {isOpen && node.children && node.children.length > 0 && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ minWidth: 0 }}>
      {/* 路径 + 搜索 */}
      <div className="shrink-0 px-2 pt-1.5 space-y-1.5">
        <div className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono cursor-pointer truncate"
          style={{
            color: 'var(--crai-fg-secondary)',
            backgroundColor: 'var(--crai-bg-secondary)',
          }}
          title={currentPath}
        >
          <Icon icon={Folder} size="sm" className="shrink-0" style={{ color: 'var(--crai-accent)' }} />
          <span className="truncate">{currentDirName}</span>
        </div>

        <div className="relative">
          <input ref={searchRef} type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="过滤文件…"
            className="w-full text-xs px-2 py-1.5 rounded outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: 'var(--crai-fg)',
              border: '1px solid var(--crai-border)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 opacity-50 hover:opacity-100 transition-opacity duration-150"
              style={{ color: 'var(--crai-fg-tertiary)' }}>
              <Icon icon={X} size="xs" />
            </button>
          )}
        </div>

        {currentPath !== workspaceRoot && (
          <button onClick={() => {
            const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
            setCurrentPath(parent)
            send({ type: 'dir:browse', path: parent, showFiles: true })
          }}
            className="w-full text-[10px] text-left flex items-center gap-1 px-2 py-1 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)]"
            style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
            <Icon icon={ArrowUp} size="xs" />
            上级目录
          </button>
        )}
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 select-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--crai-destructive)', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div className="text-xs" style={{ color: 'var(--crai-destructive)' }}>{error || '加载失败'}</div>
            <button
              onClick={() => { setError(null); setRoot([]); forceUpdate(v => v + 1) }}
              className="text-[10px] px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--crai-accent)', border: '1px solid var(--crai-accent)' }}
            >重试</button>
          </div>
        ) : root.length === 0 ? (
          <div className="flex items-center justify-center py-10 space-y-2 select-none">
            <Icon icon={LoaderCircle} size="sm" className="animate-spin" style={{ color: 'var(--crai-accent)', opacity: 0.5 }} />
            <span className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>加载工作区文件…</span>
          </div>
        ) : displayTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 select-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--crai-fg-40)', opacity: 0.4 }}>
              <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <div className="text-[10px]" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {search ? '无匹配文件或目录' : '此目录下为空'}
            </div>
          </div>
        ) : (
          displayTree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  )
}

// ── 树节点更新工具 ──

function updateTreeNode(
  nodes: TreeNode[],
  path: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === path) return updater(n)
    if (n.children) return { ...n, children: updateTreeNode(n.children, path, updater) }
    return n
  })
}
