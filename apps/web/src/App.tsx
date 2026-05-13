import { useState, useEffect } from 'react'
import { ChatView } from './components/ChatView'
import { applyTokens } from './theme/tokens'

export default function App() {
  useEffect(() => { applyTokens() }, [])
  const [wsUrl, setWsUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    // URL 参数优先；没有参数时自动推断同机地址
    return params.get('ws') || `ws://${window.location.hostname}:8080`
  })
  const [connected, setConnected] = useState(false)

  if (!connected) {
    return (
      <div
        className="h-dvh flex items-center justify-center flex-col gap-6 px-4"
        style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg)' }}
      >
        <div className="text-3xl font-bold" style={{ color: 'var(--crai-accent)' }}>Crai</div>
        <p className="text-sm" style={{ color: 'var(--crai-fg-secondary)' }}>
          连接到 Crai Runtime
        </p>
        <div className="flex gap-2">
          <input
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8080"
            className="px-4 py-2 rounded-lg text-sm w-64 outline-none"
            style={{
              backgroundColor: 'var(--crai-bg-secondary)',
              color: 'var(--crai-fg)',
              border: '1px solid var(--crai-border)',
            }}
          />
          <button
            onClick={() => setConnected(true)}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--crai-accent)' }}
          >
            连接
          </button>
        </div>
      </div>
    )
  }

  return <ChatView wsUrl={wsUrl} />
}
