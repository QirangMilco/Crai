# 前端体验打磨计划

> 对比 refs/crystalagents 和 refs/openhanako，发现 Crai 前端的质感差距。
> 逐一给出目标做法和对标参考。
>
> 实施完成后可以删掉此文档，或者保留为后续继续打磨的参考。
> 建议：功能性的设计决策入 decision-log.md，此文档作为阶段性打磨草稿可以归档或删除。

---

## P0 — 图标

**现状**：全 emoji（✓ ✗ ▶ 📁 📄 🟦 等）。跨平台渲染不一，无法着色，无法做动画。

**目标**：统一换为 SVG 图标库。

**方案**：安装 `lucide-react`（CrystalAgents 用的），逐步替换 emoji。

**替换清单**：

| 位置 | 当前 emoji | 目标 lucide icon |
|---|---|---|
| ActivityTimeline 状态指示 | ✓ / ✗ | `CheckCircle2` / `XCircle` |
| ActivityTimeline 展开箭头 | ▶ ▼ | `ChevronRight` (with rotate animation) |
| ActivityTimeline 运行中 | ⌛ ⋯ | `LoaderCircle` (with spin) |
| ActivityTimeline 工具参数 | → | `ArrowRight` |
| SessionListPanel 搜索清除 | ✕ | `X` |
| SessionListPanel 排序 | ↓ ↑ | `ArrowDown` / `ArrowUp` |
| FileTreePanel 目录图标 | 📁 | `Folder` |
| FileTreePanel 文件图标 | 📄 🟦 🎨 ⚙️ etc | `File`, `FileCode`, `FileImage`, `FileJson`, `FileText` |
| FileTreePanel 展开箭头 | ▶ ▼ | `ChevronRight` (with rotate) |
| FileTreePanel 上级目录 | ⬆ | `ArrowUp` |
| FileTreePanel 搜索清除 | ✕ | `X` |
| Header 连接状态 | 圆点 | `Circle` / `CheckCircle2` |
| 发送按钮 | 文字"发送" | `Send` icon + text |
| Config/Inspector 按钮 | 文字 | `Settings`, `Palette` icon + text |
| Panel 面板头部 | emoji icon | lucide icon |
| ConfirmBar 确认按钮 | 文字"允许"/"拒绝" | `ShieldCheck`, `Ban` |

**对标**：
- CrystalAgents: `lucide-react` 全组件使用（TurnCard.tsx:38-56 import）
- OpenHanako: 内联 SVG（AssistantMessage.tsx:299-366 多段 handwritten SVG）

**做法**：分两轮。先替换 ActivityTimeline 和 FileTreePanel 这两个最显眼的位置，再扫一遍其他零散 emoji。

---

## P1 — 卡片容器

**现状**：ActivityTimeline 是纯文字行（左边条 + 圆点 + 描述），没有"卡片"这个容器概念。
工具结果、错误信息都直接堆在文字行里。

**目标**：

1. **工具调用卡片**：运行中有边框 + 背景 + 状态色条；完成/失败后颜色变化
2. **思考折叠卡片**：类似 CrystalAgents ThinkingBlock，点击展开正文
3. **输出卡片**：文件写入、搜索结果的专用展示卡片

**方案**：

```css
/* 卡片基础 */
.card-base {
  border: 1px solid var(--crai-border);
  border-radius: var(--crai-radius-md);
  background: var(--crai-bg-secondary);
  box-shadow: var(--crai-shadow-card);
  padding: var(--crai-spacing-md);
  transition: border-color 0.15s, box-shadow 0.15s;
}
```

**对标**：
- OpenHanako: `Chat.module.css` — toolGroup, cronConfirmCard, fileOutputCard, imageOutputCard
  - 统一 `.card { border-radius: var(--radius-md); box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04); }`
  - hover 态: `:hover { border-color: var(--text-muted); background: var(--overlay-light); }`
- CrystalAgents: TurnCard.tsx — 多样化的容器（折叠组、面板、弹窗）

