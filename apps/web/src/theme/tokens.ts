/**
 * @crai/web/theme — CSS token 注册表。
 *
 * 唯一的事实来源：所有组件的视觉属性都通过 var(--crai-xxx) 引用这里的 token。
 * Inspector 读取注册表自动生成控制面板，新增组件只需在注册表中加一条记录。
 *
 * 使用方式：
 *   const value = getToken('--crai-bg')
 *   setToken('--crai-bg', '#fff')
 *   resetToken('--crai-bg')
 *   resetGroup('message')
 *
 * 不依赖 Node.js 标准库或 backend 包，属于纯前端 UI 逻辑。
 */

export type TokenType = 'color' | 'size' | 'number' | 'select'

export type TokenGroup = 'base' | 'message' | 'markdown' | 'input' | 'layout'

export interface TokenDef {
  /** CSS 变量名（完整名称，含 --crai- 前缀）。 */
  name: string
  /** 显示标签。 */
  label: string
  /** 所属分组。 */
  group: TokenGroup
  /** 值类型。 */
  type: TokenType
  /** 默认值。 */
  defaultValue: string
  /** 可选值列表（select 类型时使用）。 */
  options?: string[]
  /** 滑块最小值（size/number 类型）。 */
  min?: number
  /** 滑块最大值（size/number 类型）。 */
  max?: number
  /** 描述文本。 */
  description?: string
}

