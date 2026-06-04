import { useCallback, useRef } from 'react'
import type { ChatMessage } from '../types/messages'
import { useChatStore } from '../store/chat'
import { debugLog, DEBUG_SCOPES } from '../utils/debug'
import { extractTextFromParts } from '../utils/message-utils'
import { dispatchAuthResponse } from '../components/config/AccessKeysTab'

interface BrowseData {
  path: string
  dirs: string[]
  files?: Array<{ name: string; path: string; size: number; mtime: number; isDirectory: boolean }>
  parent?: string
  error?: string
}

interface WsHandlers {
  send: (msg: any) => void
  onSessionId: (id: string) => void
  onSessionList: (list: Array<{ id: string; title?: string; createdAt: number; pinned?: boolean; archived?: boolean }>) => void
  onSessionTitle: (id: string, title: string) => void
  onConfigData: (config: any) => void
  onConfigModels: (providerName: string, models: string[], error?: string) => void
  onConfigTest: (ok: boolean, error?: string) => void
  onWorkspaceList: (current: string | null, workspaces: Array<{ rootDir: string }>) => void
  onWorkspaceSwitched: (rootDir: string) => void
  onThinkingLevel: (level: string) => void
  onSessionMode: (mode: string) => void
  onKnownModels: (known: any, firstParty: any, levels: any, defaults: any) => void
  onRequestInput: (id: string, question: string, options?: string[], meta?: Record<string, unknown>) => void
  onDirBrowse: (data: BrowseData) => void
  setCurrentModel: (m: string) => void
  /** 来自 session:data 的 lastRoundUsage。可能为旧数据或受竞态影响的偏小值。 */
  onUsage: (usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; cost?: number }) => void
  onUsageAccumulated: (acc: { inputTokens: number; outputTokens: number; cachedInputTokens: number }) => void
  /** 设置上下文 token 数，由 session:data 检测压缩标记、compression:status 或 usage:update 事件调用。 */
  onContextTokenCount?: (tokens: number) => void
  /** 压缩进度更新：step=summarizing 时压缩进行中，step=done/tokensBefore,tokensAfter 时完成。 */
  onCompressionStatus?: (status: { step: string; tokensBefore?: number; tokensAfter?: number; message?: string }) => void
}

