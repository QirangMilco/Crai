/**
 * cn — 合并 className 的工具函数。
 *
 * 用法：
 *   cn('base-class', condition && 'conditional-class', className)
 *
 * 基于 classnames，类型安全，Tree-shakeable。
 */
import classnames from 'classnames'

export function cn(...args: classnames.ArgumentArray): string {
  return classnames(...args)
}
