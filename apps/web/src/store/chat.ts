/**
 * @crai/web — 聊天消息 Zustand store
 *
 * 设计：
 * - messages 是唯一响应式状态，通过 useStore 选择性订阅
 * - 流式内容（text, thinking）先写入模块级 buffer，每 50ms 批量 flush 到 store
 * - 低频事件（tool.*, thinking.done）立即 flush
 * - WS handler 通过 getState() 直接调用 store action，不经过 React
 */

import { create } from 'zustand'
import type { ChatMessage } from '../types/messages'

// ── Stream Buffer（模块级，不触发 React 订阅） ──────────

const FLUSH_INTERVAL = 100

const _sb = {
  text: '',
  thinking: '',
  flushedAt: 0,
  flushTimer: null as ReturnType<typeof setTimeout> | null,
}

function flushNow(set: any) {
  const { text, thinking } = _sb
  if (!text && !thinking) return

  _sb.flushedAt = Date.now()

  set((s: ChatStore) => {
    const idx = findLastAssistantIndex(s.messages)
    if (idx === undefined) return s
    const msg = s.messages[idx]
    const blocks = [...(msg.blocks || [])]

    // ── Thinking ──
    if (thinking) {
      const lastT = blocks.map((b, i) => ({ b, i }))
        .filter((x) => x.b.type === 'thinking')
        .pop()
      if (lastT && !(lastT.b as any).sealed) {
        blocks[lastT.i] = { ...blocks[lastT.i], content: (blocks[lastT.i] as any).content + thinking }
      } else {
        blocks.push({ type: 'thinking', content: thinking, sealed: false })
      }
    }

    // ── Text ──
    if (text) {
      const textIdx = blocks.findIndex((b) => b.type === 'text')
      if (textIdx >= 0) {
        blocks[textIdx] = { ...blocks[textIdx], content: (blocks[textIdx] as any).content + text }
      } else {
        blocks.push({ type: 'text', content: text })
      }
    }

    const copy = [...s.messages]
    copy[idx] = { ...copy[idx], blocks }
    return { messages: copy }
  })

  _sb.text = ''
  _sb.thinking = ''
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

  /** 创建用户消息 + 空助理消息占位符。 */
  appendPlaceholders: (text: string, ts: number, sessionId?: string | null) => void

  /** 思考内容增量。累积到 buffer，50ms 节流 flush。 */
  streamThinking: (delta: string) => void

  /** 文本增量。累积到 buffer，50ms 节流 flush。 */
  streamText: (delta: string) => void

  /** 封口 thinking block，立即 flush。 */
  sealThinking: () => void

  /** 添加工具调用到 tool_group。 */
  addTool: (toolCallId: string, name: string) => void

  /** 标记工具完成。 */
  doneTool: (toolCallId: string, isError: boolean) => void

  /** 合并服务端 session:data。 */
  mergeServerData: (incoming: ChatMessage[]) => void

  /** 节流清空 buffer。通常在 model.completed 或 turn_end 时调用。 */
  flushBuffer: () => void

  /** 清空所有消息。 */
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],

  appendPlaceholders: (text: string, ts: number, _sessionId?: string | null) => {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `user-${ts}`, role: 'user', text, createdAt: ts },
        { id: `asst-${ts}`, role: 'assistant', text: '', createdAt: ts },
      ],
    }))
  },

  streamThinking: (delta: string) => {
    _sb.thinking += delta
    scheduleFlush(set)
  },

  streamText: (delta: string) => {
    _sb.text += delta
    scheduleFlush(set)
  },

  sealThinking: () => {
    flushNow(set)
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const blocks = [...(msg.blocks || [])]
      const lastT = blocks.map((b, i) => ({ b, i }))
        .filter((x) => x.b.type === 'thinking')
        .pop()
      if (lastT) {
        blocks[lastT.i] = { ...blocks[lastT.i], sealed: true }
      }
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], blocks }
      return { messages: copy }
    })
  },

  addTool: (toolCallId: string, name: string) => {
    flushNow(set)
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const blocks = [...(msg.blocks || [])]
      // 找最后一个有 running 工具的 tool_group
      const lastG = blocks.map((b, i) => ({ b, i }))
        .filter((x) => x.b.type === 'tool_group' && (x.b as any).tools.some((t: any) => t.status === 'running'))
        .pop()
      if (lastG !== undefined) {
        const tg = blocks[lastG.i] as any
        blocks[lastG.i] = {
          ...tg,
          tools: [...tg.tools, { toolCallId, name, args: '', status: 'running' }],
        }
      } else {
        blocks.push({
          type: 'tool_group',
          tools: [{ toolCallId, name, args: '', status: 'running' }],
          collapsed: false,
        })
      }
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], blocks }
      return { messages: copy }
    })
  },

  doneTool: (toolCallId: string, isError: boolean) => {
    flushNow(set) // 先 flush 保证 blocks 是最新状态
    set((s) => {
      const idx = findLastAssistantIndex(s.messages)
      if (idx === undefined) return s
      const msg = s.messages[idx]
      const blocks = [...(msg.blocks || [])]
      for (const b of blocks) {
        if (b.type !== 'tool_group') continue
        const tg = b as any
        const tIdx = tg.tools.findIndex((t: any) => t.toolCallId === toolCallId && t.status === 'running')
        if (tIdx >= 0) {
          tg.tools[tIdx] = { ...tg.tools[tIdx], status: isError ? 'error' : 'success' } as any
          if (tg.tools.every((t: any) => t.status !== 'running')) {
            tg.collapsed = true
          }
          break
        }
      }
      const copy = [...s.messages]
      copy[idx] = { ...copy[idx], blocks }
      return { messages: copy }
    })
  },

  mergeServerData: (incoming: ChatMessage[]) => {
    flushNow(set) // 先 flush buffer，确保本地 blocks 是最新的
    set((s) => {
      const incomingIds = new Set(incoming.map((m) => m.id))
      const hasServerAssistant = incoming.some((m) => m.role === 'assistant')
      const hasServerUser = incoming.some((m) => m.role === 'user')

      // 丢弃预创建的占位消息，保留无冲突的本地消息
      const kept = s.messages.filter((m) => {
        if (incomingIds.has(m.id)) return false
        if (hasServerAssistant && m.role === 'assistant' && /^asst-/.test(m.id)) return false
        if (hasServerUser && m.role === 'user' && /^user-/.test(m.id)) return false
        return true
      })

      // 服务端数据为主，保留本地 blocks
      const merged = [...incoming]
      for (const local of s.messages) {
        if (!local.blocks?.length) continue
        const existingIdx = merged.findIndex((m) => m.id === local.id)
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], blocks: local.blocks }
        }
      }
      for (const local of kept) {
        const existingIdx = merged.findIndex((m) => m.id === local.id)
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], blocks: merged[existingIdx].blocks || local.blocks }
        } else {
          merged.push(local)
        }
      }
      merged.sort((a, b) => a.createdAt - b.createdAt)
      return { messages: merged }
    })
  },

  /** 节流清空 buffer。通常在 model.completed 或 turn_end 时调用。 */
  flushBuffer: () => {
    flushNow(set)
  },

  clearMessages: () => {
    if (_sb.flushTimer) {
      clearTimeout(_sb.flushTimer)
      _sb.flushTimer = null
    }
    _sb.text = ''
    _sb.thinking = ''
    set({ messages: [] })
  },
}))
