/**
 * MermaidBlock — 渲染 Mermaid 图表。
 *
 * 在组件挂载时初始化 mermaid，解析代码并渲染为 SVG。
 */
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  theme: 'default',
  startOnLoad: false,
})

interface Props {
  code: string
}

export function MermaidBlock({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch((err: any) => {
        setError(err.message ?? String(err))
      })
  }, [code])

  if (error) {
    return (
      <pre className="p-3 text-sm overflow-x-auto rounded"
        style={{ backgroundColor: 'var(--crai-md-code-bg)', color: 'var(--crai-destructive)', border: '1px solid var(--crai-md-code-border)' }}>
        <code>{code}</code>
        <div className="text-xs mt-1" style={{ color: 'var(--crai-fg-tertiary)' }}>Mermaid 渲染失败: {error}</div>
      </pre>
    )
  }

  return <div ref={ref} className="my-3 overflow-x-auto" />
}
