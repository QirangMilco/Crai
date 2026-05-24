# Crai 传输协议 (Transport Protocol)

> WebSocket 传输协议定义。实现位于 `packages/transport-ws`。

## 1. 连接

- 地址：`ws://<host>:<port>/`
- 协议：纯文本 WebSocket（无子协议协商）

## 2. 消息格式

所有消息使用 JSON 序列化。每条消息一个 WebSocket 帧。

### 2.1 Server → Client

```typescript
// 事件推送
{ type: 'event', event: string, payload: unknown }

// 用户输入请求（工具确认等）
{ type: 'request:input', id: string, question: string, options?: string[], meta?: Record<string, unknown> }

// Session 操作响应
{ type: 'session:id', id: string }
{ type: 'session:data', sessionId: string, messages: ChatMessage[], todos?: TodoItem[], metadata?: Record<string, unknown> }

其中消息格式 ChatMessage 同上。todos 字段可选，结构：
```typescript
interface TodoItem {
  id: string
  content: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}
```
{ type: 'session:list:data', sessions: Array<{ id, title?, createdAt, updatedAt }> }
{ type: 'session:title', sessionId: string, title: string }

// 配置响应
{ type: 'config:data', config: { providers, defaultModel, toolModel, recentWorkspaces, debugScopes?, variant? } }
{ type: 'config:models:data', providerName: string, models: string[], error?: string }

// 工作区响应
{ type: 'workspace:list:data', current: string|null, workspaces: Array<{ rootDir, config }> }
{ type: 'workspace:switched', rootDir: string, model: string, provider: string }
{ type: 'workspace:config:data', config: { provider?, model?, security?: { mode? } } }

// 目录浏览响应
{ type: 'dir:browse:data', path: string, dirs: string[], files?: Array<{name, path, size, mtime, isDirectory}>, parent?: string, error?: string }

// 错误
{ type: 'error', message: string }
```

### 2.2 Client → Server

```typescript
// Prompt
{ type: 'prompt', sessionId?: string, text: string, model?: string, provider?: string }

// Session 管理
{ type: 'session:new', system?: string }
{ type: 'session:load', sessionId: string }
{ type: 'session:list' }
{ type: 'session:update', sessionId: string, title?: string }
{ type: 'session:generate-title', sessionId: string }

// 配置
{ type: 'config:get' }
{ type: 'config:set', config: any }
{ type: 'config:set:provider', name: string, config: { apiKey, baseURL?, models?, modelsPath? } }
{ type: 'config:remove:provider', name: string }
{ type: 'config:fetch:models', providerName: string }

// 工作区
{ type: 'workspace:list' }
{ type: 'workspace:switch', rootDir: string }
{ type: 'workspace:config:get' }
{ type: 'workspace:config:set', config: { provider?, model?, security?: { mode? } } }

// 目录浏览
{ type: 'dir:browse', path?: string, showFiles?: boolean }
//   showFiles: 是否同时返回文件列表（默认 false）

// 用户输入响应
{ type: 'resolve:input', id: string, value: string }
```

## 3. 事件流

流式事件通过 `{ type: 'event', event, payload }` 推送。以下是主要事件类型：

### 文本流

```
event: model.delta
payload: { workspaceId, session, turnId, delta: string }
```

### 思考流

```
event: thinking.delta
payload: { workspaceId, session, turnId, delta: string }

event: thinking.done
payload: { workspaceId, session, turnId }
```

### 工具流

```
event: tool.start
payload: { workspaceId, session, turnId, toolCallId, name }

event: tool.delta
payload: { workspaceId, session, turnId, toolCallId, delta: string }

event: tool.done
payload: { workspaceId, session, turnId, toolCallId, name, isError?, summary? }

event: tool.blocked
payload: { workspaceId, session, toolCall, reason }
```

### 模型完成

```
event: model.completed
payload: { workspaceId, session, response }
```

### 生命周期

```
event: turn.started / turn.completed / turn.failed
payload: { workspaceId, session, turnId, ... }
```

## 4. 确认流 (request:input)

当工具需要用户确认时：

1. Server → Client: `{ type: 'request:input', id, question, options, meta }`
2. Client 展示确认 UI
3. Client → Server: `{ type: 'resolve:input', id, value: 'allow' | 'deny' }`
4. Server 继续或终止工具执行

`meta.toolName` 可用于前端自动批准同一会话中的重复工具。

## 5. 内部消息模型 (ChatMessage)

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
  blocks?: ContentBlock[]   // 渲染用，流式内容块
  activities?: ActivityItem[]  // CrystalAgents 路线，见 frontend-architecture.md
}

type ContentBlock =
  | { type: 'thinking'; content: string; sealed: boolean }
  | { type: 'tool_group'; tools: ToolCallData[]; collapsed: boolean }
  | { type: 'text'; content: string }

interface ToolCallData {
  toolCallId: string
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary?: string
}
```
