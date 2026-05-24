import { useState, useRef, useEffect } from 'react'
import { Send, Brain, Bot, Zap, HelpCircle, Shield } from 'lucide-react'
import { Icon, Select } from './ui'

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

const SESSION_MODES = [
  { value: 'execute', label: '操作', icon: Zap, iconColor: 'var(--crai-accent)' },
  { value: 'ask', label: '询问', icon: HelpCircle, iconColor: 'var(--crai-fg-60)' },
  { value: 'safe', label: '只读', icon: Shield, iconColor: 'var(--crai-success)' },
  { value: 'plan', label: '计划', icon: Bot, iconColor: 'var(--crai-fg-60)' },
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
        {/* 底部工具栏：模式 · 思考 · 模型 · 发送 */}
        <div
          data-token-group="input-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            padding: '0 12px 8px',
            minHeight: 28,
          }}>
          {/* 左侧：模式 */}
          <Select
            value={sessionMode ?? 'execute'}
            onChange={(v) => onModeChange?.(v)}
            options={SESSION_MODES}
            placeholder="模式"
            className="shrink-0"
            style={{ padding: '2px 6px', maxWidth: 90 }}
          />
          {/* 右侧：思考 + 模型 + 发送 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            {(() => {
              const curProvider = models?.find((m) => m.name === currentModel)?.provider ?? ''
              const availableLevels = getAvailableThinkingLevels(curProvider, providerThinkingLevels)
              const fallbackLevel = (curProvider && defaultThinkingLevels?.[curProvider]) ?? availableLevels[0]?.value ?? 'off'
              const effectiveLevel = availableLevels.some((l) => l.value === thinkingLevel) ? thinkingLevel : fallbackLevel
              if (effectiveLevel !== thinkingLevel) {
                queueMicrotask(() => onThinkingLevelChange?.(effectiveLevel))
              }
              return (
                <Select
                  icon={Brain}
                  value={effectiveLevel}
                  onChange={(v) => onThinkingLevelChange?.(v)}
                  options={availableLevels}
                  placeholder="思考"
                  className="shrink-0"
                  style={{ padding: '2px 6px', maxWidth: 80 }}
                />
              )
            })()}
            {models && models.length > 0 && (
              <Select
                icon={Bot}
                value={currentModel ?? ''}
                onChange={(v) => onModelChange?.(v)}
                options={models.map((m) => ({
                  value: m.name,
                  label: `${m.provider}/${m.name}`,
                }))}
                placeholder="选择模型"
                className="shrink-0"
                style={{ padding: '2px 6px', maxWidth: 160 }}
              />
            )}
            <button
              onClick={handleSubmit}
              disabled={disabled || !text.trim()}
              className="crai-send-btn"
              data-token-group="font-size radius input-bar"
              style={{
                backgroundColor: 'var(--crai-accent)',
                borderRadius: 'var(--crai-btn-radius, 8px)',
                height: 28,
                fontSize: 'var(--crai-btn-font-size, 12px)',
                padding: '0 14px',
                fontWeight: 500,
                color: 'var(--crai-btn-color)',
                opacity: disabled || !text.trim() ? 0.4 : 1,
                border: 'none',
                cursor: disabled || !text.trim() ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon icon={Send} size="sm" /> 发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
