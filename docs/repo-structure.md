# Crai 仓库结构草案 (Repository Structure Draft)

## 1. 分层原则

Crai 围绕以下层级组织：
- **core**: 最小契约与类型
- **runtime**: 可执行内核与编排
- **extension**: 可选行为
- **devtools**: 开发自动化
- **app**: 产品表面

目标是保持 `packages/core` 干净，保持 `packages/runtime` 精简。

## 2. 顶级布局

```txt
packages/
  core/                纯 TS 类型/常量（零 Node 依赖）
  runtime/             运行时内核
  config/              配置管理（全局 + 工作区 + 变体）
  cli-repl/            交互式 CLI REPL
  devtools/            开发辅助工具
  loader-ts/           TS 扩展加载器
  persistence/         会话持久化
  provider/            LLM provider
  security/            安全层：路径校验、危险命令检测、权限确认
  storage-fs/          文件系统存储
  tools-fs/            文件系统工具
  tools-shell/         shell 执行工具
  tools-web/           网络工具
  transport-cli/       CLI 传输适配器
  transport-ws/        WebSocket 传输适配器

apps/
  server/              生产服务器入口
  web/                 Vite + React + Tailwind PWA

docs/
```

## 3. 包职责

### 3.1 `packages/core`
- 共享类型、事件、钩子、适配器契约
- 运行时错误、日志类型
- `defineExtension()` 辅助函数
- 仅包含运行时内核所需的契约

### 3.2 `packages/runtime`
- 最小运行时内核
- Prompt 流程调度、Session 管理
- 中间件与钩子执行
- 事件触发、扩展生命周期
- 适配器分发、最小工具解析

### 3.3 `packages/config`
- 三层配置结构：
  - **变体配置**（`apps/server/variants/{env}.json`）：应用身份、目录名、端口
  - **全局配置**（`~/.crai-dev/config.json`）：API keys、providers、recentWorkspaces
  - **工作区配置**（`<项目>/.crai-dev/config.json`）：仅 security.mode
- `ConfigManager` 封装加载、合并、持久化完整流程

### 3.4 `packages/loader-ts`
- 加载本地 `.ts` 扩展文件
- 支持重新加载和卸载
- 监听模式工具

### 3.5 `packages/provider`
- 所有 LLM provider 实现（OpenAI、DeepSeek）
- 各 provider 以子模块组织（`src/openai/`、`src/deepseek/`）
- 共享核心 `src/core/` 复用 SSE 解析等公共逻辑
- 每个 provider 通过 Extension 工厂注册到 runtime

### 3.6 `packages/storage-fs`
- 文件系统存储适配器
- session/message/artifact 以 JSON 文件持久化到磁盘
- 支持 `getSession`

### 3.7 `packages/cli-repl`
- 交互式 CLI REPL
- 流式输出模型回复
- 危险命令确认（同一 readline 实例）

### 3.8 `packages/persistence`
- 会话持久化 extension
- `turn:after` hook 保存消息
- `session:afterStop` hook 更新 session 元数据

### 3.9 `packages/security`
- 路径校验（resolveAllowedPath）
- 敏感命令检测（可配置 JSON，scope/disable）
- `createWorkspaceSecurity` extension（tool:safetyCheck hook）
- YOLO 模式支持

### 3.10 `packages/tools-fs`
- fs_read（hashline 锚点）
- fs_write（自动建父目录、覆盖保护）
- fs_grep（spawnSync 无 shell 注入）
- fs_list
- fs_edit（搜索替换 + 锚点两种模式）
- 结构化快照（SnapshotManager）

### 3.11 `packages/tools-shell`
- bash（spawn 异步执行）
- isDangerousCommand + isSelfDestructiveCommand
- 进程管理（processManager）
- ESC 中断

### 3.12 `packages/tools-web`
- web_search（DuckDuckGo + Bing API 可插拔引擎）
- web_fetch

### 3.13 `packages/transport-ws`
- WebSocket 服务器传输
- ServerMessage/ClientMessage 歧视联合协议
- 配置 CRUD handler
- 工作区列表/切换/配置 handler
- request:input bridge
- publishEvent（多工作区事件转发）

### 3.14 `packages/transport-cli`
- CLI 适配器（复用 CLI REPL）

### 3.15 `packages/devtools`
- 任务追踪助手
- 仓库巡检助手
- 开发工作流助手
- 此包不得修改 `packages/core` 的边界

## 4. 应用层

### `apps/server`
生产级服务器入口：
- 加载变体配置 → 全局配置
- WorkspaceManager：管理多个并行 workspace runtime
- 事件转发 Extension：每个 workspace runtime 的事件 → transport.publishEvent
- 自动同步：添加/移除 provider 后启停对应 runtime
- SIGINT 清理

### `apps/web`
Vite + React 18 + TypeScript + Tailwind CSS Web UI：
- Inspector 浮动面板
- Config 面板（provider CRUD）
- PWA 支持
- 自动检测 WS URL

## 5. 目录规则

- 实现代码保持在 `packages/` 下
- 可运行的应用保持在 `apps/` 下
- 设计/规格材料保持在 `docs/` 下
- 避免在 `packages/core` 中放置特定于产品的逻辑
- 将默认行为保持在 `packages/runtime` 之外
- 扩展之间禁止直接依赖（符合 D-033）

## 6. 源码切入路径

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

### 安全、工具、传输等扩展
- `packages/security/src/workspace-security.ts`
- `packages/tools-fs/src/index.ts`
- `packages/tools-shell/src/index.ts`
- `packages/tools-web/src/index.ts`
- `packages/persistence/src/index.ts`
- `packages/storage-fs/src/adapter.ts`
- `packages/transport-ws/src/index.ts`
- `packages/config/src/index.ts`
- `packages/provider/src/openai/adapter.ts`
- `packages/provider/src/deepseek/adapter.ts`

### 应用层
- `apps/server/src/index.ts`
- `apps/web/src/App.tsx`
