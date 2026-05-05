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
- 中间件与钩子执行 (Middleware & Hook execution)
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
- 默认上下文行为 (default context behavior)
- 默认持久化行为 (default persistence behavior)
- 默认遥测/日志行为 (default telemetry/logging behavior)
- 默认模型连接占位符 (default model wiring placeholders)
- 此包的存在是为了保持运行时的精简且同时可用

### 4.6 `packages/devtools`
- 任务追踪助手 (task tracking helpers)
- 仓库巡检助手 (repo inspection helpers)
- AI 辅助补丁协调 (AI-assisted patch coordination)
- 开发工作流助手 (development workflow helpers)
- 针对 Crai 和其他项目的通用编码辅助
- 此包不得修改 `packages/core` 的边界

## 5. 应用层 (App Layer)

### `apps/dev-server`
用于测试运行时行为和加载扩展的本地开发服务器。
它可能在开发启动期间自动加载 `preset-default`。

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
- `packages/extension-sdk/src/defineExtension.ts`
- `packages/loader-ts/src/index.ts`
- `packages/preset-default/src/index.ts`
- `packages/devtools/src/index.ts`
