/**
 * @crai/web/theme — CSS token 注册表。
 */
export type TokenType = 'color' | 'size' | 'number' | 'select' | 'text'
export type TokenGroup = 'base' | 'user-msg' | 'ai-msg' | 'code-block' | 'table' | 'blockquote' | 'heading' | 'input' | 'input-box' | 'input-field' | 'input-bar' | 'layout'

export interface TokenDef {
  name: string; label: string; group: TokenGroup; type: TokenType
  defaultValue: string; options?: string[]; min?: number; max?: number; description?: string
}

export const TOKENS: TokenDef[] = [
  { name: '--crai-bg', label: '背景色', group: 'base', type: 'color', defaultValue: '#ffffff', description: '整个聊天界面的背景' },
  { name: '--crai-fg', label: '前景色', group: 'base', type: 'color', defaultValue: '#1a1a2e', description: '主要文字颜色' },
  { name: '--crai-accent', label: '强调色', group: 'base', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-border', label: '边框色', group: 'base', type: 'color', defaultValue: '#e5e7eb' },
  { name: '--crai-border-hover', label: '悬停边框色', group: 'base', type: 'color', defaultValue: '#cbd5e1' },
  { name: '--crai-success', label: '成功色', group: 'base', type: 'color', defaultValue: '#22c55e' },
  { name: '--crai-destructive', label: '危险色', group: 'base', type: 'color', defaultValue: '#ef4444' },
  { name: '--crai-bg-secondary', label: '二级背景', group: 'base', type: 'color', defaultValue: '#f9fafb' },
  { name: '--crai-bg-tertiary', label: '三级背景', group: 'base', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-fg-secondary', label: '二级文字', group: 'base', type: 'color', defaultValue: '#6b7280' },
  { name: '--crai-fg-tertiary', label: '三级文字', group: 'base', type: 'color', defaultValue: '#9ca3af' },
  { name: '--crai-scrollbar-color', label: '滚动条颜色', group: 'base', type: 'color', defaultValue: '#cbd5e1' },
  { name: '--crai-border-width', label: '通用边框宽度', group: 'base', type: 'size', defaultValue: '1px', min: 0, max: 8 },
  { name: '--crai-shadow-bubble', label: '气泡阴影', group: 'base', type: 'text', defaultValue: '0 1px 2px rgba(0,0,0,0.05)', description: '消息气泡阴影' },
  { name: '--crai-shadow-panel', label: '面板阴影', group: 'base', type: 'text', defaultValue: '0 4px 6px rgba(0,0,0,0.07)', description: 'Inspector/Config 面板阴影' },
  { name: '--crai-shadow-modal', label: '模态框阴影', group: 'base', type: 'text', defaultValue: '0 10px 25px rgba(0,0,0,0.1)', description: '弹窗/对话框阴影' },

  { name: '--crai-msg-user-bg', label: '背景', group: 'user-msg', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-msg-user-fg', label: '文字', group: 'user-msg', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-msg-user-radius', label: '圆角', group: 'user-msg', type: 'size', defaultValue: '18px 18px 4px 18px' },

  { name: '--crai-msg-assistant-bg', label: '背景', group: 'ai-msg', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-msg-assistant-fg', label: '文字', group: 'ai-msg', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-msg-assistant-radius', label: '圆角', group: 'ai-msg', type: 'size', defaultValue: '18px 18px 18px 4px' },
  { name: '--crai-msg-max-width', label: '最大宽度', group: 'ai-msg', type: 'size', defaultValue: '80%', max: 100 },
  { name: '--crai-msg-font-size', label: '字号', group: 'ai-msg', type: 'size', defaultValue: '14px', max: 32 },
  { name: '--crai-msg-line-height', label: '行高', group: 'ai-msg', type: 'number', defaultValue: '1.6' },

  { name: '--crai-md-code-bg', label: '背景', group: 'code-block', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-code-border', label: '边框', group: 'code-block', type: 'color', defaultValue: '#e9ecef' },
  { name: '--crai-md-code-font-size', label: '字号', group: 'code-block', type: 'size', defaultValue: '13px', max: 24 },

  { name: '--crai-md-table-border', label: '边框', group: 'table', type: 'color', defaultValue: '#dee2e6' },
  { name: '--crai-md-table-header-bg', label: '表头背景', group: 'table', type: 'color', defaultValue: '#f8f9fa' },

  { name: '--crai-md-blockquote-border', label: '左边框', group: 'blockquote', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-md-blockquote-bg', label: '背景', group: 'blockquote', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-blockquote-fg', label: '文字色', group: 'blockquote', type: 'color', defaultValue: '#6c757d' },
  { name: '--crai-md-inline-code-bg', label: '行内代码背景', group: 'blockquote', type: 'color', defaultValue: '#f1f3f5' },
  { name: '--crai-md-link-color', label: '链接色', group: 'blockquote', type: 'color', defaultValue: '#4f46e5' },

  { name: '--crai-md-heading-color', label: '颜色', group: 'heading', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-md-heading-weight', label: '字重', group: 'heading', type: 'select', defaultValue: '600', options: ['400', '500', '600', '700', '800'] },

  { name: '--crai-input-bg', label: '背景', group: 'input-box', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-input-border', label: '边框色', group: 'input-box', type: 'color', defaultValue: '#e5e7eb' },
  { name: '--crai-input-border-width', label: '边框宽度', group: 'input-box', type: 'size', defaultValue: '1px', min: 0, max: 8 },
  { name: '--crai-input-radius', label: '圆角', group: 'input-box', type: 'size', defaultValue: '12px' },
  { name: '--crai-shadow-input', label: '阴影', group: 'input-box', type: 'text', defaultValue: '0 2px 8px rgba(0,0,0,0.08)', description: '输入框容器阴影' },
  { name: '--crai-input-gap', label: '文本区与工具栏间距', group: 'input-box', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-input-min-height', label: '最小高度', group: 'input-box', type: 'size', defaultValue: '44px', max: 200 },
  { name: '--crai-input-max-height', label: '最大高度', group: 'input-box', type: 'size', defaultValue: '120px', max: 400 },
  { name: '--crai-btn-radius', label: '按钮圆角', group: 'input-bar', type: 'size', defaultValue: '8px' },
  { name: '--crai-btn-height', label: '按钮高度', group: 'input-bar', type: 'size', defaultValue: '32px', max: 80, description: '发送按钮和工具栏的高度' },
  { name: '--crai-btn-font-size', label: '按钮字号', group: 'input-bar', type: 'size', defaultValue: '13px', max: 24 },
  { name: '--crai-chat-max-width', label: '聊天区宽度', group: 'layout', type: 'size', defaultValue: '720px', max: 1400, description: '消息列表和输入框的整体宽度' },
  { name: '--crai-chat-padding', label: '聊天区边距', group: 'layout', type: 'size', defaultValue: '16px', max: 80, description: '消息列表和输入框的左右 padding' },

  { name: '--crai-header-height', label: '顶栏高度', group: 'layout', type: 'size', defaultValue: '48px', max: 120 },
  { name: '--crai-gap', label: '组件间距', group: 'layout', type: 'size', defaultValue: '12px', max: 60 },
  { name: '--crai-panel-width', label: '面板宽度', group: 'layout', type: 'size', defaultValue: '320px', min: 160, max: 600 },
]

export function tokensByGroup(): Record<TokenGroup, TokenDef[]> {
  const groups = {} as Record<TokenGroup, TokenDef[]>
  for (const t of TOKENS) {
    if (!groups[t.group]) groups[t.group] = []
    groups[t.group].push(t)
  }
  return groups
}

export function applyTokens(overrides?: Record<string, string>): void {
  const root = document.documentElement
  for (const t of TOKENS) {
    root.style.setProperty(t.name, overrides?.[t.name] ?? t.defaultValue)
  }
}

export function getToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
export function setToken(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value)
}
export function resetToken(name: string): void {
  const def = TOKENS.find((t) => t.name === name)
  if (def) setToken(name, def.defaultValue)
}
export function resetGroup(group: TokenGroup): void {
  for (const t of TOKENS) { if (t.group === group) setToken(t.name, t.defaultValue) }
}
export function resetAll(): void {
  for (const t of TOKENS) setToken(t.name, t.defaultValue)
}
export function exportTokens(): Record<string, string> {
  const r: Record<string, string> = {}
  for (const t of TOKENS) r[t.name] = getToken(t.name)
  return r
}
export function importTokens(data: Record<string, string>): void {
  for (const t of TOKENS) { if (data[t.name]) setToken(t.name, data[t.name]) }
}

export interface ThemePreset { name: string; description?: string; tokens: Record<string, string> }

const COLOR_TOKENS = TOKENS.filter((t) => t.type === 'color').map((t) => t.name)
function buildPreset(o: Partial<Record<string, string>>): ThemePreset {
  const t: Record<string, string> = {}
  for (const n of COLOR_TOKENS) t[n] = o[n] ?? TOKENS.find((d) => d.name === n)!.defaultValue
  return { name: '', tokens: t }
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Crai 默认（浅色）', tokens: { ...buildPreset({}).tokens } },
  {
    name: 'Crai 默认（深色）',
    tokens: buildPreset({
      '--crai-bg': '#0f172a', '--crai-bg-secondary': '#1e293b', '--crai-bg-tertiary': '#334155',
      '--crai-fg': '#f1f5f9', '--crai-fg-secondary': '#94a3b8', '--crai-fg-tertiary': '#64748b',
      '--crai-accent': '#818cf8', '--crai-border': '#334155',
      '--crai-msg-assistant-bg': '#1e293b', '--crai-msg-assistant-fg': '#f1f5f9',
      '--crai-md-code-bg': '#1e293b', '--crai-md-code-border': '#334155',
      '--crai-md-table-border': '#334155', '--crai-md-table-header-bg': '#1e293b',
      '--crai-md-blockquote-bg': '#1e293b', '--crai-md-inline-code-bg': '#334155',
      '--crai-md-heading-color': '#f1f5f9', '--crai-input-bg': '#1e293b', '--crai-input-border': '#334155',
      '--crai-success': '#22c55e', '--crai-destructive': '#ef4444',
    }).tokens,
  },
  {
    name: '极光 (Aurora)', description: '冷色调，蓝紫为主',
    tokens: buildPreset({
      '--crai-bg': '#f0f5ff', '--crai-bg-secondary': '#e0ecff', '--crai-accent': '#6366f1',
      '--crai-border': '#c8d8f0', '--crai-msg-assistant-bg': '#e0ecff',
      '--crai-md-code-bg': '#e8f0ff', '--crai-md-inline-code-bg': '#dce8ff',
      '--crai-md-heading-color': '#1a1a3e', '--crai-md-link-color': '#6366f1',
      '--crai-input-bg': '#ffffff',
    }).tokens,
  },
  {
    name: '暖橙 (Warm)', description: '暖色调，橙棕为主',
    tokens: buildPreset({
      '--crai-bg': '#fef9f0', '--crai-bg-secondary': '#fdf0d8',
      '--crai-fg': '#2d1b0e', '--crai-accent': '#e8590c', '--crai-border': '#f0dcc0',
      '--crai-msg-assistant-bg': '#fdf0d8',
      '--crai-md-code-bg': '#fef5e8', '--crai-md-inline-code-bg': '#fcecc8',
      '--crai-md-heading-color': '#2d1b0e',
      '--crai-input-bg': '#ffffff',
    }).tokens,
  },
  {
    name: '森林 (Forest)', description: '绿色调，自然柔和',
    tokens: buildPreset({
      '--crai-bg': '#f0faf0', '--crai-bg-secondary': '#d8f0d8',
      '--crai-fg': '#0e2d1b', '--crai-accent': '#16a34a', '--crai-border': '#c0e0c0',
      '--crai-msg-assistant-bg': '#d8f0d8',
      '--crai-md-code-bg': '#e8f5e8', '--crai-md-inline-code-bg': '#d0ecd0',
      '--crai-md-heading-color': '#0e2d1b',
      '--crai-input-bg': '#ffffff',
    }).tokens,
  },
  {
    name: '樱 (Sakura)', description: '粉色系，温柔',
    tokens: buildPreset({
      '--crai-bg': '#fef5f5', '--crai-bg-secondary': '#fde8e8',
      '--crai-fg': '#3a1a2a', '--crai-accent': '#ec4899', '--crai-border': '#f0c8d0',
      '--crai-msg-assistant-bg': '#fde8e8',
      '--crai-md-code-bg': '#fef0f0', '--crai-md-inline-code-bg': '#fcdce0',
      '--crai-md-heading-color': '#3a1a2a',
      '--crai-input-bg': '#ffffff',
    }).tokens,
  },
]
