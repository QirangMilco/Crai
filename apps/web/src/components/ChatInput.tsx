import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
  className?: string
}

export function ChatInput({ onSend, disabled, className = '' }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
  }, [text])

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={`border-t px-[var(--crai-chat-padding)] py-3 ${className}`}
      style={{ borderColor: 'var(--crai-border)' }}>
      <div
        className="mx-auto flex items-end gap-2"
        style={{ maxWidth: 'var(--crai-chat-max-width)' }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息…"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none outline-none px-4 py-3 text-[length:var(--crai-msg-font-size)] leading-[var(--crai-msg-line-height)]"
          style={{
            backgroundColor: 'var(--crai-input-bg)',
            color: 'var(--crai-fg)',
            borderRadius: 'var(--crai-input-radius)',
            borderColor: 'var(--crai-border)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="shrink-0 px-4 py-3 rounded-[var(--crai-input-radius)] font-medium text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--crai-accent)' }}
        >
          发送
        </button>
      </div>
    </div>
  )
}