export function useWsHandler(h: WsHandlers) {
  const store = useChatStore
  const titledSessions = useRef<Set<string>>(new Set())
  const sessionApprovedTools = useRef<Set<string>>(new Set())
  const sessionIdRef = useRef<string | null>(null)
  // 用 ref 持有 handler 参数，避免 useCallback(fn, []) 陈旧闭包
  const hRef = useRef(h)
  hRef.current = h

  // Expose refs for external access
  const getSessionIdRef = () => sessionIdRef
  const getApprovedTools = () => sessionApprovedTools

  const handler = useCallback((raw: string) => {
    const h = hRef.current
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'event': {
        if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
          debugLog('stream', 'model.delta', msg.payload.delta.slice(0, 50))
          store.getState().streamText(msg.payload.delta)
        }
        if (msg.event === 'activity.start' && msg.payload?.activity) {
          const a = msg.payload.activity
          debugLog('tools', '活动开始:', a.id, a.type, a.toolName || '')
          store.getState().addActivity({
            id: a.id, type: a.type, status: 'running',
            toolName: a.toolName, toolCallId: a.toolCallId,
            intent: a.intent, toolInput: a.toolInput,
          })
        }
        if (msg.event === 'activity.delta' && msg.payload?.delta) {
          store.getState().updateActivity(msg.payload.activityId, msg.payload.delta)
        }
        if (msg.event === 'activity.done' && msg.payload?.activity) {
          const a = msg.payload.activity
          store.getState().completeActivity(a.id, a.status, a.content, a.error)
        }
        if (msg.event === 'turn.completed' || msg.event === 'turn.failed') {
          // turn 结束（无论是否正常中止）时清理客户端占位活动
          store.getState().completeActivity('think-pending', 'completed')
        }
        if (msg.event === 'model.completed') {
          store.getState().flushBuffer()
          // 移除客户端占位的 think-pending 活动（处理尚未收到任何 server 事件的中止情况）
          store.getState().completeActivity('think-pending', 'completed')
          const usage = msg.payload?.response?.usage
          if (usage) {
            debugLog(DEBUG_SCOPES.USAGE, 'model.completed usage', usage)
            h.onUsage(usage)
          } else {
            debugLog(DEBUG_SCOPES.USAGE, 'model.completed no usage', msg.payload?.response)
          }
          const sid = sessionIdRef.current
          if (sid && !titledSessions.current.has(sid)) {
            titledSessions.current.add(sid)
            h.send({ type: 'session:generate-title', sessionId: sid })
          }
        }
        if (msg.event === 'compression.status') {
          const status = msg.payload?.status
          if (status) {
            h.onCompressionStatus?.(status)
          }
        }
        if (msg.event === 'usage.update') {
          const inputTokens = msg.payload?.inputTokens
          if (typeof inputTokens === 'number') {
            debugLog(DEBUG_SCOPES.USAGE, 'usage:update inputTokens', inputTokens)
            h.onContextTokenCount?.(inputTokens)
          }
        }
        // 实时追加消息（如压缩摘要）
        if (msg.event === 'message.appended') {
          const appendedMsg = msg.payload?.message
          if (!appendedMsg) return
          const text = extractTextFromParts(appendedMsg.parts)
          const chatMsg = {
            id: appendedMsg.id as string,
            role: appendedMsg.role as 'user' | 'assistant' | 'system',
            text: text || '',
            createdAt: appendedMsg.createdAt ?? Date.now(),
            metadata: appendedMsg.metadata,
          }
          store.getState().mergeServerData([chatMsg])
        }
        break
      }
      case 'session:id':
        sessionIdRef.current = msg.id
        h.onSessionId(msg.id)
        h.send({ type: 'session:load', sessionId: msg.id })
        h.send({ type: 'session:list' })
        break
      case 'request:input': {
        const toolName = (msg.meta?.toolName as string) ?? ''
        if (toolName && sessionApprovedTools.current.has(toolName)) {
          h.send({ type: 'resolve:input', id: msg.id, value: 'allow' })
        } else {
          h.onRequestInput(msg.id, msg.question, msg.options, msg.meta)
        }
        break
      }
      case 'config:data': {
        h.onConfigData(msg.config)
        if (msg.config?.providers) {
          const models: Array<{ name: string; provider: string }> = []
          for (const [provider, cfg] of Object.entries(msg.config.providers) as [string, { models?: string[] }][]) {
            for (const m of cfg.models ?? []) models.push({ name: m, provider })
          }
          const currentModel = msg.config?.defaultModel || (models.length > 0 ? `${models[0].provider}/${models[0].name}` : '')
          h.setCurrentModel(currentModel)
        }
        break
      }
      case 'config:models:data':
        h.onConfigModels(msg.providerName, msg.models ?? [], msg.error)
        break
      case 'config:test:result':
        h.onConfigTest(msg.ok, msg.error)
        break
      case 'workspace:list:data': {
        const list = msg.workspaces?.map((w: any) => ({ rootDir: w.rootDir })) ?? []
        h.onWorkspaceList(msg.current ?? null, list)
        if (list.length > 0) h.send({ type: 'session:list' })
        break
      }
      case 'workspace:switched':
        h.onWorkspaceSwitched(msg.rootDir)
        store.getState().clearMessages()
        h.send({ type: 'workspace:list' })
        break
      case 'session:list:data':
        h.onSessionList(msg.sessions ?? [])
        break
      case 'session:data': {
        const incoming = (msg.messages ?? []).map((m: any) => ({
          id: m.id, role: m.role as 'user' | 'assistant',
          text: m.text ?? '', createdAt: m.createdAt ?? Date.now(),
          activities: m.activities as any[] | undefined,
          metadata: m.metadata,
        }))
        if (msg.metadata?.thinkingLevel) h.onThinkingLevel(String(msg.metadata.thinkingLevel))
        if (msg.metadata?.mode) h.onSessionMode(String(msg.metadata.mode))
        if (msg.todos) store.getState().setTodos(msg.todos)
        if (msg.usageAccumulated) h.onUsageAccumulated(msg.usageAccumulated)
        if (msg.lastRoundUsage) h.onUsage(msg.lastRoundUsage)
        store.getState().mergeServerData(incoming)

        // 检测压缩标记，计算标记后的上下文 token 数
        if (h.onContextTokenCount) {
          const msgs = incoming
          let ctxStart = 0
          for (let i = msgs.length - 1; i >= 0; i--) {
            if ((msgs[i] as any).id === 'ctx-compaction') { ctxStart = i; break }
          }
          if (ctxStart > 0) {
            // 只计算压缩标记之后的消息
            const ctxText = msgs.slice(ctxStart).map((m: any) => m.text || '').join(' ')
            h.onContextTokenCount(Math.ceil(ctxText.length / 4))
          }
        }
        break
      }
      case 'error':
        store.getState().appendSystemMessage(`⚠ ${msg.message}`)
        break
      case 'dir:browse:data':
        h.onDirBrowse({ path: msg.path, dirs: msg.dirs, files: msg.files, parent: msg.parent, error: msg.error })
        break
      case 'session:title':
        h.onSessionTitle(msg.sessionId, msg.title)
        break
      case 'config:known-models:data':
        h.onKnownModels(msg.knownModels, msg.firstParty, msg.thinkingLevels, msg.defaultThinkingLevels)
        break
      case 'config:auth:list:data':
      case 'config:auth:generated':
      case 'config:auth:revoked':
        dispatchAuthResponse(msg)
        break
    }
  }, [])

  return { handler, sessionIdRef: getSessionIdRef, approvedTools: getApprovedTools }
}
