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
- typed hook helpers
- re-exported core types

### 4.4 `@crai/loader-ts`
Contains:
- local TypeScript extension loading
- reload and unload support
- watch-mode helpers for development

## 5. Source Absorption Policy

This project follows **selective project absorption**, not full repo copying.

### 5.1 Good candidates to absorb
- agent event flow
- turn loop structure
- model stream representation
- context transform pipeline
- tool dispatch sequencing
- runtime hook mechanics

### 5.2 Things to rewrite for Crai
- product-specific state containers
- provider binding style that couples core and provider
- UI components
- storage layout tied to another product
- naming that reflects source project branding

### 5.3 Rule of thumb
If a piece of code would force provider/UI/IM into core, rewrite it instead of reusing it.

## 6. Phase Split

### Phase 1
- core types
- minimal runtime kernel
- extension loading
- basic event/hook pipeline
- one model adapter
- one storage adapter
- minimal UI or CLI entry point
- preset extensions for default behaviors

### Phase 2
- richer transport adapters
- cache strategy
- command system
- better persistence and snapshotting
- more optional runtime services

### Phase 3
- stronger permission model
- sandboxing options
- multi-transport coordination
- advanced UI shell / thin client support

## 7. Documentation Rules

- keep architecture separate from API spec
- keep data model separate from flow diagrams
- keep implementation plan separate from design intent
- prefer short, focused docs over one giant mixed draft