**做法**：
1. 在 tokens.ts 添加 `--crai-shadow-card` token（参考 OpenHanako 的双层 shadow）
2. 将 ActivityTimeline 的活动行包裹为卡片
3. 运行中 / 完成 / 错误三种状态不同左边条颜色

---

## P1 — 间距体系

**现状**：间距硬编码散落在各组件（`12px`, `8px`, `16px`）。

**目标**：建立命名间距尺度 token。

**方案**：在 tokens.ts 添加：

```
--crai-space-xxs: 2px
--crai-space-xs:  4px
--crai-space-sm:  8px
--crai-space-md:  12px
--crai-space-lg:  16px
--crai-space-xl:  24px
```

**对标**：OpenHanako `Chat.module.css` 全面使用 `var(--space-xs)` 到 `var(--space-lg)`。

**做法**：
1. 加 token
2. 逐组件替换硬编码间距（从 ActivityTimeline、SessionListPanel、FileTreePanel 开始）
3. 不改 `--crai-chat-padding` / `--crai-gap` 等已有 token（它们已有语义）

---

## P1 — 微交互全覆盖

**现状**：hover 态参差不齐，过渡时间不一致或缺失。

**目标**：每个可交互元素都有 transition，统一为 `0.15s`。

**对标**：OpenHanako 几乎每段 CSS 都有 `transition: color 0.15s` / `transition: opacity 0.15s` / `transition: transform 0.15s ease`。

**方案**：加一个 utility token `--crai-transition-fast: 0.15s`，然后在以下位置加 transition：

| 元素 | 当前 | 目标 |
|---|---|---|
| 所有 button | 无或硬编码 | `transition: all 0.15s` |
| FixedBar 按钮 | 无 | `transition: opacity 0.15s, background 0.15s` |
| ResizeHandle hover | opacity | `transition: opacity 0.15s` |
| Sidebar header | 无 | `transition: background 0.15s` |
| ActivityTimeline 活动行 | 仅有 cursor | `transition: background 0.15s` |
| Dropdown 项 | 无 | `transition: background 0.15s` |
| Config/Inspector 按钮 | transition-colors | 统一用 token |

**做法**：建一个 `crai-interactive` CSS 类或在 index.css 中全局统一定义。

---

## P2 — 动画

**现状**：
- 消息只做入场（opacity + translateY）
- 侧栏展开/收起是 width transition，无内容过渡

**目标**：引入 framer-motion，分阶段加动画。

**对标**：
- CrystalAgents: TurnCard.tsx — `motion.div` 的 staggered entry、AnimatePresence 的折叠过渡、rotate 箭头动画
- OpenHanako: `Chat.module.css` — `@keyframes msgIn`、`transition: max-height 200ms cubic-bezier(0.33,1,0.68,1)`、`@keyframes typewriterDots`

**方案**：

1. 安装 `framer-motion`（CrystalAgents 用 `motion/react`）
2. 消息列表加 staggered entry（每个消息比前一个延迟 30ms 入场）
3. ActivityTimeline 折叠加 height 动画
4. 侧栏展开/收起加内容 fade-in

**做法**：仅 P2，在所有 P0-P1 做完后再做。

---

## P2 — 字体分层

**现状**：全文同一字体。

**目标**：助手正文 / 用户正文 / UI 元素用不同字体族。

**对标**：OpenHanako `messageAssistant :global(.md-content)` 用 `var(--font-serif)`，工具/UI 用 sans。

**方案**：
- 添加 `--crai-font-serif` token（默认 `Georgia, 'Noto Serif SC', serif`）
- 添加 `--crai-font-mono` token（默认 `'SF Mono', Monaco, 'Cascadia Code', monospace`）
- MarkdownRenderer 正文用 serif
- 代码块和工具参数用 mono
- UI（按钮、标签、侧栏）保持当前 sans

**做法**：仅 P2，在所有 P0-P1 做完后再做。

