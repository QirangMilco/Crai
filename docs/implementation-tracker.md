# Crai 实现跟踪

> 这是一个活文档，用来记录当前要做什么、正在做什么、已经做了什么，以及下一步应该做什么。

## 1. 当前聚焦

- 目前阶段：Phase 1 已全部完成
- 当前目标：完善 CLI/Transport 层，推进 Phase 2
- 下一阶段：Phase 2 预设扩展与传输层
- 核心冻结：core + runtime 不再需要修改，后续能力以 extension / preset / devtools / app 形式实现

## 2. Todo

- [x] 确认 Phase 1 的第一个代码单元
- [x] 建立最小仓库骨架
- [x] 实现 `packages/core` 的基础类型与接口
- [x] 实现 `packages/runtime` 的最小内核骨架
- [x] 实现 `packages/extension-sdk`
- [x] 实现 `packages/loader-ts`
- [x] **在 runtime 中实现 register() 资源管理（ExtensionContext.register / registerTool）**
- [x] **在 runtime 的 EventBus 中实现 SKIP 链（request/handle/hasHandler）**
- [x] **在 runtime 中实现 Extension 两级权限检查（trust + allowFullAccessExtensions）**
- [x] **实现 EventBus SKIP 链（request/handle/hasHandler）**
- [x] **实现 Middleware 调度逻辑（wrap 洋葱圈模式）**
- [ ] 实现 Checkpoint 机制（可中断执行，Phase 2 范畴）
- [ ] 调研并集成 pi-mono 的 Agent 循环优化逻辑
- [ ] 调研并集成 reasonix 的语义缓存机制
- [ ] 在 `packages/devtools` 中集成 snow-cli 的 LSP 支持
- [ ] 调研并集成 crystalagents 的现代 UI 与 Markdown 渲染风格
- [x] 增加最小示例与最小测试
- [x] 创建独立的 `packages/preset-default`（已删除，D-031）
- [x] 创建 `packages/provider`（统一 provider 包，首个实现为 OpenAI）
- [x] 编写最小测试验证 prompt 完整流程
- [x] 创建 `packages/storage-fs`（文件系统存储）
- [x] 创建 `packages/devtools`（开发辅助工具包）
- [ ] 创建 `packages/preset-memory`（完整记忆策略，Phase 2 范畴）
- [x] **在 `packages/core` 中定义 MemoryEntry/MemoryScope/MemoryAdapter 类型**
- [x] **在 `packages/runtime` 的 Session 生命周期中加入记忆事件/钩子触发点**
- [ ] **调研并借鉴 SimpleMem 的三阶段记忆流水线与多视图索引模型**
- [ ] **Summary 记忆策略（将来可作为独立 extension 实现）**

## 3. 进行中

- 核心（core + runtime）已冻结，后续不涉及核心修改

## 4. 已完成（Phase 1）

- [x] core 基础类型、事件、钩子、适配器契约
- [x] runtime 最小内核（SessionManager、turnRunner、HookBus、EventBus）
- [x] extension-sdk（defineExtension + 类型重导出）
- [x] loader-ts（TS 扩展加载/重载/卸载/文件监听）
- [x] **EventBus SKIP 链（request/handle/hasHandler）**
- [x] **Extension 两级权限检查（trust + allowFullAccessExtensions）**
- [x] **ExtensionContext 完整：register() / registerTool() / registerModelMiddleware() / bus 别名 / config / dataDir**
- [x] **Middleware 调度（wrap 洋葱圈模式）**
- [x] **工具安全检查门（safetyLevel + PermissionMode）**
- [x] **记忆体系设计文档 + 核心契约（MemoryEntry/MemoryScope/MemoryAdapter）**
- [x] **Session 生命周期记忆事件触发点**
- [x] 默认行为已迁移到独立 preset 包
- [x] OpenAI provider 实现
- [x] storage-fs 文件系统存储实现
- [x] examples/minimal-runtime 示例（含持久化多轮对话）
- [x] 最小测试验证 prompt 完整流程
- [x] 纯文本单轮/多轮 LLM 对话可工作（需加载 provider + storage-fs + 用户自行编写的 persist/inject extension）
- [x] devtools 包骨架（tracker / inspect 模块）
- [x] 工具执行循环（execute → append → re-call 闭环）
- [x] 默认流式，回退非流式
- [x] SessionPipeline（可接管 session 创建/销毁）
- [x] Middleware 简化（去掉 before/after，只保留 wrap）
- [x] 文档：Middleware vs Hook、Adapter vs Pipeline 语义区分
- [x] 单元测试：工具执行循环
- [x] DeepSeek provider（reasoning_content 捕获/回传、thinking mode、utility mode）
- [x] D-032 工具结果独立消息模型
- [x] AI_DEBUG 调试系统（tools/api scope、流式响应日志）
- [x] 独立测试示例（openai-test、deepseek-test）
- [x] persistence extension（turn 后自动保存消息）
- [x] transport-cli（交互式 REPL，含 read_file/grep/bash 内置工具）

## 5. 阻塞项

- 暂无

## 6. 已确认决策

- D-001 ~ D-030 保持不变（详见决策记录）

## 7. 下一步建议

1. 补充 devtools 能力（task planner、repo inspector 增强）
2. 实现 Summary 记忆策略（作为独立 extension）
3. 调研 SimpleMem 三阶段流水线 → 准备 preset-memory
4. 实现 Transport 适配器（CLI、WebSocket）
5. 调研 pi-mono Agent 循环优化与 reasonix 语义缓存
6. 实现 Checkpoint 机制（可中断执行，Phase 2 范畴）

## 8. 说明

- 核心已冻结。任何新增能力若要求修改 core 或 runtime 的类型定义/调度逻辑，需重新评估。
- 新增 Transport / Storage / Provider / Memory 均以 Extension 形式注册。
- 一切行为以 extension 形式提供，无默认预设。
