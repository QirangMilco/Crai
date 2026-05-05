# Crai 仓库结构草案 (Repository Structure Draft)

本草案反映了当前的文档拆分和预期的 monorepo 布局。

## 1. 分层原则

Crai 应当围绕五个层级进行组织：
- **core**: 最小契约与类型
- **runtime**: 可执行内核与编排
- **extension**: 可选行为与 SDK 助手
- **preset**: 保持在运行时之外的默认行为捆绑包
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
  preset-default/
  devtools/
  provider-openai/
  provider-anthropic/
  provider-deepseek/
  storage-fs/
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
  preset-default/
```

可选的 Phase 1 补充（如果需要）：
- 一个供应商 (Provider) 包
- 一个存储 (Storage) 包
- 一个最小的传输层 (Transport) 包
- 一个开发工具 (Developer-tools) 包（当且仅当它保持在核心之外时）

## 4. 包职责

### 4.1 `packages/core`
- 共享类型
- 事件 (Events)
- 钩子 (Hooks)
- 适配器契约 (Adapter contracts)
- 运行时错误
- 日志类型
- 仅包含运行时内核所需的契约

### 4.2 `packages/runtime`
- 最小运行时内核
- Prompt 流程调度
- Session 管理
- 钩子执行
- 事件触发
- 扩展生命周期
- 适配器分发
- 最小工具解析

### 4.3 `packages/extension-sdk`
- `defineExtension()`
- 辅助工具类
- 来自核心的类型化重导出
- 扩展编写助手

### 4.4 `packages/loader-ts`
- 加载本地 `.ts` 扩展
- 支持重新加载和卸载
- 监听模式 (Watch-mode) 工具

### 4.5 `packages/preset-default`
- 默认 Prompt 流水线
- default context behavior
- default persistence behavior
- default telemetry/logging behavior
- default model wiring placeholders
- this package exists to keep runtime thin and usable at the same time

### 4.6 `packages/devtools`
- task tracking helpers
- repo inspection helpers
- AI-assisted patch coordination
- development workflow helpers
- generic coding assistance for Crai and other projects
- this package must not modify `packages/core` boundaries

## 5. App Layer

### `apps/dev-server`
A local development server for testing runtime behavior and loading extensions.
It may auto-load `preset-default` during development startup.

### `apps/web`
A web UI shell that consumes runtime events and interacts with transport adapters.

### `apps/bootstrap-console`
A product surface for developer workflows, task tracking, and assistant-assisted coding.

## 6. Example Layer

Examples should stay small and focused:
- minimal runtime bootstrap
- web chat demo
- Feishu bot demo

## 7. Directory Rules

- keep implementation code under `packages/`
- keep runnable demos under `apps/` or `examples/`
- keep design/spec material under `docs/`
- avoid placing product-specific logic in `packages/core`
- keep developer-tooling helpers outside `packages/core`
- keep default behaviors outside `packages/runtime`
- if a feature mainly helps development work, prefer `packages/devtools` or `apps/bootstrap-console`

## 8. Recommended First Files

When implementation begins, start with:
- `packages/core/src/types.ts`
- `packages/core/src/events.ts`
- `packages/core/src/hooks.ts`
- `packages/runtime/src/createRuntime.ts`
- `packages/runtime/src/turnRunner.ts`
- `packages/extension-sdk/src/defineExtension.ts`
- `packages/loader-ts/src/index.ts`
- `packages/preset-default/src/index.ts`
- `packages/devtools/src/index.ts`
