# 前端架构：Agent 工作台

## 定位

长期目标是 **Agent 工作台**，而非简易 AI 聊天框。工具调用是核心工作项（work items），不是聊天消息的附属。

## 数据模型

### 当前（Phase 1+2 完成后）

```typescript
interface ActivityItem {
  id: string
  type: 'thinking' | 'tool' | 'status' | 'plan'
  status: 'pending' | 'running' | 'completed' | 'error' | 'backgrounded'
  toolName?: string
  toolCallId?: string
  toolInput?: Record<string, unknown>
  content?: string          // thinking 文本 / tool 结果摘要
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

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string              // 纯文本（流式累积 + Markdown 渲染）
  createdAt: number
  activities?: ActivityItem[]  // 活动列表（与文本分离渲染）
  blocks?: ContentBlock[]      // 仅旧 session 回放兼容
}
```

### 目标（远期）

```typescript
// blocks 字段完全移除，所有旧 session 数据通过 parts 重建 activities
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  activities?: ActivityItem[]
}
```

## 阶段完成状态

### Phase 1 ✅ 协议层（transport-ws + turnRunner）

- [x] 核心类型：`ActivityItem` / `ActivityType` / `ActivityStatus` 加入 `@crai/core/types.ts`
- [x] 事件类型：`activity.start` / `activity.delta` / `activity.done` 加入 EventMap
- [x] turnRunner 发射 activity.* 事件（同时保留旧生命周期事件 TOOL_REQUESTED/COMPLETED/FAILED）
- [x] `buildActivitiesFromParts` 函数用于 session:data 重建
- [x] `session:data` 中携带 `activities` 数组

### Phase 2 ✅ 前端 Store + 渲染

- [x] `ChatMessage.activities` 字段
- [x] Store actions：`addActivity` / `updateActivity` / `completeActivity`
- [x] 文本流式写入 `msg.text`，不再使用 blocks
- [x] 移除旧 action：`streamThinking` / `sealThinking` / `addTool` / `doneTool`
- [x] 移除旧 ChatView handler：`thinking.*` / `tool.*`
- [x] `ActivityTimeline` + `ActivityRow` 组件
- [x] MessageBubble 双轨渲染（旧 session → blocks，新 session → text + activities）
- [x] 移除 `_sb.thinking` buffer、`forceNewTextBlock` 等 hack

### Phase 3 🔲 前端 UI 完善

- [x] ActivityRow 展示 intent 文本
- [x] 文本区域内只包含最终回复（intent 文本归到 activity）
- [ ] `ActivityDetail` 面板：完整 tool input/output 展示
- [ ] 思考活动自动折叠（thinking 完成后折叠）
- [ ] `ActivityGroup` 组件：子 agent 的工具执行组，可折叠
- [ ] 动画：staggered 入场、状态切换动效
- [ ] 后台任务指示器：实时 elapsed 时间显示

### Phase 4 ✅ 清理

- [x] 删除旧 `blocks` 和 `ContentBlock` 类型
- [x] 删除 `buildBlocksFromParts` 函数
- [x] 删除 `ThinkingBlock.tsx` / `ToolBlock.tsx` 组件
- [x] 删除 `ContentBlocksRenderer` 和相关代码

## 设计原则

1. **增量迁移**：不一次性重写，新旧结构并行，逐步切换
2. **服务端权威**：activities 顺序以服务端 parts 为准，流式期间本地增量，最终被覆盖
3. **交互优先**：每个 activity 最终都可点击展开查看完整内容
