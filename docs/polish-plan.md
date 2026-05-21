# 前端体验打磨计划

> 对比 refs/crystalagents 和 refs/openhanako，做系统性差距分析。
> 按「地基 → 上层」的顺序分层实施。

---

## 差距：9 层架构

组成一个优质前端界面的完整维度。Crai 在每一层上的差距：

### 第 1 层：色值体系（Color System）

**这是什么**：颜色之间的数学关系。决定了整个界面是否协调。

| | CrystalAgents | OpenHanako | Crai |
|---|---|---|---|
| 色彩空间 | `oklch` + `color-mix()` 自动衍生 | 手调 CSS 变量 | hex 硬编码 |
| 表面层级 | 10 级（foreground-2~95） | 5 级 | 3 级（bg/s/tertiary） |
| 换主题 | accent 一变，全部跟随 | 手动调 | 手动调 |
| 分割线 | 前景色 5% 透明度，极浅 | rgba(0,0,0,0.1) | `#e5e7eb` 固定 |

**这是地基。地基不正，上面再怎么打磨也看不出效果。**

### 第 2 层：表面层级（Surface Hierarchy）

**这是什么**：每个元素"在界面里有多深"的信号。背景、卡片、弹窗、下拉菜单应该有不同的表面色。

Crai 所有覆盖层（对话框、弹窗、侧栏、卡片）都用同一个 `--crai-bg`，没有分层。

### 第 3 层：边框哲学（Border Treatment）

**这是什么**：边框的深浅和用法。一条线的透明度决定了界面的精致度。

Crai 全界面用同一个 `--crai-border: #e5e7eb`。CrystalAgents 的边框是前景色 5% 透明度，深色模式自动变浅。

### 第 4 层：阴影系统（Shadow System）

**这是什么**：多层 shadow 组合出深度感。

| | CrystalAgents | Crai |
|---|---|---|
| 阴影层数 | 5 级（从 minimal 到 elevated） | 3 级 |
| 衍生方式 | 从 foreground-rgb 计算 | 固定 rgba |
| 含义 | 每个阴影对应一个语义层级 | bubble/panel/modal 堆砌 |

### 第 5 层：组件视觉语法（Component Grammar）

**这是什么**：所有组件共用一套边框、圆角、focus ring 规则。这是「一致性」的来源。

CrystalAgents 所有组件从 `--border`、`--ring`、`--radius` 衍生。Crai 每个组件自己写 borderRadius 和 borderColor。

### 第 6 层：微交互（Micro-interactions）

**这是什么**：每个可交互元素 hover/click/focus 时的反馈。

CrystalAgents 用 framer-motion，OpenHanako 用 `transition: 0.15s` 全覆盖。Crai 有全局 transition 规则但部分组件没覆盖到。

### 第 7 层：间距韵律（Spacing Rhythm）

**这是什么**：所有元素之间的间距遵守同一套尺度。

OpenHanako 用 `--space-xs` 到 `--space-xl` 命名尺度，全界面遵守。Crai 有 token 但组件在用。

### 第 8 层：排版（Typography）

**这是什么**：字体选择、字重、行高、letter-spacing 的体系。

CrystalAgents 用 Inter 字体 + font-feature-settings。OpenHanako 正文 serif、UI sans。Crai 刚加了 font token。

### 第 9 层：内容密度（Content Density）

**这是什么**：每屏能放多少信息，间距是紧凑还是宽松。

CrystalAgents 紧凑但呼吸感好，OpenHanako 宽松卡片式。Crai 不一致。

---

## 独特优势：Inspector 系统

Crai 的 Inspector 面板（实时编辑 token / 预设 / 定位模式）是两个 ref 都没有的特性。
CrystalAgents 的设计系统是编译时确定的，OpenHanako 的 CSS 变量是静态的。
Crai 可以在运行时调色、调字号、调间距，立即看到效果。

**打磨计划中 Inspector 的角色**：所有新增 token 必须注册到 Inspector。
后续可做面板配置 UI、token 搜索、样式快照导出。

---

## 实施顺序

```
Phase 0 — 色值体系重构（第1~3层，地基）✅
  ✅ 0. 将 Crai 的 hex 色值替换为 oklch + color-mix 体系
  ✅ 1. 重建表面层级：--crai-bg-3/5/8/12 + --crai-fg-40/60
  ✅ 2. 边框改为从 foreground 衍生（color-mix 8% / 15%）
  ✅ 3. 暗色模式同步（仅 5 个基色，其余 color-mix 自动计算）
  ✅ 4. 所有组件色值 token 改为引用 var(--crai-bg-*)、var(--crai-fg-*)
  ✅ 5. 向后兼容别名（旧 --crai-bg-secondary 等 → 新层级）

Phase 1 — 组件语法统一（第5层）
  ⬜ 5. 统一 border-radius：所有组件用 --crai-radius token
  ⬜ 6. 统一 focus ring：所有输入框/按钮用 --crai-ring token
  ⬜ 7. 统一 shadow 语义：确认每个组件用了正确的阴影层级

Phase 2 — 微交互 + 间距落实（第6~7层）✅
  ✅ 8. 审查全组件 transition 覆盖（补漏）— 全局 CSS 规则覆盖所有 button/select/input
  ✅ 9. 间距 token 替换硬编码 — 主要组件用 Tailwind 间距类，剩余硬编码并入后续深挖

Phase 3 — 阴影 + 排版 + 密度 ✅
  ✅ 10. 阴影系统完善 — 补充 --crai-shadow-minimal token，现有 shadow 层级覆盖基础需求
  ⬜ 11. 排版细节（line-height, letter-spacing）— 需视觉审查，并入后续区域深挖
  ⬜ 12. 内容密度审计 — 需视觉审查，并入后续区域深挖

--- 已完成的打磨（图标、动画、卡片、输出组件）---

已做（作为旧 Phase 0~4 完成）：
  ✅ lucide-react + framer-motion
  ✅ UI 原语（Icon/Button/Card/Dropdown/cn/ToolOutputCard）
  ✅ 全界面 emoji → lucide icons 替换
  ✅ ActivityTimeline 卡片化 + 折叠动画
  ✅ 消息 staggered entry + 侧栏 fade-in
  ✅ 字体分层（sans/serif/mono）
  ✅ 阴影扩展（shadow-card/elevated）
  ✅ 全局 transition 规则
```
