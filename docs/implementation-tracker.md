# Crai 实现跟踪

> 活文档，反映当前实际状态。

## 当前聚焦

- 目标：跨平台 GUI/Web 应用，个人桌面助手
- 安全就绪：三层防御 + 敏感命令配置 + 三级权限模式
- 核心稳定：core + runtime + tools 能力集较完整
- 配置：变体配置（dev/prod 隔离）+ 全局配置 + 工作区配置（仅 security）
- 不需要环境变量，全配置文件驱动
- Plan+ToDo 功能：todo-write 内置工具、plan 模式系统提示、前端 TodoDisplay 组件
- 下一步：Web UI 完善（markdown 渲染、会话历史、工作区选择器）

## 已完成

### Core & Runtime
- core 基础类型、事件、钩子、适配器契约
- runtime 最小内核（SessionManager、turnRunner、HookBus、EventBus）
- loader-ts
- EventBus SKIP 链
- SessionPipeline
- 工具执行循环（并行化：资源感知分组）
- `AdapterContext.requestUserInput`（Transport 注入，工具可向用户提问）

### Provider
- OpenAI provider（完整响应 + SSE 流式）
- DeepSeek provider（reasoning_content、thinking mode、utility mode）
- 非流式/流式统一抽象

### Storage & Persistence
- storage-fs（`getSession` 支持）
- persistence extension（turn:after + session:afterStop）
- 会话 ID 持久化与恢复

### Safety
- `@crai/security`：路径校验、敏感命令检测、三级权限模式
- 敏感命令可配置（JSON 文件、scope、enable/disable）
- 预设 46 条敏感命令（SQL、Git、Docker、PowerShell、远程代码执行、npm）
- 三层防御：工具自检 → 安全扩展 → turnRunner

### Tools
- `@crai/tools-fs`：fs_read（hashline 锚点）、fs_write、fs_grep、fs_list、fs_edit（搜索替换 + 锚点模式）
- `@crai/tools-shell`：bash（spawn 异步 + 危险命令检测 + 自我保护 + ESC 中断 + processManager）
- `@crai/tools-web`：web_search（DuckDuckGo + Bing API）、web_fetch（HTML 剥离）
- 结构化快照（SnapshotManager）
- 独立工具包设计（不跨扩展依赖，符合 D-033）

### Config
- `@crai/config`：ConfigManager（加载/保存/合并）
- 三层配置：变体（dev/prod 目录隔离）→ 全局（API keys、providers）→ 工作区（仅 security）
- 不依赖环境变量，全文件驱动

### Base
- `@crai/base`：core 与 extension 之间的桥梁层
- `resolveAllowedPath` / `validateToolPaths` / `getPathArg` — 路径校验工具
- `ConsoleLogger` — 电平过滤 + 大小轮转 + 文件输出
- 消除 tools-fs、security、config 之间的重复代码

### Transport
- `@crai/transport-ws`：WebSocket 传输层
  - ServerMessage/ClientMessage 歧视联合协议
  - 配置 CRUD handler
  - 工作区列表、切换、配置 handler
  - request:input 模式（向所有客户端广播问题，取第一个回复）
  - `publishEvent(workspaceId, event, payload)` 多工作区事件转发

### Server
- `apps/server`：生产级服务器入口
  - WorkspaceManager（管理多个并行 runtime，按工作区隔离）
  - 事件转发 Extension（每个 workspace 的 runtime 事件 → transport.publishEvent）
  - 自动同步：添加/移除 provider 后启停对应 runtime
  - SIGINT 清理

### Web UI
- `apps/web`：Vite + React 18 + TypeScript + Tailwind CSS
- PWA 支持（vite-plugin-pwa）
- Inspector 浮动面板（50+ CSS token 参数）
- Config 面板（provider CRUD）
- 自动检测 WS URL（从页面 origin 推导）
- 思考过程显示（ThinkingBlock，可折叠）
- 工具调用显示（ToolBlock/ToolGroupBlock，实时状态）

### CLI
- `@crai/cli-repl`（交互式 REPL）
- 调试系统（按 scope 控制输出，通过变体配置注入）
- 敏感命令确认（Always-Allow + 强制确认）
- 会话管理（/session 命令）

### 测试
- 所有测试沙箱隔离（mkdtempSync 在系统临时目录）
- 150+ 测试覆盖全部 P0/P1/P2
- 测试覆盖率：core、runtime、storage-fs、security、tools-fs、tools-shell、tools-web、transport-ws
- 思考过程流式展示（thinking.delta/thinking.done 事件 → ThinkingBlock 组件）
- 工具调用流式展示（tool.start/tool.delta/tool.done 事件 → ToolBlock 组件）
- DeepSeek reasoning_content 实时推送

## 下一步

1. Web UI 完善：markdown 渲染、会话历史持久化、工作区选择器
2. Summary 记忆策略 extension（Phase 2）
3. Checkpoint 机制
4. PWA 离线缓存 + 移动端适配
5. `apps/desktop`（Electron/Tauri 壳）

## 架构概览

```
apps/web (Vite + React)
    │ WebSocket
apps/server (Node.js)
    │
    ├── WorkspaceManager
    │    ├── workspace-A runtime (tools-fs + tools-shell + tools-web + security + persistence + storage-fs + provider)
    │    ├── workspace-B runtime (同上，隔离)
    │    └── 事件转发 → transport.publishEvent(workspaceId, ...)
    │
    └── transport-ws (WebSocket 服务器)
         ├── 配置 handler（CRUD）
         ├── 工作区 handler（列表/切换/配置）
         └── request:input bridge

packages/
    ├── core          — 纯 TS 类型/常量（零 Node 依赖）
    ├── runtime       — 运行时内核
    ├── provider      — 模型适配器工厂
    ├── config        — 配置管理
    ├── security      — 路径校验、敏感命令、三级权限模式
    ├── tools-fs      — 文件系统工具
    ├── tools-shell   — shell 执行工具
    ├── tools-web     — 网络工具
    ├── storage-fs    — 文件存储适配器
    ├── persistence   — 持久化扩展
    ├── transport-ws  — WebSocket 传输
    ├── cli-repl      — CLI 交互 REPL
    └── loader-ts     — TS 加载器
```
