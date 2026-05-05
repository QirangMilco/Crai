# Crai 数据模型 (Data Model)

## 1. 模型目标

数据模型应当具备以下特性：
- 小型化
- 显式化
- 可版本化
- 追加友好 (Append-friendly)
- 适用于重放 (Replay) 和持久化

## 2. 核心实体

### 2.1 Workspace

Workspace 是顶级项目容器。它在核心 API 草案中是可选的，但如果 Crai 管理多个项目或环境，它应该存在于产品层。

建议字段：
```ts
interface Workspace {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}
```

### 2.2 Session

Session 是对话和工具活动的主要运行时容器。

建议语义：
- 一个 Session 归组一个连续的任务或工作线程
- Session 状态应当是持久的
- Session 元数据 (Metadata) 应当保持精简且具有描述性
- Session 应当足以从存储中重建上下文

### 2.3 Turn

Turn 是 Session 内部的一次“请求/响应”执行周期。

建议字段：
```ts
interface Turn {
  id: string
  sessionId: string
  createdAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "stopped"
  metadata?: Record<string, unknown>
}
```

Turn 的用途：
- 追踪一次模型调用周期
- 归组工具调用 (Tool calls)
- 记录重试或失败状态
- 支持流式重放 (Stream replay)

### 2.4 Message

Message 是交互单元的持久化表示。

建议行为：
- Message 应当是只增的 (Append-only)
- Part 应当携带具体的有效负载 (Payloads)
- 工具调用和工具结果应当通过 `toolCallId` 保持可追溯性
- 避免将纯 UI 数据混入 Message 核心字段

### 2.5 Artifact

Artifact 存储生成的或附加的内容，例如：
- 源文件
- 渲染输出
- 快照 (Snapshots)
- 日志
- 图像

Artifact 应当同时支持内联内容和外部 URI 引用。

## 3. 状态关系

建议关系：
- Workspace 1 -> N Session
- Session 1 -> N Turn
- Session 1 -> N Message
- Session 1 -> N Artifact
- Turn 1 -> N 工具执行记录

## 4. 版本化规则

### 4.1 Schema 版本化

每一条持久化记录都应当有版本策略。至少存储层应当知道：
- 记录类型
- 记录 Schema 版本
- 如果需要，提供迁移路径

建议的记录封装 (Envelope)：
```ts
interface RecordEnvelope<T> {
  type: string
  version: number
  data: T
}
```

### 4.2 Migration hook

A storage adapter or runtime service should be able to migrate old records before they are used by the kernel.

Suggested helper shape:
```ts
interface MigrationContext {
  fromVersion: number
  toVersion: number
  recordType: string
}

interface MigrationStep<T = unknown> {
  fromVersion: number
  toVersion: number
  migrate(record: T, ctx: MigrationContext): T | Promise<T>
}
```

Suggested call timing:
- read record from storage
- inspect type and version
- run the applicable migration chain
- hand the migrated record to the runtime

### 4.3 Backward compatibility

Prefer additive changes over breaking changes.

Good changes:
- add optional field
- add new message part subtype
- add new event type

Risky changes:
- rename required field
- change semantic meaning of existing field
- remove a currently persisted property

## 5. Persistence Strategy

### 5.1 Append-first

Where possible, prefer append-only writes for:
- messages
- turns
- events
- tool execution traces

### 5.2 Snapshot plus log

For long-running sessions, a practical strategy is:
- append detailed events or messages
- periodically write a session snapshot
- rebuild the current state from snapshot + tail log

## 6. Recommended Missing Entities

These are not mandatory in the first core API draft, but they should be considered before implementation:
- Workspace
- Turn
- Attachment / File
- Task / Job
- Snapshot
- Execution trace

## 7. Migration Example

A simple example of a version upgrade could be:
- `Session v1` stores `title`
- `Session v2` renames it to `name`
- a migration step reads v1, maps `title -> name`, and returns the v2 shape

This keeps migration behavior explicit and avoids each storage adapter inventing its own upgrade style.

## 8. Notes for Implementation

- Do not store UI-only state in core entities.
- Do not overload Metadata to replace proper schema fields.
- Keep identity fields stable and predictable.
- Make replay and debugging a first-class consideration.
- Keep migrations explicit and testable.
