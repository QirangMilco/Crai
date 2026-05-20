import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWsHandler } from '../hooks/useWsHandler'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConfirmBar } from './ConfirmBar'
import { InspectorPanel } from './InspectorPanel'
import { SessionPanel } from './SessionPanel'
import { ConfigPanel } from './ConfigPanel'
import { DirBrowser } from './DirBrowser'
import { useChatStore } from '../store/chat'
import { debugLog } from '../utils/debug'

interface Props { wsUrl: string }

function Dropdown<T extends string>({ label, items, selected, onSelect, onAction, actionLabel }: {
  label: string; items: { id: T; display: string; active: boolean }[]; selected: T | null
  onSelect: (id: T) => void; onAction?: () => void; actionLabel?: string
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
        {label} <span className="text-[10px]">▼</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[160px] rounded-lg z-50 py-1"
          style={{ backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)' }}>
          {items.map((item) => (
            <button key={item.id} onClick={() => { onSelect(item.id); setOpen(false) }}
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
                className="w-full text-left px-3 py-1.5 text-xs" style={{ color: 'var(--crai-accent)' }}>
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
  const messages = useChatStore((s) => s.messages)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number }>>([])
  const [dirBrowser, setDirBrowser] = useState<{ path: string; dirs: string[]; parent?: string; error?: string } | null>(null)
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; provider: string }>>([])
  const [currentModel, setCurrentModel] = useState<string>('')
  const [modelsFetchResult, setModelsFetchResult] = useState<{ providerName: string; models: string[]; error?: string } | null>(null)
  const [thinkingLevel, setThinkingLevel] = useState<string>('auto')
  const [sessionMode, setSessionMode] = useState<string>('ask')
  const [knownModels, setKnownModels] = useState<Record<string, Record<string, { contextWindow: number; maxOutput?: number }>> | null>(null)
  const [firstPartyProviders, setFirstPartyProviders] = useState<Array<{ name: string; label: string; defaultBaseURL: string }> | null>(null)
  const [providerThinkingLevels, setProviderThinkingLevels] = useState<Record<string, string[]> | null>(null)
  const [defaultThinkingLevels, setDefaultThinkingLevels] = useState<Record<string, string> | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; question: string; options?: string[]; meta?: Record<string, unknown> } | null>(null)

  const store = useChatStore

  // 用 ref 桥接 onMessage，避免 TDZ（onMessage 在 useWebSocket 返回后才创建）
  const onMessageRef = useRef<((raw: string) => void) | undefined>(undefined)

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: useCallback((raw: string) => onMessageRef.current?.(raw), []),
    onError: useCallback((err: string) => {
      console.error('[WS error]', err)
      debugLog('timeline', 'WS 错误:', err)
    }, []),
  })

  // 构建 onMessage handler（此时 send 已可用）
  const wsHandler = useWsHandler({
    send,
    setCurrentModel: (m) => setCurrentModel((prev) => prev || m),
      onSessionId: (id) => setSessionId(id),
      onSessionList: (list) => setSessions(list),
      onSessionTitle: (id, title) => setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s)),
      onConfigData: (config) => {
        setGlobalConfig(config)
        if (config?.debugScopes?.length) {
          localStorage.setItem('crai:debug:scope', config.debugScopes.join(','))
          console.log('[crai:debug] 已激活 scope:', config.debugScopes.join(', '))
        }
        if (config?.providers) {
          const models: Array<{ name: string; provider: string }> = []
          for (const [provider, cfg] of Object.entries(config.providers) as [string, { models?: string[] }][]) {
            for (const m of cfg.models ?? []) models.push({ name: m, provider })
          }
          setAvailableModels(models)
        }
      },
      onConfigModels: (providerName, models, error) => setModelsFetchResult({ providerName, models, error }),
      onWorkspaceList: (current, list) => {
        setWorkspaces(list)
        if (current) setCurrentWorkspace(current)
      },
      onWorkspaceSwitched: (rootDir) => {
        setCurrentWorkspace(rootDir)
        setSessionId(null)
        store.getState().clearMessages()
      },
      onThinkingLevel: (level) => setThinkingLevel(level),
      onSessionMode: (mode) => setSessionMode(mode),
      onKnownModels: (known, firstParty, levels, defaults) => {
        setKnownModels(known)
        setFirstPartyProviders(firstParty)
        setProviderThinkingLevels(levels ?? null)
        setDefaultThinkingLevels(defaults ?? null)
      },
      onRequestInput: (id, question, options, meta) => setPendingConfirm({ id, question, options, meta }),
      onDirBrowse: (data) => setDirBrowser(data),
    }).handler
  onMessageRef.current = wsHandler

  const handleSend = useCallback((text: string, model?: string) => {
    store.getState().appendPlaceholders(text, Date.now(), sessionId ?? undefined)
    if (sessionId && !sessions.find((s) => s.id === sessionId)?.title) {
      const title = text.length > 30 ? text.slice(0, 30) + '…' : text
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s))
      send({ type: 'session:update', sessionId, title })
    }
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text, model: model || undefined, thinkingLevel, mode: sessionMode })
  }, [sessionId, send, sessions, store, thinkingLevel, sessionMode])

  const handleNewSession = useCallback(() => {
    store.getState().clearMessages()
    setSessionId(null)
    setThinkingLevel('auto')
    setSessionMode('ask')
    send({ type: 'session:new' })
  }, [send, store])

  const handleDeleteSession = useCallback((sid: string) => {
    send({ type: 'session:delete', sessionId: sid })
    if (sid === sessionId) { store.getState().clearMessages(); setSessionId(null) }
  }, [send, sessionId, store])

  const handleSwitchSession = useCallback((sid: string) => {
    store.getState().clearMessages()
    setSessionId(sid)
    send({ type: 'session:load', sessionId: sid })
  }, [send, store])

  const handleSwitchWorkspace = useCallback((rootDir: string) => {
    send({ type: 'workspace:switch', rootDir })
    setSessions([])
    store.getState().clearMessages()
    setSessionId(null)
  }, [send, store])

  const handleAddWorkspace = useCallback(() => {
    setDirBrowser({ path: '', dirs: [], parent: undefined })
    send({ type: 'dir:browse' })
  }, [send])

  useEffect(() => {
    if (status === 'connected') {
      send({ type: 'config:get' })
      send({ type: 'config:known-models' })
      send({ type: 'workspace:list' })
    }
  }, [status, send])

  const resolveConfirm = useCallback((id: string, value: string, alwaysAllow?: boolean) => {
    send({ type: 'resolve:input', id, value })
    setPendingConfirm(null)
  }, [send])

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
          <button onClick={() => setShowSessionPanel(true)}
            style={{ background: 'none', border: '1px solid var(--crai-border)', borderRadius: 6, padding: '4px 10px', color: 'var(--crai-fg)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            会话 ({sessions.length})
          </button>
          <Dropdown label={currentWorkspace ? currentWorkspace.split('/').pop()! : '工作区'}
            items={workspaces.map((w) => ({ id: w.rootDir, display: w.rootDir.split('/').pop() ?? w.rootDir, active: w.rootDir === currentWorkspace }))}
            selected={currentWorkspace} onSelect={handleSwitchWorkspace} onAction={handleAddWorkspace} actionLabel="+ 添加工作区" />
          <button onClick={() => { send({ type: 'config:get' }); setShowConfig((s) => !s) }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: showConfig ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)', color: showConfig ? '#fff' : 'var(--crai-fg-secondary)' }}>
            配置</button>
          <button onClick={() => setShowInspector((s) => !s)}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: showInspector ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)', color: showInspector ? '#fff' : 'var(--crai-fg-secondary)' }}>
            Inspector</button>
        </div>
      </header>

      <MessageList messages={messages} />
      {pendingConfirm && (
        <ConfirmBar
          id={pendingConfirm.id}
          question={pendingConfirm.question}
          options={pendingConfirm.options}
          meta={pendingConfirm.meta}
          onResolve={resolveConfirm}
        />
      )}
      <ChatInput
        onSend={handleSend}
        disabled={status !== 'connected'}
        models={availableModels}
        currentModel={currentModel}
        onModelChange={setCurrentModel}
        thinkingLevel={thinkingLevel}
        onThinkingLevelChange={(level) => { setThinkingLevel(level); if (sessionId) send({ type: 'session:update', sessionId, thinkingLevel: level }) }}
        sessionMode={sessionMode}
        onModeChange={(mode) => { setSessionMode(mode); if (sessionId) send({ type: 'session:update', sessionId, mode }) }}
        providerThinkingLevels={(() => {
          if (!providerThinkingLevels) return undefined
          const provider = availableModels.find((m) => m.name === currentModel)?.provider
          if (!provider) return undefined
          const levels = providerThinkingLevels[provider]
          if (!levels) return undefined
          const labelMap: Record<string, string> = { off: '关', auto: '自动', low: '低', medium: '中', high: '高', max: '最高', xhigh: '极高' }
          const result: Record<string, string> = {}
          for (const l of levels) result[l] = labelMap[l] ?? l
          return result
        })()}
        defaultThinkingLevels={defaultThinkingLevels ?? undefined}
      />

      {showInspector && <InspectorPanel onClose={() => setShowInspector(false)} />}
      {showConfig && <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} modelsFetchResult={modelsFetchResult} onClearModelsResult={() => setModelsFetchResult(null)} knownModels={knownModels ?? undefined} firstParty={firstPartyProviders ?? undefined} />}
      {dirBrowser && <DirBrowser data={dirBrowser} onNavigate={(p) => send({ type: 'dir:browse', path: p })} onSelect={(p) => { setDirBrowser(null); handleSwitchWorkspace(p) }} onClose={() => setDirBrowser(null)} />}
      {showSessionPanel && <SessionPanel sessions={sessions} currentSessionId={sessionId} onSelect={handleSwitchSession} onNew={handleNewSession} onDelete={handleDeleteSession} onClose={() => setShowSessionPanel(false)} />}
    </div>
  )
}
