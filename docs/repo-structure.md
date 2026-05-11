# Crai 仓库结构草案 (Repository Structure Draft)

本草案反映了当前的文档拆分和预期的 monorepo 布局。

## 1. 分层原则

Crai 应当围绕五个层级进行组织：
- **core**: 最小契约与类型（包括记忆类型定义与适配器契约）
- **runtime**: 可执行内核与编排（包括记忆事件/钩子触发点）
- **extension**: 可选行为与 SDK 助手
- **extension**: 可选行为与 SDK 助手
- **devtools**: 开发自动化、工作流助手和通用编码辅助
- **app**: 产品表面、演示和开发工具

目标是保持 `packages/core` 干净，保持 `packages/runtime` 精简，并防止自举或产品逻辑泄露到核心层。

## 2. 顶级布局

```txt
packages/
  core/
  runtime/
  extension-sdk/
  loader-ts/
  devtools/
  provider/
  storage-fs/
  extension-memory/        (新增) 完整记忆策略：压缩/检索/注入/整理
  storage-vector/          (可选) 向量存储适配器（LanceDB/FAISS 等）
  cache-default/
  transport-websocket/
  transport-cli/
  transport-feishu/
  ui-web/
  shell-electron/
apps/
  dev-server/
  web/
  bootstrap-console/
examples/
  minimal-runtime/
  web-chat/
  feishu-bot/
docs/
```

## 3. Phase 1 目标布局

仅从证明架构所需的最小包开始：

```txt
packages/
  core/
  runtime/
  extension-sdk/
  loader-ts/
```

可选的 Phase 1 补充（如果需要）：
- provider 包（统一管理所有 LLM provider）
- 一个存储 (Storage) 包
- 一个最小的传输层 (Transport) 包
- 一个开发工具 (Developer-tools) 包（当且仅当它保持在核心之外时）
- **记忆类型与适配器契约 (MemoryEntry/MemoryAdapter，仅 Core 层)**

## 4. 包职责

### 4.1 `packages/core`
- 共享类型
- 事件 (Events)
- 钩子 (Hooks)
- 适配器契约 (Adapter contracts)
- 运行时错误
- 日志类型
- 记忆类型定义 (`MemoryEntry`, `MemoryScope`, `MemoryProvenance`)
- 记忆适配器契约 (`MemoryAdapter`)
- 仅包含运行时内核所需的契约

### 4.2 `packages/runtime`
- 最小运行时内核
- Prompt 流程调度
- Session 管理
- 中间件与钩子执行 (Middleware & Hook execution)
- 事件触发
- 扩展生命周期
- 适配器分发
- 最小工具解析

### 4.3 `packages/extension-sdk`
- `defineExtension()`
- `ExtensionManifest` 类型
- 辅助工具类
- 来自核心的类型化重导出
- 扩展编写助手
- `register()` 资源管理辅助

### 4.4 `packages/loader-ts`
- 加载本地 `.ts` 扩展文件
- 支持重新加载和卸载
- 监听模式 (Watch-mode) 工具

### 4.5 ~~`packages/preset-default`~~（已删除，见 D-031）
运行时不再提供任何默认行为。用户根据需要自行组合 extension。
- 需要模型 → 加载 `@crai/provider`
- 需要存储 → 加载 `@crai/storage-fs`
- 需要历史注入 → 自行编写 `context:build` hook
- 需要持久化 → 自行编写 `turn:after` hook

### 4.6 `packages/provider`
- 所有 LLM provider 实现（OpenAI、Anthropic、DeepSeek 等）
- 各 provider 以子模块形式组织（`src/openai/`、`src/anthropic/`）
- 共享核心 `src/core/` 复用 SSE 解析等公共逻辑
- 每个 provider 通过 Extension 工厂注册到 runtime，支持 loader-ts 热更新

### 4.7 `packages/storage-fs`
- 文件系统存储适配器
- session/message/artifact 以 JSON 文件持久化到磁盘
- 通过 Extension 注册到 registry.storages，支持热替换

### 4.8 `packages/extension-memory` (新增，Phase 2)
- 完整的记忆策略实现（借鉴 SimpleMem）
- 语义结构化压缩：MemoryBuilder — 滑窗分割 + LLM 提取 → 多视图索引
- 混合检索：HybridRetriever — 语义/关键词/结构化三路并行检索 + 反思轮次
- 分层上下文注入：ContextInjector — Token 预算优先级注入
- 记忆整理：Consolidation — 衰减/合并/裁剪
- 记忆生命周期编排：MemoryOrchestrator
- 此包属于 Phase 2 范畴

### 4.9 `packages/devtools`
- 任务追踪助手 (task tracking helpers)
- 仓库巡检助手 (repo inspection helpers)
- AI 辅助补丁协调 (AI-assisted patch coordination)
- 开发工作流助手 (development workflow helpers)
- 针对 Crai 和其他项目的通用编码辅助
- 此包不得修改 `packages/core` 的边界

## 5. 应用层 (App Layer)

### `apps/dev-server`
用于测试运行时行为和加载扩展的本地开发服务器。
它可以在开发启动期间加载一组默认 extension。

### `apps/web`
一个 Web UI 壳层，它消费运行时事件并与传输适配器交互。

### `apps/bootstrap-console`
一个用于开发工作流、任务追踪和助手辅助编码的产品表面。

## 6. 示例层 (Example Layer)

示例应当保持小型且专注：
- 最小运行时自举
- Web 聊天演示
- 飞书机器人演示

## 7. 目录规则 (Directory Rules)

- 将实现代码保持在 `packages/` 下
- 将可运行的演示保持在 `apps/` 或 `examples/` 下
- 将设计/规格材料保持在 `docs/` 下
- 避免在 `packages/core` 中放置特定于产品的逻辑
- 将开发工具助手保持在 `packages/core` 之外
- 将默认行为保持在 `packages/runtime` 之外
- 如果一个功能主要帮助开发工作，优先考虑 `packages/devtools` 或 `apps/bootstrap-console`

## 8. 推荐的首批文件 (Recommended First Files)

当开始实现时，从以下文件开始：
- `packages/core/src/types.ts`
- `packages/core/src/events.ts`
- `packages/core/src/hooks.ts`
- `packages/runtime/src/createRuntime.ts`
- `packages/runtime/src/turnRunner.ts`
- `packages/extension-sdk/src/index.ts`
- `packages/loader-ts/src/index.ts`
- `packages/storage-fs/src/adapter.ts`
- `packages/provider/src/openai/adapter.ts`
- `packages/devtools/src/index.ts`

### 记忆首批文件 (Memory First Files)

当开始实现记忆策略时，从以下文件开始：
- `packages/core/src/types.ts`（追加 MemoryEntry/MemoryScope 类型）
- `packages/core/src/hooks.ts`（追加 memoryEvents 相关钩子定义）
- `packages/extension-memory/src/memory-builder.ts`（摘要生成与注入，Phase 2）
