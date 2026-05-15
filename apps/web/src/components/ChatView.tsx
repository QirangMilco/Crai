import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import { DirBrowser } from './DirBrowser'
import type { ChatMessage } from '../types/messages'

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

/** 更新最后一条 assistant 消息的 blocks 数组。 */
function updateLastAssistantBlocks(
  prev: ChatMessage[],
  updater: (blocks: any[]) => any[],
): ChatMessage[] {
  const idx = prev.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
  if (idx === undefined) return prev
  const copy = [...prev]
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  copy[idx] = { ...copy[idx], blocks: updater(blocks) }
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
  const debounceRef = useRef<{ text: string; timer: any } | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback((raw: string) => {
      let msg: any
      try { msg = JSON.parse(raw) } catch { return }

      switch (msg.type) {
        case 'event': {
          if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
            if (!debounceRef.current) debounceRef.current = { text: '', timer: null }
            const d = debounceRef.current
            d.text += msg.payload.delta
            if (!d.timer) {
              d.timer = setTimeout(() => {
                const batch = d.text
                d.text = ''
                d.timer = null
                setMessages((prev) => {
                  const idx = prev.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
                  if (idx === undefined) return prev
                  const copy = [...prev]
                  copy[idx] = { ...copy[idx], text: copy[idx].text + batch }
                  return copy
                })
              }, 50)
            }
          }

          // ── 思考过程与工具调用流式事件 ──
          if (msg.event === 'thinking.delta' && typeof msg.payload?.delta === 'string') {
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              const existing = blocks.filter((b) => b.type === 'thinking').pop() as any
              if (existing) {
                existing.content += msg.payload.delta
              } else {
                blocks.push({ type: 'thinking', content: msg.payload.delta, sealed: false })
              }
              return blocks
            }))
          }
          if (msg.event === 'thinking.done') {
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              for (const b of blocks) {
                if (b.type === 'thinking') b.sealed = true
              }
              return blocks
            }))
          }
          if (msg.event === 'tool.start' && msg.payload?.name) {
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              blocks.push({ type: 'tool', toolCallId: msg.payload.toolCallId, name: msg.payload.name, args: '', status: 'running' })
              return blocks
            }))
          }
          if (msg.event === 'tool.delta' && msg.payload?.delta) {
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              for (const b of blocks) {
                if (b.type === 'tool' && b.toolCallId === msg.payload.toolCallId) {
                  b.args += msg.payload.delta
                }
              }
              return blocks
            }))
          }
          if (msg.event === 'tool.done') {
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              for (const b of blocks) {
                if (b.type === 'tool' && b.toolCallId === msg.payload.toolCallId) {
                  b.status = msg.payload.isError ? 'error' : 'success'
                }
              }
              return blocks
            }))
          }

          if (msg.event === 'model.completed' && msg.payload?.response?.message?.parts) {
            // 立即刷新防抖缓冲区
            if (debounceRef.current?.timer) {
              clearTimeout(debounceRef.current.timer)
              debounceRef.current.timer = null
            }
            const pending = debounceRef.current?.text ?? ''
            debounceRef.current = null
            const textParts = pending + msg.payload.response.message.parts
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('')
            if (textParts) {
              setMessages((prev) => {
                // 找到最后一个 assistant 消息更新
                const idx = prev.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
                if (idx === undefined) return prev
                const copy = [...prev]
                copy[idx] = { ...copy[idx], text: copy[idx].text + textParts }
                return copy
              })
              // 首次 AI 响应完成后，请求服务端生成标题
              if (sessionIdRef.current && !titledSessions.current.has(sessionIdRef.current)) {
                titledSessions.current.add(sessionIdRef.current)
                send({ type: 'session:generate-title', sessionId: sessionIdRef.current })
              }
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
            const incomingIds = new Set((msg.messages ?? []).map((m: any) => m.id))
            // 保留本地已有但服务端没有的消息（如正在流式中的 assistant 消息）
            const kept = prev.filter((m) => !incomingIds.has(m.id))
            const incoming = (msg.messages ?? []).map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              text: m.text,
              createdAt: m.createdAt ?? Date.now(),
            }))
            // 用服务端数据覆盖同 id 消息，保留本地独有的
            const merged = [...incoming]
            for (const local of kept) {
              const existing = merged.findIndex((m) => m.id === local.id)
              if (existing >= 0) {
                merged[existing] = { ...merged[existing], text: merged[existing].text || local.text }
              } else {
                merged.push(local)
              }
            }
            // 按 createdAt 排序
            merged.sort((a, b) => a.createdAt - b.createdAt)
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
