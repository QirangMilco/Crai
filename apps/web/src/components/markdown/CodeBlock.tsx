/**
 * CodeBlock — Shiki 语法高亮 + 复制按钮。
 *
 * 在组件初始化时创建 Shiki highlighter，缓存高亮结果避免重复计算。
 */
import { useCallback, useRef, useState, useEffect } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'

const COMMON_LANGS = [
  'javascript', 'typescript', 'python', 'json', 'bash', 'shell',
  'markdown', 'html', 'css', 'sql', 'yaml', 'go', 'rust', 'java',
  'c', 'cpp', 'tsx', 'jsx', 'swift', 'ruby', 'php',
]

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: COMMON_LANGS,
    })
  }
  return highlighterPromise
}

// LRU 缓存
const cache = new Map<string, string>()
const CACHE_MAX = 200

function cachedHighlight(highlighter: Highlighter, code: string, lang: string, isDark: boolean): string {
  const key = `${isDark ? 'dark' : 'light'}:${lang}:${code}`
  const cached = cache.get(key)
  if (cached) return cached

  const html = highlighter.codeToHtml(code, {
    lang,
    theme: isDark ? 'github-dark' : 'github-light',
  })

  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, html)
  return html
}

interface Props {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: Props) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  useEffect(() => {
    getHighlighter()
      .then(setHighlighter)
      .catch(() => setError('highlighter failed'))
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  const lang = language === '' ? 'text' : (language || 'text')
  let html: string | null = null
  if (highlighter) {
    try {
      html = cachedHighlight(highlighter, code, lang, isDark)
    } catch {
      html = `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`
    }
  }

  return (
    <div className="relative group my-3 overflow-hidden"
      style={{ border: '1px solid var(--crai-md-code-border)', borderRadius: 'var(--crai-md-code-radius, 8px)' }}>
      {html ? (
        <div className="overflow-x-auto text-sm leading-relaxed"
          style={{ backgroundColor: 'var(--crai-md-code-bg)', fontSize: 'var(--crai-md-code-font-size)' }}
          dangerouslySetInnerHTML={{ __html: html }} />
      ) : error ? (
        <pre className="p-3 text-sm overflow-x-auto" style={{ backgroundColor: 'var(--crai-md-code-bg)', color: 'var(--crai-fg)' }}><code>{code}</code></pre>
      ) : (
        <pre className="p-3 text-sm overflow-x-auto" style={{ backgroundColor: 'var(--crai-md-code-bg)', color: 'var(--crai-fg-tertiary)' }}><code>加载中…</code></pre>
      )}
      <button onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px]"
        style={{ backgroundColor: 'var(--crai-bg)', color: 'var(--crai-fg-secondary)', border: '1px solid var(--crai-border)' }}>
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
