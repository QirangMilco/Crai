import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  onSend: (text: string, model?: string) => void
  disabled?: boolean
  className?: string
  models?: Array<{ name: string; provider: string }>
  currentModel?: string
  onModelChange?: (model: string) => void
  thinkingLevel?: string
  onThinkingLevelChange?: (level: string) => void
  sessionMode?: string
  onModeChange?: (mode: string) => void
  /**
   * 当前 provider 配置的思考深度列表（来自 ProviderConfig.thinkingLevels）。
   * key 为思考深度值（如 "off" / "high" / "max"），value 为显示名称。
   * 优先级高于内部 hardcoded 映射。
   */
  providerThinkingLevels?: Record<string, string>
  /** 各 provider 默认思考深度。provider → level。 */
  defaultThinkingLevels?: Record<string, string>
}

const THINKING_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'off', label: '关' },
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最高' },
  { value: 'xhigh', label: '极高' },
]

/**
 * 各 provider 默认支持的思考深度。
 * 与 @crai/core/known-models.ts 的 PROVIDER_DEFAULT_THINKING_LEVELS 同步。
 */
const PROVIDER_THINKING_LEVELS: Record<string, string[]> = {
  deepseek:  ['off', 'high', 'max'],
  openai:    ['off', 'low', 'medium', 'high'],
  anthropic: ['off', 'high', 'xhigh'],
  mock:      ['off', 'auto', 'low', 'medium', 'high', 'xhigh'],
}

const ALL_THINKING_LEVEL_VALUES = THINKING_LEVELS.map((tl) => tl.value)

function getAvailableThinkingLevels(provider: string, configLevels?: Record<string, string>): Array<{ value: string; label: string }> {
  if (configLevels) {
    // 保留 config 中的顺序
    return Object.entries(configLevels).map(([value, label]) => ({ value, label }))
  }
  const levels = PROVIDER_THINKING_LEVELS[provider] ?? ALL_THINKING_LEVEL_VALUES
  return THINKING_LEVELS.filter((tl) => levels.includes(tl.value))
}

const LEVEL_LABEL_MAP = Object.fromEntries(THINKING_LEVELS.map((tl) => [tl.value, tl.label]))

const SESSION_MODES: Array<{ value: string; label: string }> = [
  { value: 'execute', label: '操作' },
  { value: 'ask', label: '询问' },
  { value: 'safe', label: '只读' },
]

export function ChatInput({ onSend, disabled, className = '', models, currentModel, onModelChange, thinkingLevel, onThinkingLevelChange, sessionMode, onModeChange, providerThinkingLevels, defaultThinkingLevels }: Props) {
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
        {/* 工具栏：思考深度 + 模式 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px',
            minHeight: 28,
          }}>
          {/* 思考深度 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--crai-fg-tertiary)', whiteSpace: 'nowrap' }}>思考</span>
            {(() => {
              // 根据当前模型获取可用的思考深度
              const curProvider = models?.find((m) => m.name === currentModel)?.provider ?? ''
              const availableLevels = getAvailableThinkingLevels(curProvider, providerThinkingLevels)
              // 当前 thinkingLevel 不在可用列表中时，使用该 provider 的默认思考深度
              const fallbackLevel = (curProvider && defaultThinkingLevels?.[curProvider]) ?? availableLevels[0]?.value ?? 'off'
              const effectiveLevel = availableLevels.some((l) => l.value === thinkingLevel) ? thinkingLevel : fallbackLevel
              // 同步：回传有效值到父组件
              if (effectiveLevel !== thinkingLevel) {
                queueMicrotask(() => onThinkingLevelChange?.(effectiveLevel))
              }
              return availableLevels.map((tl) => (
                <button
                  key={tl.value}
                  onClick={() => onThinkingLevelChange?.(tl.value)}
                  style={{
                    fontSize: 11,
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: effectiveLevel === tl.value ? 'var(--crai-accent)' : 'transparent',
                    color: effectiveLevel === tl.value ? '#fff' : 'var(--crai-fg-tertiary)',
                    fontWeight: effectiveLevel === tl.value ? 600 : 400,
                  }}>
                  {tl.label}
                </button>
              ))
            })()}
          </div>
          {/* 分隔线 */}
          <span style={{ width: 1, height: 14, backgroundColor: 'var(--crai-border)', margin: '0 6px' }} />
          {/* 模式 */}
          {SESSION_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange?.(m.value)}
              style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: sessionMode === m.value ? 'var(--crai-accent)' : 'transparent',
                color: sessionMode === m.value ? '#fff' : 'var(--crai-fg-tertiary)',
                fontWeight: sessionMode === m.value ? 600 : 400,
              }}>
              {m.label}
            </button>
          ))}
        </div>
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
