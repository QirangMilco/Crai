# Crai 仓库结构草案 (Repository Structure Draft)

本草案反映了当前的文档拆分和预期的 monorepo 布局。

## 1. 分层原则

Crai 应当围绕五个层级进行组织:
- **core**: 最小契约与类型(包括记忆类型定义与适配器契约)
- **runtime**: 可执行内核与编排(包括记忆事件/钩子触发点)
- **extension**: 可选行为与 SDK 助手
- **extension**: 可选行为与 SDK 助手
- **devtools**: 开发自动化、工作流助手和通用编码辅助
- **app**: 产品表面、演示和开发工具

目标是保持 `packages/core` 干净,保持 `packages/runtime` 精简,并防止自举或产品逻辑泄露到核心层。

## 2. 顶级布局

```txt
packages/
  core/
  runtime/
  cli-repl/               交互式 CLI REPL
  devtools/               开发辅助工具
  loader-ts/              TS 扩展加载器
  persistence/            会话持久化
  provider/               LLM provider
  security/               安全层:路径校验、危险命令检测、权限确认
  storage-fs/             文件系统存储
  tools-fs/               文件系统工具
  tools-shell/            shell 执行工具
  tools-web/              网络工具
docs/
```

## 3. Phase 1 实际布局

当前所有已实现的包：

```txt
packages/
  core/
  runtime/
  cli-repl/               交互式 CLI REPL
  devtools/               开发辅助工具
  loader-ts/              TS 扩展加载器
  persistence/            会话持久化
  provider/               LLM provider
  security/               安全层
  storage-fs/             文件系统存储
  tools-fs/               文件系统工具
  tools-shell/            shell 执行工具
  tools-web/              网络工具
```

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

### 4.3 `@crai/core` (defineExtension)
`defineExtension()` 辅助函数已合入 `@crai/core`。
- 扩展编写助手

### 4.4 `packages/loader-ts`
- 加载本地 `.ts` 扩展文件
- 支持重新加载和卸载
- 监听模式 (Watch-mode) 工具

### 4.5 ~~`packages/preset-default`~~(已删除,见 D-031)
运行时不再提供任何默认行为。用户根据需要自行组合 extension。
- 需要模型 → 加载 `@crai/provider`
- 需要存储 → 加载 `@crai/storage-fs`
- 需要历史注入 → 自行编写 `context:build` hook
- 需要持久化 → 自行编写 `turn:after` hook

### 4.6 `packages/provider`
- 所有 LLM provider 实现(OpenAI、Anthropic、DeepSeek 等)
- 各 provider 以子模块形式组织(`src/openai/`、`src/anthropic/`)
- 共享核心 `src/core/` 复用 SSE 解析等公共逻辑
- 每个 provider 通过 Extension 工厂注册到 runtime,支持 loader-ts 热更新

### 4.7 `packages/storage-fs`
- 文件系统存储适配器
- session/message/artifact 以 JSON 文件持久化到磁盘

### 4.8 `packages/cli-repl`
- 交互式 CLI REPL
- 流式输出模型回复
- 内置危险命令确认(同一 readline 实例)

### 4.9 `packages/persistence`
- 会话持久化 extension
- `turn:after` hook 保存消息
- `session:afterStop` hook 更新 session 元数据

### 4.10 `packages/security`
- 路径校验(resolveAllowedPath)
- 敏感命令检测(可配置 JSON,scope/disable)
- `createWorkspaceSecurity` extension(tool:safetyCheck hook)
- YOLO 模式支持

### 4.11 `packages/tools-fs`
- fs_read(hashline 锚点行号)
- fs_write(自动建父目录、覆盖保护)
- fs_grep(spawnSync 无 shell 注入)
- fs_list
- fs_edit(搜索替换 + 锚点两种模式)
- 结构化快照(SnapshotManager)

### 4.12 `packages/tools-shell`
- bash(spawn 异步执行)
- isDangerousCommand + isSelfDestructiveCommand
- 进程管理(processManager)

### 4.13 `packages/tools-web`
- web_search(DuckDuckGo + Bing API 可插拔)
- web_fetch

### 4.14 `packages/extension-memory` (Phase 2)
- 完整的记忆策略实现(借鉴 SimpleMem)。详见 [memory-design.md](memory-design.md)。

### 4.15 `packages/devtools`
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
一个 Web UI 壳层,它消费运行时事件并与传输适配器交互。

### `apps/bootstrap-console`
一个用于开发工作流、任务追踪和助手辅助编码的产品表面。

## 6. 示例层 (Example Layer)

示例应当保持小型且专注:
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
- 如果一个功能主要帮助开发工作,优先考虑 `packages/devtools` 或 `apps/bootstrap-console`

## 8. 源码切入路径 (Suggested Starting Points)

### 核心层
- `packages/core/src/types.ts`
- `packages/core/src/events.ts`
- `packages/core/src/hooks.ts`
- `packages/core/src/constants.ts`

### 运行时
- `packages/runtime/src/createRuntime.ts`
- `packages/runtime/src/turnRunner.ts`
- `packages/runtime/src/bus.ts`
- `packages/runtime/src/sessionManager.ts`

### 安全、工具、持久化等扩展
- `packages/security/src/workspace-security.ts` — 安全检查钩子
- `packages/tools-fs/src/index.ts` — 文件系统工具
- `packages/tools-shell/src/index.ts` — shell 工具（含危险命令检测）
- `packages/tools-web/src/index.ts` — 网络工具
- `packages/persistence/src/index.ts` — 持久化扩展
- `packages/storage-fs/src/adapter.ts` — 文件存储适配器
- `packages/provider/src/openai/adapter.ts` — OpenAI provider
- `packages/provider/src/deepseek/adapter.ts` — DeepSeek provider

### 记忆系统（Phase 2）
详见 [memory-design.md](memory-design.md)。
