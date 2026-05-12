# Crai 实现跟踪

> 活文档，反映当前实际状态。

## 当前聚焦

- 目标：跨平台 GUI/Web 应用
- 安全就绪：三层防御 + 敏感命令配置 + YOLO
- 核心趋稳：core + runtime 已有较完整的能力集
- 下一步：Web transport + GUI

## 已完成

### Core & Runtime
- core 基础类型、事件、钩子、适配器契约
- runtime 最小内核（SessionManager、turnRunner、HookBus、EventBus）
- loader-ts
- EventBus SKIP 链
- Extension 两级权限检查
- 工具安全检查门
- SessionPipeline
- 工具执行循环
- **工具执行并行化**（资源感知分组，同资源串行、不同资源并行）
- **`AdapterContext.requestUserInput`**（Transport 层注入，工具可向用户提问）

### Provider
- OpenAI provider
- DeepSeek provider（reasoning_content、thinking mode、utility mode）

### Storage & Persistence
- storage-fs（含 `getSession`）
- persistence extension（turn:after + session:afterStop）
- 会话 ID 持久化与恢复

### Safety
- `@crai/security`：路径校验、敏感命令检测、Always-Allow + YOLO
- 敏感命令可配置（JSON 文件、scope、enable/disable）
- **敏感命令预设扩展至 46 条**（SQL、Git、Docker、PowerShell、远程代码执行、npm）
- 三层防御：工具自检 → 安全扩展 → turnRunner

### Tools
- `@crai/tools-fs`：fs_read（hashline 锚点）、fs_write、fs_grep、fs_list、fs_edit（搜索替换 + 锚点模式）
- `@crai/tools-shell`：bash（spawn 异步 + 危险命令检测 + 自我保护 + **ESC 中断**）
- `@crai/tools-web`：web_search（DuckDuckGo + Bing API）、web_fetch
- 结构化快照（SnapshotManager）

### CLI
- `@crai/cli-repl`（交互式 REPL）
- AI_DEBUG 调试系统
- 危险命令确认（Always-Allow + 敏感命令强制确认）

### Other
- devtools 包
- extension-sdk 合并到 core（defineExtension）

## 下一步

1. Web transport 层（WebSocket/HTTP）
2. GUI 应用壳（Web 先）
3. Summary 记忆策略 extension
4. Checkpoint 机制
