# Crai 架构概览

## 1. 项目目标

Crai 是一个 **极简的、默认空心的、高度可扩展的 AI Agent 运行时和应用基座**。

其目标不是构建一个沉重的一体化 Agent 产品，而是提供一个可以通过以下方式扩展的小型核心：
- 模型适配器 (Provider Adapters)
- UI 壳层 (UI Shells)
- IM 传输层 (IM Transports)
- 存储/缓存后端 (Storage/Cache Backends)
- 权限策略 (Permissions Policies)
- 外部 TypeScript 扩展 (Extensions)
- 扩展 (Extensions)

## 2. 非目标 (Non-goals)

Crai 不打算：
- 硬编码单一模型供应商
- 硬编码单一 UI 框架
- 强制要求使用 Electron
- 在核心库中强制要求飞书或任何 IM SDK
- 强制要求固定的存储引擎
- 在 Phase 1 阶段成为工作流引擎
- 将产品特定的业务逻辑捆绑到核心库中

## 3. 架构原则

### 3.0 记忆是跨层关注点 (Memory is Cross-Layer)

记忆是 Crai 体系中一个特殊的跨层关注点，不归属单一层级：

- **Core 层**：定义 `MemoryEntry` 类型和 `MemoryAdapter` 契约，仅关注记忆的数据形状和抽象能力
- **Runtime 层**：在 Session 生命周期中提供记忆触发点（事件/钩子），不实现任何记忆策略
- **Extension 层**：实现具体的记忆策略（Summary 注入、向量检索、知识图谱等）

Runtime 内核不应拥有记忆策略实现。记忆策略由用户自行选择或实现，以独立 extension 形式提供。

> 详细的记忆体系设计请参见 [memory-design.md](memory-design.md)。

### 3.1 核心只感知能力 (Capabilities)
核心 (Core) 应该只理解抽象的能力，例如：
- `ModelAdapter`
- `ToolProvider`
- `StorageAdapter`
- `CacheAdapter`
- `MemoryAdapter`
- `PermissionAdapter`
- `TransportAdapter`
- `Extension`

核心不应该感知这些能力是来自 OpenAI、Web UI、飞书、SQLite 还是任何其他具体实现。

### 3.2 事件优先 (Event First)
每一个重要的运行时动作都应该是可观测的事件：
- session 创建
- 输入接收
- 上下文构建
- 模型请求/响应
- 工具执行
- 持久化
- 扩展加载/卸载
- 传输层消息传递

### 3.3 可钩入的生命周期 (Hookable Lifecycle)
扩展必须能够：
- 观测 (Observe)
- 拦截 (Block)
- 替换 (Replace)
- 补丁 (Patch)
- 装饰 (Decorate)
- 追加副作用 (Append side effects)

### 3.4 默认空心 (Hollow by default)
即使没有模型供应商、没有 UI、没有 IM 传输层，运行时仍然应该能够：
- 启动
- 创建 session
- 接收事件
- 加载扩展
- 通过注入的适配器或预设扩展持久化状态

### 3.5 安全是跨层关注点 (Safety is Cross-Layer)

Crai 的安全防护采用纵深防御策略，在四层同时生效。详见 [security-model.md](security-model.md)。

### 3.7 Middleware 与 Hook 的语义区分

