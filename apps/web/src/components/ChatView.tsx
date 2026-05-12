import { useState, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { InspectorPanel } from './InspectorPanel'
import { ConfigPanel } from './ConfigPanel'
import type { ChatMessage, ClientMsg } from '../types/messages'

interface Props {
  wsUrl: string
}

export function ChatView({ wsUrl }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showInspector, setShowInspector] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [dark, setDark] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)

  const handleWsMessage = useCallback((raw: string) => {
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {
      case 'event': {
        if (msg.event === 'model.delta' && typeof msg.payload?.delta === 'string') {
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant' ? { ...m, text: m.text + msg.payload.delta } : m,
          ))
        }
        if (msg.event === 'model.completed' && msg.payload?.response?.message?.parts) {
          const textParts = msg.payload.response.message.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('')
          if (textParts) {
            setMessages((prev) => prev.map((m, i) =>
              i === prev.length - 1 && m.role === 'assistant' ? { ...m, text: textParts } : m,
            ))
          }
        }
        break
      }
      case 'session:id':
        setSessionId(msg.id)
        break
      case 'request:input': {
        const answer = prompt(msg.question + (msg.options?.length ? `\n选项: ${msg.options.join(', ')}` : ''))
        if (answer !== null) send({ type: 'resolve:input', id: msg.id, value: answer })
        break
      }
      case 'config:data':
        setGlobalConfig(msg.config)
        break
      case 'workspace:switched':
        setCurrentWorkspace(msg.rootDir)
        setSessionId(null)
        setMessages([])
        break
    }
  }, [])

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleWsMessage,
  })

  const handleSend = useCallback((text: string) => {
    const ts = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: `user-${ts}`, role: 'user', text, createdAt: ts },
      { id: `asst-${ts}`, role: 'assistant', text: '', createdAt: ts },
    ])
    send({ type: 'prompt', sessionId: sessionId ?? undefined, text } as ClientMsg)
  }, [sessionId, send])

  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  return (
    <div className="flex h-dvh flex-col" style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}>
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b" style={{ borderColor: 'var(--crai-border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Crai</span>
          <span className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: status === 'connected' ? 'var(--crai-success)' : 'var(--crai-destructive)' }} />
          <span className="text-xs" style={{ color: 'var(--crai-fg-tertiary)' }}>
            {status === 'connected' ? (sessionId ? sessionId.slice(0, 12) : '已连接') : status}
          </span>
          {currentWorkspace && (
            <span className="text-xs ml-2 px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--crai-bg-tertiary)', color: 'var(--crai-fg-tertiary)' }}>
              {currentWorkspace.split('/').pop() || currentWorkspace}
            </span>
          )}
        </div>
        <div className="flex gap-2">
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
      <ChatInput onSend={handleSend} disabled={status !== 'connected'} />

      {showInspector && <InspectorPanel dark={dark} onToggleDark={toggleDark} onClose={() => setShowInspector(false)} />}
      {showConfig && <ConfigPanel config={globalConfig} send={send} onClose={() => setShowConfig(false)} />}
    </div>
  )
}
