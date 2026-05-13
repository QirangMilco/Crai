import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
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

export function ChatView({ wsUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number }>>([])

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback((raw: string) => {
      let msg: any
      try { msg = JSON.parse(raw) } catch { return }

      switch (msg.type) {
        case 'event': {
          if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 && m.role === 'assistant' ? { ...m, text: m.text + msg.payload.delta } : m,
            ))
          }
          if (msg.event === 'model.completed' && msg.payload?.response?.message?.parts) {
            const textParts = msg.payload.response.message.parts
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('')
            if (textParts) {
              setMessages((prev) => prev.map((m, i) =>
                i === prev.length - 1 && m.role === 'assistant' ? { ...m, text: textParts } : m,
              ))
            }
          }
          break
        }
        case 'session:id':
          setSessionId(msg.id)
          send({ type: 'session:load', sessionId: msg.id })
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
          setMessages([])
          send({ type: 'workspace:list' })
          break
        case 'session:list:data':
          setSessions(msg.sessions ?? [])
          break
        case 'session:data': {
          const chatMsgs = (msg.messages ?? []).map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            text: m.text,
            createdAt: m.createdAt ?? Date.now(),
          }))
          setMessages(chatMsgs)
          break
        }
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
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text })
  }, [sessionId, send])

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
    const dir = prompt('输入目标目录的绝对路径：')
    if (dir && dir.trim()) handleSwitchWorkspace(dir.trim())
  }, [handleSwitchWorkspace])

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
    </div>
  )
}
