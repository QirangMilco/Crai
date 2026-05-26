/**
 * design.md 解析/生成工具。
 *
 * 将 Crai 的 token 系统与 Design/design.md 文件格式互相转换，
 * 支持：
 *   1. parseDesignMd(mdContent) → 读取 design.md 返回 token 覆盖表
 *   2. generateDesignMd(tokens) → 从当前 token 导出 design.md 文本
 *
 * design.md 格式标准（参考 Design/apple-design.md）：
 *   ## Tokens — Colors
 *   | Name | Value | Token | Role |
 *   |------|-------|-------|------|
 *   | Ink | #1d1d1f | --color-ink | Primary text |
 *
 *   ## Tokens — Typography
 *   (字号、字体 token)
 *
 *   ## Tokens — Spacing & Shapes
 *   (间距、圆角 token)
 */

import { TOKENS, getRawToken, type TokenDef } from './tokens'

// ── 解析 ───────────────────────────────────────────────

/**
 * 从 design.md 文本中解析 token 值。
 * 返回 { tokenName: value } 的映射表，
 * tokenName 为完整的 CSS 变量名（如 '--crai-bg'）。
 */
export function parseDesignMd(mdContent: string): Record<string, string> {
  const result: Record<string, string> = {}

  // 匹配所有 Markdown 表格行
  const tableRowRegex = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm
  let match: RegExpExecArray | null

  while ((match = tableRowRegex.exec(mdContent)) !== null) {
    const name = match[1].trim()   // 显示名（如 Ink）
    const value = match[2].trim()  // 值（如 #1d1d1f）
    const token = match[3].trim()  // token 名（如 --color-ink）

    // 跳过表头行
    if (name === 'Name' || name === '------' || name.startsWith('---')) continue
    if (!value || value === 'Value' || value.startsWith('---')) continue

    // 尝试将 design.md 的 token 名映射到 Crai 的 CSS 变量名
    const craiName = mapToCraiToken(token, name)
    if (craiName && !result[craiName]) {
      result[craiName] = value
    }
  }

  return result
}

/**
 * 将 design.md 中的 token 名映射到 Crai 的 --crai-* 变量名。
 * design.md 的 token 名可能是 --color-ink、--radius-cards 等形式，
 * 需要映射到 --crai-bg、--crai-radius-lg 等。
 */
function mapToCraiToken(token: string, displayName: string): string | null {
  const tokenLower = token.toLowerCase()
  const nameLower = displayName.toLowerCase()

  // 直接匹配 --crai- 开头的 token
  if (tokenLower.startsWith('--crai-')) return tokenLower

  // 颜色映射
  const colorMap: Record<string, string> = {
    'background': '--crai-bg',
    'canvas': '--crai-bg',
    'page': '--crai-bg',
    'ink': '--crai-fg',
    'foreground': '--crai-fg',
    'text': '--crai-fg',
    'accent': '--crai-accent',
    'primary': '--crai-accent',
    'success': '--crai-success',
    'destructive': '--crai-destructive',
    'error': '--crai-destructive',
    'danger': '--crai-destructive',
    'border': '--crai-border',
    'divider': '--crai-border',
    'card': '--crai-bg',        // 卡片背景 → bg（表面靠亮度区分）
  }

  for (const [key, craiName] of Object.entries(colorMap)) {
    if (nameLower.includes(key) || tokenLower.includes(key)) return craiName
  }

  // 圆角映射
  if (tokenLower.includes('radius') || nameLower.includes('圆角') || nameLower.includes('radius')) {
    if (nameLower.includes('card') || nameLower.includes('大')) return '--crai-radius-lg'
    if (nameLower.includes('button') || nameLower.includes('pill') || nameLower.includes('药丸')) return '--crai-radius-pill'
    if (nameLower.includes('small') || nameLower.includes('小')) return '--crai-radius-sm'
    return '--crai-radius'
  }

  // 间距映射
  if (tokenLower.includes('spacing') || nameLower.includes('间距')) {
    // 尝试提取数值
    const numMatch = nameLower.match(/(\d+)/)
    if (numMatch) {
      const px = parseInt(numMatch[1], 10)
      if (px <= 4) return '--crai-space-xs'
      if (px <= 8) return '--crai-space-sm'
      if (px <= 12) return '--crai-space-md'
      if (px <= 16) return '--crai-space-lg'
      if (px <= 24) return '--crai-space-xl'
      if (px <= 40) return '--crai-space-2xl'
      return '--crai-space-3xl'
    }
    return '--crai-spacing'
  }

  return null
}