---

## P3 — 阴影体系

**现状**：3 个简单阴影 token（bubble / panel / modal）。

**目标**：多层阴影系统，区分更细的层级（minimal / card / modal / overlay）。

**对标**：
- CrystalAgents `index.css:40-80` — 6 层 shadow（`shadow-minimal` / `shadow-minimal-flat` / `shadow-modal-small`）
- OpenHanako 简单一些，但也是双层 shadow（`box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)`）

**方案**：添加 `--crai-shadow-card`、`--crai-shadow-elevated` 两新 token。

**做法**：仅 P3，P0-P2 之后或穿插。

---

## P3 — 专用组件

**现状**：工具调用没有专用视觉组件。

**目标**：逐步添加专用组件。

**对标**：
- OpenHanako: fileOutputCard, imageOutputCard, cronConfirmCard, toolGroup
- CrystalAgents: TurnCard 内部的各种状态渲染分支

**方案**：后续阶段做，当前阶段先做 P0-P1 的卡片化。

---

## 独特优势：Inspector 系统

Crai 的 Inspector 面板（实时编辑 token / 预设 / 定位模式）是两个 ref 都没有的特性。
CrystalAgents 的设计系统是编译时确定的，OpenHanako 的 CSS 变量是静态的。
Crai 可以在运行时调色、调字号、调间距，立即看到效果。

**打磨计划中 Inspector 的角色**：Inspector 不是被对标的目标，而是**分发新 token 的通道**。
所有新增的 token（`--crai-shadow-card`、`--crai-space-*`、`--crai-transition-fast`）都必须注册到 Inspector，
让用户能在面板里直接调整，继承 Inspector 已有的"修改实时生效"能力。

**后续可做的 Inspector 增强（不等同于对标 refs，而是 Crai 独有的发展方向）**：

1. **面板配置 UI** — 把 PanelRegistry 的配置（左右侧、顺序、可见性）做到 Inspector 中，拖拽排序
2. **token 搜索** — token 列表加搜索过滤（现在需要手动翻分组）
3. **token 对比** — 当前值与预设值的 diff 展示
4. **样式快照** — 一键导出当前所有 token 为预设，分享给其他人

这些都超出了"对标 refs"的范畴，是 Crai 自己可以走的方向。
放在本计划的"后续可能"阶段，不在当前的 Phase 1-4 中实施。

---

## 组件化架构（脚手架层面）

打磨的同时建立可复用的组件体系。目标不是"做漂亮"，而是"做规范"。

### 当前问题

- 所有组件用 `style={}` 内联对象，不可覆写、不可组合
- 没有 className forwarding 模式，外部无法定制样式
- 没有 UI 原语层（Button / Card / Icon / Badge），每个组件自己写按钮
- 组件之间边界模糊（ChatView 里内联了 Dropdown、workspaceBrowser modal）
- 不一致的渲染模式：有的用 Tailwind className，有的用 inline style，有的两者混用

### 目标分层

```
packages/ui/ (未来可提取的共享包)
├── primitives/       # 通用 UI 原语
│   ├── Button        # 图标+文字按钮
│   ├── Card          # 卡片容器
│   ├── Icon          # lucide 包装
│   ├── Badge         # 状态徽标
│   └── Select        # 下拉框
├── layout/           # 布局原语
│   ├── Panel         # 面板容器（header + content）
│   ├── Sidebar       # 侧栏布局
│   └── Header        # 顶栏
└── domain/           # 领域组件（当前在 components/）
    ├── MessageBubble
    ├── ActivityTimeline
    ├── SessionListPanel
    ├── FileTreePanel
    └── ...
```

实作时**不建新包**，先在 `apps/web/src/components/ui/` 下积累原语，方便后续提取。

### 组件设计规范

每个可复用组件遵循以下模式：

