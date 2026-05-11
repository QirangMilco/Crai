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
借鉴自 Eino 的设计，指代可以包裹在模型调用或工具执行外层的可组合逻辑单元。相比于 Hook 的点状拦截，Middleware 强调对整个调用过程的"包裹"和"转换"。

### Command (命令)
注册到运行时命令注册表中的命名操作。命令对于 UI、CLI、自动化和扩展非常有用。

### Transport (传输层)
将运行时连接到外部输入/输出通道的适配器，例如 WebSocket、CLI 或 IM。

### MCP (Model Context Protocol)
一种标准化协议（借鉴自 snow-cli 的集成经验），允许 AI 模型以统一的方式连接到外部工具、数据源和上下文。

### LSP (Language Server Protocol)
用于在开发工具（如 VS Code）中提供智能代码分析能力的协议。在 Crai 中（借鉴自 snow-cli），主要用于 `devtools` 层增强代码库巡检能力。

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

## 记忆术语 (Memory Terms)

### MemoryEntry (记忆条目)
长期记忆的最小单元，采用多视图索引模型。包含语义层（密集向量）、词汇层（稀疏关键词）和符号层（结构化元数据）三个索引维度。一个 MemoryEntry 通常表示一个自包含的、无歧义的事实陈述。

### MemoryScope (记忆作用域)
记忆条目的作用域层级，决定记忆的生命周期和注入优先级：
- `global`（全局）：用户偏好、安全规则、系统级约束，持久有效
- `project`（项目）：项目规范、架构决策、代码约定，跨 Session 有效
- `session`（会话）：当前对话上下文，Session 级有效

### MemoryAdapter (记忆适配器)
记忆存储与检索的抽象契约。Core 层定义接口，具体的策略实现由 Extension 提供。

### Context Injection (上下文注入)
在 Session 启动时，将历史记忆（摘要、观察、相关条目）按 Token 预算注入到系统提示中的过程。注入遵循"摘要优先 → 观察次之 → 语义检索补充"的优先级顺序。

### ContextBundle (上下文包)
上下文注入的输出结果，包含 Session 摘要、观察条目和记忆条目，附带 Token 预算估算。

### Hybrid Retrieval (混合检索)
融合语义检索（密集向量）、关键词检索（BM25）和结构化检索（元数据过滤）三种方式的检索策略，在三路结果上执行去重合并。

### Pyramid Retrieval (金字塔检索)
在 Token 成本敏感场景下按代价逐级展开检索结果：Preview（摘要，低成本）→ Details（全文+元数据，中成本）→ Evidence（原始内容，高成本）。

### Consolidation (记忆整理)
对记忆库进行周期性维护的机制，包括：
- Decay（衰减）：基于重要性和时间降低旧条目权重
- Merge（合并）：检测重复/相似条目并合并
- Prune（裁剪）：移除过期或被取代的条目

### Observation (观察)
在 Session 过程中提取的细粒度发现或决策，类型包括 decision、bugfix、feature、refactor、discovery、change 六类。Observation 比 MemoryEntry 更细粒度，通常携带溯源信息。

### SessionSummary (会话摘要)
Session 结束时生成的紧凑摘要，包含请求、调查内容、收获、完成事项和后续步骤。用于快速恢复跨会话上下文。

### Memory Provenance (记忆溯源)
记录每条记忆的来源信息（源 Session、源事件类型、源事件 ID），确保每条记忆都可追溯到其产生上下文。

## 命名规则 (Naming Rules)

- 在核心文档中，首选 `Session` 而不是 `Conversation`。
- 对于一次"从输入到完成"的周期，首选 `Turn` 而不是 `Run`。
- 首选 `Transport` 而不是 `Notification`，除非该能力仅限于出站通知。
- 在 API 契约中，首选 `ModelAdapter` 而不是 `Provider`。
- 仅对运行时循环所需的行为使用内核特定的术语。
- 避免在核心实体中放置纯 UI 术语。
- 在记忆相关的 API 中，首选 `MemoryEntry` 而不是 `Memory` 或 `Fact`。
- 在作用域讨论中，首选 `MemoryScope` 而不是 `MemoryLevel`。

## Extension API 术语

### Extension Trust Level (Extension 信任级别)
Extension 通过 `defineExtension({ trust })` 声明的权限级别：`restricted`（默认，受限 API 访问）或 `full-access`（全权，需显式声明 + 运行时开关启用）。借鉴 OpenHanako 两级权限模型。

### ExtensionContext
注入到 Extension.setup() 中的上下文对象。包含 runtime、hooks、events（bus）、registry、logger、config、dataDir，以及 register() 和 registerTool() 辅助方法。是所有 Extension 的统一运行时接口。

### register() 模式 (注册-清理模式)
Extension 通过 `ctx.register(disposable)` 向框架声明资源，框架在卸载时逆序自动调用 `dispose()`。借鉴 OpenHanako 的自动资源管理设计。

### SKIP 链 (Skip Chain)
EventBus 的请求-响应模式：同一事件类型可注册多个 handler，按顺序调用。handler 返回 `EventBus.SKIP` 表示"我不处理，交给下一个"。支持多 Extension 按优先级协作。借鉴 OpenHanako EventBus 设计。

### Soft Dependency (软依赖)
通过 `ExtensionManifest.depends.capabilities` 声明和 `bus.hasHandler()` 运行时检测实现的能力依赖。缺失不会阻止 Extension 加载，Extension 自行降级。

### Skills (技能)
独立于 Extension 体系的 Markdown 知识文档（`SKILL.md`）。由 Agent 按需加载，不注册运行时代码。Skills 不是 Extension，但可以随 Extension 一起分发。