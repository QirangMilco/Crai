/**
 * contrast-utils.ts — WCAG 对比度计算和 color-mix 近似值解析。
 *
 * 从 DOM 读取当前 CSS 变量实际值（已由 color-mix 等函数解析），
 * 计算前景/背景组合的对比度并给出 WCAG 评级。
 */

/** sRGB → 线性化 */
function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** 将 CSS 颜色值（如 oklch(...)、#hex、rgba(...)）解析为 sRGB 分量。
 *  利用 canvas 2D 的 getImageData 获取已计算的像素值。 */
function resolveColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255 }
}

/** 计算相对亮度 (WCAG 定义) */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** 计算对比度 (WCAG 2.1) */
export function contrastRatio(color1: string, color2: string): number | null {
  const c1 = resolveColorToRgb(color1)
  const c2 = resolveColorToRgb(color2)
  if (!c1 || !c2) return null

  const l1 = relativeLuminance(c1.r, c1.g, c1.b)
  const l2 = relativeLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG 评级 */
export type WcagLevel = 'AAA' | 'AA' | 'AA-Large' | 'Fail'

export function wcagLevel(ratio: number, isLargeText = false): WcagLevel {
  // 0.05 epsilon 补偿浮点精度（如 4.49999 → 4.5）
  const r = ratio + 0.05
  if (r >= 7) return 'AAA'
  if (r >= 4.5) return 'AA'
  if (isLargeText && r >= 3) return 'AA-Large'
  return 'Fail'
}

/** 从 DOM 获取 CSS 变量的已计算值。 */
export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export interface ContrastPair {
  label: string
  foreground: string
  background: string
  /** 通过 getCssVar 获取变量的已计算值 */
  fgValue: string
  bgValue: string
}

/** 默认需要检查的色值对 */
export const DEFAULT_CONTRAST_PAIRS: ContrastPair[] = [
  { label: '正文/背景', foreground: '--crai-fg', background: '--crai-bg', fgValue: '', bgValue: '' },
  { label: '正文/bg-3', foreground: '--crai-fg', background: '--crai-bg-3', fgValue: '', bgValue: '' },
  { label: '正文/bg-5', foreground: '--crai-fg', background: '--crai-bg-5', fgValue: '', bgValue: '' },
  { label: '正文/bg-8', foreground: '--crai-fg', background: '--crai-bg-8', fgValue: '', bgValue: '' },
  { label: '正文/bg-12', foreground: '--crai-fg', background: '--crai-bg-12', fgValue: '', bgValue: '' },
  { label: '弱正文/背景', foreground: '--crai-fg-40', background: '--crai-bg', fgValue: '', bgValue: '' },
  { label: '弱正文/bg-3', foreground: '--crai-fg-40', background: '--crai-bg-3', fgValue: '', bgValue: '' },
  { label: '强调色/背景', foreground: '--crai-accent', background: '--crai-bg', fgValue: '', bgValue: '' },
  { label: '成功色/背景', foreground: '--crai-success', background: '--crai-bg', fgValue: '', bgValue: '' },
  { label: '错误色/背景', foreground: '--crai-destructive', background: '--crai-bg', fgValue: '', bgValue: '' },
]

export function resolvePairs(pairs: ContrastPair[]): ContrastPair[] {
  return pairs.map((p) => ({
    ...p,
    fgValue: getCssVar(p.foreground),
    bgValue: getCssVar(p.background),
  }))
}
