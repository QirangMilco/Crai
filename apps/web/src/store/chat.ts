/**
 * @crai/web — 聊天消息 Zustand store
 *
 * 核心原则：消息自创建到完成始终是同一个 messages[] 条目，不切换组件树。
 * - appendPlaceholders 创建 asst-xxx 占位消息
 * - 流式 buffer 写入占位消息的 text
 * - Activity 事件写入占位消息的 activities
 * - message.appended 到达时：原地更新占位消息的数据（text + activities），不添加新条目
 * - 无独立 turn 状态、无 TurnCard、无组件切换
 */

import { create } from 'zustand'
import type { ChatMessage } from '../types/messages'
import { debugLog } from '../utils/debug'

const FLUSH_INTERVAL = 100

const _sb = {
  text: '',
  flushedAt: 0,
  flushTimer: null as ReturnType<typeof setTimeout> | null,
}

function flushNow(set: any) {
  if (!_sb.text) return
  _sb.flushedAt = Date.now()
  set((s: ChatStore) => {
    const idx = findLastAssistantIndex(s.messages)
    if (idx === undefined) return s
    const msg = s.messages[idx]
    const copy = [...s.messages]
    const activities = msg.activities ? [...msg.activities] : undefined
    copy[idx] = { ...copy[idx], text: msg.text + _sb.text, activities }
    return { messages: copy }
  })
  _sb.text = ''
}

function scheduleFlush(set: any) {
  const elapsed = Date.now() - _sb.flushedAt
  if (elapsed >= FLUSH_INTERVAL) {
    flushNow(set)
  } else if (!_sb.flushTimer) {
    _sb.flushTimer = setTimeout(() => {
      _sb.flushTimer = null
      flushNow(set)
    }, FLUSH_INTERVAL - elapsed)
  }
}

function findLastAssistantIndex(msgs: ChatMessage[]): number | undefined {
  return msgs.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
}

export interface ChatStore {
  messages: ChatMessage[]
  todos: Array<{ id: string; content: string; activeForm?: string; status: 'pending' | 'in_progress' | 'completed' }>
  activeTurnIndex: number
  processing: boolean
  setProcessing: (v: boolean) => void
  setActiveTurnIndex: (idx: number) => void
  appendPlaceholders: (text: string, ts: number, sessionId?: string | null) => void
  streamText: (delta: string) => void
  addActivity: (activity: { id: string; type: 'thinking' | 'tool'; status: 'running'; toolName?: string; toolCallId?: string; intent?: string; toolInput?: Record<string, unknown> }) => void
  updateActivity: (activityId: string, delta: string) => void
  completeActivity: (activityId: string, status: 'completed' | 'error' | 'aborted', content?: string, error?: string) => void
  mergeServerData: (incoming: ChatMessage[]) => void
  setTodos: (todos: ChatStore['todos']) => void
  flushBuffer: () => void
  clearMessages: () => void
  appendSystemMessage: (text: string) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  processing: false,
  todos: [],
  activeTurnIndex: -1,

  setActiveTurnIndex: (idx) => set({ activeTurnIndex: idx }),
  setProcessing: (v) => set({ processing: v }),

  appendPlaceholders: (text: string, ts: number) => {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `user-${ts}`, role: 'user', text, createdAt: ts },
        { id: `asst-${ts}`, role: 'assistant', text: '', createdAt: ts },
      ],
      processing: true,
    }))
  },

  streamText: (delta: string) => {
    _sb.text += delta
    scheduleFlush(set)
  },

  addActivity: (activity) => {
    flushNow(set)
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const activities = [...(msg.activities || [])]
      const existingIdx = activities.findIndex((a) => a.id === activity.id)
      if (existingIdx >= 0) {
        activities[existingIdx] = { ...activities[existingIdx], ...activity, timestamp: Date.now() }
        const copy = [...s.messages]
        copy[idx] = { ...copy[idx], activities }
        return { messages: copy }
      }
      activities.push({ ...activity, timestamp: Date.now() } as any)
      const newText = activity.intent ? '' : msg.text
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], activities, text: newText }
      return { messages: copy }
    })
  },

  updateActivity: (activityId, delta) => {
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const activities = [...(msg.activities || [])]
      const aIdx = activities.findIndex((a) => a.id === activityId)
      if (aIdx < 0) return s
      activities[aIdx] = { ...activities[aIdx], content: (activities[aIdx].content || '') + delta }
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], activities }
      return { messages: copy }
    })
  },

  completeActivity: (activityId, status, content, error) => {
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const activities = [...(msg.activities || [])]
      const aIdx = activities.findIndex((a) => a.id === activityId)
      if (aIdx < 0) return s
      activities[aIdx] = {
        ...activities[aIdx], status,
        ...(content !== undefined ? { content } : {}),
        ...(error !== undefined ? { error } : {}),
      }
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], activities }
      return { messages: copy }
    })
  },

  mergeServerData: (incoming: ChatMessage[]) => {
    flushNow(set)
    set((s) => {
      const incomingIds = new Set(incoming.map((m) => m.id))
      const kept = s.messages.filter((m) => !incomingIds.has(m.id))
      const merged = [...incoming]

      for (const local of s.messages) {
        const existingIdx = merged.findIndex((m) => m.id === local.id)
        if (existingIdx < 0) continue
        const serverMsg = merged[existingIdx]
        const mergedMsg = { ...serverMsg }
        if (local.text && !serverMsg.text) {
          mergedMsg.text = local.text
        }
        const serverActivities = serverMsg.activities || []
        if (local.activities && local.activities.length > 0) {
          const serverById = new Map(serverActivities.map((a) => [a.id, a]))
          for (const la of local.activities) serverById.set(la.id, la)
          mergedMsg.activities = Array.from(serverById.values())
        } else {
          mergedMsg.activities = serverActivities
        }
        merged[existingIdx] = mergedMsg
      }
      for (const local of kept) {
        const existingIdx = merged.findIndex((m) => m.id === local.id)
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], activities: local.activities }
        } else {
          merged.push(local)
        }
      }

      // 原地更新占位消息：保留 asst-xxx key，用服务端数据替换，保持 React 稳定
      const serverAsst = incoming.find(m => m.role === 'assistant')
      if (serverAsst) {
        for (let i = merged.length - 1; i >= 0; i--) {
          if (merged[i].role === 'assistant' && /^asst-/.test(merged[i].id)) {
            merged[i] = {
              ...merged[i],
              text: serverAsst.text || merged[i].text,
              metadata: serverAsst.metadata || merged[i].metadata,
              // 保留现场 activities 引用不变（已完成状态，避免 ActivityRow key 变化触发 remount）
            }
            const si = merged.findIndex(m => m.id === serverAsst.id)
            if (si >= 0) merged.splice(si, 1)
            break
          }
        }
      }

      merged.sort((a, b) => a.createdAt - b.createdAt)
      return { messages: merged }
    })
  },

  flushBuffer: () => {
    flushNow(set)
  },

  clearMessages: () => {
    if (_sb.flushTimer) {
      clearTimeout(_sb.flushTimer)
      _sb.flushTimer = null
    }
    _sb.text = ''
    set({ messages: [], todos: [], processing: false })
  },

  setTodos: (todos) => set({ todos }),

  appendSystemMessage: (text: string) => {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `sys-${Date.now()}`, role: 'system', text, createdAt: Date.now() },
      ],
    }))
  },
}))
