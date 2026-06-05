import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useWsHandler } from '../hooks/useWsHandler'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConfirmBar } from './ConfirmBar'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import { useChatStore } from '../store/chat'
import { debugLog, DEBUG_SCOPES } from '../utils/debug'
import { ShellLayout } from './shell/ShellLayout'
import { registerPanels } from './shell/PanelRegistry'
import { SessionListPanel } from './panels/SessionListPanel'
import { FileTreePanel } from './panels/FileTreePanel'
import { SessionNavPanel } from './panels/SessionNavPanel'
import { InfoIsland } from './shell/InfoIsland'
import { Dialog } from './ui/Dialog'
import { Dropdown, Icon } from './ui'
import { MessageSquare, FolderTree, X, Folder, ArrowUp, Settings, Palette, Plus, Send, List, Trash2, Eye, EyeOff } from 'lucide-react'

interface ConnectionProfile {
  id: string
  label: string
  url: string
  token: string
  lastConnected: number
}

interface Props { wsUrl: string; onDisconnect?: (url?: string) => void }

function buildWsUrlForSwitch(url: string, token: string): string {
  try {
    const u = new URL(url.startsWith('ws') ? url : `ws://${url}`)
    if (token) u.searchParams.set('token', token)
    return u.toString()
  } catch { return url }
}