export const TOKENS: TokenDef[] = [
  // ═══════════════════════════════════════
  // base — 基础语义色
  // ═══════════════════════════════════════
  { name: '--crai-bg', label: '背景色', group: 'base', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-fg', label: '前景色', group: 'base', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-accent', label: '强调色', group: 'base', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-border', label: '边框色', group: 'base', type: 'color', defaultValue: '#e5e7eb' },
  { name: '--crai-success', label: '成功色', group: 'base', type: 'color', defaultValue: '#22c55e' },
  { name: '--crai-destructive', label: '危险色', group: 'base', type: 'color', defaultValue: '#ef4444' },
  { name: '--crai-bg-secondary', label: '二级背景', group: 'base', type: 'color', defaultValue: '#f9fafb' },
  { name: '--crai-bg-tertiary', label: '三级背景', group: 'base', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-fg-secondary', label: '二级前景', group: 'base', type: 'color', defaultValue: '#6b7280' },
  { name: '--crai-fg-tertiary', label: '三级前景', group: 'base', type: 'color', defaultValue: '#9ca3af' },

  // ═══════════════════════════════════════
  // message — 消息气泡
  // ═══════════════════════════════════════
  { name: '--crai-msg-user-bg', label: '用户消息背景', group: 'message', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-msg-user-fg', label: '用户消息前景', group: 'message', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-msg-user-radius', label: '用户消息圆角', group: 'message', type: 'size', defaultValue: '18px 18px 4px 18px' },
  { name: '--crai-msg-assistant-bg', label: 'AI 消息背景', group: 'message', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-msg-assistant-fg', label: 'AI 消息前景', group: 'message', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-msg-assistant-radius', label: 'AI 消息圆角', group: 'message', type: 'size', defaultValue: '18px 18px 18px 4px' },
  { name: '--crai-msg-max-width', label: '消息最大宽度', group: 'message', type: 'size', defaultValue: '80%' },
  { name: '--crai-msg-font-size', label: '消息字号', group: 'message', type: 'size', defaultValue: '14px' },
  { name: '--crai-msg-line-height', label: '消息行高', group: 'message', type: 'number', defaultValue: '1.6' },

  // ═══════════════════════════════════════
  // markdown — Markdown 渲染
  // ═══════════════════════════════════════
  { name: '--crai-md-code-bg', label: '代码块背景', group: 'markdown', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-code-border', label: '代码块边框', group: 'markdown', type: 'color', defaultValue: '#e9ecef' },
  { name: '--crai-md-code-font-size', label: '代码字号', group: 'markdown', type: 'size', defaultValue: '13px' },
  { name: '--crai-md-code-header-bg', label: '代码块标题背景', group: 'markdown', type: 'color', defaultValue: '#f1f3f5' },
  { name: '--crai-md-code-lang-color', label: '代码语言标签色', group: 'markdown', type: 'color', defaultValue: '#868e96' },
  { name: '--crai-md-table-border', label: '表格边框', group: 'markdown', type: 'color', defaultValue: '#dee2e6' },
  { name: '--crai-md-table-header-bg', label: '表格表头背景', group: 'markdown', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-blockquote-border', label: '引用边框色', group: 'markdown', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-md-blockquote-bg', label: '引用背景', group: 'markdown', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-blockquote-fg', label: '引用前景', group: 'markdown', type: 'color', defaultValue: '#6c757d' },
  { name: '--crai-md-link-color', label: '链接色', group: 'markdown', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-md-inline-code-bg', label: '行内代码背景', group: 'markdown', type: 'color', defaultValue: '#f1f3f5' },
  { name: '--crai-md-heading-weight', label: '标题字重', group: 'markdown', type: 'select', defaultValue: '600', options: ['400', '500', '600', '700', '800'] },
  { name: '--crai-md-heading-color', label: '标题色', group: 'markdown', type: 'color', defaultValue: '#1a1a2e' },

  // ═══════════════════════════════════════
  // input — 输入框
  // ═══════════════════════════════════════
  { name: '--crai-input-bg', label: '输入框背景', group: 'input', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-input-border', label: '输入框边框', group: 'input', type: 'color', defaultValue: '#e5e7eb' },
  { name: '--crai-input-focus-border', label: '输入框聚焦边框', group: 'input', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-input-radius', label: '输入框圆角', group: 'input', type: 'size', defaultValue: '12px' },
  { name: '--crai-input-min-height', label: '输入框最小高度', group: 'input', type: 'size', defaultValue: '44px' },
  { name: '--crai-input-max-height', label: '输入框最大高度', group: 'input', type: 'size', defaultValue: '200px' },

  // ═══════════════════════════════════════
  // layout — 布局
  // ═══════════════════════════════════════
  { name: '--crai-chat-max-width', label: '聊天区最大宽度', group: 'layout', type: 'size', defaultValue: '720px' },
  { name: '--crai-header-height', label: '顶栏高度', group: 'layout', type: 'size', defaultValue: '48px' },
  { name: '--crai-chat-padding', label: '聊天区域边距', group: 'layout', type: 'size', defaultValue: '16px' },
  { name: '--crai-gap', label: '组件间距', group: 'layout', type: 'size', defaultValue: '12px' },
  { name: '--crai-panel-width', label: '面板宽度', group: 'layout', type: 'size', defaultValue: '320px', options: [], min: 200 },
]

/** 按分组归类。 */
export function tokensByGroup(): Record<TokenGroup, TokenDef[]> {
  const groups = {} as Record<TokenGroup, TokenDef[]>
  for (const t of TOKENS) {
    if (!groups[t.group]) groups[t.group] = []
    groups[t.group].push(t)
  }
  return groups
}

/** 应用 token 到 :root。 */
export function applyTokens(overrides?: Record<string, string>): void {
  const root = document.documentElement
  for (const t of TOKENS) {
    const val = overrides?.[t.name] ?? t.defaultValue
    root.style.setProperty(t.name, val)
  }
}

/** 读取 token 值。 */
export function getToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** 设置 token 值。 */
export function setToken(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value)
}

/** 重置 token 为默认值。 */
export function resetToken(name: string): void {
  const def = TOKENS.find((t) => t.name === name)
  if (def) setToken(name, def.defaultValue)
}

/** 重置整个分组的 token。 */
export function resetGroup(group: TokenGroup): void {
  for (const t of TOKENS) {
    if (t.group === group) setToken(t.name, t.defaultValue)
  }
}

/** 重置所有 token。 */
export function resetAll(): void {
  for (const t of TOKENS) setToken(t.name, t.defaultValue)
}

/** 保存当前 token 值到 JSON。 */
export function exportTokens(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const t of TOKENS) {
    result[t.name] = getToken(t.name)
  }
  return result
}

/** 从 JSON 加载 token 值。 */
export function importTokens(data: Record<string, string>): void {
  for (const t of TOKENS) {
    if (data[t.name]) setToken(t.name, data[t.name])
  }
}

// ═══════════════════════════════════════
// 预设配色方案
// ═══════════════════════════════════════

export interface ThemePreset {
  name: string
  description?: string
  tokens: Record<string, string>
}

/** 只存储色值相关的 token（不包含布局、尺寸等）。 */
const COLOR_TOKENS = TOKENS
  .filter((t) => t.type === 'color')
  .map((t) => t.name)

function buildPreset(overrides: Record<string, string>): ThemePreset {
  const tokens: Record<string, string> = {}
  for (const name of COLOR_TOKENS) {
    const def = TOKENS.find((t) => t.name === name)
    tokens[name] = overrides[name] ?? def!.defaultValue
  }
  return { name: '', tokens }
}

/** 预设列表。 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Crai 默认（浅色）',
    tokens: buildPreset({}).tokens,
  },
  {
    name: 'Crai 默认（深色）',
    tokens: buildPreset({
      '--crai-bg': '#0f172a',
      '--crai-bg-secondary': '#1e293b',
      '--crai-bg-tertiary': '#334155',
      '--crai-fg': '#f1f5f9',
      '--crai-fg-secondary': '#94a3b8',
      '--crai-fg-tertiary': '#64748b',
      '--crai-accent': '#818cf8',
      '--crai-border': '#334155',
      '--crai-msg-assistant-bg': '#1e293b',
      '--crai-msg-assistant-fg': '#f1f5f9',
      '--crai-md-code-bg': '#1e293b',
      '--crai-md-code-border': '#334155',
      '--crai-md-table-border': '#334155',
      '--crai-md-table-header-bg': '#1e293b',
      '--crai-md-blockquote-bg': '#1e293b',
      '--crai-md-inline-code-bg': '#334155',
      '--crai-md-heading-color': '#f1f5f9',
      '--crai-input-bg': '#1e293b',
      '--crai-input-border': '#334155',
      '--crai-success': '#22c55e',
      '--crai-destructive': '#ef4444',
    }).tokens,
  },
  {
    name: '极光 (Aurora)',
    description: '冷色调，蓝紫为主',
    tokens: buildPreset({
      '--crai-bg': '#f0f5ff',
      '--crai-bg-secondary': '#e0ecff',
      '--crai-bg-tertiary': '#d0e3ff',
      '--crai-fg': '#1a1a3e',
      '--crai-fg-secondary': '#4a5a7a',
      '--crai-fg-tertiary': '#7a8aaa',
      '--crai-accent': '#6366f1',
      '--crai-border': '#c8d8f0',
      '--crai-msg-user-bg': '#6366f1',
      '--crai-msg-assistant-bg': '#e0ecff',
      '--crai-msg-assistant-fg': '#1a1a3e',
      '--crai-md-code-bg': '#e8f0ff',
      '--crai-md-code-border': '#c8d8f0',
      '--crai-md-blockquote-border': '#6366f1',
      '--crai-md-blockquote-bg': '#e8f0ff',
      '--crai-md-inline-code-bg': '#dce8ff',
      '--crai-md-heading-color': '#1a1a3e',
      '--crai-md-link-color': '#6366f1',
      '--crai-input-bg': '#ffffff',
      '--crai-md-table-header-bg': '#e0ecff',
    }).tokens,
  },
  {
    name: '暖橙 (Warm)',
    description: '暖色调，橙棕为主',
    tokens: buildPreset({
      '--crai-bg': '#fef9f0',
      '--crai-bg-secondary': '#fdf0d8',
      '--crai-bg-tertiary': '#fce8c8',
      '--crai-fg': '#2d1b0e',
      '--crai-fg-secondary': '#6b4c2a',
      '--crai-fg-tertiary': '#a08060',
      '--crai-accent': '#e8590c',
      '--crai-border': '#f0dcc0',
      '--crai-msg-user-bg': '#e8590c',
      '--crai-msg-assistant-bg': '#fdf0d8',
      '--crai-msg-assistant-fg': '#2d1b0e',
      '--crai-md-code-bg': '#fef5e8',
      '--crai-md-code-border': '#f0dcc0',
      '--crai-md-blockquote-border': '#e8590c',
      '--crai-md-blockquote-bg': '#fef5e8',
      '--crai-md-inline-code-bg': '#fcecc8',
      '--crai-md-heading-color': '#2d1b0e',
      '--crai-md-link-color': '#e8590c',
      '--crai-input-bg': '#ffffff',
      '--crai-md-table-header-bg': '#fdf0d8',
    }).tokens,
  },
  {
    name: '森林 (Forest)',
    description: '绿色调，自然柔和',
    tokens: buildPreset({
      '--crai-bg': '#f0faf0',
      '--crai-bg-secondary': '#d8f0d8',
      '--crai-bg-tertiary': '#c8e8c8',
      '--crai-fg': '#0e2d1b',
      '--crai-fg-secondary': '#2a6b4c',
      '--crai-fg-tertiary': '#60a080',
      '--crai-accent': '#16a34a',
      '--crai-border': '#c0e0c0',
      '--crai-msg-user-bg': '#16a34a',
      '--crai-msg-assistant-bg': '#d8f0d8',
      '--crai-msg-assistant-fg': '#0e2d1b',
      '--crai-md-code-bg': '#e8f5e8',
      '--crai-md-code-border': '#c0e0c0',
      '--crai-md-blockquote-border': '#16a34a',
      '--crai-md-blockquote-bg': '#e8f5e8',
      '--crai-md-inline-code-bg': '#d0ecd0',
      '--crai-md-heading-color': '#0e2d1b',
      '--crai-md-link-color': '#16a34a',
      '--crai-input-bg': '#ffffff',
      '--crai-md-table-header-bg': '#d8f0d8',
    }).tokens,
  },
  {
    name: '樱 (Sakura)',
    description: '粉色系，温柔',
    tokens: buildPreset({
      '--crai-bg': '#fef5f5',
      '--crai-bg-secondary': '#fde8e8',
      '--crai-bg-tertiary': '#fcd8d8',
      '--crai-fg': '#3a1a2a',
      '--crai-fg-secondary': '#7a4a5a',
      '--crai-fg-tertiary': '#aa7a8a',
      '--crai-accent': '#ec4899',
      '--crai-border': '#f0c8d0',
      '--crai-msg-user-bg': '#ec4899',
      '--crai-msg-assistant-bg': '#fde8e8',
      '--crai-msg-assistant-fg': '#3a1a2a',
      '--crai-md-code-bg': '#fef0f0',
      '--crai-md-code-border': '#f0c8d0',
      '--crai-md-blockquote-border': '#ec4899',
      '--crai-md-blockquote-bg': '#fef0f0',
      '--crai-md-inline-code-bg': '#fcdce0',
      '--crai-md-heading-color': '#3a1a2a',
      '--crai-md-link-color': '#ec4899',
      '--crai-input-bg': '#ffffff',
      '--crai-md-table-header-bg': '#fde8e8',
    }).tokens,
  },
]
