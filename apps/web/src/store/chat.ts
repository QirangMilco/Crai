/**
 * @crai/web — 聊天消息 Zustand store
 *
 * 设计：
 * - messages 是唯一响应式状态，通过 useStore 选择性订阅
 * - 流式文本先写入模块级 buffer，每 100ms 批量 flush 到 msg.text
 * - Activity 事件（thinking/tool）直接 set store，不经过 buffer
 * - WS handler 通过 getState() 直接调用 store action，不经过 React
 *
 * CrystalAgents 路线：text 和 activities 分离存储，blocks 仅用于旧 session 回放。
 */

import { create } from 'zustand'
import type { ChatMessage } from '../types/messages'
import { debugLog } from '../utils/debug'

// ── Stream Buffer（模块级，不触发 React 订阅） ──────────

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
    // 流式文本开始到达时，移除占位的 think-pending 活动
    const activities = msg.activities ? [...msg.activities] : undefined
    if (activities) {
      const pi = activities.findIndex((a: any) => a.id === 'think-pending')
      if (pi >= 0) activities.splice(pi, 1)
    }
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

// ── 辅助函数 ────────────────────────────────────────

function findLastAssistantIndex(msgs: ChatMessage[]): number | undefined {
  return msgs.map((m, i) => ({ m, i })).filter((x) => x.m.role === 'assistant').pop()?.i
}

// ── Store ────────────────────────────────────────────

export interface ChatStore {
  messages: ChatMessage[]
  todos: Array<{ id: string; content: string; activeForm?: string; status: 'pending' | 'in_progress' | 'completed' }>
  /** 导航面板当前高亮的消息索引 */
  activeTurnIndex: number

  /** 设置当前高亮索引 */
  setActiveTurnIndex: (idx: number) => void

  /** 创建用户消息 + 空助理消息占位符。 */
  appendPlaceholders: (text: string, ts: number, sessionId?: string | null) => void

  /** 文本增量。累积到 buffer，100ms 节流 flush 到 msg.text。 */
  streamText: (delta: string) => void

  // ── Activity 操作（CrystalAgents 路线） ──

  /** 添加/更新一个活动（thinking/tool 开始或补充参数）。 */
  addActivity: (activity: { id: string; type: 'thinking' | 'tool'; status: 'running'; toolName?: string; toolCallId?: string; intent?: string; toolInput?: Record<string, unknown> }) => void

  /** 更新活动内容（thinking delta）。 */
  updateActivity: (activityId: string, delta: string) => void

  /** 完成一个活动（thinking/tool 结束）。 */
  completeActivity: (activityId: string, status: 'completed' | 'error' | 'aborted', content?: string, error?: string) => void

  /** 合并服务端 session:data。 */
  mergeServerData: (incoming: ChatMessage[]) => void

  /** 设置 TODO 列表。 */
  setTodos: (todos: ChatStore['todos']) => void

  /** 节流清空 buffer。通常在 model.completed 或 turn_end 时调用。 */
  flushBuffer: () => void

  /** 清空所有消息。 */
  clearMessages: () => void

  /** 追加一条系统消息（用于显示错误信息）。 */
  appendSystemMessage: (text: string) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  todos: [],
  activeTurnIndex: -1,

  setActiveTurnIndex: (idx) => set({ activeTurnIndex: idx }),

  appendPlaceholders: (text: string, ts: number, _sessionId?: string | null) => {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `user-${ts}`, role: 'user', text, createdAt: ts },
        { id: `asst-${ts}`, role: 'assistant', text: '', createdAt: ts, activities: [{ id: 'think-pending', type: 'thinking', status: 'running' }] },
      ],
    }))
  },

  streamText: (delta: string) => {
    _sb.text += delta
    scheduleFlush(set)
  },

  // ── Activity 操作 ──

  /** 添加一个活动（thinking/tool 开始），同时捕获 msg.text 中的 intent 文本并清空。 */
  addActivity: (activity: { id: string; type: 'thinking' | 'tool'; status: 'running'; toolName?: string; toolCallId?: string; intent?: string; toolInput?: Record<string, unknown> }) => {
    flushNow(set)
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const activities = [...(msg.activities || [])]
      // 移除占位活动（客户端即时反馈），替换为真实活动
      const pendingIdx = activities.findIndex((a) => a.id === 'think-pending')
      if (pendingIdx >= 0 && pendingIdx < activities.length) {
        activities.splice(pendingIdx, 1)
      }
      const existingIdx = activities.findIndex((a) => a.id === activity.id)
      if (existingIdx >= 0) {
        activities[existingIdx] = { ...activities[existingIdx], ...activity, timestamp: Date.now() }
        const copy = [...s.messages]
        copy[idx] = { ...copy[idx], activities }
        return { messages: copy }
      }
      activities.push({ ...activity, timestamp: Date.now() } as any)
      // 服务端已告知 intent（textBeforeTool），移除 msg.text 中对应的 intent 文本
      const newText = activity.intent ? '' : msg.text
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], activities, text: newText }
      return { messages: copy }
    })
  },

  updateActivity: (activityId: string, delta: string) => {
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
      const hasServerAssistant = incoming.some((m) => m.role === 'assistant')
      const hasServerUser = incoming.some((m) => m.role === 'user')

      const kept = s.messages.filter((m) => {
        if (incomingIds.has(m.id)) return false
        if (hasServerAssistant && m.role === 'assistant' && /^asst-/.test(m.id)) return false
        if (hasServerUser && m.role === 'user' && /^user-/.test(m.id)) return false
        return true
      })

      const merged = [...incoming]
      for (const local of s.messages) {
        const existingIdx = merged.findIndex((m) => m.id === local.id)
        if (existingIdx < 0) continue

        const serverMsg = merged[existingIdx]
        const mergedMsg: any = { ...serverMsg }

        // 本地有流式文本且服务端没有 → 保留本地
        if (local.text && !serverMsg.text) {
          mergedMsg.text = local.text
        }
        // 服务端 activities + 本地流式 activities 合并
        const serverActivities = serverMsg.activities || []
        if (local.activities && local.activities.length > 0) {
          const serverById = new Map(serverActivities.map((a: any) => [a.id, a]))
          for (const la of local.activities) {
            if (la.status === 'running' || la.status === 'pending') {
              serverById.set(la.id, la)
            }
          }
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
    set({ messages: [], todos: [] })
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
