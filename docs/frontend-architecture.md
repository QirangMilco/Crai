# 前端架构：Agent 工作台

## 定位

长期目标是 **Agent 工作台**，而非简易 AI 聊天框。工具调用是核心工作项（work items），不是聊天消息的附属。

## 数据模型

### 当前（待迁移）

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  blocks?: ContentBlock[]  // text, thinking, tool_group 交错
}
```

### 目标（CrystalAgents 路线）

```typescript
interface ActivityItem {
  id: string
  type: 'tool' | 'thinking' | 'status' | 'plan'
  status: 'pending' | 'running' | 'completed' | 'error' | 'backgrounded'
  toolName?: string
  toolCallId?: string
  toolInput?: Record<string, unknown>
  content?: string          // 输出/结果文本
  intent?: string           // 模型说明"为什么调这个工具"
  displayName?: string      // 人类可读的工具名
  toolDisplayMeta?: { icon?: string; color?: string }
  parentId?: string         // 子 agent 的父活动 ID
  depth?: number            // 嵌套层级
  error?: string
  elapsedSeconds?: number   // 后台任务已运行秒数
  isBackground?: boolean
  timestamp: number
}

interface AssistantResponse {
  text: string              // 纯文本回复（Markdown 渲染）
  isStreaming: boolean
  activities: ActivityItem[]
}

// 消息结构
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  createdAt: number
  // assistant 消息：
  text?: string             // text content（新结构）
  isStreaming?: boolean
  activities?: ActivityItem[]
  // 兼容旧 blocks（迁移过渡期）
  blocks?: ContentBlock[]
}
```

## 阶段计划

### Phase 1：协议层（transport-ws）

- [ ] 新增 `activity:*` 事件类型，替代 `tool.*` + `thinking.*`：
  - `activity.start` → 取代 `tool.start` + `thinking.delta` 的开始
  - `activity.delta` → 活动内容增量（thinking 或 tool 中间输出）
  - `activity.done` → 取代 `tool.done`
  - `activity.error` → 取代 `tool.blocked` / `tool.error`
- [ ] `session:data` 中携带 `activities` 数组（覆盖本地流式 activities）
- [ ] 过渡期：服务端同时发送新旧两套事件，前端按 feature flag 选择

### Phase 2：前端 Store

- [ ] `ChatMessage` 支持 `activities` 字段
- [ ] 新增 store actions：`addActivity` / `updateActivity` / `completeActivity` / `errorActivity`
- [ ] 移除 blocks 中 tool_group 的增删逻辑（或逐步废弃）
- [ ] `ActivityItem` 状态管理：支持 backgrounded 状态、elapsed 计时器

### Phase 3：前端 UI

- [ ] `ActivityTimeline` 组件：左侧边线 + 活动列表
- [ ] `ActivityRow` 组件：图标 + 名称 + 状态 + 意图文本 + 展开详情
- [ ] `ActivityDetail` 面板：完整 tool input/output 展示
- [ ] `ActivityGroup` 组件：子 agent 的工具执行组，可折叠
- [ ] 动画：staggered 入场、状态切换动效
- [ ] 后台任务指示器：实时 elapsed 时间显示

### Phase 4：清理

- [ ] 删除旧的 `blocks` 和 `ContentBlock` 类型
- [ ] 删除 `tool.*` / `thinking.*` 事件处理（改用 activity 事件）
- [ ] 删除 `forceNewTextBlock`、`reverse().findIndex()` 等 hack

## 设计原则

1. **增量迁移**：不一次性重写，新旧结构并行，逐步切换
2. **服务端权威**：activities 顺序以服务端 parts 为准，流式期间本地增量，最终被覆盖
3. **交互优先**：每个 activity 最终都可点击展开查看完整内容
