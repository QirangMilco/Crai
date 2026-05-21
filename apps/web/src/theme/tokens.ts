/**
 * @crai/web/theme — CSS token 注册表。
 *
 * 支持继承链：子 token 的 defaultValue 可设为 `var(--parent)`，
 * ref 字段记录父 token 名，Inspector 据此展示继承态 UI。
 */
export type TokenType = 'color' | 'size' | 'number' | 'select' | 'text'
export type TokenGroup = 'base' | 'font-size' | 'line-height' | 'radius' | 'spacing' | 'user-msg' | 'ai-msg' | 'code-block' | 'table' | 'blockquote' | 'heading' | 'input' | 'input-box' | 'input-field' | 'input-bar' | 'layout' | 'thinking-block' | 'tool-block'

export interface TokenDef {
  name: string; label: string; group: TokenGroup; type: TokenType
  defaultValue: string
  /** 父 token 名。当前值为 `var(--parent)` 时视为继承中。 */
  ref?: string
  options?: string[]; min?: number; max?: number; description?: string
}

export const TOKENS: TokenDef[] = [
  // ============================================================
  // 🎨 基础色
  // ============================================================
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

  // ============================================================
  // 🔤 字号（基础字号 + 继承链）
  // ============================================================
  { name: '--crai-font-size', label: '基础字号', group: 'font-size', type: 'size', defaultValue: '16px', max: 32, description: '修改后所有继承它的字号自动跟随' },
  { name: '--crai-msg-user-font-size', label: '用户消息字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32 },
  { name: '--crai-msg-ai-font-size', label: 'AI 消息字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32 },
  { name: '--crai-input-font-size', label: '文本区字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32 },
  { name: '--crai-md-paragraph-font-size', label: '正文字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32, description: 'Markdown 段落文字大小' },

  // ── 字体 ──
  { name: '--crai-font-sans', label: 'UI 字体', group: 'font-size', type: 'text', defaultValue: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif", description: '界面元素字体（按钮、标签、侧栏）' },
  { name: '--crai-font-serif', label: '正文字体', group: 'font-size', type: 'text', defaultValue: "Georgia, 'Noto Serif SC', serif", description: '长文本阅读字体（助手消息正文）' },
  { name: '--crai-font-mono', label: '等宽字体', group: 'font-size', type: 'text', defaultValue: "'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace", description: '代码和工具参数的字体' },

  // ============================================================
  // 📏 行高（基础行高 + 继承链）
  // ============================================================
  { name: '--crai-line-height', label: '基础行高', group: 'line-height', type: 'number', defaultValue: '1.6', description: '修改后所有继承它的行高自动跟随' },
  { name: '--crai-msg-user-line-height', label: '用户消息行高', group: 'line-height', type: 'number', defaultValue: 'var(--crai-line-height)', ref: '--crai-line-height' },
  { name: '--crai-msg-ai-line-height', label: 'AI 消息行高', group: 'line-height', type: 'number', defaultValue: 'var(--crai-line-height)', ref: '--crai-line-height' },
  { name: '--crai-input-line-height', label: '文本区行高', group: 'line-height', type: 'number', defaultValue: 'var(--crai-line-height)', ref: '--crai-line-height' },

  // ============================================================
  // ⭕ 圆角（基础圆角 + 继承链）
  // ============================================================
  { name: '--crai-radius', label: '基础圆角', group: 'radius', type: 'size', defaultValue: '12px', max: 48, description: '修改后所有继承它的圆角自动跟随' },
  { name: '--crai-msg-user-radius', label: '用户消息圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius) var(--crai-radius) var(--crai-radius) var(--crai-radius)', ref: '--crai-radius' },
  { name: '--crai-msg-assistant-radius', label: 'AI 消息圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius) var(--crai-radius) var(--crai-radius) var(--crai-radius)', ref: '--crai-radius' },
  { name: '--crai-input-radius', label: '输入框圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius)', ref: '--crai-radius' },
  { name: '--crai-md-code-radius', label: '代码块圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius)', ref: '--crai-radius' },

  // ============================================================
  // ↔️ 间距（基础间距 + 继承链）
  // ============================================================
  { name: '--crai-spacing', label: '基础间距', group: 'spacing', type: 'size', defaultValue: '8px', max: 40, description: '修改后所有继承它的间距自动跟随' },
  { name: '--crai-msg-gap', label: '消息间距', group: 'spacing', type: 'size', defaultValue: 'var(--crai-spacing)', ref: '--crai-spacing', max: 40 },

  // ============================================================
  // 💬 用户消息（独有配置）
  // ============================================================
  { name: '--crai-msg-user-bg', label: '背景', group: 'user-msg', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-msg-user-fg', label: '文字', group: 'user-msg', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-msg-user-max-width', label: '最大宽度', group: 'user-msg', type: 'size', defaultValue: '80%', max: 100 },

  // ============================================================
  // 🤖 AI 消息（独有配置）
  // ============================================================
  { name: '--crai-msg-assistant-bg', label: '背景', group: 'ai-msg', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-msg-assistant-fg', label: '文字', group: 'ai-msg', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-msg-max-width', label: '最大宽度', group: 'ai-msg', type: 'size', defaultValue: '100%', max: 100 },
  { name: '--crai-msg-padding-x', label: '气泡水平内边距', group: 'ai-msg', type: 'size', defaultValue: '16px', max: 48 },
  { name: '--crai-msg-padding-y', label: '气泡垂直内边距', group: 'ai-msg', type: 'size', defaultValue: '12px', max: 48 },

  // ============================================================
  // 📄 代码块
  // ============================================================
  { name: '--crai-md-code-bg', label: '背景', group: 'code-block', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-code-fg', label: '文字色', group: 'code-block', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-md-code-border', label: '边框', group: 'code-block', type: 'color', defaultValue: '#e9ecef' },
  { name: '--crai-md-code-font-size', label: '代码字号', group: 'font-size', type: 'size', defaultValue: '13px', max: 24 },

  // ============================================================
  // 📊 表格
  // ============================================================
  { name: '--crai-md-table-border', label: '边框', group: 'table', type: 'color', defaultValue: '#dee2e6' },
  { name: '--crai-md-table-fg', label: '文字色', group: 'table', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-md-table-header-bg', label: '表头背景', group: 'table', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-table-body-bg', label: '内容背景', group: 'table', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-md-table-cell-padding', label: '单元格内边距', group: 'table', type: 'size', defaultValue: '8px 12px', max: 30, description: '格式：水平 垂直（如 8px 12px）' },

  // ============================================================
  // 📝 引用 & 链接
  // ============================================================
  { name: '--crai-md-blockquote-border', label: '左边框', group: 'blockquote', type: 'color', defaultValue: '#4f46e5' },
  { name: '--crai-md-blockquote-border-width', label: '左边框宽度', group: 'blockquote', type: 'size', defaultValue: '4px', max: 16 },
  { name: '--crai-md-blockquote-bg', label: '背景', group: 'blockquote', type: 'color', defaultValue: '#f8f9fa' },
  { name: '--crai-md-blockquote-fg', label: '文字色', group: 'blockquote', type: 'color', defaultValue: '#6c757d' },
  { name: '--crai-md-inline-code-bg', label: '行内代码背景', group: 'blockquote', type: 'color', defaultValue: '#f1f3f5' },
  { name: '--crai-md-link-color', label: '链接色', group: 'blockquote', type: 'color', defaultValue: '#4f46e5' },

  // ============================================================
  // 📰 标题
  // ============================================================
  { name: '--crai-md-heading-color', label: '颜色', group: 'heading', type: 'color', defaultValue: '#1a1a2e' },
  { name: '--crai-md-heading-weight', label: '字重', group: 'heading', type: 'select', defaultValue: '600', options: ['400', '500', '600', '700', '800'] },
  { name: '--crai-md-h1-font-size', label: 'H1 字号', group: 'font-size', type: 'size', defaultValue: '24px', max: 48 },
  { name: '--crai-md-h2-font-size', label: 'H2 字号', group: 'font-size', type: 'size', defaultValue: '20px', max: 44 },
  { name: '--crai-md-h3-font-size', label: 'H3 字号', group: 'font-size', type: 'size', defaultValue: '18px', max: 40 },
  { name: '--crai-md-h4-font-size', label: 'H4 字号', group: 'font-size', type: 'size', defaultValue: '16px', max: 36 },

  // ============================================================
  // 📦 输入框容器
  // ============================================================
  { name: '--crai-input-bg', label: '背景', group: 'input-box', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-input-border', label: '边框色', group: 'input-box', type: 'color', defaultValue: '#e5e7eb' },
  { name: '--crai-input-border-width', label: '边框宽度', group: 'input-box', type: 'size', defaultValue: 'var(--crai-border-width)', ref: '--crai-border-width', min: 0, max: 8 },
  { name: '--crai-shadow-input', label: '阴影', group: 'input-box', type: 'text', defaultValue: '0 2px 8px rgba(0,0,0,0.08)', description: '输入框容器阴影' },
  { name: '--crai-input-gap', label: '文本区与工具栏间距', group: 'input-box', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-input-padding-x', label: '水平内边距', group: 'input-box', type: 'size', defaultValue: '16px', max: 40, description: '文本框左右两侧的空白' },
  { name: '--crai-input-min-height', label: '最小高度', group: 'input-box', type: 'size', defaultValue: '44px', max: 200 },
  { name: '--crai-input-max-height', label: '最大高度', group: 'input-box', type: 'size', defaultValue: '120px', max: 400 },

  // ============================================================
  // 🔧 工具栏
  // ============================================================
  { name: '--crai-btn-radius', label: '按钮圆角', group: 'input-bar', type: 'size', defaultValue: '8px' },
  { name: '--crai-btn-height', label: '按钮高度', group: 'input-bar', type: 'size', defaultValue: '32px', max: 80, description: '发送按钮和工具栏的高度' },
  { name: '--crai-btn-font-size', label: '按钮字号', group: 'font-size', type: 'size', defaultValue: '13px', max: 24 },
  { name: '--crai-btn-color', label: '按钮文字色', group: 'input-bar', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-btn-hover-bg', label: '悬停背景色', group: 'input-bar', type: 'color', defaultValue: '#4338ca' },

  // ============================================================
  // 📐 布局
  // ============================================================
  { name: '--crai-chat-max-width', label: '聊天区宽度', group: 'layout', type: 'size', defaultValue: '720px', max: 1400, description: '消息列表和输入框的整体宽度' },
  { name: '--crai-chat-padding', label: '聊天区边距', group: 'layout', type: 'size', defaultValue: '16px', max: 80, description: '消息列表和输入框的左右 padding' },
  { name: '--crai-header-height', label: '顶栏高度', group: 'layout', type: 'size', defaultValue: '48px', max: 120 },
  { name: '--crai-gap', label: '组件间距', group: 'layout', type: 'size', defaultValue: '12px', max: 60 },
  { name: '--crai-panel-width', label: '面板宽度', group: 'layout', type: 'size', defaultValue: '320px', min: 160, max: 600 },

  // ── 侧栏 ──
  { name: '--crai-sidebar-fixed-bar-width', label: '固定栏宽度', group: 'layout', type: 'size', defaultValue: '36px', min: 24, max: 64, description: '侧栏收起时固定栏的宽度' },
  { name: '--crai-sidebar-min-width', label: '侧栏最小宽度', group: 'layout', type: 'size', defaultValue: '160px', min: 100, max: 300 },
  { name: '--crai-sidebar-max-width', label: '侧栏最大宽度', group: 'layout', type: 'size', defaultValue: '520px', min: 300, max: 800 },
  { name: '--crai-sidebar-handle-width', label: '拖拽手柄宽度', group: 'layout', type: 'size', defaultValue: '4px', min: 2, max: 12 },
  { name: '--crai-sidebar-handle-color', label: '拖拽手柄颜色', group: 'layout', type: 'color', defaultValue: 'var(--crai-border)', description: '拖拽手柄 hover 时的颜色' },
  { name: '--crai-sidebar-header-height', label: '面板头部高度', group: 'layout', type: 'size', defaultValue: '36px', min: 24, max: 60 },

  // ── UI 原语 ──
  { name: '--crai-shadow-card', label: '卡片阴影', group: 'layout', type: 'text', defaultValue: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)', description: '卡片容器的阴影' },
  { name: '--crai-shadow-elevated', label: '抬高阴影', group: 'layout', type: 'text', defaultValue: '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)', description: '弹窗/次级模态的阴影' },
  { name: '--crai-transition-fast', label: '过渡速度', group: 'layout', type: 'size', defaultValue: '0.15s', min: 0.05, max: 0.5, description: '通用微交互过渡时长' },
  { name: '--crai-space-xxs', label: '间距 XXS', group: 'spacing', type: 'size', defaultValue: '2px', max: 8, description: '极细微间距' },
  { name: '--crai-space-xs', label: '间距 XS', group: 'spacing', type: 'size', defaultValue: '4px', max: 16 },
  { name: '--crai-space-sm', label: '间距 SM', group: 'spacing', type: 'size', defaultValue: '8px', max: 24 },
  { name: '--crai-space-md', label: '间距 MD', group: 'spacing', type: 'size', defaultValue: '12px', max: 32 },
  { name: '--crai-space-lg', label: '间距 LG', group: 'spacing', type: 'size', defaultValue: '16px', max: 48 },
  { name: '--crai-space-xl', label: '间距 XL', group: 'spacing', type: 'size', defaultValue: '24px', max: 64 },

  // ── 思考过程 ──
  { name: '--crai-thinking-bg', label: '背景', group: 'thinking-block', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-thinking-fg', label: '标题色', group: 'thinking-block', type: 'color', defaultValue: '#6b7280' },
  { name: '--crai-thinking-content-fg', label: '内容色', group: 'thinking-block', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-thinking-radius', label: '圆角', group: 'thinking-block', type: 'size', defaultValue: '6px', max: 20 },
  { name: '--crai-thinking-font-size', label: '字号', group: 'thinking-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-thinking-line-height', label: '行高', group: 'thinking-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-thinking-content-font-size', label: '内容字号', group: 'thinking-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-thinking-content-line-height', label: '内容行高', group: 'thinking-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-thinking-padding', label: '内边距', group: 'thinking-block', type: 'size', defaultValue: '8px 12px', max: 40 },
  { name: '--crai-thinking-mt', label: '上边距', group: 'thinking-block', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-thinking-mb', label: '下边距', group: 'thinking-block', type: 'size', defaultValue: '4px', max: 40 },

  // ── 工具调用 ──
  { name: '--crai-tool-bg', label: '背景', group: 'tool-block', type: 'color', defaultValue: '#f3f4f6' },
  { name: '--crai-tool-fg', label: '文字色', group: 'tool-block', type: 'color', defaultValue: '#374151' },
  { name: '--crai-tool-radius', label: '圆角', group: 'tool-block', type: 'size', defaultValue: '6px', max: 20 },
  { name: '--crai-tool-font-size', label: '字号', group: 'tool-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-tool-line-height', label: '行高', group: 'tool-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-tool-gap', label: '图标间距', group: 'tool-block', type: 'size', defaultValue: '8px', max: 40 },
  { name: '--crai-tool-padding', label: '内边距', group: 'tool-block', type: 'size', defaultValue: '4px 8px', max: 40 },
  { name: '--crai-tool-mt', label: '上边距', group: 'tool-block', type: 'size', defaultValue: '2px', max: 40 },
  { name: '--crai-tool-mb', label: '下边距', group: 'tool-block', type: 'size', defaultValue: '2px', max: 40 },
  { name: '--crai-tool-group-title-size', label: '组标题字号', group: 'tool-block', type: 'size', defaultValue: '12px', max: 32 },
  { name: '--crai-tool-group-title-fg', label: '组标题色', group: 'tool-block', type: 'color', defaultValue: '#9ca3af' },
  { name: '--crai-tool-group-mt', label: '组上边距', group: 'tool-block', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-tool-group-mb', label: '组下边距', group: 'tool-block', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-tool-success', label: '成功色', group: 'tool-block', type: 'color', defaultValue: 'var(--crai-success)', ref: '--crai-success' },
  { name: '--crai-tool-error', label: '失败色', group: 'tool-block', type: 'color', defaultValue: 'var(--crai-destructive)', ref: '--crai-destructive' },
]

// ── 辅助 ──

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

/** 获取 token 的**计算值**（px 等已解析的值，用于 Inspector 显示）。 */
export function getToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** 获取 token 的**原始设置值**（可能是 `var(--parent)`，用于检测继承）。 */
export function getRawToken(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim()
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
  for (const t of TOKENS) {
    r[t.name] = getRawToken(t.name) || t.defaultValue
  }
  return r
}

export function importTokens(data: Record<string, string>): void {
  for (const t of TOKENS) { if (data[t.name]) setToken(t.name, data[t.name]) }
}

// ── 预设系统 ──

export interface ThemePreset { name: string; description?: string; tokens: Record<string, string> }

// 仅含 color token 的预设（换色不影响样式）
const COLOR_NAMES = new Set(TOKENS.filter((t) => t.type === 'color').map((t) => t.name))
function colorPreset(o: Partial<Record<string, string>> = {}): Record<string, string> {
  const r: Record<string, string> = {}
  for (const n of COLOR_NAMES) r[n] = o[n] ?? TOKENS.find((d) => d.name === n)!.defaultValue
  return r
}

export const COLOR_PRESETS: ThemePreset[] = [
  { name: 'Crai 默认（浅色）', tokens: colorPreset() },
  {
    name: 'Crai 默认（深色）', description: '深色配色方案',
    tokens: colorPreset({
      '--crai-bg': '#0f172a', '--crai-bg-secondary': '#1e293b', '--crai-bg-tertiary': '#334155',
      '--crai-fg': '#f1f5f9', '--crai-fg-secondary': '#94a3b8', '--crai-fg-tertiary': '#64748b',
      '--crai-accent': '#818cf8', '--crai-border': '#334155',
      '--crai-msg-assistant-bg': '#1e293b', '--crai-msg-assistant-fg': '#f1f5f9',
      '--crai-md-code-bg': '#1e293b', '--crai-md-code-border': '#334155',
      '--crai-md-code-fg': '#f1f5f9',
      '--crai-md-table-border': '#334155', '--crai-md-table-header-bg': '#1e293b',
      '--crai-md-table-fg': '#f1f5f9', '--crai-md-table-body-bg': '#1e293b',
      '--crai-md-blockquote-bg': '#1e293b', '--crai-md-inline-code-bg': '#334155',
      '--crai-md-heading-color': '#f1f5f9', '--crai-input-bg': '#1e293b', '--crai-input-border': '#334155',
      '--crai-btn-hover-bg': '#6366f1', '--crai-scrollbar-color': '#64748b',
      '--crai-success': '#22c55e', '--crai-destructive': '#ef4444',
    }),
  },
  {
    name: '极光 (Aurora)', description: '冷色调，蓝紫为主',
    tokens: colorPreset({
      '--crai-bg': '#f0f5ff', '--crai-bg-secondary': '#e0ecff', '--crai-accent': '#6366f1',
      '--crai-border': '#c8d8f0', '--crai-msg-assistant-bg': '#e0ecff',
      '--crai-md-code-bg': '#e8f0ff', '--crai-md-inline-code-bg': '#dce8ff',
      '--crai-md-heading-color': '#1a1a3e', '--crai-md-link-color': '#6366f1',
      '--crai-input-bg': '#ffffff',
    }),
  },
  {
    name: '暖橙 (Warm)', description: '暖色调，橙棕为主',
    tokens: colorPreset({
      '--crai-bg': '#fef9f0', '--crai-bg-secondary': '#fdf0d8',
      '--crai-fg': '#2d1b0e', '--crai-accent': '#e8590c', '--crai-border': '#f0dcc0',
      '--crai-msg-assistant-bg': '#fdf0d8',
      '--crai-md-code-bg': '#fef5e8', '--crai-md-inline-code-bg': '#fcecc8',
      '--crai-md-heading-color': '#2d1b0e',
      '--crai-input-bg': '#ffffff',
    }),
  },
  {
    name: '森林 (Forest)', description: '绿色调，自然柔和',
    tokens: colorPreset({
      '--crai-bg': '#f0faf0', '--crai-bg-secondary': '#d8f0d8',
      '--crai-fg': '#0e2d1b', '--crai-accent': '#16a34a', '--crai-border': '#c0e0c0',
      '--crai-msg-assistant-bg': '#d8f0d8',
      '--crai-md-code-bg': '#e8f5e8', '--crai-md-inline-code-bg': '#d0ecd0',
      '--crai-md-heading-color': '#0e2d1b',
      '--crai-input-bg': '#ffffff',
    }),
  },
  {
    name: '樱 (Sakura)', description: '粉色系，温柔',
    tokens: colorPreset({
      '--crai-bg': '#fef5f5', '--crai-bg-secondary': '#fde8e8',
      '--crai-fg': '#3a1a2a', '--crai-accent': '#ec4899', '--crai-border': '#f0c8d0',
      '--crai-msg-assistant-bg': '#fde8e8',
      '--crai-md-code-bg': '#fef0f0', '--crai-md-inline-code-bg': '#fcdce0',
      '--crai-md-heading-color': '#3a1a2a',
      '--crai-input-bg': '#ffffff',
    }),
  },
]

// ── 样式预设（只含非色 token） ──

const STYLE_NAMES = new Set(TOKENS.filter((t) => t.type !== 'color').map((t) => t.name))
function stylePreset(o: Partial<Record<string, string>> = {}): Record<string, string> {
  const r: Record<string, string> = {}
  for (const n of STYLE_NAMES) r[n] = o[n] ?? TOKENS.find((d) => d.name === n)!.defaultValue
  return r
}

export const STYLE_PRESETS: ThemePreset[] = [
  { name: 'Crai 默认样式', description: '恢复所有样式到默认值', tokens: stylePreset() },
]