// ── 生成 ───────────────────────────────────────────────

/**
 * 从当前 token 值生成 design.md 文本。
 * tokens 参数为 { '--crai-bg': '#ffffff' } 格式。
 * 不传时使用当前 document 的计算值。
 */
export function generateDesignMd(
  title: string,
  description: string,
  tokens: Record<string, string> = {},
): string {
  const getVal = (name: string): string => {
    if (tokens[name]) return tokens[name]
    try { return getRawToken(name) || '' } catch { return '' }
  }

  const lines: string[] = []
  lines.push(`# ${title} — Style Reference`)
  if (description) lines.push(`> ${description}`)
  lines.push('')

  // ── Colors ──
  const colorTokens = TOKENS.filter(t => t.type === 'color' || t.name.includes('rgb'))
  if (colorTokens.length > 0) {
    lines.push('## Tokens — Colors')
    lines.push('| Name | Value | Token | Role |')
    lines.push('|------|-------|-------|------|')
    for (const t of colorTokens) {
      const val = getVal(t.name)
      if (val) {
        lines.push(`| ${t.label} | ${val} | ${t.name} | ${t.description || ''} |`)
      }
    }
    lines.push('')
  }

  // ── Typography ──
  const fontTokens = TOKENS.filter(t => t.group === 'font-size')
  if (fontTokens.length > 0) {
    lines.push('## Tokens — Typography')
    lines.push('')
    lines.push('### Font Stacks')
    for (const t of fontTokens.filter(t => t.label.includes('字体') || t.name.includes('font-s'))) {
      const val = getVal(t.name)
      if (val) lines.push(`- **${t.label}**: ${val}`)
    }
    lines.push('')
    lines.push('### Type Scale')
    lines.push('| Role | Size | Token |')
    lines.push('|------|------|-------|')
    for (const t of fontTokens.filter(t => !t.label.includes('字体') && !t.name.includes('font-s'))) {
      const val = getVal(t.name)
      if (val) lines.push(`| ${t.label} | ${val} | ${t.name} |`)
    }
    lines.push('')
  }

  // ── Spacing & Shapes ──
  const spacingTokens = TOKENS.filter(t => t.group === 'spacing' || t.group === 'radius')
  const shapeLines: string[] = []
  for (const t of spacingTokens) {
    const val = getVal(t.name)
    if (val) shapeLines.push(`| ${t.label} | ${val} | ${t.name} |`)
  }
  if (shapeLines.length > 0) {
    lines.push('## Tokens — Spacing & Shapes')
    lines.push('')
    if (getVal('--crai-spacing')) lines.push(`Base unit: ${getVal('--crai-spacing')}`)
    lines.push('')
    lines.push('### Spacing Scale')
    lines.push('| Name | Value | Token |')
    lines.push('|------|-------|-------|')
    for (const t of TOKENS.filter(t => t.group === 'spacing')) {
      const val = getVal(t.name)
      if (val) lines.push(`| ${t.label} | ${val} | ${t.name} |`)
    }
    lines.push('')
    lines.push('### Border Radius')
    lines.push('| Element | Value | Token |')
    lines.push('|---------|-------|-------|')
    for (const t of TOKENS.filter(t => t.group === 'radius')) {
      const val = getVal(t.name)
      if (val) lines.push(`| ${t.label} | ${val} | ${t.name} |`)
    }
    lines.push('')
  }

  // ── Z-Index ──
  const zTokens = TOKENS.filter(t => t.group === 'z-index')
  if (zTokens.length > 0) {
    lines.push('### Z-Index Layers')
    lines.push('| Name | Value | Token |')
    lines.push('|------|-------|-------|')
    for (const t of zTokens) {
      const val = getVal(t.name)
      if (val) lines.push(`| ${t.label} | ${val} | ${t.name} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
