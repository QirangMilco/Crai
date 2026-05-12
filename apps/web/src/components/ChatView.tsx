import { useState, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import type { ChatMessage, ClientMsg } from '../types/messages'

interface Props {
  wsUrl: string
}

export function ChatView({ wsUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [dark, setDark] = useState(false)
  const pendingInputs = useRef<Map<string, (v: string) => void>>(new Map())

  // 处理 runtime 事件 → 更新消息列表
  const handleEvent = useCallback((event: string, payload: unknown) => {
    if (event === 'model.delta') {
      const delta = (payload as any)?.delta
      if (typeof delta === 'string') {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          // 追加流式文本
          return prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant'
              ? { ...m, text: m.text + delta }
              : m,
          )
        })
      }
    }
    if (event === 'model.completed') {
      const resp = (payload as any)?.response
      if (resp?.message?.parts) {
        const textParts = resp.message.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('')
        if (textParts) {
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant'
              ? { ...m, text: textParts }
              : m,
          ))
        }
      }
    }
  }, [])

  // 处理 session ID
  const handleSessionId = useCallback((id: string) => {
    setSessionId(id)
  }, [])

  // 处理 request:input（工具提问）
  const handleRequestInput = useCallback((id: string, question: string, options?: string[]) => {
    const answer = prompt(question + (options?.length ? `\n选项: ${options.join(', ')}` : ''))
    if (answer !== null) {
      send({ type: 'resolve:input', id, value: answer })
    }
  }, [])

  const { status, send } = useWebSocket({
    url: wsUrl,
    onEvent: handleEvent,
    onSessionId: handleSessionId,
    onRequestInput: handleRequestInput,
  })

  // 用户发送消息
  const handleSend = useCallback((text: string) => {
    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      createdAt: Date.now(),
    }
    // 添加占位的 assistant 消息（用于流式追加）
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '',
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const clientMsg: ClientMsg = {
      type: 'prompt',
      sessionId: sessionId ?? undefined,
      text,
    }
    send(clientMsg)
  }, [sessionId, send])

  // 暗色/亮色切换
  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  return (
    <div
      className="flex h-dvh flex-col"
      style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}
    >
      {/* ── 顶部栏 ── */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ borderColor: 'var(--crai-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">Crai</span>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: status === 'connected' ? 'var(--crai-success)' : 'var(--crai-destructive)' }}
          />
          <span className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
            {status === 'connected' ? (sessionId ? sessionId.slice(0, 12) : '已连接') : status}
          </span>
        </div>
        <button
          onClick={() => setShowInspector((s) => !s)}
          className="px-3 py-1 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: showInspector ? 'var(--crai-accent)' : 'var(--crai-bg-tertiary)',
            color: showInspector ? '#fff' : 'var(--crai-fg-secondary)',
          }}
        >
          Inspector
        </button>
      </header>

      {/* ── 消息列表 ── */}
      <MessageList messages={messages} />

      {/* ── 输入框 ── */}
      <ChatInput onSend={handleSend} disabled={status !== 'connected'} />

      {/* ── Inspector ── */}
      {showInspector && (
        <InspectorPanel
          dark={dark}
          onToggleDark={toggleDark}
          onClose={() => setShowInspector(false)}
        />
      )}
    </div>
  )
}
