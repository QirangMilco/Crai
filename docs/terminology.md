# Crai 术语表 (Terminology)

本文档定义了 Crai 文档和代码中使用的首选术语。

## 核心术语 (Core Terms)

### Runtime (运行时)
协调 Session、钩子、事件、模型适配器、工具、存储和扩展的执行引擎。

不要使用 Runtime 来指代 UI、桌面壳层或供应商 SDK。

### Core (核心)
轻量级的契约层。包含共享类型、适配器接口、事件定义、钩子定义、注册表契约以及基础错误/日志类型。

Core 不应依赖于供应商 SDK、UI 框架、Electron、IM SDK 或具体的存储引擎。

### Extension (扩展)
由用户或包提供的模块，可以注册钩子、命令、提供者、工具、传输层、缓存策略、权限策略或其他运行时行为。

### Adapter (适配器)
外部能力契约的具体实现，例如模型、存储、缓存、权限或传输层。

### Registry (注册表)
运行时拥有的集合，扩展和自举代码可以在其中注册适配器、工具、命令或其他能力。

## 对话术语 (Conversation Terms)

### Workspace (工作空间)
项目或环境的产品级容器。Workspace 对于最小运行时内核不是必需的，但对于 UI/产品层非常有用。

在 Phase 1 中，不应将 Workspace 视为必需的核心实体。

### Session (会话)
一个连续用户任务或对话的主要运行时容器。一个 Session 拥有消息 (Messages)、Turn、Artifact 和元数据 (Metadata)。

### Turn
Session 内部的一次执行周期。一个 Turn 通常从输入开始，可能包括上下文构建、模型请求、模型流式处理、工具调用、持久化以及完成/失败。

### Message (消息)
由类型化部分 (Parts) 组成的持久化交互单元。消息应当保持 UI 无关性。

### Message Part (消息部分)
消息内容的类型化片段，例如文本、图像、工具调用或工具结果。

### Artifact (产物)
与 Session 关联的生成或附加资产，例如文件、渲染输出、快照、图像或日志。

## 执行术语 (Execution Terms)

### Event (事件)
关于已发生事情的已发布事实。事件是观测性的，不应直接由其自身改变运行时状态。

### Hook (钩子)
一个拦截点，可以观测、阻塞、替换或补丁运行时生命周期中的值。

### Middleware / Interceptor (中间件/拦截器)
借鉴自 Eino 的设计，指代可以包裹在模型调用或工具执行外层的可组合逻辑单元。相比于 Hook 的点状拦截，Middleware 强调对整个调用过程的“包裹”和“转换”。

### Command (命令)
注册到运行时命令注册表中的命名操作。命令对于 UI、CLI、自动化和扩展非常有用。

### Transport (传输层)
将运行时连接到外部输入/输出通道的适配器，例如 WebSocket、CLI 或 IM。

### Provider (提供者)
模型服务实现，例如 OpenAI、Anthropic、DeepSeek 或自定义模型端点。在 Crai 文档中，提及核心契约时首选使用 `ModelAdapter`。

主要在产品说明中使用 `Provider`，而不在核心契约中使用。

## 存储术语 (Storage Terms)

### Storage Adapter (存储适配器)
用于 Session、消息、产物以及最终用于 Turn/快照的具体实现。

### Snapshot / Checkpoint (快照/检查点)
`Snapshot` 是当前 Session 状态的持久化摘要。`Checkpoint`（借鉴自 Eino）特指在 Turn 执行过程中的关键状态保存点，用于在发生中断（如人机确认）后能够精确恢复执行流。

### Append Log (追加日志)
只增的消息、事件或 Turn 追踪记录序列。

## 命名规则 (Naming Rules)

- 在核心文档中，首选 `Session` 而不是 `Conversation`。
- 对于一次“从输入到完成”的周期，首选 `Turn` 而不是 `Run`。
- 首选 `Transport` 而不是 `Notification`，除非该能力仅限于出站通知。
- 在 API 契约中，首选 `ModelAdapter` 而不是 `Provider`。
- 仅对运行时循环所需的行为使用内核特定的术语。
- 避免在核心实体中放置纯 UI 术语。
