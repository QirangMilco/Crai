import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import { DirBrowser } from './DirBrowser'
import type { ChatMessage } from '../types/messages'

/** 前端调试日志，仅在 localStorage 中设置了对应 scope 时输出到 stderr。
 * 用法：浏览器控制台运行 localStorage.setItem('crai:debug:scope', 'thinking,stream')
 * scope 列表：thinking, stream, merge
 */
function debugLog(scope: string, ...args: unknown[]) {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('crai:debug:scope') || '' : ''
  const scopes = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (scopes.includes('ALL') || scopes.includes(scope)) {
    console.error(`[crai:${scope}]`, ...args)
  }
}

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
  const idx = findLastAssistantIndex(prev)
  if (idx === undefined) return prev
  const copy = [...prev]
  const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
  copy[idx] = { ...copy[idx], blocks: updater(blocks) }
  return copy
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
            debugLog('stream', 'model.delta', msg.payload.delta.slice(0, 50))
            if (!debounceRef.current) debounceRef.current = { text: '', timer: null }
            const d = debounceRef.current
            d.text += msg.payload.delta
            if (!d.timer) {
              d.timer = setTimeout(() => {
                const batch = d.text
                d.text = ''
                d.timer = null
                setMessages((prev) => {
                  const { copy, idx } = findCreateAssistant(prev)
                  copy[idx] = { ...copy[idx], text: copy[idx].text + batch }
                  return copy
                })
              }, 50)
            }
          }

          // ── 思考过程与工具调用流式事件 ──
          if (msg.event === 'thinking.delta' && typeof msg.payload?.delta === 'string') {
            debugLog('thinking', 'thinking.delta arrived', msg.payload.delta.slice(0, 60))
            setMessages((prev) => {
              const { copy, idx } = findCreateAssistant(prev)
              const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
              const existing = blocks.filter((b: any) => b.type === 'thinking').pop() as any
              if (existing) {
                existing.content += msg.payload.delta
              } else {
                debugLog('thinking', 'creating thinking block on message', copy[idx].id)
                blocks.push({ type: 'thinking', content: msg.payload.delta, sealed: false })
              }
              copy[idx] = { ...copy[idx], blocks }
              return copy
            })
          }
          if (msg.event === 'thinking.done') {
            debugLog('thinking', 'thinking.done')
            setMessages((prev) => updateLastAssistantBlocks(prev, (blocks) => {
              for (const b of blocks) {
                if (b.type === 'thinking') b.sealed = true
              }
              return blocks
            }))
          }
          if (msg.event === 'tool.start' && msg.payload?.name) {
            setMessages((prev) => {
              const { copy, idx } = findCreateAssistant(prev)
              const blocks = copy[idx].blocks ? [...copy[idx].blocks!] : []
              blocks.push({ type: 'tool', toolCallId: msg.payload.toolCallId, name: msg.payload.name, args: '', status: 'running' })
              copy[idx] = { ...copy[idx], blocks }
              return copy
            })
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
            // 立即刷新防抖缓冲区（不再追加 payload 中的完整回复，避免重复）
            if (debounceRef.current?.timer) {
              clearTimeout(debounceRef.current.timer)
              debounceRef.current.timer = null
            }
            const pending = debounceRef.current?.text ?? ''
            debounceRef.current = null
            if (pending) {
              setMessages((prev) => {
                const { copy, idx } = findCreateAssistant(prev)
                copy[idx] = { ...copy[idx], text: copy[idx].text + pending }
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
                merged[existing] = { ...merged[existing], text: merged[existing].text || local.text }
              } else {
                merged.push(local)
              }
            }
            // 按 createdAt 排序
            merged.sort((a, b) => a.createdAt - b.createdAt)
            // 恢复被丢弃的本地 blocks 到对应的服务端消息
            for (const dropped of droppedWithBlocks) {
              const targetIdx = merged.map((m, i) => ({ m, i }))
                .filter(x => x.m.role === dropped.role && !x.m.blocks)
                .pop()?.i
              if (targetIdx !== undefined) {
                merged[targetIdx] = { ...merged[targetIdx], blocks: dropped.blocks }
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
