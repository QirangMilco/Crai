import { useState, useRef, useEffect, useMemo } from 'react'
import { Send } from 'lucide-react'
import { Icon, Select } from './ui'
import { useChatStore } from '../store/chat'
import { TodoBar } from './TodoDisplay'

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
  providerThinkingLevels?: Record<string, string>
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

const PROVIDER_THINKING_LEVELS: Record<string, string[]> = {
  deepseek:  ['off', 'high', 'max'],
  openai:    ['off', 'low', 'medium', 'high'],
  anthropic: ['off', 'high', 'xhigh'],
  mock:      ['off', 'auto', 'low', 'medium', 'high', 'xhigh'],
}

const ALL_THINKING_LEVEL_VALUES = THINKING_LEVELS.map((tl) => tl.value)

function getAvailableThinkingLevels(provider: string, configLevels?: Record<string, string>): Array<{ value: string; label: string }> {
  if (configLevels) {
    return Object.entries(configLevels).map(([value, label]) => ({ value, label }))
  }
  const levels = PROVIDER_THINKING_LEVELS[provider] ?? ALL_THINKING_LEVEL_VALUES
  return THINKING_LEVELS.filter((tl) => levels.includes(tl.value))
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  execute: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
  ask: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" /><path d="M12 17h.01" /></svg>,
  safe: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  plan: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
}

const SESSION_MODES = [
  { value: 'execute', label: '操作' },
  { value: 'ask', label: '询问' },
  { value: 'safe', label: '只读' },
  { value: 'plan', label: '计划' },
]

// ── 模式下拉按钮（类 pure-html 风格） ──

function ModeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = SESSION_MODES.find((m) => m.value === value)
  const label = current?.label ?? '模式'

  function toggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 200)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
        style={{ color: 'var(--crai-fg)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {MODE_ICONS[value]}
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div
          className={`absolute z-50 py-1 rounded-lg shadow-lg overflow-hidden ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ minWidth: 130, left: 0, backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}
        >
          {SESSION_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => { onChange(m.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
              style={{ color: m.value === value ? 'var(--crai-accent)' : 'var(--crai-fg)', fontWeight: m.value === value ? 500 : 400, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {MODE_ICONS[m.value]}
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 模型下拉（按钮只显示模型名，下拉按 provider 分组） ──

function ModelDropdown({ models, value, onChange }: { models: Array<{ name: string; provider: string }>; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = models.find((m) => m.name === value)

  const grouped = useMemo(() => {
    const groups: Record<string, typeof models> = {}
    for (const m of models) {
      const key = m.provider || ''
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
    return groups
  }, [models])

  const providerKeys = Object.keys(grouped)
  const multiProvider = providerKeys.length > 1

  function toggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpenUp(window.innerHeight - rect.bottom < 200)
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={toggle}
        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
        style={{ color: 'var(--crai-fg)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <span className="max-w-[100px] truncate">{current?.name ?? '选择模型'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div
          className={`absolute z-50 py-1 rounded-lg shadow-lg overflow-hidden ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ minWidth: 180, right: 0, backgroundColor: 'var(--crai-bg)', border: '1px solid var(--crai-border)', boxShadow: 'var(--crai-shadow-modal)' }}
        >
          {providerKeys.map((provider) => (
            <div key={provider}>
              {multiProvider && (
                <div className="px-3 py-1 text-[10px] font-medium" style={{ color: 'var(--crai-fg-40)' }}>
                  {provider || '—'}
                </div>
              )}
              {grouped[provider].map((m) => (
                <button
                  key={`${m.provider}/${m.name}`}
                  onClick={() => { onChange(m.name); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 hover:bg-[var(--crai-bg-5)]"
                  style={{ color: m.name === value ? 'var(--crai-accent)' : 'var(--crai-fg)', fontWeight: m.name === value ? 500 : 400, backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChatInput({ onSend, disabled, className = '', models, currentModel, onModelChange, thinkingLevel, onThinkingLevelChange, sessionMode, onModeChange, providerThinkingLevels, defaultThinkingLevels }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        className="transition-all duration-150"
        style={{
          backgroundColor: 'var(--crai-input-bg)',
          border: 'var(--crai-input-border-width, 1px) solid var(--crai-input-border)',
          borderRadius: 'var(--crai-input-radius)',
          minHeight: 'var(--crai-input-min-height, 44px)',
          boxShadow: 'var(--crai-shadow-input)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--crai-input-gap, 4px)',
          overflow: 'visible',
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
            padding: '8px var(--crai-input-padding-x, 14px) 0',
            maxHeight: 'calc(var(--crai-input-max-height, 120px))',
            overflowY: 'hidden',
          }}
        />

        {/* 底部工具栏 */}
        <div
          data-token-group="input-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px 8px',
            minHeight: 28,
          }}
        >
          {/* 左：模式 */}
          <ModeDropdown value={sessionMode ?? 'execute'} onChange={(v) => onModeChange?.(v)} />

          {/* 中：todo 进度 */}
          <div className="flex-1 flex justify-center min-w-0">
            <TodoBar todos={useChatStore((s) => s.todos)} />
          </div>

          {/* 右：模型 + 思考 + 发送 */}
          <div className="flex items-center gap-1 shrink-0">
            {models && models.length > 0 && (
              <ModelDropdown
                models={models}
                value={currentModel ?? ''}
                onChange={(v) => onModelChange?.(v)}
              />
            )}
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
                  value={effectiveLevel}
                  onChange={(v) => onThinkingLevelChange?.(v)}
                  options={availableLevels}
                  placeholder="思考"
                  className="shrink-0"
                  style={{ backgroundColor: 'transparent', border: 'none', padding: '2px 4px', maxWidth: 70, minHeight: 0, height: 'auto' }}
                />
              )
            })()}
            <button
              onClick={handleSubmit}
              disabled={disabled || !text.trim()}
              className="crai-send-btn"
              data-token-group="font-size radius input-bar"
              style={{
                backgroundColor: 'var(--crai-accent)',
                borderRadius: 'var(--crai-btn-radius, 8px)',
                width: 28,
                height: 28,
                color: 'var(--crai-btn-color)',
                opacity: disabled || !text.trim() ? 0.4 : 1,
                border: 'none',
                cursor: disabled || !text.trim() ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="发送 (Enter)"
            >
              <Icon icon={Send} size="sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