export function ChatView({ wsUrl, onDisconnect }: Props) {
  const messages = useChatStore((s) => s.messages)
  const processing = useChatStore((s) => s.processing)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingNewSession, setPendingNewSession] = useState(false)
  const [showConnections, setShowConnections] = useState(false)
  const [connProfiles, setConnProfiles] = useState<ConnectionProfile[]>(() => {
    try {
      const raw = localStorage.getItem('crai:connections')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [connFormMode, setConnFormMode] = useState(false)
  const [connFormUrl, setConnFormUrl] = useState('')
  const [connFormLabel, setConnFormLabel] = useState('')
  const [connFormToken, setConnFormToken] = useState('')
  const [connShowToken, setConnShowToken] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<Array<{ rootDir: string }>>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; title?: string; createdAt: number; pinned?: boolean; archived?: boolean }>>([])
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; provider: string }>>([])
  const [currentModel, setCurrentModel] = useState<string>('')
  const [modelsFetchResult, setModelsFetchResult] = useState<{ providerName: string; models: string[]; error?: string } | null>(null)
  const [configTestResult, setConfigTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [thinkingLevel, setThinkingLevel] = useState<string>('auto')
  const [sessionMode, setSessionMode] = useState<string>('ask')
  const [knownModels, setKnownModels] = useState<Record<string, Record<string, { displayName?: string; contextWindow: number; maxOutput?: number; supportedThinkingLevels?: string[]; inputPrice?: number; cachedInputPrice?: number; outputPrice?: number }>> | null>(null)
  const [lastUsage, setLastUsage] = useState<{ inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; cost?: number } | null>(null)
  const [contextTokenCount, setContextTokenCount] = useState<number | null>(null)
  const [compressionStatus, setCompressionStatus] = useState<{ step: string; tokensBefore?: number; tokensAfter?: number } | null>(null)
  const [rollbackPoints, setRollbackPoints] = useState<Map<number, { turnId: string; fileCount: number }>>(new Map())
  const [showRollbackModal, setShowRollbackModal] = useState<{ messageIndex: number; fileCount: number } | null>(null)
  const [rollbackMode, setRollbackMode] = useState<'both' | 'files' | 'conversation'>('both')
  // 累计用量：跨所有 turn 的汇总（每次切换 session 时重置）
  const [accInputTokens, setAccInputTokens] = useState(0)
  const [accOutputTokens, setAccOutputTokens] = useState(0)
  const [accCachedInputTokens, setAccCachedInputTokens] = useState(0)
  const [firstPartyProviders, setFirstPartyProviders] = useState<Array<{ name: string; label: string; defaultBaseURL: string }> | null>(null)
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
    onSessionList: (list) => {
      setSessions(list)
      // 自动选中最近的活动会话
      if (list.length > 0 && !sessionId) {
        const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
        handleSwitchSession(sorted[0].id)
      }
    },
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
      else if (list.length > 0) send({ type: 'workspace:switch', rootDir: list[0].rootDir })
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
    },
    onRequestInput: (id, question, options, meta) => setPendingConfirm({ id, question, options, meta }),
    onDirBrowse: (data) => {
      // 转发给 FileTreePanel
      browseResultRef.current?.(data)
      // 转发给工作区选择浏览器
      workspaceBrowseRef.current?.(data)
    },
    onUsage: (usage) => {
      debugLog(DEBUG_SCOPES.USAGE, 'onUsage', usage)
      setLastUsage(usage)
    },
    onUsageAccumulated: (acc) => {
      debugLog(DEBUG_SCOPES.USAGE, 'onUsageAccumulated', acc)
      // 取最大值而非覆盖——因为 onUsage 可能在之后加上本轮用量
      setAccInputTokens((prev) => Math.max(prev, acc.inputTokens))
      setAccOutputTokens((prev) => Math.max(prev, acc.outputTokens))
      setAccCachedInputTokens((prev) => Math.max(prev, acc.cachedInputTokens))
    },
    onContextTokenCount: (tokens) => {
      debugLog(DEBUG_SCOPES.USAGE, 'onContextTokenCount', tokens)
      setContextTokenCount(tokens)
    },
    onCompressionStatus: (status) => {
      debugLog(DEBUG_SCOPES.USAGE, 'onCompressionStatus', status)
      if (status.step === 'checking' || status.step === 'summarizing' || status.step === 'retrying') {
        setCompressionStatus(status)
      } else if (status.step === 'done' || status.step === 'truncating') {
        setCompressionStatus(null)
      }
    },
  }).handler
  onMessageRef.current = wsHandler

  const handleSend = useCallback((text: string, modelArg?: string) => {
    store.getState().appendPlaceholders(text, Date.now(), sessionId ?? undefined)
    if (sessionId && !sessions.find((s) => s.id === sessionId)?.title) {
      const title = text.length > 30 ? text.slice(0, 30) + '…' : text
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title } : s))
      send({ type: 'session:update', sessionId, title })
    }
    // 解析 provider/model 格式
    const slashIdx = modelArg?.indexOf('/')
    const provider = slashIdx && slashIdx! > 0 ? modelArg!.slice(0, slashIdx) : undefined
    const model = slashIdx && slashIdx! > 0 ? modelArg!.slice(slashIdx! + 1) : (modelArg || undefined)
    const needsNew = pendingNewSession
    if (needsNew) setPendingNewSession(false)
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text, model, provider, thinkingLevel, mode: sessionMode, forceNewSession: needsNew || undefined })
  }, [sessionId, send, sessions, store, thinkingLevel, sessionMode, pendingNewSession])

  const handleNewSession = useCallback(() => {
    store.getState().clearMessages()
    setSessionId(null)
    setLastUsage(null)
    setContextTokenCount(null)
    setCompressionStatus(null)
    setAccInputTokens(0)
    setAccOutputTokens(0)
    setAccCachedInputTokens(0)
    // 从模型的 supportedThinkingLevels 推导默认思考深度（第一个非 off 的值）
    const modelName = currentModel?.includes('/') ? currentModel.split('/')[1] : currentModel
    let defaultLevel = 'auto'
    if (knownModels && modelName) {
      for (const models of Object.values(knownModels)) {
        const info = models[modelName]
        if (info?.supportedThinkingLevels) {
          const nonOff = info.supportedThinkingLevels.filter(l => l !== 'off')
          defaultLevel = nonOff[0] ?? info.supportedThinkingLevels[0]
          break
        }
      }
    }
    setThinkingLevel(defaultLevel)
    setSessionMode('ask')
    // 标记下次 prompt 需要创建新会话
    setPendingNewSession(true)
  }, [send, store, currentModel, knownModels])

  const handleDeleteSession = useCallback((sid: string) => {
    debugLog(DEBUG_SCOPES.MIDDLEWARE, `handleDeleteSession: ${sid}`)
    send({ type: 'session:delete', sessionId: sid })
    if (sid === sessionId) { store.getState().clearMessages(); setSessionId(null) }
  }, [send, sessionId, store])

  const handleSwitchSession = useCallback((sid: string) => {
    store.getState().clearMessages()
    setSessionId(sid)
    setLastUsage(null)
    setContextTokenCount(null)
    setCompressionStatus(null)
    setAccInputTokens(0)
    setAccOutputTokens(0)
    setAccCachedInputTokens(0)
    send({ type: 'session:load', sessionId: sid })
  }, [send, store])

  const handleSessionUpdate = useCallback((sid: string, updates: { title?: string; pinned?: boolean; archived?: boolean }) => {
    send({ type: 'session:update', sessionId: sid, ...updates })
    setSessions((prev) => prev.map((s) => s.id === sid ? { ...s, ...updates } : s))
  }, [send])

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
            onUpdate={handleSessionUpdate}
            width={260}
            hovered={true}
          />
        ),
      },
      {
        id: 'files',
        label: '文件树',
        icon: <Icon icon={FolderTree} size="sm" />,
        defaultSide: 'left',
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
      {
        id: 'session-nav',
        label: '会话导航',
        icon: <Icon icon={List} size="sm" />,
        defaultSide: 'right',
        defaultVisible: true,
        render: () => <SessionNavPanel />,
      },
    ])
  }, [sessions, sessionId, currentWorkspace, send, handleNewSession, handleDeleteSession, handleSwitchSession, handleSessionUpdate])

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
      <header className="flex items-center px-5 shrink-0 border-b"
        style={{
          borderColor: 'var(--crai-border)',
          height: 'var(--crai-header-height, 48px)',
        }}
      >
        {/* 左：工作区 badge（可交互，点击展开下拉） + 对话标题 */}
        <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
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

        {/* 中：Dynamic Island */}
        <div className="flex items-center justify-center gap-2" style={{ flex: 1 }}>
          {compressionStatus && (
            <div className="text-xs animate-pulse" style={{ color: 'var(--crai-accent)' }}>
              压缩中...
            </div>
          )}
          <InfoIsland
            status={status}
            isProcessing={processing || messages.some((m) => m.activities?.some((a) => a.status === 'running'))}
            turnCount={messages.filter((m) => m.role === 'user').length}
            usedTokens={contextTokenCount ?? undefined}
            contextWindow={
              currentModel && knownModels
                ? (() => {
                    const si = currentModel.indexOf('/')
                    const mdl = si >= 0 ? currentModel.slice(si + 1) : currentModel
                    // 跨所有 provider 搜索模型（provider 名可能不匹配 known-models 的 key）
                    for (const models of Object.values(knownModels)) {
                      if (models[mdl]?.contextWindow) return models[mdl].contextWindow
                    }
                    return undefined
                  })()
                : undefined
            }
            lastUsage={lastUsage}
            accInputTokens={accInputTokens > 0 ? accInputTokens : (() => {
              // 从消息列表估算 token 用量（服务端未推送实际用量时的回退）
              const totalText = messages.map(m => m.text || '').join(' ')
              return Math.ceil(totalText.length / 4)
            })()}
            accOutputTokens={accOutputTokens}
            accCachedInputTokens={accCachedInputTokens}
            currency={globalConfig?.currency ?? 'CNY'}
            modelPricing={
              currentModel && knownModels
                ? (() => {
                    const si = currentModel.indexOf('/')
                    const mdl = si >= 0 ? currentModel.slice(si + 1) : currentModel
                    for (const models of Object.values(knownModels)) {
                      if (models[mdl]) return models[mdl]
                    }
                    return undefined
                  })()
                : undefined
            }
          />
        </div>

        {/* 右：设置 */}
        <div className="flex items-center gap-2 justify-end" style={{ flex: 1 }}>
          <button onClick={() => { send({ type: 'config:get' }); setShowConfig((s) => !s) }}
            className="p-1.5 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
            style={{ color: showConfig ? 'var(--crai-accent)' : 'var(--crai-fg-40)' }}>
            <Icon icon={Settings} size="xs" /></button>
          <button onClick={() => setShowInspector((s) => !s)}
            className="p-1.5 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
            style={{ color: showInspector ? 'var(--crai-accent)' : 'var(--crai-fg-40)' }}>
            <Icon icon={Palette} size="xs" /></button>
          <button onClick={() => setShowConnections(true)}
            className="p-1.5 rounded transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
            style={{ color: 'var(--crai-fg-40)' }}
            title="切换连接">
            <Icon icon={List} size="xs" /></button>
        </div>
      </header>

      {/* 连接管理器弹窗 */}
      <Dialog open={showConnections} onClose={() => { setShowConnections(false); setConnFormMode(false) }}
        style={{ width: 380, maxHeight: '70vh', borderRadius: 12, padding: 20 }}>
        {connFormMode ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--crai-fg)' }}>
              添加连接
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={connFormLabel} onChange={(e) => setConnFormLabel(e.target.value)}
                placeholder="标签（可选）"
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
              <input value={connFormUrl} onChange={(e) => setConnFormUrl(e.target.value)}
                placeholder="ws://127.0.0.1:8080"
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
              <div style={{ position: 'relative' }}>
                <input value={connFormToken} onChange={(e) => setConnFormToken(e.target.value)}
                  type={connShowToken ? 'text' : 'password'}
                  placeholder="访问密钥（可选）"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--crai-bg-secondary)', color: 'var(--crai-fg)', border: '1px solid var(--crai-border)' }} />
                <button onClick={() => setConnShowToken(!connShowToken)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--crai-fg-40)', cursor: 'pointer' }}>
                  {connShowToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => {
                  if (!connFormUrl.trim()) return
                  const url = connFormUrl.trim()
                  const label = connFormLabel.trim() || url
                  const id = `conn_${Date.now()}`
                  const profile: ConnectionProfile = { id, label, url, token: connFormToken.trim(), lastConnected: Date.now() }
                  const updated = [...connProfiles, profile]
                  setConnProfiles(updated)
                  localStorage.setItem('crai:connections', JSON.stringify(updated))
                  setConnFormMode(false)
                  setConnFormUrl('')
                  setConnFormLabel('')
                  setConnFormToken('')
                  // 保存后立即切换
                  onDisconnect?.(buildWsUrlForSwitch(url, profile.token))
                  setShowConnections(false)
                }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--crai-accent)' }}>
                  保存并连接
                </button>
                <button onClick={() => setConnFormMode(false)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
                  取消
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--crai-fg)' }}>
              切换连接
            </div>
            {connProfiles.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--crai-fg-40)', padding: '24px 0', textAlign: 'center' }}>
                没有已保存的连接
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {connProfiles.map((p) => (
                  <div key={p.id}
                    onClick={() => { onDisconnect?.(buildWsUrlForSwitch(p.url, p.token)); setShowConnections(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      backgroundColor: 'var(--crai-bg-secondary)',
                    }}
                    className="transition-colors hover:opacity-80">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--crai-fg-40)' }}>{p.url}</div>
                    </div>
                    <button onClick={(e) => {
                      e.stopPropagation()
                      const updated = connProfiles.filter((x) => x.id !== p.id)
                      setConnProfiles(updated)
                      localStorage.setItem('crai:connections', JSON.stringify(updated))
                    }}
                      style={{ color: 'var(--crai-destructive)', fontSize: 14, cursor: 'pointer' }}>
                      <Icon icon={Trash2} size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setConnFormMode(true); setConnFormUrl(''); setConnFormLabel(''); setConnFormToken('') }}
              style={{
                marginTop: 12, padding: '8px 0', borderRadius: 8, fontSize: 13, textAlign: 'center', cursor: 'pointer',
                color: 'var(--crai-fg-secondary)',
                border: '1px dashed var(--crai-border)',
              }}
              className="transition-colors hover:opacity-80">
              + 添加连接
            </button>
          </>
        )}
      </Dialog>
      <ShellLayout send={send}>

      {/* 回滚确认模态框 */}
      {showRollbackModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }} onClick={() => setShowRollbackModal(null)}>
          <div style={{
            backgroundColor: 'var(--crai-bg)',
            borderRadius: 12, padding: 24, minWidth: 300,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--crai-fg)' }}>
              确认回滚
            </div>
            <div style={{ fontSize: 13, color: 'var(--crai-fg-60)', marginBottom: 16, lineHeight: 1.5 }}>
              {showRollbackModal.fileCount > 0
                ? `将回滚 ${showRollbackModal.fileCount} 个文件并截断对话到此之前的消息。`
                : '将截断对话到此之前的消息（无文件需要恢复）。'}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="text-xs" style={{ color: 'var(--crai-fg-40)', marginBottom: 6 }}>回滚范围</div>
              {[
                { value: 'both' as const, label: '文件 + 对话', desc: '恢复文件并截断消息' },
                { value: 'files' as const, label: '仅文件', desc: '恢复文件，保留后续对话' },
                { value: 'conversation' as const, label: '仅对话', desc: '截断消息，文件保持不变' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: rollbackMode === opt.value ? 'var(--crai-bg-secondary)' : 'transparent' }}>
                  <input type="radio" name="mode" checked={rollbackMode === opt.value}
                    onChange={() => setRollbackMode(opt.value)}
                    style={{ accentColor: 'var(--crai-accent)' }} />
                  <div>
                    <div className="text-sm" style={{ color: 'var(--crai-fg)' }}>{opt.label}</div>
                    <div className="text-xs" style={{ color: 'var(--crai-fg-40)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRollbackModal(null)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ color: 'var(--crai-fg-60)', border: '1px solid var(--crai-border)' }}>
                取消
              </button>
              <button onClick={() => {
                const idx = showRollbackModal.messageIndex
                setShowRollbackModal(null)
                if (rollbackMode === 'both' || rollbackMode === 'conversation') {
                  send({ type: 'checkpoint:rollback:to-index', sessionId, messageIndex: idx })
                }
                if (rollbackMode === 'both' || rollbackMode === 'files') {
                  send({ type: 'checkpoint:rollback:to-index', sessionId, messageIndex: idx })
                }
              }}
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{ backgroundColor: 'var(--crai-accent)', color: '#fff' }}>
                {rollbackMode === 'both' ? '回滚文件与对话' :
                 rollbackMode === 'files' ? '仅回滚文件' : '仅截断对话'}
              </button>
            </div>
          </div>
        </div>
      )}
        <MessageList messages={messages} rollbackPoints={rollbackPoints} />
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
          onCancel={() => send({ type: 'session:cancel-turn' })}
          disabled={status !== 'connected'}
          isProcessing={processing || messages.some((m) => m.activities?.some((a) => a.status === 'running'))}
          models={availableModels}
          currentModel={currentModel}
          onModelChange={setCurrentModel}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={(level) => { setThinkingLevel(level); if (sessionId) send({ type: 'session:update', sessionId, thinkingLevel: level }) }}
          sessionMode={sessionMode}
          onModeChange={(mode) => { setSessionMode(mode); if (sessionId) send({ type: 'session:update', sessionId, mode }) }}
          sessionId={sessionId}
          knownModels={knownModels ?? undefined}
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
        <Dialog open={showConfig} onClose={() => setShowConfig(false)} showClose={false}
          className="rounded-xl flex flex-col overflow-hidden"
          style={{ width: 660, height: '75vh' }}
        >
          <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} modelsFetchResult={modelsFetchResult} onClearModelsResult={() => setModelsFetchResult(null)} configTestResult={configTestResult} onClearTestResult={() => setConfigTestResult(null)} knownModels={knownModels ?? undefined} firstParty={firstPartyProviders ?? undefined} />
        </Dialog>
      )}
    </div>
  )
}