```tsx
// 1. className 透传（外部可覆写样式）
// 2. 用 cn() 合并默认 className 和外部 className
// 3. 语义化 props，最小心智负担
// 4. 支持 asChild 或 render props 模式（需要时）

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: React.ReactNode  // 可选前置图标
  children: React.ReactNode
}

function Button({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-150',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
```

### 样式策略

**统一使用 inline style + 无法覆写的 Token** 的现行模式不改——因为 Inspector 依赖 CSS 变量实时生效，切到 Tailwind utility class 会破坏这个能力。

但对于**组件结构**（flex / gap / align / padding 等布局属性），逐步从 `style={}` 迁移到 Tailwind className。分界线：

| 用 CSS 变量（style=） | 用 Tailwind className |
|---|---|
| 颜色、字号、圆角、间距尺度 | flex / grid / gap / padding / align |
| 阴影、边框宽度 | overflow / cursor / position / z-index |
| 背景色、文字色 | display / width / height / text-align |
| 过渡持续时间 | border-style / white-space / text-overflow |

原因是：Tailwind 处理布局类更简洁（`flex items-center gap-2` vs `style={{display:'flex',alignItems:'center',gap:8}}`），且不影响 Inspector 的实时调色能力。

### 新增目录

```
apps/web/src/components/
├── ui/               # UI 原语（可复用组件）
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Icon.tsx
├── shell/            # 布局层（不变）
├── panels/           # 面板层（不变）
├── markdown/         # markdown 渲染（不变）
└── ...               # 现有领域组件
```

现有组件逐步迁移：内联的 Dropdown → `ui/Dropdown.tsx`，workspaceBrowser → 用 Card 原语拼装。

### 设计原则

**不做虚拟壳，原语按可提取标准写，domain 直接接真实业务。**

- `ui/` 下的原语以"明天就提取成独立包"的标准设计——TypeScript 完备、className forwarding、纯表现层零业务依赖
- domain 层（Timeline、Bubble、Panels）直接接 `send()`、zustand store、真实 WebSocket 数据
- 不建虚拟壳，不做假 demo
- 等原语 API 稳定后（至少 2-3 个 domain 组件用完没改过），再考虑提取到独立 package

- OpenHanako: 没有显式的原语层，但 CSS Modules + `composes` 起到了类似效果
- CrystalAgents: `packages/ui/src/components/ui/` 下有 Button、Select、Spinner 等原语
  - 都接入了 `cn()` utility（`import { cn } from '../../lib/utils'`）
  - 都用 className forwarding 模式

---

## 实施顺序

```
Phase 0 (脚手架基础)
  0. 安装 lucide-react + classnames (cn utility)
  1. 创建 apps/web/src/components/ui/ 目录
  2. 实现 cn() utility（classnames merge）
  3. 创建 Icon 原语（lucide 包装，统一 size/strokeWidth）
  4. 创建 Button 原语（variant / size / icon / className forwarding）
  5. 创建 Card 原语（基础卡片容器）
  6. 提取内联 Dropdown → ui/Dropdown.tsx
  7. tokens.ts 加 --crai-shadow-card + --crai-space-* + --crai-transition-fast

Phase 1 (P0 + P1 混合)
  8. 替换 ActivityTimeline emoji → lucide icons
  9. ActivityTimeline 用 Card 原语包裹为卡片容器
  10. 替换 FileTreePanel emoji → lucide icons
  11. 替换 SessionListPanel 零散 emoji
  12. workspaceBrowser modal 改用 Card 原语拼装

Phase 2 (P1 剩余)
  13. 间距体系硬编码替换（从 ActivityTimeline 开始）
  14. 微交互 transition 全覆盖（用 --crai-transition-fast）
  15. 布局属性从 inline style → Tailwind className (flex/gap/padding 等)

Phase 3 (P2)
  16. 安装 framer-motion
  17. 消息 staggered entry
  18. 折叠 height 动画

Phase 4 (P2 + P3 可选)
  19. 字体分层
  20. 阴影体系扩展
  21. 专用输出卡片
```
