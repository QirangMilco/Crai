import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWsHandler } from '../hooks/useWsHandler'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConfirmBar } from './ConfirmBar'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import { useChatStore } from '../store/chat'
import { debugLog } from '../utils/debug'
import { ShellLayout } from './shell/ShellLayout'
import { registerPanels } from './shell/PanelRegistry'
import { SessionListPanel } from './panels/SessionListPanel'
import { FileTreePanel } from './panels/FileTreePanel'
import { Dropdown, Icon } from './ui'
import { MessageSquare, FolderTree, X, Folder, ArrowUp, Settings, Palette, Plus, Send } from 'lucide-react'

interface Props { wsUrl: string }

export function ChatView({ wsUrl }: Props) {
  const messages = useChatStore((s) => s.messages)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number }>>([])
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; provider: string }>>([])
  const [currentModel, setCurrentModel] = useState<string>('')
  const [modelsFetchResult, setModelsFetchResult] = useState<{ providerName: string; models: string[]; error?: string } | null>(null)
  const [configTestResult, setConfigTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [thinkingLevel, setThinkingLevel] = useState<string>('auto')
  const [sessionMode, setSessionMode] = useState<string>('ask')
  const [knownModels, setKnownModels] = useState<Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number }>> | null>(null)
  const [firstPartyProviders, setFirstPartyProviders] = useState<Array<{ name: string; label: string; defaultBaseURL: string }> | null>(null)
  const [providerThinkingLevels, setProviderThinkingLevels] = useState<Record<string, string[]> | null>(null)
  const [defaultThinkingLevels, setDefaultThinkingLevels] = useState<Record<string, string> | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; question: string; options?: string[]; meta?: Record<string, unknown> } | null>(null)

  const store = useChatStore

  // 用 ref 桥接 onMessage，避免 TDZ
  const onMessageRef = useRef<((raw: string) => void) | undefined>(undefined)

  // FileTreePanel 使用的 browse result ref
  const browseResultRef = useRef<((data: any) => void) | null>(null)

  // 工作区选择目录浏览状态
  const [workspaceBrowser, setWorkspaceBrowser] = useState<{
    path: string
    dirs: string[]
    parent?: string
    error?: string
  } | null>(null)
  const workspaceBrowseRef = useRef<((data: any) => void) | null>(null)

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
    onConfigTest: (ok, error) => setConfigTestResult({ ok, error }),
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
    onDirBrowse: (data) => {
      // 转发给 FileTreePanel
      browseResultRef.current?.(data)
      // 转发给工作区选择浏览器
      workspaceBrowseRef.current?.(data)
    },
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
    // 打开工作区选择目录浏览器
    setWorkspaceBrowser({ path: '', dirs: [], parent: undefined })
    send({ type: 'dir:browse' })
  }, [send])

  // 工作区浏览器的回调注册：接收 dir:browse:data 更新 modal
  const handleWorkspaceBrowseData = useCallback((data: any) => {
    if (!data) return
    setWorkspaceBrowser((prev) => {
      if (!prev) return prev
      return { path: data.path, dirs: data.dirs, parent: data.parent, error: data.error }
    })
  }, [])

  // 接通 dir:browse 响应到工作区选择器
  workspaceBrowseRef.current = workspaceBrowser ? handleWorkspaceBrowseData : null

  // ── 注册面板（放在 handler 定义之后，避免 deps 中引用未初始化的 const） ──
  useEffect(() => {
    registerPanels([
      {
        id: 'sessions',
        label: '会话列表',
        icon: <Icon icon={MessageSquare} size="sm" />,
        defaultSide: 'left',
        defaultVisible: true,
        render: () => (
          <SessionListPanel
            sessions={sessions}
            currentSessionId={sessionId}
            onSelect={handleSwitchSession}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
            width={260}
            hovered={true}
          />
        ),
      },
      {
        id: 'files',
        label: '文件树',
        icon: <Icon icon={FolderTree} size="sm" />,
        defaultSide: 'right',
        defaultVisible: true,
        render: () => (
          <FileTreePanel
            send={send}
            workspaceRoot={currentWorkspace}
            onBrowseResultRef={browseResultRef}
            width={260}
            hovered={true}
          />
        ),
      },
    ])
  }, [sessions, sessionId, currentWorkspace, send, handleNewSession, handleDeleteSession, handleSwitchSession])

  useEffect(() => {
    if (status === 'connected') {
      send({ type: 'config:get' })
      send({ type: 'config:known-models' })
      send({ type: 'workspace:list' })
    }
  }, [status, send])

  // 按 / 聚焦输入框
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        // 查找 ChatInput 中的 textarea
        const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]')
        ta?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const resolveConfirm = useCallback((id: string, value: string, alwaysAllow?: boolean) => {
    send({ type: 'resolve:input', id, value })
    setPendingConfirm(null)
  }, [send])

  const currentSessionTitle = sessionId ? sessions.find((s) => s.id === sessionId)?.title : undefined

  return (
    <div className="flex h-dvh flex-col" style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}>
      <header className="flex items-center justify-between px-5 shrink-0 border-b"
        style={{
          borderColor: 'var(--crai-border)',
          height: 'var(--crai-header-height, 48px)',
        }}
      >
        {/* 左：工作区 badge（可交互，点击展开下拉） + 对话标题 */}
        <div className="flex items-center gap-3 min-w-0">
          <Dropdown label={currentWorkspace ? currentWorkspace.split('/').pop()! : '无工作区'}
            items={workspaces.map((w) => ({ id: w.rootDir, display: w.rootDir.split('/').pop() ?? w.rootDir, active: w.rootDir === currentWorkspace }))}
            selected={currentWorkspace}
            onSelect={handleSwitchWorkspace}
            onAction={handleAddWorkspace}
            actionLabel="+ 添加工作区"
            onDelete={(id) => send({ type: 'workspace:delete', rootDir: id })}
            align="left"
          />
          {sessionId && (
            <>
              <span className="text-sm shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }}>/</span>
              <span className="text-sm font-medium truncate" style={{ color: 'var(--crai-fg)' }}>
                {currentSessionTitle || '新对话'}
              </span>
            </>
          )}
        </div>

        {/* 右：状态 + 设置 */}
        <div className="flex items-center gap-2">
          <button onClick={() => { send({ type: 'config:get' }); setShowConfig((s) => !s) }}
            className="px-2 py-1 rounded text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1"
            style={{ backgroundColor: showConfig ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)', color: showConfig ? '#fff' : 'var(--crai-fg-secondary)' }}>
            <Icon icon={Settings} size="xs" /></button>
          <button onClick={() => setShowInspector((s) => !s)}
            className="px-2 py-1 rounded text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1"
            style={{ backgroundColor: showInspector ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)', color: showInspector ? '#fff' : 'var(--crai-fg-secondary)' }}>
            <Icon icon={Palette} size="xs" /></button>
          <span className="flex items-center gap-1.5 text-[11px] shrink-0 pl-1 border-l"
            style={{ color: 'var(--crai-fg-tertiary)', borderColor: 'var(--crai-border)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: status === 'connected' ? 'var(--crai-success)' : 'var(--crai-destructive)',
              }}
            />
            {status === 'connected' ? '已连接' : '断开'}
          </span>
        </div>
      </header>

      <ShellLayout send={send}>
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
          sessionId={sessionId}
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
      </ShellLayout>

      {/* 工作区选择目录浏览器 */}
      {workspaceBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setWorkspaceBrowser(null)}>
          <div className="w-[420px] flex flex-col overflow-hidden rounded-xl"
            style={{
              backgroundColor: 'var(--crai-bg)',
              border: '1px solid var(--crai-border)',
              boxShadow: 'var(--crai-shadow-elevated)',
              maxHeight: 400,
            }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--crai-border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--crai-fg)' }}>选择工作区目录</span>
              <button onClick={() => setWorkspaceBrowser(null)}
                className="p-0.5 opacity-50 hover:opacity-100 transition-opacity duration-150"
                style={{ color: 'var(--crai-fg)' }}>
                <Icon icon={X} size="md" />
              </button>
            </div>
            <div className="px-4 py-2 text-[10px] font-mono truncate shrink-0" style={{ color: 'var(--crai-fg-tertiary)' }}>
              {workspaceBrowser.path || '目录'}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 200 }}>
              {workspaceBrowser.error ? (
                <div className="text-xs text-center py-8" style={{ color: 'var(--crai-destructive)' }}>
                  {workspaceBrowser.error}
                </div>
              ) : workspaceBrowser.dirs.length === 0 ? (
                <div className="text-xs text-center py-8" style={{ color: 'var(--crai-fg-tertiary)' }}>
                  {workspaceBrowser.path === '' ? '加载中…' : '此目录下没有子目录'}
                </div>
              ) : (
                <>
                  {workspaceBrowser.parent && (
                    <button
                      onClick={() => send({ type: 'dir:browse', path: workspaceBrowser.parent })}
                      className="w-full text-left flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)]"
                      style={{ color: 'var(--crai-fg-secondary)' }}>
                      <Icon icon={ArrowUp} size="xs" /> ../
                    </button>
                  )}
                  {/* 子目录列表 */}
                  {workspaceBrowser.dirs.map((d) => (
                    <button key={d}
                      onClick={() => {
                        const p = workspaceBrowser.path === '' ? d : workspaceBrowser.path + '/' + d
                        send({ type: 'dir:browse', path: p })
                      }}
                      className="w-full text-left flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-tertiary)]"
                      style={{ color: 'var(--crai-fg)' }}>
                      <Icon icon={Folder} size="sm" style={{ color: 'var(--crai-accent)' }} />
                      {d}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="flex gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--crai-border)' }}>
              <div className="flex-1" />
              {workspaceBrowser.path && !workspaceBrowser.error && (
                <button
                  onClick={() => {
                    setSessions([])
                    store.getState().clearMessages()
                    setSessionId(null)
                    send({ type: 'workspace:switch', rootDir: workspaceBrowser.path })
                    setWorkspaceBrowser(null)
                  }}
                  className="px-4 py-1.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--crai-accent)' }}>
                  选择此目录
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showInspector && <InspectorPanel onClose={() => setShowInspector(false)} />}
      {/* 配置弹窗 */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={() => setShowConfig(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col overflow-hidden rounded-xl"
            style={{
              width: 660,
              height: '75vh',
              backgroundColor: 'var(--crai-bg)',
              border: '1px solid var(--crai-border)',
              boxShadow: 'var(--crai-shadow-modal)',
            }}
          >
            <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} modelsFetchResult={modelsFetchResult} onClearModelsResult={() => setModelsFetchResult(null)} configTestResult={configTestResult} onClearTestResult={() => setConfigTestResult(null)} knownModels={knownModels ?? undefined} firstParty={firstPartyProviders ?? undefined} />
          </div>
        </div>
      )}
    </div>
  )
}
