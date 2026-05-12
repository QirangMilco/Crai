/** Inspector 可调节的参数定义。 */

export type TokenCategory =
  | 'theme'    // 主题色
  | 'message'  // 消息气泡
  | 'layout'   // 布局
  | 'effects'  // 动效

export interface TokenDef {
  /** CSS 变量名（不含 --crai- 前缀）。 */
  key: string
  /** 显示名称。 */
  label: string
  /** 所属分组。 */
  category: TokenCategory
  /** 控件类型。 */
  control: 'color' | 'slider' | 'select' | 'toggle'
  /** slider 范围。 */
  min?: number
  max?: number
  step?: number
  /** select 选项。 */
  options?: { label: string; value: string }[]
}

/** 所有可调节的 token 定义。 */
export const TOKENS: TokenDef[] = [
  // ── theme ──
  { key: 'accent',        label: '主色',          category: 'theme',  control: 'color' },
  { key: 'accent-hover',  label: '主色悬浮',      category: 'theme',  control: 'color' },
  { key: 'bg',            label: '背景色',        category: 'theme',  control: 'color' },
  { key: 'fg',            label: '文字色',        category: 'theme',  control: 'color' },
  { key: 'fg-secondary',  label: '次要文字色',    category: 'theme',  control: 'color' },
  { key: 'border',        label: '边框色',        category: 'theme',  control: 'color' },

  // ── message ──
  { key: 'msg-user-bg',         label: '用户气泡背景',   category: 'message', control: 'color' },
  { key: 'msg-user-fg',         label: '用户气泡文字',   category: 'message', control: 'color' },
  { key: 'msg-assistant-bg',    label: 'AI 气泡背景',    category: 'message', control: 'color' },
  { key: 'msg-assistant-fg',    label: 'AI 气泡文字',    category: 'message', control: 'color' },
  { key: 'msg-font-size',       label: '消息字号',       category: 'message', control: 'slider', min: 12, max: 24, step: 1 },
  { key: 'msg-max-width',       label: '气泡最大宽度',   category: 'message', control: 'slider', min: 400, max: 900, step: 20 },

  // ── layout ──
  { key: 'chat-max-width',      label: '聊天区最大宽度', category: 'layout', control: 'slider', min: 400, max: 1200, step: 20 },
  { key: 'chat-padding',        label: '聊天区内边距',   category: 'layout', control: 'slider', min: 8, max: 48, step: 4 },
  { key: 'input-radius',        label: '输入框圆角',     category: 'layout', control: 'slider', min: 0, max: 30, step: 2 },

  // ── effects ──
  { key: 'duration-fast',   label: '快速动效时长',  category: 'effects', control: 'slider', min: 50, max: 500, step: 10 },
  { key: 'duration-normal', label: '普通动效时长',  category: 'effects', control: 'slider', min: 50, max: 500, step: 10 },

  // ── 圆角预设（特殊） ──
  { key: '_radius_preset',  label: '圆角预设',      category: 'layout', control: 'select',
    options: [
      { label: '默认',  value: '' },
      { label: '无圆角', value: 'radius-none' },
      { label: '方形',  value: 'radius-square' },
      { label: '药丸',  value: 'radius-pill' },
    ]},
]

/** 导出配置格式。 */
export interface ExportedConfig {
  tokens: Record<string, string>
  darkMode: boolean
}
