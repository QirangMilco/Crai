import { useCallback, useRef } from 'react'
import type { ChatMessage } from '../types/messages'
import { useChatStore } from '../store/chat'
import { debugLog } from '../utils/debug'

interface WsHandlers {
  send: (msg: any) => void
  onSessionId: (id: string) => void
  onSessionList: (list: Array<{ id: string; title?: string; createdAt: number }>) => void
  onSessionTitle: (id: string, title: string) => void
  onConfigData: (config: any) => void
  onConfigModels: (providerName: string, models: string[], error?: string) => void
  onWorkspaceList: (current: string | null, workspaces: Array<{ rootDir: string }>) => void
  onWorkspaceSwitched: (rootDir: string) => void
  onThinkingLevel: (level: string) => void
  onSessionMode: (mode: string) => void
  onKnownModels: (known: any, firstParty: any, levels: any, defaults: any) => void
  onRequestInput: (id: string, question: string, options?: string[], meta?: Record<string, unknown>) => void
  onDirBrowse: (data: { path: string; dirs: string[]; parent?: string; error?: string }) => void
  setCurrentModel: (m: string) => void
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
        if (msg.event === 'model.completed') {
          store.getState().flushBuffer()
          const sid = sessionIdRef.current
          if (sid && !titledSessions.current.has(sid)) {
            titledSessions.current.add(sid)
            h.send({ type: 'session:generate-title', sessionId: sid })
          }
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
          const currentModel = models.length > 0 ? models[0].name : ''
          h.setCurrentModel(currentModel)
        }
        break
      }
      case 'config:models:data':
        h.onConfigModels(msg.providerName, msg.models ?? [], msg.error)
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
        }))
        if (msg.metadata?.thinkingLevel) h.onThinkingLevel(String(msg.metadata.thinkingLevel))
        if (msg.metadata?.mode) h.onSessionMode(String(msg.metadata.mode))
        store.getState().mergeServerData(incoming)
        break
      }
      case 'error':
        store.getState().appendSystemMessage(`⚠ ${msg.message}`)
        break
      case 'dir:browse:data':
        h.onDirBrowse({ path: msg.path, dirs: msg.dirs, parent: msg.parent, error: msg.error })
        break
      case 'session:title':
        h.onSessionTitle(msg.sessionId, msg.title)
        break
      case 'config:known-models:data':
        h.onKnownModels(msg.knownModels, msg.firstParty, msg.thinkingLevels, msg.defaultThinkingLevels)
        break
    }
  }, [])

  return { handler, sessionIdRef: getSessionIdRef, approvedTools: getApprovedTools }
}
