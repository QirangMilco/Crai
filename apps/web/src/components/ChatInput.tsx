import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (text: string, model?: string) => void
  disabled?: boolean
  className?: string
  /** 可用模型列表 */
  models?: Array<{ name: string; provider: string }>
  /** 当前选中的模型 */
  currentModel?: string
  /** 切换模型 */
  onModelChange?: (model: string) => void
}

export function ChatInput({ onSend, disabled, className = '', models, currentModel, onModelChange }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--crai-input-max-height').trim() || '120', 10,
    )
    if (el.scrollHeight > maxH) {
      el.style.height = maxH + 'px'
      el.style.overflowY = 'auto'
    } else {
      el.style.height = el.scrollHeight + 'px'
      el.style.overflowY = 'hidden'
    }
  }, [text])

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, currentModel)
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 中文输入法组合进行时跳过回车提交
    if ((e.nativeEvent as any).isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={`mx-auto py-3 ${className}`}
      data-token-group="layout"
      style={{
        maxWidth: 'var(--crai-chat-max-width)',
        width: '100%',
        paddingLeft: 'var(--crai-chat-padding)',
        paddingRight: 'var(--crai-chat-padding)',
      }}>
      <div
        data-token-group="input-box"
        style={{
          backgroundColor: 'var(--crai-input-bg)',
          border: 'var(--crai-input-border-width, 1px) solid var(--crai-input-border)',
          borderRadius: 'var(--crai-input-radius)',
          minHeight: 'var(--crai-input-min-height, 44px)',
          boxShadow: 'var(--crai-shadow-input)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--crai-input-gap, 4px)',
        }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息…"
          rows={1}
          data-token-group="input-field"
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: 'transparent',
            color: 'var(--crai-fg)',
            fontSize: 'var(--crai-input-font-size)',
            lineHeight: 'var(--crai-input-line-height)',
            border: 'none',
            borderRadius: 0,
            outline: 'none',
            resize: 'none',
            boxSizing: 'border-box',
            padding: '12px var(--crai-input-padding-x, 16px) 0',
            maxHeight: 'calc(var(--crai-input-max-height, 120px))',
            overflowY: 'hidden',
          }}
        />
        <div
          data-token-group="input-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 12px 8px',
            height: 'var(--crai-btn-height, 32px)',
          }}>
          {models && models.length > 0 && (
            <select
              value={currentModel ?? ''}
              onChange={(e) => onModelChange?.(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--crai-fg-secondary)',
                fontSize: 12,
                border: '1px solid var(--crai-border)',
                borderRadius: 'var(--crai-btn-radius, 8px)',
                padding: '0 8px',
                height: 'var(--crai-btn-height, 32px)',
                maxWidth: 180,
                outline: 'none',
                cursor: 'pointer',
              }}>
              {models.map((m) => (
                <option key={`${m.provider}:${m.name}`} value={m.name}>
                  {m.provider}/{m.name.length > 20 ? m.name.slice(0, 20) + '…' : m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="crai-send-btn"
            style={{
              backgroundColor: 'var(--crai-accent)',
              borderRadius: 'var(--crai-btn-radius, 8px)',
              height: 'var(--crai-btn-height, 32px)',
              fontSize: 'var(--crai-btn-font-size, 13px)',
              lineHeight: 'var(--crai-btn-height, 32px)',
              padding: '0 20px',
              fontWeight: 500,
              color: 'var(--crai-btn-color)',
              opacity: disabled || !text.trim() ? 0.4 : 1,
              border: 'none',
              cursor: disabled || !text.trim() ? 'default' : 'pointer',
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
