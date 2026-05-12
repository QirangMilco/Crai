import { useEffect, useRef, useCallback, useState } from 'react'
import type { ServerMsg, ClientMsg } from '../types/messages'

export interface UseWebSocketOptions {
  url: string
  /** 收到任何消息时的通用回调（用于自定义处理）。 */
  onMessage?: (raw: string) => void
  /** 事件类型消息回调。 */
  onEvent?: (event: string, payload: unknown) => void
  /** session:id 消息回调。 */
  onSessionId?: (id: string) => void
  /** request:input 消息回调。 */
  onRequestInput?: (id: string, question: string, options?: string[]) => void
  /** error 消息回调。 */
  onError?: (msg: string) => void
}

export interface UseWebSocketReturn {
  status: 'connecting' | 'connected' | 'disconnected'
  send: (msg: any) => void
  wsRef: React.MutableRefObject<WebSocket | null>
}

export function useWebSocket({
  url,
  onMessage,
  onEvent,
  onSessionId,
  onRequestInput,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setStatus('connected')
    ws.onclose = () => setStatus('disconnected')
    ws.onerror = () => {}

    ws.onmessage = (event) => {
      const raw = String(event.data)
      // 先调通用回调
      onMessage?.(raw)

      let msg: ServerMsg
      try { msg = JSON.parse(raw) as ServerMsg } catch { return }

      switch (msg.type) {
        case 'event':
          onEvent?.(msg.event, msg.payload)
          break
        case 'session:id':
          onSessionId?.(msg.id)
          break
        case 'request:input':
          onRequestInput?.(msg.id, msg.question, msg.options)
          break
        case 'error':
          onError?.(msg.message)
          break
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [url])

  const send = useCallback((msg: any) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  return { status, send, wsRef }
}
