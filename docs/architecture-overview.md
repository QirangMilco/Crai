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
- 提供默认行为的预设扩展 (Preset Extensions)

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

### 3.1 核心只感知能力 (Capabilities)
核心 (Core) 应该只理解抽象的能力，例如：
- `ModelAdapter`
- `ToolProvider`
- `StorageAdapter`
- `CacheAdapter`
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

### 3.5 行业基准对齐 (Industry Alignment)
Crai 在设计上积极参考并吸收多个优秀开源项目的工程实践：
- **[CloudWeGo/Eino](file:///Users/qirang/Documents/Projects/Crai/refs/eino)**：借鉴其组件抽象、中间件模式和检查点机制，用于增强内核的治理能力。
- **[pi-mono](file:///Users/qirang/Documents/Projects/Crai/refs/pi-mono)**：借鉴其极简的 Agent 循环设计与 Provider 适配层抽象。
- **[reasonix](file:///Users/qirang/Documents/Projects/Crai/refs/reasonix)**：借鉴其以缓存为中心的语义索引与状态持久化机制。
- **[crystalagents](file:///Users/qirang/Documents/Projects/Crai/refs/crystalagents)**：借鉴其优雅的前端交互风格与高性能 Markdown 渲染实现。
- **[snow-cli](file:///Users/qirang/Documents/Projects/Crai/refs/snow-cli)**：借鉴其完善的 MCP 集成、LSP 支持以及工具确认流（Tool Confirmation Flow）的交互设计。

## 4. 推荐包边界

```txt
@crai/core
@crai/runtime
@crai/extension-sdk
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

### 4.2 `@crai/runtime`
包含：
- 最小运行时内核 (Minimal runtime kernel)
- Session 管理器
- Turn 执行器 (Turn runner)
- 事件总线 (Event bus)
- 钩子总线 (Hook bus)
- 扩展生命周期管理
- 适配器分发 (Adapter dispatch)

### 4.3 `@crai/extension-sdk`
包含：
- `defineExtension()`
- 辅助工具类 (Helper utilities)
- 类型化的钩子辅助方法 (typed hook helpers)
- 重导出的核心类型 (re-exported core types)

### 4.4 `@crai/loader-ts`
包含：
- 本地 TypeScript 扩展加载
- 支持重新加载和卸载
- 用于开发的监听模式 (watch-mode) 辅助工具

## 5. 源码吸收与落位原则 (Source Absorption & Placement)

本项目遵循 **选择性的项目吸收**，而不是完整的仓库复制。吸收的代码必须严格按照层级进行落位。

### 5.1 核心层 (Core / Runtime) - 吸收自 pi-mono / Eino
- **pi-mono**: 借鉴其轻量级的 `AgentLoop` 调度逻辑、`ModelProvider` 接口定义，确保内核足够薄。
- **Eino**: 借鉴其中间件 (Middleware) 管道设计和检查点 (Checkpoint) 机制，增强执行流的可控性。

### 5.2 扩展层 (Extensions / Presets) - 吸收自 reasonix / snow-cli
- **reasonix**: 吸收其语义缓存 (Semantic Cache) 逻辑和状态持久化策略，作为 `CacheAdapter` 的参考实现落位到 `packages/cache-default`。
- **snow-cli**: 吸收其 MCP (Model Context Protocol) 客户端实现和工具确认工作流，落位到 `@crai/extension-sdk` 或独立的 `packages/extension-mcp`。

### 5.3 应用与 UI 层 (App / Shell) - 吸收自 crystalagents / snow-cli
- **crystalagents**: 吸收其现代化的前端 UI 风格、主题系统以及基于 Markdown 的产物渲染逻辑，落位到 `apps/web` 或 `packages/ui-kit`。
- **snow-cli**: 吸收其 LSP (Language Server Protocol) 集成和仓库分析逻辑，落位到 `packages/devtools`。

### 5.4 经验法则
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

### Phase 2
- 更丰富的传输适配器
- 缓存策略
- 命令系统
- 更好的持久化和快照/检查点能力
- 更多可选的运行时服务

### Phase 3
- 更强的权限模型
- 沙箱选项
- 多传输层协调
- 高级 UI 壳层 / 瘦客户端支持

## 7. 文档规则 (Documentation Rules)

- 将架构与 API 规格分离
- 将数据模型与流程图分离
- 将实施计划与设计意图分离
- 优先选择短小、专注的文档，而不是一份巨大的混合草案
