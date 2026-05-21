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
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 transition-all duration-150 select-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