Crai 提供两种生命周期拦截机制：Middleware（洋葱圈包裹）和 Hook（广播/管道）。详见 [core-api-spec.md → 5. Hooks & Middleware](core-api-spec.md#5-钩子与中间件-hooks--middleware)。

### 3.8 Adapter 与 Pipeline 的语义区分

Crai 中有两种可替换的能力单元，虽然底层都使用 `Registry<T>` 注册，但语义不同：

**Adapter** — 对接外部系统。把外部接口（LLM API、文件系统、数据库、缓存系统、权限校验、传输协议、国际化资源）翻译成 Crai 的内部契约。核心动作是 **翻译**。

- `ModelAdapter` → 把 LLM API 翻译成 Crai 的 `request/stream`
- `StorageAdapter` → 把数据库/文件系统翻译成 Crai 的 CRUD
- `CacheAdapter` / `MemoryAdapter` / `TransportAdapter` / `I18nAdapter` → 同上

**Pipeline** — 接管内部流程。替换运行时的一段完整执行逻辑，不是对接外部接口。核心动作是 **接管**。

- `PromptPipeline` → 完全接管 `prompt()` 的全流程
- `SessionPipeline` → 完全接管 session 的创建/销毁/查询

选择依据：如果你需要**引入一个外部系统**，用 Adapter；如果你需要**重写运行时的某个完整流程**，用 Pipeline。

### 3.9 行业基准对齐 (Industry Alignment)
Crai 在设计上积极参考并吸收多个优秀开源项目的工程实践：
- **[OpenHanako](file:///Users/qirang/Documents/Projects/Crai/refs/openhanako)**：借鉴其**两级权限模型（restricted / full-access）**、**EventBus SKIP 链多 handler 协作机制**、**register() 自动资源清理模式**、**错误隔离与前向兼容原则**。这些设计直接作用于 Crai 的 Extension SDK 设计，为 Crai 的运行时提供了一套经过实战验证的扩展管理方案。
- **[CloudWeGo/Eino](file:///Users/qirang/Documents/Projects/Crai/refs/eino)**：借鉴其组件抽象、中间件模式、检查点机制以及**中断/恢复（interrupt/resume）模式**，用于增强内核的治理能力和**人机确认流程**。
- **[pi-mono](file:///Users/qirang/Documents/Projects/Crai/refs/pi-mono)**：借鉴其极简的 Agent 循环设计与 Provider 适配层抽象；以及**扩展级安全门（permission-gate / protected-paths）** 和 **OS 级沙箱（sandbox-exec/bubblewrap）** 实现。
- **[reasonix](file:///Users/qirang/Documents/Projects/Crai/refs/reasonix)**：借鉴其以缓存为中心的语义索引与状态持久化机制，三层记忆作用域（user/project/session）设计；以及**文件系统沙箱（rootDir 强制校验 + 路径遍历检测 + 读写字节上限）**。
- **[crystalagents](file:///Users/qirang/Documents/Projects/Crai/refs/crystalagents)**：借鉴其优雅的前端交互风格与高性能 Markdown 渲染实现；以及**三级权限模式（safe/ask/allow-all）、危险命令黑名单（DANGEROUS_COMMANDS）、工作空间级 permissions.json 配置**。
- **[snow-cli](file:///Users/qirang/Documents/Projects/Crai/refs/snow-cli)**：借鉴其完善的 MCP 集成、LSP 支持以及工具确认流（Tool Confirmation Flow）的交互设计；以及**自毁命令检测（防止 agent 杀掉自身进程）和技能级 allowed-tools 白名单**。
- **[SimpleMem](file:///Users/qirang/Documents/Projects/Crai/refs/SimpleMem)**：借鉴其三阶段记忆流水线（语义压缩 → 混合检索 → 答案生成）、多视图索引模型（语义/词汇/符号三层）、跨会话记忆生命周期管理以及 Token 预算分层上下文注入策略。

## 4. 推荐包边界

```txt
@crai/core
@crai/runtime
@crai/loader-ts
```

### 4.1 `@crai/core`
包含：
- 共享类型
- 事件定义 (Events)
- 钩子定义 (Hooks)
- 适配器契约 (Adapter contracts)
- 注册表契约 (Registry contracts)
- 错误与日志类型
- 记忆类型定义 (`MemoryEntry`, `MemoryScope`, `MemoryProvenance`)
- 记忆适配器契约 (`MemoryAdapter`)
- **安全类型定义 (`ToolSafetyLevel`, `PermissionMode`, `SandboxScope`)**
- **权限适配器契约 (`PermissionAdapter`)**
- **Extension 类型定义 (`ExtensionManifest`, `ExtensionConfigStore`)**
- **EventBus 契约（含 SKIP 链语义）**

### 4.2 `@crai/runtime`
包含：
- 最小运行时内核 (Minimal runtime kernel)
- Session 管理器
- Turn 执行器 (Turn runner)
- 事件总线 (Event bus，含 SKIP 链实现)
- 钩子总线 (Hook bus)
- 扩展生命周期管理
- 扩展加载与卸载
- 适配器分发 (Adapter dispatch)
- **工具执行前的安全检查拦截**
- **文件路径沙箱校验**

### 4.3 `@crai/core` (defineExtension)
`defineExtension()` 辅助函数已合入 `@crai/core`，扩展作者只需 import 此包。
- 类型化的钩子辅助方法 (typed hook helpers)
- 重导出的核心类型 (re-exported core types)
- `register()` 资源管理辅助

### 4.4 `@crai/loader-ts`
包含：
- 本地 TypeScript 扩展加载
- 支持重新加载和卸载
- 监听模式 (Watch-mode) 工具
- 支持重新加载和卸载
- 用于开发的监听模式 (watch-mode) 辅助工具

## 5. 源码吸收与落位原则 (Source Absorption & Placement)

本项目遵循 **选择性的项目吸收**，而不是完整的仓库复制。吸收的代码必须严格按照层级进行落位。

### 5.1 核心层 (Core / Runtime) - 吸收自 pi-mono / Eino
- **pi-mono**: 借鉴其轻量级的 `AgentLoop` 调度逻辑、`ModelProvider` 接口定义，确保内核足够薄。
- **Eino**: 借鉴其中间件 (Middleware) 管道设计和检查点 (Checkpoint) 机制，增强执行流的可控性。

### 5.2 扩展层 (Extensions) - 吸收自 OpenHanako / reasonix / snow-cli
- **OpenHanako**: 借鉴其两级权限模型（restricted / full-access）、EventBus SKIP 链设计、register() 资源管理、错误隔离和前向兼容原则，直接作用于 `@crai/core` 的扩展契约设计。
- **reasonix**: 吸收其语义缓存 (Semantic Cache) 逻辑和状态持久化策略，作为 `CacheAdapter` 的参考实现落位到 `packages/cache-default`。
- **snow-cli**: 吸收其 MCP (Model Context Protocol) 客户端实现和工具确认工作流，落位到独立 extension 包。

### 5.3 应用与 UI 层 (App / Shell) - 吸收自 crystalagents / snow-cli
- **crystalagents**: 吸收其现代化的前端 UI 风格、主题系统以及基于 Markdown 的产物渲染逻辑，落位到 `apps/web` 或 `packages/ui-kit`。
- **snow-cli**: 吸收其 LSP (Language Server Protocol) 集成和仓库分析逻辑，落位到 `packages/devtools`。

### 5.4 记忆层 (Memory) - 吸收自 SimpleMem / reasonix
- **SimpleMem**: 吸收其三阶段记忆流水线（语义压缩→混合检索→答案生成）、多视图索引模型（语义/词汇/符号三层）以及 Token 预算分层上下文注入策略。记忆策略以独立 extension 形式实现。
- **reasonix**: 吸收其三层记忆作用域（user/project/session）设计，作为 MemoryScope 分层模型参考。

### 5.5 安全层 (Safety) - 吸收自 CrystalAgents / reasonix / snow-cli / pi-mono
- **CrystalAgents**: 吸收其三级权限模式（safe/ask/allow-all）、危险命令黑名单（`DANGEROUS_COMMANDS`）和工作空间级 `permissions.json` 配置，作为安全配置的参考实现。
- **reasonix**: 吸收其文件系统沙箱（`safePath` 路径遍历检测 + `rootDir` 强制校验 + 读写字节上限）和只读模式开关，作为 runtime 层面 `SandboxScope` 校验逻辑的参考实现。
- **snow-cli**: 吸收其自毁命令检测（`isSelfDestructiveCommand`）和危险命令正则模式（`DANGEROUS_PATTERNS`），作为危险命令匹配器的参考实现。
- **pi-mono**: 吸收其 OS 级沙箱集成模式（sandbox-exec / bubblewrap 作为 extension），作为 Phase 3 的可选沙箱策略参考。

### 5.6 经验法则
如果一段代码会将供应商/UI/IM 强制引入核心，那么请重写它，或者将其落位到应用层/扩展层。

## 6. 阶段划分 (Phase Split)

### Phase 1
- 核心类型
- 最小运行时内核
- 扩展加载
- 基础事件/钩子流水线
- 一个模型适配器
- 一个存储适配器
- 最小 UI 或 CLI 入口点
- 提供默认行为的预设扩展
- **记忆类型定义与适配器契约 (MemoryEntry/MemoryAdapter，仅 Core 层)**
- **Session 生命周期中的记忆事件/钩子触发点 (仅 Runtime 层)**
- **工具安全级别系统：ToolDefinition 必须声明 safetyLevel**
- **危险命令模式检测：默认危险命令列表 + 可扩展匹配器**
- **权限模式运行时切换：safe / ask / execute 三级模式**
- **文件系统路径沙箱：rootDir 校验 + 路径遍历检测**
- **扩展权限声明强制执行：bootstrap 中实现权限验证**

### Phase 2
- 更丰富的传输适配器
- 缓存策略
- 命令系统
- 更好的持久化和快照/检查点能力
- 更多可选的运行时服务
- **完整的记忆策略实现（独立 extension）**
- **分层 Token 预算上下文注入**
- **混合检索与记忆整理机制**

### Phase 3
- 多传输层协调
- 高级 UI 壳层 / 瘦客户端支持
- **OS 级沙箱选项（sandbox-exec / bubblewrap）**
- **多模态记忆支持 (向量 + 知识图谱)**
- **可插拔的记忆后端**

## 7. 文档规则 (Documentation Rules)

- 将架构与 API 规格分离
- 将数据模型与流程图分离
- 将实施计划与设计意图分离
- 优先选择短小、专注的文档，而不是一份巨大的混合草案
