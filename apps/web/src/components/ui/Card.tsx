/**
 * Card — 通用卡片容器原语。
 *
 * 提供统一的边框、阴影、内边距。视觉属性通过 CSS 变量控制，Inspector 可实时调整。
 * 外部可通过 className 覆写。
 *
 * 用法：
 *   <Card>内容</Card>
 *   <Card className="mt-2">
 *     <Card.Header>标题</Card.Header>
 *     <Card.Body>正文</Card.Body>
 *   </Card>
 */
import { cn } from './cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  /** hover 时是否有视觉反馈 */
  hoverable?: boolean
  onClick?: () => void
}

export function Card({ children, className, hoverable, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden',
        'border',
        'bg-[var(--crai-bg-secondary)]',
        'shadow-[var(--crai-shadow-card)]',
        hoverable && 'cursor-pointer transition-border-color transition-shadow duration-150 hover:border-[var(--crai-border-hover)]',
        className,
      )}
      style={{ borderColor: 'var(--crai-border)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        className,
      )}
      style={{ borderColor: 'var(--crai-border)' }}
    >
      {children}
    </div>
  )
}

Card.Body = function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3', className)}>
      {children}
    </div>
  )
}
