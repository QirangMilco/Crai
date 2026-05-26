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
{ type: 'session:data', sessionId: string, messages: ChatMessage[], todos?: TodoItem[], metadata?: Record<string, unknown>, activities?: ActivityItem[] }
{ type: 'session:list:data', sessions: Array<{ id, title?, createdAt, updatedAt }> }
{ type: 'session:title', sessionId: string, title: string }

// 配置响应
{ type: 'config:data', config: GlobalConfig }
{ type: 'config:models:data', providerName: string, models: string[], error?: string }
{ type: 'config:test:result', ok: boolean, error?: string }
{ type: 'config:known-models:data', firstParty: Array<{name, label, defaultBaseURL}>, knownModels: KnownModelsMap, thinkingLevels: Record<string, string[]>, defaultThinkingLevels: Record<string, string> }

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
{ type: 'prompt', sessionId?: string, text: string, model?: string, provider?: string, thinkingLevel?: string, mode?: string }

// Session 管理
{ type: 'session:new', system?: string }
{ type: 'session:load', sessionId: string }
{ type: 'session:list' }
{ type: 'session:update', sessionId: string, title?: string, mode?: string, thinkingLevel?: string }
{ type: 'session:delete', sessionId: string }
{ type: 'session:generate-title', sessionId: string }

// 配置
{ type: 'config:get' }
{ type: 'config:set', config: GlobalConfig 的部分字段 }
{ type: 'config:set:provider', name: string, config: ProviderConfig }  // 含 modelConfigs
{ type: 'config:remove:provider', name: string }
{ type: 'config:fetch:models', providerName: string }
{ type: 'config:test', providerName: string }
{ type: 'config:known-models' }

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
payload: { session, turnId, delta: string }
```

### 思考流（Activity Timeline 模式）

```
event: activity.start
payload: { session, turnId, activityId, intent?: string }

event: activity.delta  
payload: { session, turnId, activityId, delta: string }

event: activity.done
payload: { session, turnId, activityId, name?: string, isError?: boolean, content?: ToolResultContent[] }
```

### 工具流

```
event: tool.start
payload: { session, turnId, toolCallId, name, toolInput }

event: tool.delta
payload: { session, turnId, toolCallId, delta: string }

event: tool.done
payload: { session, turnId, toolCallId, name, isError?, summary? }
```

### 模型完成

```
event: model.completed
payload: { session, response }
```

### 生命周期

```
event: turn.started / turn.completed / turn.failed
payload: { session, turnId, ... }
```

## 4. 确认流 (request:input)

当工具需要用户确认时：

1. Server → Client: `{ type: 'request:input', id, question, options, meta }`
2. Client 展示确认 UI
3. Client → Server: `{ type: 'resolve:input', id, value: 'allow' | 'deny' }`
4. Server 继续或终止工具执行

`meta.toolName` 可用于前端自动批准同一会话中的重复工具。

## 5. 消息模型

### 5.1 ChatMessage

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  text?: string          // 前端渲染文本
  parts?: MessagePart[]  // 原始消息部件
  createdAt: number
  activities?: ActivityItem[]
  content?: ToolResultContent[]  // tool 消息的工具结果
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool-call'; toolCallId: string; name: string; arguments: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; name: string; content: ToolResultContent[]; isError?: boolean }

interface ToolResultContent {
  type: 'text'
  text: string
}
```

### 5.2 ActivityItem

```typescript
interface ActivityItem {
  id: string
  type: 'thinking' | 'tool'
  status: 'running' | 'success' | 'error'
  intent?: string
  content?: ToolResultContent[]
  toolCallId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
}
```

### 5.3 TodoItem

```typescript
interface TodoItem {
  id: string
  content: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}
```

### 5.4 GlobalConfig

```typescript
interface GlobalConfig {
  providers: Record<string, ProviderConfig>
  defaultModel?: string       // 格式：provider/model
  toolModel?: string          // 工具调用/摘要专用模型
  sandboxEnabled?: boolean
  compressionThreshold?: number  // 0~1，默认 0.8
  keepRecentTokens?: number      // 默认 32000
  customContextWindows?: Record<string, number>
  recentWorkspaces: string[]
  variant?: string
  debugScopes?: string[]
}
```

### 5.5 ProviderConfig

```typescript
interface ProviderConfig {
  apiKey?: string
  baseURL?: string
  models?: string[]
  modelsPath?: string           // 获取模型列表的 API 路径
  modelConfigs?: Record<string, ModelConfig>
}

interface ModelConfig {
  displayName?: string
  contextWindow?: number
  maxOutput?: number
  vision?: boolean
}
```
