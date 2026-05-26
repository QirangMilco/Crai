/**
 * Button — 通用按钮原语。
 *
 * 支持 variant / size / icon 前置图标 / className forwarding。
 * 视觉属性（颜色、字号、圆角）通过 CSS 变量控制，Inspector 可实时调整。
 *
 * 用法：
 *   <Button>发送</Button>
 *   <Button variant="secondary" icon={<Icon icon={Settings} />}>配置</Button>
 *   <Button variant="ghost" size="sm" className="ml-auto" />
 */
import { cn } from './cn'
import type { LucideProps } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'text-white font-medium ' +
    'bg-[var(--crai-accent)] ' +
    'hover:opacity-90 ' +
    'disabled:opacity-40 disabled:cursor-default',
  secondary:
    'text-[var(--crai-fg-secondary)] font-medium ' +
    'bg-[var(--crai-bg-tertiary)] ' +
    'hover:bg-[var(--crai-border)] ' +
    'disabled:opacity-40 disabled:cursor-default',
  ghost:
    'text-[var(--crai-fg-secondary)] ' +
    'hover:text-[var(--crai-fg)] hover:bg-[var(--crai-bg-tertiary)] ' +
    'disabled:opacity-30 disabled:cursor-default',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2 py-1 rounded',
  md: 'text-sm px-3 py-1.5 rounded-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 transition-all duration-150 select-none',
        variantStyles[variant],
        sizeStyles[size],
        (loading || disabled) && 'opacity-40 cursor-default pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="shrink-0 animate-spin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </span>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
