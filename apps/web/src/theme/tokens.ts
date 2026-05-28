/**
 * @crai/web/theme — CSS token 注册表。
 *
 * 支持继承链：子 token 的 defaultValue 可设为 `var(--parent)`，
 * ref 字段记录父 token 名，Inspector 据此展示继承态 UI。
 */
export type TokenType = 'color' | 'size' | 'number' | 'select' | 'text'
export type TokenGroup = 'base' | 'z-index' | 'font-size' | 'line-height' | 'radius' | 'spacing' | 'user-msg' | 'ai-msg' | 'code-block' | 'table' | 'blockquote' | 'heading' | 'input' | 'input-box' | 'input-field' | 'input-bar' | 'layout' | 'thinking-block' | 'tool-block'

export interface TokenDef {
  name: string; label: string; group: TokenGroup; type: TokenType
  defaultValue: string
  /** 父 token 名。当前值为 `var(--parent)` 时视为继承中。 */
  ref?: string
  options?: string[]; min?: number; max?: number; description?: string
}

export const TOKENS: TokenDef[] = [
  // ============================================================
  // 🎨 基础色（oklch 色彩空间，color-mix 自动衍生）
  // ============================================================
  { name: '--crai-bg', label: '背景色', group: 'base', type: 'color', defaultValue: '#ffffff', description: '界面最底层背景。所有表面色从此衍生。' },
  { name: '--crai-fg', label: '前景色', group: 'base', type: 'color', defaultValue: '#1a1a1a', description: '主要文字色。所有次级文字从此衍生。' },
  { name: '--crai-foreground-rgb', label: '前景色 RGB', group: 'base', type: 'text', defaultValue: '26, 26, 26', description: '用于阴影计算的 RGB 分量（r, g, b）' },
  { name: '--crai-accent', label: '强调色', group: 'base', type: 'color', defaultValue: '#2563eb', description: '按钮、链接、活跃态——唯一色彩出口' },
  { name: '--crai-accent-rgb', label: '强调色 RGB', group: 'base', type: 'text', defaultValue: '37, 99, 235', description: '用于阴影色调的 RGB 分量' },
  { name: '--crai-info', label: '信息色', group: 'base', type: 'color', defaultValue: 'var(--crai-accent)', ref: '--crai-accent', description: '警告/提示/询问模式色。默认继承强调色，可独立调节。' },
  { name: '--crai-success', label: '成功色', group: 'base', type: 'color', defaultValue: '#16a34a' },
  { name: '--crai-destructive', label: '危险色', group: 'base', type: 'color', defaultValue: '#dc2626' },

  // ── 表面层级（从前景色混合生成，改前景色同步变化） ──
  { name: '--crai-bg-2', label: '表面 2%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 2%, var(--crai-bg))', description: '极浅表面，分隔线' },
  { name: '--crai-bg-3', label: '表面 3%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 3%, var(--crai-bg))', description: 'bg-secondary，最浅表面' },
  { name: '--crai-bg-5', label: '表面 5%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))', description: 'bg-tertiary，次浅表面' },
  { name: '--crai-bg-8', label: '表面 8%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 8%, var(--crai-bg))', description: 'hover / 选中背景' },
  { name: '--crai-bg-12', label: '表面 12%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 12%, var(--crai-bg))', description: '活跃选中背景' },

  // ── 文字层级（从前景色透明度衍生） ──
  { name: '--crai-fg-40', label: '文字 40%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 40%, var(--crai-bg))', description: 'fg-secondary，次要文字' },
  { name: '--crai-fg-60', label: '文字 60%', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 60%, var(--crai-bg))', description: 'fg-tertiary，三级文字' },

  // ── 边框（从前景色微透明衍生） ──
  { name: '--crai-border', label: '边框色', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))', description: '从前景色衍生，换主题时自动跟随' },
  { name: '--crai-border-hover', label: '悬停边框色', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 10%, var(--crai-bg))' },
  { name: '--crai-input-border', label: '输入框边框', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))' },

  // ── 其余基础 ──
  { name: '--crai-scrollbar-color', label: '滚动条颜色', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 12%, var(--crai-bg))' },
  { name: '--crai-ring', label: '焦点环色', group: 'base', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 25%, var(--crai-bg))', description: '输入框/按钮聚焦时的外环颜色' },
  { name: '--crai-ring-width', label: '焦点环宽度', group: 'base', type: 'size', defaultValue: '1px', min: 0, max: 6, description: '聚焦外环的厚度' },
  { name: '--crai-border-width', label: '通用边框宽度', group: 'base', type: 'size', defaultValue: '1px', min: 0, max: 8 },
  { name: '--crai-shadow-bubble', label: '气泡阴影', group: 'base', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 2px -0.5px', description: '消息气泡阴影' },
  { name: '--crai-shadow-panel', label: '面板阴影', group: 'base', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 4px -1px, rgba(0, 0, 0, 0.02) 0px 4px 6px -2px', description: 'Inspector/Config 面板阴影' },
  { name: '--crai-shadow-modal', label: '模态框阴影', group: 'base', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0) 0px 0px 0px 0px, rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 1px -0.5px, rgba(0, 0, 0, 0.04) 0px 3px 3px 0px, rgba(0, 0, 0, 0.02) 0px 6px 6px 0px, rgba(0, 0, 0, 0.02) 0px 12px 12px 0px, rgba(0, 0, 0, 0.02) 0px 24px 24px 0px', description: '弹窗/对话框阴影' },

  // ============================================================
  // 🔤 字号（基础字号 + 继承链）
  // ============================================================
  { name: '--crai-font-size', label: '基础字号', group: 'font-size', type: 'size', defaultValue: '15px', max: 32, description: '修改后所有继承它的字号自动跟随' },
  { name: '--crai-msg-user-font-size', label: '用户消息字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32 },
  { name: '--crai-msg-ai-font-size', label: 'AI 消息字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32 },
  { name: '--crai-input-font-size', label: '文本区字号', group: 'font-size', type: 'size', defaultValue: '14px', max: 32, description: '输入框文本的大小' },
  { name: '--crai-toolbar-font-size', label: '工具栏字号', group: 'input-bar', type: 'size', defaultValue: '11px', max: 20, description: '输入框底部选择菜单的字号' },
  { name: '--crai-md-paragraph-font-size', label: '正文字号', group: 'font-size', type: 'size', defaultValue: 'var(--crai-font-size)', ref: '--crai-font-size', max: 32, description: 'Markdown 段落文字大小' },

  // ── 字体 ──
  { name: '--crai-font-sans', label: 'UI 字体', group: 'font-size', type: 'text', defaultValue: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif", description: '界面元素字体（按钮、标签、侧栏）' },
  { name: '--crai-font-serif', label: '正文字体', group: 'font-size', type: 'text', defaultValue: "Georgia, 'Noto Serif SC', serif", description: '长文本阅读字体（助手消息正文）' },
  { name: '--crai-font-mono', label: '等宽字体', group: 'font-size', type: 'text', defaultValue: "'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace", description: '代码和工具参数的字体' },

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
  { name: '--crai-radius', label: '基础圆角', group: 'radius', type: 'size', defaultValue: '0px', max: 48, description: '修改后所有继承它的圆角自动跟随' },
  { name: '--crai-radius-sm', label: '小圆角', group: 'radius', type: 'size', defaultValue: '4px', max: 24, description: '按钮、标签等小控件圆角' },
  { name: '--crai-radius-lg', label: '大圆角', group: 'radius', type: 'size', defaultValue: '8px', max: 64, description: '弹窗、卡片容器圆角' },
  { name: '--crai-radius-xl', label: '特大圆角', group: 'radius', type: 'size', defaultValue: '12px', max: 96, description: '面板、分组容器圆角' },
  { name: '--crai-radius-pill', label: '药丸圆角', group: 'radius', type: 'size', defaultValue: '999px', max: 999, description: '标签、徽章、模式指示器' },
  { name: '--crai-msg-user-radius', label: '用户消息圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius) var(--crai-radius) var(--crai-radius) var(--crai-radius)', ref: '--crai-radius' },
  { name: '--crai-msg-assistant-radius', label: 'AI 消息圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius) var(--crai-radius) var(--crai-radius) var(--crai-radius)', ref: '--crai-radius' },
  { name: '--crai-input-radius', label: '输入框圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius-lg)', ref: '--crai-radius-lg' },
  { name: '--crai-md-code-radius', label: '代码块圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius-sm)', ref: '--crai-radius-sm' },

  // ============================================================
  // ↔️ 间距（基础间距 + 继承链）
  // ============================================================
  { name: '--crai-spacing', label: '基础间距', group: 'spacing', type: 'size', defaultValue: '8px', max: 40, description: '修改后所有继承它的间距自动跟随' },
  { name: '--crai-msg-gap', label: '消息间距', group: 'spacing', type: 'size', defaultValue: 'var(--crai-spacing)', ref: '--crai-spacing', max: 40 },

  // ============================================================
  // 💬 用户消息（独有配置）
  // ============================================================
  { name: '--crai-msg-user-bg', label: '背景', group: 'user-msg', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))' },
  { name: '--crai-msg-user-fg', label: '文字', group: 'user-msg', type: 'color', defaultValue: 'var(--crai-fg)' },
  { name: '--crai-msg-user-max-width', label: '最大宽度', group: 'user-msg', type: 'size', defaultValue: '80%', max: 100 },

  // ============================================================
  // 🤖 AI 消息（独有配置）
  // ============================================================
  { name: '--crai-msg-assistant-bg', label: '背景', group: 'ai-msg', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3', description: '助手消息背景，继承自表面层级' },
  { name: '--crai-msg-assistant-fg', label: '文字', group: 'ai-msg', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-msg-max-width', label: '最大宽度', group: 'ai-msg', type: 'size', defaultValue: '100%', max: 100 },
  { name: '--crai-msg-padding-x', label: '气泡水平内边距', group: 'ai-msg', type: 'size', defaultValue: '16px', max: 48 },
  { name: '--crai-msg-padding-y', label: '气泡垂直内边距', group: 'ai-msg', type: 'size', defaultValue: '12px', max: 48 },

  // ============================================================
  // 📄 代码块
  // ============================================================
  { name: '--crai-md-code-bg', label: '背景', group: 'code-block', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3' },
  { name: '--crai-md-code-fg', label: '文字色', group: 'code-block', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-md-code-border', label: '边框', group: 'code-block', type: 'color', defaultValue: 'var(--crai-border)', ref: '--crai-border' },
  { name: '--crai-md-code-font-size', label: '代码字号', group: 'font-size', type: 'size', defaultValue: '13px', max: 24 },

  // ============================================================
  // 📊 表格
  // ============================================================
  { name: '--crai-md-table-border', label: '边框', group: 'table', type: 'color', defaultValue: 'var(--crai-border)', ref: '--crai-border' },
  { name: '--crai-md-table-fg', label: '文字色', group: 'table', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-md-table-header-bg', label: '表头背景', group: 'table', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3' },
  { name: '--crai-md-table-body-bg', label: '内容背景', group: 'table', type: 'color', defaultValue: 'var(--crai-bg)', ref: '--crai-bg' },
  { name: '--crai-md-table-cell-padding', label: '单元格内边距', group: 'table', type: 'size', defaultValue: '8px 12px', max: 30, description: '格式：水平 垂直（如 8px 12px）' },

  // ============================================================
  // 📝 引用 & 链接
  // ============================================================
  { name: '--crai-md-blockquote-border', label: '左边框', group: 'blockquote', type: 'color', defaultValue: 'var(--crai-accent)', ref: '--crai-accent' },
  { name: '--crai-md-blockquote-border-width', label: '左边框宽度', group: 'blockquote', type: 'size', defaultValue: '4px', max: 16 },
  { name: '--crai-md-blockquote-bg', label: '背景', group: 'blockquote', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3' },
  { name: '--crai-md-blockquote-fg', label: '文字色', group: 'blockquote', type: 'color', defaultValue: 'var(--crai-fg-60)', ref: '--crai-fg-60' },
  { name: '--crai-md-inline-code-bg', label: '行内代码背景', group: 'blockquote', type: 'color', defaultValue: 'var(--crai-bg-5)', ref: '--crai-bg-5' },
  { name: '--crai-md-link-color', label: '链接色', group: 'blockquote', type: 'color', defaultValue: 'var(--crai-accent)', ref: '--crai-accent' },

  // ============================================================
  // 📰 标题
  // ============================================================
  { name: '--crai-md-heading-color', label: '颜色', group: 'heading', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-md-heading-weight', label: '字重', group: 'heading', type: 'select', defaultValue: '600', options: ['400', '500', '600', '700', '800'] },
  { name: '--crai-md-h1-font-size', label: 'H1 字号', group: 'font-size', type: 'size', defaultValue: '24px', max: 48 },
  { name: '--crai-md-h2-font-size', label: 'H2 字号', group: 'font-size', type: 'size', defaultValue: '20px', max: 44 },
  { name: '--crai-md-h3-font-size', label: 'H3 字号', group: 'font-size', type: 'size', defaultValue: '18px', max: 40 },
  { name: '--crai-md-h4-font-size', label: 'H4 字号', group: 'font-size', type: 'size', defaultValue: '16px', max: 36 },

  // ============================================================
  // 📦 输入框容器
  // ============================================================
  { name: '--crai-input-bg', label: '背景', group: 'input-box', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3', description: '输入框容器背景，略高于页面底色' },
  { name: '--crai-input-border-width', label: '边框宽度', group: 'input-box', type: 'size', defaultValue: 'var(--crai-border-width)', ref: '--crai-border-width', min: 0, max: 8 },
  { name: '--crai-shadow-input', label: '阴影', group: 'input-box', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.02) 0px 2px 8px', description: '输入框容器阴影' },
  { name: '--crai-input-gap', label: '文本区与工具栏间距', group: 'input-box', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-input-padding-x', label: '水平内边距', group: 'input-box', type: 'size', defaultValue: '14px', max: 40, description: '文本左右两侧的空白' },
  { name: '--crai-input-min-height', label: '最小高度', group: 'input-box', type: 'size', defaultValue: '44px', max: 200 },
  { name: '--crai-input-max-height', label: '最大高度', group: 'input-box', type: 'size', defaultValue: '120px', max: 400 },

  // ============================================================
  // 🔧 工具栏
  // ============================================================
  { name: '--crai-btn-radius', label: '按钮圆角', group: 'radius', type: 'size', defaultValue: 'var(--crai-radius-sm)', ref: '--crai-radius-sm' },
  { name: '--crai-btn-font-size', label: '按钮字号', group: 'font-size', type: 'size', defaultValue: '13px', max: 24 },
  { name: '--crai-btn-color', label: '按钮文字色', group: 'input-bar', type: 'color', defaultValue: '#ffffff' },
  { name: '--crai-btn-hover-bg', label: '悬停背景色', group: 'input-bar', type: 'color', defaultValue: 'color-mix(in oklch, var(--crai-accent) 85%, #000)' },

  // ============================================================
  // 📐 布局
  // ============================================================
  { name: '--crai-chat-max-width', label: '聊天区宽度', group: 'layout', type: 'size', defaultValue: '720px', max: 1400, description: '消息列表和输入框的整体宽度' },
  { name: '--crai-chat-padding', label: '聊天区边距', group: 'layout', type: 'size', defaultValue: '16px', max: 80, description: '消息列表和输入框的左右 padding' },
  { name: '--crai-header-height', label: '顶栏高度', group: 'layout', type: 'size', defaultValue: '48px', max: 120 },
  { name: '--crai-gap', label: '组件间距', group: 'layout', type: 'size', defaultValue: '12px', max: 60 },
  { name: '--crai-panel-width', label: '面板宽度', group: 'layout', type: 'size', defaultValue: '320px', min: 160, max: 600 },

  // ── Z-Index 标尺 ──
  { name: '--crai-z-dropdown', label: '下拉菜单', group: 'z-index', type: 'number', defaultValue: '100', min: 0, max: 999, description: '下拉菜单、自动补全面板' },
  { name: '--crai-z-sticky', label: '固定定位', group: 'z-index', type: 'number', defaultValue: '200', min: 0, max: 999, description: '粘性头部、侧栏' },
  { name: '--crai-z-overlay', label: '遮罩层', group: 'z-index', type: 'number', defaultValue: '300', min: 0, max: 999, description: '半透明背景遮罩' },
  { name: '--crai-z-modal', label: '模态框', group: 'z-index', type: 'number', defaultValue: '400', min: 0, max: 999, description: '弹窗、对话框' },
  { name: '--crai-z-toast', label: '通知提示', group: 'z-index', type: 'number', defaultValue: '500', min: 0, max: 999, description: 'Toast 通知、临时提示' },

  // ── 侧栏 ──
  { name: '--crai-sidebar-fixed-bar-width', label: '固定栏宽度', group: 'layout', type: 'size', defaultValue: '36px', min: 24, max: 64, description: '侧栏收起时固定栏的宽度' },
  { name: '--crai-sidebar-min-width', label: '侧栏最小宽度', group: 'layout', type: 'size', defaultValue: '160px', min: 100, max: 300 },
  { name: '--crai-sidebar-max-width', label: '侧栏最大宽度', group: 'layout', type: 'size', defaultValue: '520px', min: 300, max: 800 },
  { name: '--crai-sidebar-handle-width', label: '拖拽手柄宽度', group: 'layout', type: 'size', defaultValue: '4px', min: 2, max: 12 },
  { name: '--crai-sidebar-handle-color', label: '拖拽手柄颜色', group: 'layout', type: 'color', defaultValue: 'var(--crai-border)', description: '拖拽手柄 hover 时的颜色' },
  { name: '--crai-sidebar-header-height', label: '面板头部高度', group: 'layout', type: 'size', defaultValue: '36px', min: 24, max: 60 },

  // ── UI 原语 ──
  { name: '--crai-shadow-card', label: '卡片阴影', group: 'layout', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 2px -0.5px', description: '卡片/活动行的浅阴影' },
  { name: '--crai-shadow-elevated', label: '抬高阴影', group: 'layout', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 4px -1px, rgba(0, 0, 0, 0.02) 0px 4px 8px -2px', description: '弹窗/次级模态阴影' },
  { name: '--crai-shadow-minimal', label: '极浅阴影', group: 'layout', type: 'text', defaultValue: 'rgba(var(--crai-foreground-rgb, 38,36,42), 0.06) 0px 0px 0px 1px', description: '仅 1px border-ring，用于分隔/嵌入元素' },
  { name: '--crai-transition-fast', label: '过渡速度', group: 'layout', type: 'size', defaultValue: '0.15s', min: 0.05, max: 0.5, description: '通用微交互过渡时长' },
  { name: '--crai-ease-default', label: '缓动曲线', group: 'layout', type: 'text', defaultValue: 'cubic-bezier(0.22, 1, 0.36, 1)', description: '默认缓动曲线（ease-out）' },
  { name: '--crai-ease-smooth', label: '平滑缓动', group: 'layout', type: 'text', defaultValue: 'cubic-bezier(0.4, 0, 0.2, 1)', description: '平滑缓动（material ease）' },
  { name: '--crai-spring-mass', label: '弹簧质量', group: 'layout', type: 'size', defaultValue: '0.9', min: 0.1, max: 3, step: 0.1, description: 'framer-motion spring mass' },
  { name: '--crai-spring-stiffness', label: '弹簧刚性', group: 'layout', type: 'size', defaultValue: '400', min: 100, max: 1000, step: 10, description: 'framer-motion spring stiffness' },
  { name: '--crai-spring-damping', label: '弹簧阻尼', group: 'layout', type: 'size', defaultValue: '30', min: 10, max: 80, step: 2, description: 'framer-motion spring damping' },
  { name: '--crai-space-xxs', label: '极小间距', group: 'spacing', type: 'size', defaultValue: '2px', max: 8, description: '图标与文字间隙' },
  { name: '--crai-space-xs', label: '特小间距', group: 'spacing', type: 'size', defaultValue: '4px', max: 16, description: '元素内部紧密间距' },
  { name: '--crai-space-sm', label: '小间距', group: 'spacing', type: 'size', defaultValue: '8px', max: 24, description: '元素之间基本间距' },
  { name: '--crai-space-md', label: '中间距', group: 'spacing', type: 'size', defaultValue: '12px', max: 32, description: '组件内部宽松间距' },
  { name: '--crai-space-lg', label: '大间距', group: 'spacing', type: 'size', defaultValue: '16px', max: 48, description: '组件之间间距' },
  { name: '--crai-space-xl', label: '特大间距', group: 'spacing', type: 'size', defaultValue: '24px', max: 64, description: '区域之间间距' },
  { name: '--crai-space-2xl', label: '超大间距', group: 'spacing', type: 'size', defaultValue: '40px', max: 96, description: '区块之间间距' },
  { name: '--crai-space-3xl', label: '巨大间距', group: 'spacing', type: 'size', defaultValue: '64px', max: 160, description: '页面区域间距' },

  // ── 思考过程 ──
  { name: '--crai-thinking-bg', label: '背景', group: 'thinking-block', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3' },
  { name: '--crai-thinking-fg', label: '标题色', group: 'thinking-block', type: 'color', defaultValue: 'var(--crai-fg-40)', ref: '--crai-fg-40' },
  { name: '--crai-thinking-content-fg', label: '内容色', group: 'thinking-block', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-thinking-radius', label: '圆角', group: 'thinking-block', type: 'size', defaultValue: 'var(--crai-radius-sm)', ref: '--crai-radius-sm' },
  { name: '--crai-thinking-font-size', label: '字号', group: 'thinking-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-thinking-line-height', label: '行高', group: 'thinking-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-thinking-content-font-size', label: '内容字号', group: 'thinking-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-thinking-content-line-height', label: '内容行高', group: 'thinking-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-thinking-padding', label: '内边距', group: 'thinking-block', type: 'size', defaultValue: '8px 12px', max: 40 },
  { name: '--crai-thinking-mt', label: '上边距', group: 'thinking-block', type: 'size', defaultValue: '4px', max: 40 },
  { name: '--crai-thinking-mb', label: '下边距', group: 'thinking-block', type: 'size', defaultValue: '4px', max: 40 },

  // ── 工具调用 ──
  { name: '--crai-tool-bg', label: '背景', group: 'tool-block', type: 'color', defaultValue: 'var(--crai-bg-3)', ref: '--crai-bg-3' },
  { name: '--crai-tool-fg', label: '文字色', group: 'tool-block', type: 'color', defaultValue: 'var(--crai-fg)', ref: '--crai-fg' },
  { name: '--crai-tool-radius', label: '圆角', group: 'tool-block', type: 'size', defaultValue: 'var(--crai-radius-sm)', ref: '--crai-radius-sm' },
  { name: '--crai-tool-font-size', label: '字号', group: 'tool-block', type: 'size', defaultValue: 'var(--crai-font-size)', max: 32 },
  { name: '--crai-tool-line-height', label: '行高', group: 'tool-block', type: 'number', defaultValue: 'var(--crai-line-height)' },
  { name: '--crai-tool-gap', label: '图标间距', group: 'tool-block', type: 'size', defaultValue: '8px', max: 40 },
  { name: '--crai-tool-padding', label: '内边距', group: 'tool-block', type: 'size', defaultValue: '4px 8px', max: 40 },
  { name: '--crai-tool-mt', label: '上边距', group: 'tool-block', type: 'size', defaultValue: '2px', max: 40 },
  { name: '--crai-tool-mb', label: '下边距', group: 'tool-block', type: 'size', defaultValue: '2px', max: 40 },
  { name: '--crai-tool-group-title-size', label: '组标题字号', group: 'tool-block', type: 'size', defaultValue: '12px', max: 32 },
  { name: '--crai-tool-group-title-fg', label: '组标题色', group: 'tool-block', type: 'color', defaultValue: 'var(--crai-fg-60)', ref: '--crai-fg-60' },
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
  // 向后兼容别名（旧 token 名 → 新表面/文字层级）
  root.style.setProperty('--crai-bg-secondary', 'var(--crai-bg-3)')
  root.style.setProperty('--crai-bg-tertiary', 'var(--crai-bg-5)')
  root.style.setProperty('--crai-fg-secondary', 'var(--crai-fg-40)')
  root.style.setProperty('--crai-fg-tertiary', 'var(--crai-fg-60)')
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
  { name: 'Crai 默认（浅色）', description: '基于 Craft Agents 设计系统', tokens: colorPreset() },
  {
    name: 'Crai 默认（深色）', description: '深色配色方案',
    tokens: colorPreset({
      '--crai-bg': '#1a1a1a',
      '--crai-fg': '#e5e5e5',
      '--crai-foreground-rgb': '229, 229, 229',
      '--crai-accent': '#3b82f6',
      '--crai-accent-rgb': '59, 130, 246',
      '--crai-success': '#22c55e',
      '--crai-destructive': '#ef4444',
    }),
  },
  {
    name: '极光 (Aurora)', description: '冷色调，蓝紫为主',
    tokens: colorPreset({
      '--crai-bg': '#f0f5ff',
      '--crai-accent': '#6366f1',
    }),
  },
  {
    name: '暖橙 (Warm)', description: '暖色调，橙棕为主',
    tokens: colorPreset({
      '--crai-bg': '#fef9f0',
      '--crai-fg': '#2d1b0e',
      '--crai-accent': '#e8590c',
    }),
  },
  {
    name: '森林 (Forest)', description: '绿色调，自然柔和',
    tokens: colorPreset({
      '--crai-bg': '#f0faf0',
      '--crai-fg': '#0e2d1b',
      '--crai-accent': '#16a34a',
    }),
  },
  {
    name: '樱 (Sakura)', description: '粉色系，温柔',
    tokens: colorPreset({
      '--crai-bg': '#fef5f5',
      '--crai-fg': '#3a1a2a',
      '--crai-accent': '#ec4899',
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
