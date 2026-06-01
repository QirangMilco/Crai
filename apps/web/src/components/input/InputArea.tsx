/**
 * InputArea — 可自动缩放的 textarea，支持 Enter 发送、Shift+Enter 换行，
 * 以及按 sessionId 的草稿持久化（sessionStorage）。
 *
 * 草稿 key: chat-draft-{sessionId}
 * - 每次输入变化自动保存
 * - 切换 sessionId 时保存旧会话草稿、加载新会话草稿
 * - 发送成功后清除当前草稿
 *
 * 通过 ref 暴露 submit() 方法，供父组件（发送按钮）调用。
 */
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface InputAreaHandle {
  submit: () => void
}

interface InputAreaProps {
  onSend: (text: string) => void
  disabled?: boolean
  sessionId?: string
  placeholder?: string
}

export const InputArea = forwardRef<InputAreaHandle, InputAreaProps>(
  function InputArea({ onSend, disabled, sessionId, placeholder = '输入消息…' }, ref) {
    const [text, setText] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    // ref 同步 text，用于在 sessionId 变化时读取当前值
    const textRef = useRef(text)
    textRef.current = text

    // 追踪上一次的 sessionId，用于切换时保存旧草稿
    const prevSessionIdRef = useRef(sessionId)

    // ── 草稿：加载 / 切换 ──
    useEffect(() => {
      const prev = prevSessionIdRef.current

      // 保存旧会话的草稿（仅在 sessionId 确实变化时）
      if (prev !== undefined && prev !== sessionId && prev) {
        const oldDraft = textRef.current
        if (oldDraft) {
          sessionStorage.setItem(`chat-draft-${prev}`, oldDraft)
        } else {
          sessionStorage.removeItem(`chat-draft-${prev}`)
        }
      }
      prevSessionIdRef.current = sessionId

      // 加载新会话的草稿
      if (sessionId) {
        const saved = sessionStorage.getItem(`chat-draft-${sessionId}`)
        setText(saved ?? '')
      } else {
        setText('')
      }
    }, [sessionId])

    // ── 草稿：输入时自动保存 ──
    useEffect(() => {
      if (!sessionId) return
      if (text) {
        sessionStorage.setItem(`chat-draft-${sessionId}`, text)
      } else {
        sessionStorage.removeItem(`chat-draft-${sessionId}`)
      }
    }, [text, sessionId])

    // ── 自动缩放 ──
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
      onSend(trimmed)
      setText('')
      // 发送成功后清除草稿
      if (sessionId) {
        sessionStorage.removeItem(`chat-draft-${sessionId}`)
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if ((e.nativeEvent as any).isComposing) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    // 暴露 submit 方法给父组件
    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [text, disabled, sessionId, onSend])

    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
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
    )
  },
)
