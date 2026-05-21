/**
 * Icon — lucide-react 包装组件。
 *
 * 统一 size 和 strokeWidth，外部可通过 className 覆写样式。
 *
 * 用法：
 *   <Icon icon={CheckCircle2} />
 *   <Icon icon={XCircle} size="md" />
 *   <Icon icon={ChevronRight} className="rotate-90" />
 */
import type { LucideIcon, LucideProps } from 'lucide-react'

interface IconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const SIZE_MAP: Record<string, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
}

export function Icon({ icon: LucideIconComponent, size = 'md', strokeWidth = 1.5, className, ...rest }: IconProps) {
  return (
    <LucideIconComponent
      size={SIZE_MAP[size] ?? SIZE_MAP.md}
      strokeWidth={strokeWidth}
      className={className}
      {...rest}
    />
  )
}
