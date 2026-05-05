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
- 快照 / 检查点 (Snapshots / Checkpoints)
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

### 4.2 迁移钩子 (Migration hook)

存储适配器或运行时服务应当能够在核心内核使用旧记录之前对其进行迁移。

建议的辅助形状：
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

建议的调用时机：
- 从存储中读取记录
- 检查类型和版本
- 运行适用的迁移链
- 将迁移后的记录交给运行时

### 4.3 向后兼容性 (Backward compatibility)

优先考虑增加性变更，而不是破坏性变更。

好的变更：
- 添加可选字段
- 添加新的消息部分子类型
- 添加新的事件类型

高风险变更：
- 重命名必需字段
- 更改现有字段的语义
- 删除当前已持久化的属性

## 5. 持久化策略 (Persistence Strategy)

### 5.1 追加优先 (Append-first)

在可能的情况下，优先为以下内容使用“仅追加”写入：
- 消息 (Messages)
- Turn
- 事件 (Events)
- 工具执行追踪 (Tool execution traces)

### 5.2 快照与日志 (Snapshot plus log)

对于长期运行的会话，一个实用的策略是：
- 追加详细的事件或消息
- 定期写入会话快照或检查点 (Session Snapshot / Checkpoint)
- 从快照 + 尾部日志重建当前状态

## 6. 建议的缺失实体 (Recommended Missing Entities)

这些在第一个核心 API 草案中不是强制性的，但在实现之前应当予以考虑：
- Workspace
- Turn
- 附件 / 文件 (Attachment / File)
- 任务 / 作业 (Task / Job)
- 检查点 / 快照 (Checkpoint / Snapshot)
- 执行追踪 (Execution trace)

## 7. 迁移示例 (Migration Example)

一个简单的版本升级示例：
- `Session v1` 存储 `title`
- `Session v2` 将其重命名为 `name`
- 迁移步骤读取 v1，执行 `title -> name` 的映射，并返回 v2 形状的数据

这保持了迁移行为的显式化，并避免了每个存储适配器都发明自己的升级风格。

## 8. 实现注意事项 (Notes for Implementation)

- Do not store UI-only state in core entities.
- Do not overload Metadata to replace proper schema fields.
- Keep identity fields stable and predictable.
- Make replay and debugging a first-class consideration.
- Keep migrations explicit and testable.
