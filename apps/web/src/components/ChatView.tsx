import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import { DirBrowser } from './DirBrowser'
import type { ChatMessage, ContentBlock } from '../types/messages'
import { debugLog } from '../utils/debug'

interface Props {
  wsUrl: string
}

function Dropdown<T extends string>({ label, items, selected, onSelect, onAction, actionLabel }: {
  label: string
  items: { id: T; display: string; active: boolean }[]
  selected: T | null
  onSelect: (id: T) => void
  onAction?: () => void
  actionLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors"
        style={{ borderColor: 'var(--crai-border)', color: 'var(--crai-fg-secondary)' }}>
        {label}
        <span className="text-[10px]">▼</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[160px] rounded-lg z-50 py-1"
          style={{ backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)' }}>
          {items.map((item) => (
            <button key={item.id}
              onClick={() => { onSelect(item.id); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 flex items-center gap-2"
              style={{ color: item.active ? 'var(--crai-accent)' : 'var(--crai-fg)' }}>
              {item.active && <span className="text-[10px]">●</span>}
              {item.display}
            </button>
          ))}
          {onAction && actionLabel && (
            <>
              <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--crai-border)' }} />
              <button onClick={() => { onAction(); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs"
                style={{ color: 'var(--crai-accent)' }}>
                {actionLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** 找到最后一条 assistant 消息的索引，找不到则创建一个新的。 */
function findCreateAssistant(prev: ChatMessage[]): { copy: ChatMessage[]; idx: number } {
  const idx = findLastAssistantIndex(prev)
  if (idx !== undefined) return { copy: prev, idx }
  const now = Date.now()
  const msg: ChatMessage = { id: `asst-${now}`, role: 'assistant', text: '', createdAt: now }
  debugLog('thinking', 'created fallback assistant message', `asst-${now}`)
  const copy = [...prev, msg]
  return { copy, idx: copy.length - 1 }
}

function findLastAssistantIndex(prev: ChatMessage[]): number | undefined {
  return prev.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
}

/** 在最后一条 assistant 消息上追加文本块内容。无 debounce，实时写入。 */
function appendTextBlock(prev: ChatMessage[], delta: string): ChatMessage[] {
  const { copy, idx } = findCreateAssistant(prev)
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  const existing = blocks.find((b: any) => b.type === 'text') as any
  if (existing) {
    existing.content += delta
  } else {
    // text 永远在最后
    blocks.push({ type: 'text', content: delta })
  }
  copy[idx] = { ...copy[idx], blocks }
  return copy
}

/** thinking 块永远在最前。已存在则 replace，否则 unshift。 */
function upsertThinkingBlock(prev: ChatMessage[], delta: string): ChatMessage[] {
  const { copy, idx } = findCreateAssistant(prev)
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  const existingIdx = blocks.findIndex((b: any) => b.type === 'thinking')
  const block: ContentBlock = {
    type: 'thinking',
    content: existingIdx >= 0 ? (blocks[existingIdx] as any).content + delta : delta,
    sealed: false,
  }
  if (existingIdx >= 0) blocks[existingIdx] = block
  else blocks.unshift(block)
  copy[idx] = { ...copy[idx], blocks }
  return copy
}

/** tool_group：已有未完成组则追加，否则 push 新组。 */
function upsertToolGroup(prev: ChatMessage[], toolCallId: string, name: string): ChatMessage[] {
  const { copy, idx } = findCreateAssistant(prev)
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  // 找最后一个包含未完成工具的 tool_group
  const lastIdx = blocks.map((b, i) => ({ b, i })).filter(
    (x) => x.b.type === 'tool_group' && (x.b as any).tools.some((t: any) => t.status === 'running'),
  ).pop()?.i
  if (lastIdx !== undefined) {
    const tg = blocks[lastIdx] as any
    tg.tools.push({ toolCallId, name, args: '', status: 'running' })
  } else {
    blocks.push({
      type: 'tool_group',
      tools: [{ toolCallId, name, args: '', status: 'running' }],
      collapsed: false,
    })
  }
  copy[idx] = { ...copy[idx], blocks }
  return copy
}

/** 更新指定 tool_group 中某 tool 的 args。 */
function updateToolArgs(prev: ChatMessage[], toolCallId: string, argsDelta: string): ChatMessage[] {
  const idx = findLastAssistantIndex(prev)
  if (idx === undefined) return prev
  const copy = [...prev]
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  for (const b of blocks) {
    if (b.type !== 'tool_group') continue
    const tool = (b as any).tools.find((t: any) => t.toolCallId === toolCallId && t.status === 'running')
    if (tool) { tool.args += argsDelta; break }
  }
  copy[idx] = { ...copy[idx], blocks }
  return copy
}

/** 标记 tool 完成，若组内全部完成则折叠。 */
function markToolDone(prev: ChatMessage[], toolCallId: string, isError: boolean): ChatMessage[] {
  const idx = findLastAssistantIndex(prev)
  if (idx === undefined) return prev
  const copy = [...prev]
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  for (const b of blocks) {
    if (b.type !== 'tool_group') continue
    const tool = (b as any).tools.find((t: any) => t.toolCallId === toolCallId && t.status === 'running')
    if (tool) {
      tool.status = isError ? 'error' : 'success'
      // 所有工具完成后自动折叠
      if ((b as any).tools.every((t: any) => t.status !== 'running')) {
        (b as any).collapsed = true
      }
      break
    }
  }
  copy[idx] = { ...copy[idx], blocks }
  return copy
}

export function ChatView({ wsUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number }>>([])
  const [dirBrowser, setDirBrowser] = useState<{ path: string; dirs: string[]; parent?: string; error?: string } | null>(null)
  const titledSessions = useRef<Set<string>>(new Set())
  const sessionIdRef = useRef<string | null>(null)

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback((raw: string) => {
      let msg: any
      try { msg = JSON.parse(raw) } catch { return }

      switch (msg.type) {
        case 'event': {
          if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
            debugLog('stream', 'model.delta', msg.payload.delta.slice(0, 50))
            // 实时写入 text block，无 debounce
            setMessages((prev) => appendTextBlock(prev, msg.payload.delta))
          }

          // ── 思考过程与工具调用流式事件 ──
          if (msg.event === 'thinking.delta' && typeof msg.payload?.delta === 'string') {
            debugLog('thinking', 'thinking.delta arrived', msg.payload.delta.slice(0, 60))
            setMessages((prev) => upsertThinkingBlock(prev, msg.payload.delta))
          }
          if (msg.event === 'thinking.done') {
            debugLog('thinking', 'thinking.done', {})
            setMessages((prev) => {
              const idx = findLastAssistantIndex(prev)
              if (idx === undefined) return prev
              const copy = [...prev]
              const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
              for (const b of blocks) {
                if (b.type === 'thinking') (b as any).sealed = true
              }
              copy[idx] = { ...copy[idx], blocks }
              return copy
            })
          }
          if (msg.event === 'tool.start' && msg.payload?.name) {
            setMessages((prev) => upsertToolGroup(prev, msg.payload.toolCallId, msg.payload.name))
          }
          if (msg.event === 'tool.delta' && msg.payload?.delta) {
            setMessages((prev) => updateToolArgs(prev, msg.payload.toolCallId, msg.payload.delta))
          }
          if (msg.event === 'tool.done') {
            setMessages((prev) => markToolDone(prev, msg.payload.toolCallId, !!msg.payload.isError))
          }

          if (msg.event === 'model.completed') {
            // 首次 AI 响应完成后，请求服务端生成标题
            if (sessionIdRef.current && !titledSessions.current.has(sessionIdRef.current)) {
              titledSessions.current.add(sessionIdRef.current)
              send({ type: 'session:generate-title', sessionId: sessionIdRef.current })
            }
          }
          break
        }
        case 'session:id':
          setSessionId(msg.id)
          sessionIdRef.current = msg.id
          send({ type: 'session:load', sessionId: msg.id })
          send({ type: 'session:list' })
          break
        case 'request:input': {
          const answer = prompt(msg.question + (msg.options?.length ? `\n选项: ${msg.options.join(', ')}` : ''))
          if (answer !== null) send({ type: 'resolve:input', id: msg.id, value: answer })
          break
        }
        case 'config:data':
          setGlobalConfig(msg.config)
          // 自动同步服务端调试 scope 到 localStorage
          if (msg.config?.debugScopes?.length) {
            localStorage.setItem('crai:debug:scope', msg.config.debugScopes.join(','))
          }
          break
        case 'workspace:list:data': {
          const list = msg.workspaces?.map((w: any) => ({ rootDir: w.rootDir })) ?? []
          setWorkspaces(list)
          if (msg.current) {
            setCurrentWorkspace(msg.current)
          } else if (list.length > 0 && !currentWorkspace) {
            // 没有当前工作区时自动切到第一个
            send({ type: 'workspace:switch', rootDir: list[0].rootDir })
            return
          }
          send({ type: 'session:list' })
          break
        }
        case 'workspace:switched':
          setCurrentWorkspace(msg.rootDir)
          setSessionId(null)
          sessionIdRef.current = null
          setMessages([])
          send({ type: 'workspace:list' })
          break
        case 'session:list:data':
          setSessions(msg.sessions ?? [])
          break
        case 'session:data': {
          setMessages((prev) => {
            debugLog('merge', 'session:data merge start', { incoming: (msg.messages ?? []).length, local: prev.length, localIds: prev.map(m => m.id) })
            const incoming = (msg.messages ?? []).map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              text: m.text,
              createdAt: m.createdAt ?? Date.now(),
            }))
            const incomingIds = new Set(incoming.map((m: any) => m.id))
            const hasServerAssistant = incoming.some((m: any) => m.role === 'assistant')
            const hasServerUser = incoming.some((m: any) => m.role === 'user')
            // 分离：带 blocks 的本地消息暂存，其余按规则过滤
            const droppedWithBlocks: Array<{ role: string; blocks: any[] }> = []
            // 合并前保存本地 blocks（用于合并后恢复，防止跨对话消失）
            const localBlocks = new Map<string, any[]>()
            for (const m of prev) {
              if (m.blocks?.length) localBlocks.set(m.id, m.blocks)
            }
            const kept = prev.filter((m) => {
              if (incomingIds.has(m.id)) return false
              if (hasServerAssistant && m.role === 'assistant' && /^asst-/.test(m.id)) {
                if (m.blocks && m.blocks.length > 0) droppedWithBlocks.push({ role: m.role, blocks: m.blocks })
                return false
              }
              if (hasServerUser && m.role === 'user' && /^user-/.test(m.id)) return false
              return true
            })
            // 用服务端数据覆盖，保留 kept 中真正本地独有的消息
            const droppedCount = prev.length - kept.length - incoming.filter(m => prev.some(p => p.id === m.id)).length
            debugLog('merge', 'kept', kept.length, 'dropped local placeholders', droppedCount, 'incoming', incoming.length)
            const merged = [...incoming]
            for (const local of kept) {
              const existing = merged.findIndex((m) => m.id === local.id)
              if (existing >= 0) {
                merged[existing] = { ...merged[existing], text: merged[existing].text || local.text, blocks: merged[existing].blocks || local.blocks }
              } else {
                merged.push(local)
              }
            }
            // 按 createdAt 排序
            merged.sort((a, b) => a.createdAt - b.createdAt)
            // 恢复被丢弃的本地 blocks 到对应的服务端消息（含预创建消息和同 id 消息）
            for (const dropped of droppedWithBlocks) {
              const targetIdx = merged.map((m, i) => ({ m, i }))
                .filter(x => x.m.role === dropped.role && !x.m.blocks)
                .pop()?.i
              if (targetIdx !== undefined) {
                merged[targetIdx] = { ...merged[targetIdx], blocks: dropped.blocks }
              }
            }
            // 恢复本地 blocks（同 id 消息被服务端数据覆盖时）
            for (const m of merged) {
              if (!m.blocks && localBlocks.has(m.id)) {
                m.blocks = localBlocks.get(m.id)
              }
            }
            return merged
          })
          break
        }
        case 'dir:browse:data':
          setDirBrowser({ path: msg.path, dirs: msg.dirs, parent: msg.parent, error: msg.error })
          break
        case 'session:title':
          setSessions((prev) => prev.map((s) => s.id === msg.sessionId ? { ...s, title: msg.title } : s))
          break
      }
    }, []),
  })

  const handleSend = useCallback((text: string) => {
    const ts = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: `user-${ts}`, role: 'user', text, createdAt: ts },
      { id: `asst-${ts}`, role: 'assistant', text: '', createdAt: ts },
    ])
    // 如果尚未生成标题，从首条消息自动生成
    if (sessionId && !sessions.find((s) => s.id === sessionId)?.title) {
      const title = text.length > 30 ? text.slice(0, 30) + '…' : text
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s))
      send({ type: 'session:update', sessionId, title })
    }
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text })
  }, [sessionId, send, sessions])

  const handleNewSession = useCallback(() => {
    setMessages([])
    setSessionId(null)
    send({ type: 'session:new' })
  }, [send])

  const handleSwitchSession = useCallback((sid: string) => {
    setSessionId(sid)
    send({ type: 'session:load', sessionId: sid })
  }, [send])

  const handleSwitchWorkspace = useCallback((rootDir: string) => {
    send({ type: 'workspace:switch', rootDir })
    setSessions([])
    setMessages([])
    setSessionId(null)
  }, [send])

  const handleAddWorkspace = useCallback(() => {
    setDirBrowser({ path: '', dirs: [], parent: undefined })
    send({ type: 'dir:browse' })
  }, [send])

  function handleDirNavigate(path: string) {
    send({ type: 'dir:browse', path })
  }

  function handleDirSelect(path: string) {
    setDirBrowser(null)
    handleSwitchWorkspace(path)
  }

  useEffect(() => {
    if (status === 'connected') {
      send({ type: 'config:get' })
      send({ type: 'workspace:list' })
      send({ type: 'session:list' })
    }
  }, [status, send])

  return (
    <div className="flex h-dvh flex-col" style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}>
      <header className="flex items-center justify-between px-4 shrink-0 border-b"
        style={{ borderColor: 'var(--crai-border)', height: 'var(--crai-header-height, 48px)' }}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Crai</span>
          <span className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: status === 'connected' ? 'var(--crai-success)' : 'var(--crai-destructive)' }} />
          <span className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
            {status === 'connected' ? (sessionId ? sessionId.slice(0, 12) : '已连接') : status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            label="会话"
            items={sessions.map((s) => ({
              id: s.id,
              display: s.title ? `${s.title.slice(0, 16)}…` : s.id.slice(0, 12),
              active: s.id === sessionId,
            }))}
            selected={sessionId}
            onSelect={handleSwitchSession}
            onAction={handleNewSession}
            actionLabel="+ 新会话"
          />
          <Dropdown
            label={currentWorkspace ? currentWorkspace.split('/').pop()! : '工作区'}
            items={workspaces.map((w) => ({
              id: w.rootDir,
              display: w.rootDir.split('/').pop() ?? w.rootDir,
              active: w.rootDir === currentWorkspace,
            }))}
            selected={currentWorkspace}
            onSelect={handleSwitchWorkspace}
            onAction={handleAddWorkspace}
            actionLabel="+ 添加工作区"
          />
          <button onClick={() => { send({ type: 'config:get' }); setShowConfig((s) => !s) }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: showConfig ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
              color: showConfig ? '#fff' : 'var(--crai-fg-secondary)',
            }}>配置</button>
          <button onClick={() => setShowInspector((s) => !s)}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: showInspector ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
              color: showInspector ? '#fff' : 'var(--crai-fg-secondary)',
            }}>Inspector</button>
        </div>
      </header>

      <MessageList messages={messages} />
      <ChatInput onSend={handleSend} disabled={status !== 'connected'} />

      {showInspector && <InspectorPanel onClose={() => setShowInspector(false)} />}
      {showConfig && <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} />}
      {dirBrowser && <DirBrowser data={dirBrowser} onNavigate={handleDirNavigate} onSelect={handleDirSelect} onClose={() => setDirBrowser(null)} />}
    </div>
  )
}
