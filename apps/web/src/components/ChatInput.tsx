import { useRef } from 'react'
import { Send } from 'lucide-react'
import { Icon } from './ui'
import { useChatStore } from '../store/chat'
import { TodoBar } from './TodoDisplay'
import { InputArea, type InputAreaHandle } from './input/InputArea'
import { ModeSelector } from './input/ModeSelector'
import { ModelSelector } from './input/ModelSelector'
import { ThinkingSelector } from './input/ThinkingSelector'

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
  sessionId?: string
  knownModels?: Record<string, Record<string, { displayName?: string; contextWindow?: number; maxOutput?: number; supportedThinkingLevels?: string[] }>>
}

export function ChatInput({
  onSend,
  disabled,
  className = '',
  models,
  currentModel,
  onModelChange,
  thinkingLevel,
  onThinkingLevelChange,
  sessionMode,
  onModeChange,
  sessionId,
  knownModels,
}: Props) {
  const inputRef = useRef<InputAreaHandle>(null)

  function handleInputSend(text: string) {
    onSend(text, currentModel)
  }

  function handleButtonClick() {
    inputRef.current?.submit()
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
        <InputArea
          ref={inputRef}
          onSend={handleInputSend}
          disabled={disabled}
          sessionId={sessionId}
          placeholder="输入消息…"
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
          <ModeSelector value={sessionMode ?? 'execute'} onChange={(v) => onModeChange?.(v)} />

          {/* 中：todo 进度 */}
          <div className="flex-1 flex justify-center min-w-0">
            <TodoBar todos={useChatStore((s) => s.todos)} onAddTodo={() => {
              // 聚焦输入框让用户输入创建待办的指令
              const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]')
              ta?.focus()
            }} />
          </div>

          {/* 右：模型 + 思考 + 发送 */}
          <div className="flex items-center gap-1 shrink-0">
            {models && models.length > 0 && (
              <ModelSelector
                models={models}
                value={currentModel ?? ''}
                onChange={(v) => onModelChange?.(v)}
              />
            )}
            <ThinkingSelector
              currentModel={currentModel}
              models={models}
              thinkingLevel={thinkingLevel}
              onThinkingLevelChange={onThinkingLevelChange}
              knownModels={knownModels}
            />
            <button
              onClick={handleButtonClick}
              disabled={disabled}
              className="crai-send-btn"
              data-token-group="font-size radius input-bar"
              style={{
                backgroundColor: 'var(--crai-accent)',
                borderRadius: 'var(--crai-btn-radius, 8px)',
                width: 28,
                height: 28,
                color: 'var(--crai-btn-color)',
                opacity: disabled ? 0.4 : 1,
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
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
