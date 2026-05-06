# Crai 实现跟踪

> 这是一个活文档，用来记录当前要做什么、正在做什么、已经做了什么，以及下一步应该做什么。

## 1. 当前聚焦

- 目前阶段：Phase 1 基础内核实现
- 当前策略：小步推进、逐块 review、避免一次性生成大量代码
- 当前目标：先实现最小 runtime kernel，再逐步补充周边能力
- 设计方向：runtime 作为纯调度器，默认行为优先放入独立 preset 包
- 记忆方向：Core 定义契约，Runtime 提供触发点，策略主体在 Preset 层
- 开发辅助能力：作为通用 devtools，而不是自举专属层

## 2. Todo

- [x] 确认 Phase 1 的第一个代码单元
- [x] 建立最小仓库骨架
- [x] 实现 `packages/core` 的基础类型与接口
- [x] 实现 `packages/runtime` 的最小内核骨架
- [x] 实现 `packages/extension-sdk`
- [ ] 实现 `packages/loader-ts`
- [ ] 实现 Middleware 与 Checkpoint 核心调度逻辑 (借鉴 Eino)
- [ ] 调研并集成 pi-mono 的 Agent 循环优化逻辑
- [ ] 调研并集成 reasonix 的语义缓存机制
- [ ] 在 `packages/devtools` 中集成 snow-cli 的 LSP 支持
- [ ] 调研并集成 crystalagents 的现代 UI 与 Markdown 渲染风格
- [ ] 增加最小示例与最小测试
- [x] 创建独立的 `packages/preset-default`
- [x] 创建 `packages/provider`（统一 provider 包，首个实现为 OpenAI）
- [x] 编写最小测试验证 prompt 完整流程
- [ ] 创建 `packages/devtools`
- [x] **在 `packages/core` 中定义 MemoryEntry/MemoryScope/MemoryAdapter 类型**
- [x] **在 `packages/runtime` 的 Session 生命周期中加入记忆事件/钩子触发点**
- [ ] **调研并借鉴 SimpleMem 的三阶段记忆流水线与多视图索引模型**
- [ ] **在 `packages/preset-default` 中实现最小 Summary 记忆策略（摘要生成与注入）**

## 3. 进行中

- extension-sdk 已完成（defineExtension + 类型重导出）
- 记忆体系设计文档已合并，记忆契约已在 core 中实现（MemoryEntry/MemoryScope/MemoryAdapter）
- Runtime 的 Session/Turn 生命周期中已加入记忆事件/钩子触发点
- prompt() 与 runTurn() 已连通，替代了 preset-default 中的假 pipeline
- 首个 ModelAdapter 实现 `packages/provider`（OpenAI）已创建
- 测试验证 prompt 完整流程通过（mock 模型）
- 开发辅助能力命名统一为 devtools
- 默认行为已迁移到独立 preset 包，旧 presets.ts 已删除

## 4. 已完成

- [x] 完成 docs 结构重整
- [x] 拆分并补充核心设计文档
- [x] 补充术语表、决策记录、仓库目录结构草案
- [x] 收敛 runtime 为最小内核 + 可选服务的结构
- [x] 补充错误恢复、最小示例、迁移策略、权限声明等文档
- [x] 实现 `packages/core` 的基础类型与接口
- [x] 实现 `packages/runtime` 的最小内核骨架
- [x] 统一 docs 为"runtime 纯调度器 + preset extensions"方向
- [x] 将默认行为迁移为独立 preset 包的长期方向
- [x] 将自举相关能力统一重命名为通用 devtools
- [x] 明确 `sessionManager` 只是 runtime 内部实现，不作为 extension public API
- [x] 将 prompt capability 通过 registry 交给 preset 侧实现
- [x] **完成记忆体系设计文档：memory-design.md 创建，各模块 docs 更新**
- [x] **更新所有 docs 以反映记忆体系设计决策**

## 5. 阻塞项

- 暂无

## 6. 已确认决策

- D-001：使用 TypeScript 作为主实现语言
- D-002：采用空心核心架构
- D-003：runtime 只保留最小 kernel 职责
- D-004：provider / transport / storage / UI 外置
- D-005：Phase 1 只做最小可运行内核
- D-006：核心术语优先使用 `Session` / `Turn` / `ModelAdapter`
- D-007：扩展在 Phase 1 也要具备最基本的权限声明能力
- D-008：缓存适配器应具备稳定缓存键语义
- D-009：数据记录需要显式版本与迁移机制
- D-010：错误默认要显式暴露，不应静默吞掉
- D-011：自举能力优先放在扩展或应用层，不污染 core
- D-012：默认行为优先落到 preset extensions，runtime 尽量保持纯调度器
- D-013：preset 默认行为应长期放在 runtime 之外的独立包中
- D-014：开发辅助能力应统一视为 devtools，而不是自举专属层
- D-015：`sessionManager` 保持为 runtime 内部实现细节，不作为 extension public API
- D-016：引入中间件 (Middleware) 模式以增强生命周期包裹能力
- D-017：引入检查点 (Checkpoint) 机制以支持可中断执行
- D-018：核心设计借鉴 pi-mono
- D-019：缓存机制借鉴 reasonix
- D-020：记忆是跨层关注点，不归属单一层级
- D-021：借鉴 SimpleMem 的多视图索引模型与三阶段流水线
- D-022：记忆按作用域分三层：全局/项目/会话
- D-023：默认 Summary 记忆策略由 preset-default 提供

## 7. 下一步建议

1. 先确认 Phase 1 的第一个代码单元
2. 再建立最小仓库骨架
3. 然后从 `packages/extension-sdk` 开始补最薄的扩展辅助层
4. 再创建 `packages/preset-default` 并把默认行为逐步迁出 runtime
5. 再创建 `packages/devtools`
6. 再决定哪些开发辅助能力应该进入 preset 包或 devtools，而不是 core
7. **在 `packages/core` 中追加 MemoryEntry/MemoryScope/MemoryProvenance 类型定义**
8. **在 `packages/core` 中定义 MemoryAdapter 接口**
9. **在 `packages/runtime` 的 Session/Turn 生命周期中加入记忆相关的 Hook 触发点**
10. **调研并借鉴 SimpleMem 的核心实现，为 Phase 2 的 preset-memory 做准备**

## 8. 说明

- 任何新增任务都应该先加到 Todo，再进入进行中。
- 每完成一个小任务，就把它移动到“已完成”。
- 如果任务卡住，就放入“阻塞项”并写明原因。
- 如果决策变化，要同步更新“已确认决策”。
