import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { SessionPanel } from './SessionPanel'
import { ConfigPanel } from './ConfigPanel'
import { DirBrowser } from './DirBrowser'
import { useChatStore } from '../store/chat'
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

export function ChatView({ wsUrl }: Props) {
  const messages = useChatStore((s) => s.messages)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number }>>([])
  const [dirBrowser, setDirBrowser] = useState<{ path: string; dirs: string[]; parent?: string; error?: string } | null>(null)
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; provider: string }>>([])
  const [currentModel, setCurrentModel] = useState<string>('')
  const [modelsFetchResult, setModelsFetchResult] = useState<{ providerName: string; models: string[]; error?: string } | null>(null)
  const titledSessions = useRef<Set<string>>(new Set())
  const sessionIdRef = useRef<string | null>(null)
  const [thinkingLevel, setThinkingLevel] = useState<string>('auto')
  const [sessionMode, setSessionMode] = useState<string>('ask')
  const [knownModels, setKnownModels] = useState<Record<string, Record<string, { contextWindow: number; maxOutput?: number }>> | null>(null)
  const [firstPartyProviders, setFirstPartyProviders] = useState<Array<{ name: string; label: string; defaultBaseURL: string }> | null>(null)
  const [providerThinkingLevels, setProviderThinkingLevels] = useState<Record<string, string[]> | null>(null)
  const [defaultThinkingLevels, setDefaultThinkingLevels] = useState<Record<string, string> | null>(null)
  // 确认弹窗
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; question: string; options?: string[]; meta?: Record<string, unknown> } | null>(null)
  // 本会话已自动批准的 tools（不再弹确认）
  const sessionApprovedTools = useRef<Set<string>>(new Set())
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const store = useChatStore

  const { status, send } = useWebSocket({
    url: wsUrl,
    onError: useCallback((err: string) => {
      console.error('[WS error]', err)
      debugLog('timeline', 'WS 错误:', err)
    }, []),
    onMessage: useCallback((raw: string) => {
      let msg: any
      try { msg = JSON.parse(raw) } catch { return }

      switch (msg.type) {
        case 'event': {
          if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
            debugLog('stream', 'model.delta', msg.payload.delta.slice(0, 50))
            debugLog('timeline', '文本 δ:', `${msg.payload.delta.slice(0, 30)}`)
            store.getState().streamText(msg.payload.delta)
          }

          // ── Activity 事件（CrystalAgents 路线，替代 tool.* / thinking.*） ──
          if (msg.event === 'activity.start' && msg.payload?.activity) {
            const a = msg.payload.activity
            debugLog('tools', '活动开始:', a.id, a.type, a.toolName || '')
            store.getState().addActivity({
              id: a.id,
              type: a.type,
              status: 'running',
              toolName: a.toolName,
              toolCallId: a.toolCallId,
              intent: a.intent,
              toolInput: a.toolInput,
            })
          }
          if (msg.event === 'activity.delta' && msg.payload?.delta) {
            const { activityId, delta } = msg.payload
            store.getState().updateActivity(activityId, delta)
          }
          if (msg.event === 'activity.done' && msg.payload?.activity) {
            const a = msg.payload.activity
            debugLog('tools', '活动完成:', a.id, a.status, a.content?.slice(0, 60))
            store.getState().completeActivity(a.id, a.status, a.content, a.error, a.toolInput)
          }

          if (msg.event === 'model.completed') {
            debugLog('timeline', '本轮模型调用完成','')
            store.getState().flushBuffer()
            if (sessionIdRef.current && !titledSessions.current.has(sessionIdRef.current)) {
              titledSessions.current.add(sessionIdRef.current)
              debugLog('title-gen', '发送 session:generate-title', sessionIdRef.current)
              send({ type: 'session:generate-title', sessionId: sessionIdRef.current })
            } else {
              debugLog('title-gen', '跳过生成', { sessionId: sessionIdRef.current, alreadyTitled: titledSessions.current.has(sessionIdRef.current ?? '') })
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
          // 自动批准已记录的工具
          const toolName = (msg.meta?.toolName as string) ?? ''
          if (toolName && sessionApprovedTools.current.has(toolName)) {
            send({ type: 'resolve:input', id: msg.id, value: 'allow' })
          } else {
            setPendingConfirm({ id: msg.id, question: msg.question, options: msg.options, meta: msg.meta })
          }
          break
        }
        case 'config:data':
          setGlobalConfig(msg.config)
          if (msg.config?.debugScopes?.length) {
            localStorage.setItem('crai:debug:scope', msg.config.debugScopes.join(','))
            console.log('[crai:debug] 已激活 scope:', msg.config.debugScopes.join(', '))
            console.log('[crai:debug] 如需手动调试，在控制台执行: localStorage.setItem(\'crai:debug:scope\', \'thinking,stream,timeline,merge\')')
          }
          if (msg.config?.providers) {
            const models: Array<{ name: string; provider: string }> = []
            for (const [provider, cfg] of Object.entries(msg.config.providers) as [string, { models?: string[] }][]) {
              for (const m of cfg.models ?? []) {
                models.push({ name: m, provider })
              }
            }
            setAvailableModels(models)
            if (!currentModel && models.length > 0) {
              setCurrentModel(models[0].name)
            }
          }
          break
        case 'config:models:data':
          setModelsFetchResult({ providerName: msg.providerName, models: msg.models ?? [], error: msg.error })
          break
        case 'workspace:list:data': {
          const list = msg.workspaces?.map((w: any) => ({ rootDir: w.rootDir })) ?? []
          setWorkspaces(list)
          if (msg.current) {
            setCurrentWorkspace(msg.current)
          } else if (list.length > 0 && !currentWorkspace) {
            send({ type: 'workspace:switch', rootDir: list[0].rootDir })
            return
          }
          if (list.length > 0) {
            send({ type: 'session:list' })
          }
          break
        }
        case 'workspace:switched':
          setCurrentWorkspace(msg.rootDir)
          setSessionId(null)
          sessionIdRef.current = null
          store.getState().clearMessages()
          send({ type: 'workspace:list' })
          break
        case 'session:list:data':
          setSessions(msg.sessions ?? [])
          break
        case 'session:data': {
          const incoming = (msg.messages ?? []).map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            text: m.text,
            createdAt: m.createdAt ?? Date.now(),
            activities: m.activities as any[] | undefined,
          }))
          // 从 metadata 恢复思考深度和模式
          if (msg.metadata) {
            if (msg.metadata.thinkingLevel) setThinkingLevel(String(msg.metadata.thinkingLevel))
            if (msg.metadata.mode) setSessionMode(String(msg.metadata.mode))
          }
          debugLog('timeline', `session:data 合并 → ${incoming.length} 条消息`,'')
          store.getState().mergeServerData(incoming)
          break
        }
        case 'error': {
          debugLog('tools', '服务端错误:', msg.message)
          store.getState().appendSystemMessage(`⚠ ${msg.message}`)
          break
        }
        case 'dir:browse:data':
          setDirBrowser({ path: msg.path, dirs: msg.dirs, parent: msg.parent, error: msg.error })
          break
        case 'session:title':
          debugLog('title-gen', '收到标题', { sessionId: msg.sessionId, title: msg.title })
          setSessions((prev) => prev.map((s) => s.id === msg.sessionId ? { ...s, title: msg.title } : s))
          break
        case 'config:known-models:data':
          setKnownModels(msg.knownModels)
          setFirstPartyProviders(msg.firstParty)
          setProviderThinkingLevels(msg.thinkingLevels ?? null)
          setDefaultThinkingLevels(msg.defaultThinkingLevels ?? null)
          break
      }
    }, []),
  })

  const handleSend = useCallback((text: string, model?: string) => {
    const ts = Date.now()
    debugLog('timeline', '用户发送消息', { text, model, thinkingLevel, mode: sessionMode })
    debugLog('timeline', '创建助理消息（空）','')
    store.getState().appendPlaceholders(text, ts, sessionId)
    if (sessionId) {
      // 更新标题（仅第一次）
      if (!sessions.find((s) => s.id === sessionId)?.title) {
        const title = text.length > 30 ? text.slice(0, 30) + '…' : text
        setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s))
        send({ type: 'session:update', sessionId, title })
      }
      // 同步当前思考深度和模式到 session metadata
      const meta: Record<string, any> = {}
      if (thinkingLevel !== 'auto') meta.thinkingLevel = thinkingLevel
      if (sessionMode !== 'ask') meta.mode = sessionMode
      // 只在新会话或值变化时发送 metadata
      // 实际上 session:update 会在前端控件改变时单独发送
    }
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text, model: model || undefined, thinkingLevel, mode: sessionMode })
  }, [sessionId, send, sessions, store, thinkingLevel, sessionMode])

  const handleNewSession = useCallback(() => {
    store.getState().clearMessages()
    setSessionId(null)
    sessionIdRef.current = null
    setThinkingLevel('auto')
    setSessionMode('ask')
    send({ type: 'session:new' })
  }, [send, store])

  const handleDeleteSession = useCallback((sid: string) => {
    send({ type: 'session:delete', sessionId: sid })
    if (sid === sessionId) {
      store.getState().clearMessages()
      setSessionId(null)
      sessionIdRef.current = null
    }
  }, [send, sessionId, store])

  const handleSwitchSession = useCallback((sid: string) => {
    store.getState().clearMessages()
    setSessionId(sid)
    sessionIdRef.current = sid
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
      send({ type: 'config:known-models' })
      send({ type: 'workspace:list' })
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
          <button
            onClick={() => setShowSessionPanel(true)}
            style={{
              background: 'none',
              border: '1px solid var(--crai-border)',
              borderRadius: 6,
              padding: '4px 10px',
              color: 'var(--crai-fg)',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            会话 ({sessions.length})
          </button>
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
      {/* 确认弹窗条 */}
      {pendingConfirm && (() => {
        const meta = pendingConfirm.meta ?? {}
        const toolName = (meta.toolName as string) ?? ''
        const safetyLevel = (meta.safetyLevel as string) ?? ''
        const toolArgs = (meta.args as Record<string, unknown>) ?? {}
        const safetyColor = safetyLevel === 'dangerous' ? 'var(--crai-destructive, #e74c3c)' : safetyLevel === 'restricted' ? 'var(--crai-warning, #f39c12)' : 'var(--crai-fg)'
        // 提取关键参数
        const detailParts: string[] = []
        if (toolArgs.path) detailParts.push(`路径: ${toolArgs.path}`)
        if (toolArgs.command) detailParts.push(`命令: ${(toolArgs.command as string).slice(0, 80)}`)
        if (toolArgs.pattern) detailParts.push(`搜索: ${toolArgs.pattern}`)
        return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            margin: '0 auto',
            maxWidth: 'var(--crai-chat-max-width)',
            width: '100%',
            backgroundColor: 'var(--crai-bg-tertiary)',
            borderTop: '1px solid var(--crai-border)',
            gap: 12,
          }}>
          {/* 左侧：描述 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--crai-fg)', fontWeight: 500, marginBottom: 2 }}>
              {pendingConfirm.question}
            </div>
            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: safetyColor, fontWeight: 600 }}>{toolName}</span>
              {detailParts.length > 0 && (
                <span style={{ color: 'var(--crai-fg-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                  {detailParts.join(' | ')}
                </span>
              )}
            </div>
          </div>
          {/* 右侧：操作按钮 */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={() => {
              send({ type: 'resolve:input', id: pendingConfirm.id, value: 'deny' })
              setPendingConfirm(null)
            }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--crai-border)',
                backgroundColor: 'transparent',
                color: 'var(--crai-fg-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}>拒绝</button>
            <button onClick={() => {
              send({ type: 'resolve:input', id: pendingConfirm.id, value: 'allow' })
              setPendingConfirm(null)
            }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'var(--crai-accent)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}>允许</button>
            <button onClick={() => {
              if (toolName) sessionApprovedTools.current.add(toolName)
              send({ type: 'resolve:input', id: pendingConfirm.id, value: 'allow' })
              setPendingConfirm(null)
            }}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--crai-accent)',
                backgroundColor: 'transparent',
                color: 'var(--crai-accent)',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>始终允许</button>
          </div>
        </div>
        )
      })()}
      <ChatInput
        onSend={handleSend}
        disabled={status !== 'connected'}
        models={availableModels}
        currentModel={currentModel}
        onModelChange={setCurrentModel}
        thinkingLevel={thinkingLevel}
        onThinkingLevelChange={(level) => {
          setThinkingLevel(level)
          if (sessionId) send({ type: 'session:update', sessionId, thinkingLevel: level })
        }}
        sessionMode={sessionMode}
        onModeChange={(mode) => {
          setSessionMode(mode)
          if (sessionId) send({ type: 'session:update', sessionId, mode })
        }}
        providerThinkingLevels={
          (() => {
            if (!providerThinkingLevels) return undefined
            const provider = availableModels.find((m) => m.name === currentModel)?.provider
            if (!provider) return undefined
            const levels = providerThinkingLevels[provider]
            if (!levels) return undefined
            // 转为 { value: label } 格式，label 用硬编码标签（也可抽到服务端）
            const labelMap: Record<string, string> = { off: '关', auto: '自动', low: '低', medium: '中', high: '高', max: '最高', xhigh: '极高' }
            const result: Record<string, string> = {}
            for (const l of levels) {
              result[l] = labelMap[l] ?? l
            }
            return result
          })()
        }
        defaultThinkingLevels={defaultThinkingLevels ?? undefined}
      />

      {showInspector && <InspectorPanel onClose={() => setShowInspector(false)} />}
      {showConfig && <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} modelsFetchResult={modelsFetchResult} onClearModelsResult={() => setModelsFetchResult(null)} knownModels={knownModels ?? undefined} firstParty={firstPartyProviders ?? undefined} />}
      {dirBrowser && <DirBrowser data={dirBrowser} onNavigate={handleDirNavigate} onSelect={handleDirSelect} onClose={() => setDirBrowser(null)} />}
      {showSessionPanel && (
        <SessionPanel
          sessions={sessions}
          currentSessionId={sessionId}
          onSelect={handleSwitchSession}
          onNew={handleNewSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowSessionPanel(false)}
        />
      )}
    </div>
  )
}
