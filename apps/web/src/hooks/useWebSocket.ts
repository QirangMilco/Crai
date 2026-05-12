import { useEffect, useRef, useCallback, useState } from 'react'
import type { ServerMsg, ClientMsg } from '../types/messages'

export interface UseWebSocketOptions {
  url: string
  onEvent?: (event: string, payload: unknown) => void
  onSessionId?: (id: string) => void
  onRequestInput?: (id: string, question: string, options?: string[]) => void
  onError?: (msg: string) => void
}

export interface UseWebSocketReturn {
  /** 连接状态。 */
  status: 'connecting' | 'connected' | 'disconnected'
  /** 发送消息给 runtime。 */
  send: (msg: ClientMsg) => void
  /** 连接引用（用于读取 readyState 等）。 */
  wsRef: React.MutableRefObject<WebSocket | null>
}

export function useWebSocket({
  url,
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

    ws.onerror = () => {
      // onclose 会随后触发，不清除状态
    }

    ws.onmessage = (event) => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(event.data) as ServerMsg
      } catch {
        return
      }

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

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  return { status, send, wsRef }
}
