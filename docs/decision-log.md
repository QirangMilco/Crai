# Crai 决策记录 (Decision Log)

本日志记录了应当保持稳定的决策，除非有强有力的理由进行更改。

## D-001 — 使用 TypeScript 作为主要实现语言

### 状态
已接受 (Accepted)

### 决策
Crai 将在核心 (Core)、运行时 (Runtime)、扩展 (Extensions) 和面向 UI 的基础设施中使用 TypeScript。

### 理由
- 更好地契合动态扩展加载
- 运行时与 UI 之间共享语言
- 降低供应商 (Provider) 和传输层 (Transport) 集成的摩擦
- 为小团队/单人开发工作流提供更快的迭代速度

## D-002 — 采用空心核心架构 (Hollow core architecture)

### 状态
已接受 (Accepted)

### 决策
核心将保持轻量依赖，不依赖于供应商 SDK、UI 框架、IM SDK 或具体的存储引擎。

### 理由
- 保持运行时可扩展性
- 使系统更易于测试和更换
- 减少产品关注点与执行关注点之间的耦合

## D-003 — 首选事件驱动且可钩入的运行时流程

### 状态
已接受 (Accepted)

### 决策
重要的运行时步骤应当表示为事件 (Events)，关键的生命周期点应当可以通过钩子 (Hooks) 拦截。

### 理由
- 支持扩展驱动的定制化
- 实现可观测性和策略强制执行
- 保持核心运行时在多个表面上的可重用性

## D-004 — 将提供者、传输层、存储和 UI 保持在核心之外

### 状态
已接受 (Accepted)

### 决策
这些能力是扩展点，而不是内置的产品依赖。

### 理由
- 避免过早的产品耦合
- 支持多个前端和传输层
- 使未来的迁移更容易

## D-005 — Phase 1 应当保持极简

### 状态
已接受 (Accepted)

### 决策
Phase 1 应当聚焦于运行时外壳、扩展加载、事件/钩子流水线以及一个最小的适配器路径。

### 理由
- 降低实现风险
- 使第一个里程碑可交付
- 避免在运行时形态得到验证之前过度构建

## D-006 — 首选使用 `Session` 和 `Turn` 作为核心对话术语

### 状态
已接受 (Accepted)

### 决策
核心文档和 API 应当默认使用 `Session` 和 `Turn` 术语。

### 理由
- 更清晰的生命周期语义
- 契合面向运行时的执行流程
- 避免产品级概念与运行时概念之间的歧义

## D-007 — 扩展在 Phase 1 也要具备最基本的权限声明能力

### 状态
已接受 (Accepted)

### 决策
扩展在加载时应当能够声明所需的权限，运行时在调用 `setup()` 之前对声明的权限进行评估，拒绝未授权的加载请求。

### 理由
- 从 Phase 1 开始就建立安全意识
- 防止扩展在未经用户明确同意的情况下访问敏感能力
- 为未来更细粒度的权限模型打好基础

## D-008 — 缓存适配器应具备稳定缓存键语义

### 状态
已接受 (Accepted)

### 决策
`CacheAdapter` 应当提供一个可选的 `getCacheKey()` 方法用于从模型请求中导出稳定的缓存键，运行时可以基于此实现缓存命中/未命中的策略。

### 理由
- 确保缓存行为可预测且可调试
- 使扩展能够自定义缓存键的生成逻辑
- 与 reasonix 的语义索引策略对齐，降低 Token 消耗

## D-009 — 数据记录需要显式版本与迁移机制

### 状态
已接受 (Accepted)

### 决策
每一条持久化记录都应当携带 schema 版本信息，存储层或运行时服务应当在读取旧版本记录时运行迁移链，将其升级到当前版本。

### 理由
- 保证数据模型的可演进性
- 避免不同版本的记录在同一个运行时中产生歧义
- 使迁移行为显式化、可测试

## D-010 — 错误默认要显式暴露，不应静默吞掉

### 状态
已接受 (Accepted)

### 决策
运行时在模型请求、工具执行、扩展加载或持久化过程中发生失败时，应当使用结构化的 `RuntimeError` 抛出，不静默吞掉异常。

### 理由
- 增强系统可观测性
- 帮助开发者快速定位问题
- 避免因静默失败导致的数据不一致

## D-011 — 自举能力优先放在扩展或应用层，不污染 core

### 状态
已接受 (Accepted)

### 决策
凡是与"帮助开发工作"直接相关的能力（如任务拆解、实现跟踪、代码补丁生成等），优先放在扩展层、应用层或 `packages/devtools` 中，不内建到 `@crai/core`。

### 理由
- 保持核心层干净、稳定、可独立演进
- 开发工具可以被替换或卸载而不影响运行时核心
- 使 Crai 自身的开发工作流作为 devtools 的一个用户，而不是硬编码在核心中

## D-012 — 默认行为优先落到 preset extensions，runtime 尽量保持纯调度器

### 状态
已接受 (Accepted)

### 决策
运行时（Runtime）的职责仅限于调度和协调执行循环（Session/Turn/事件/钩子/适配器分发）。所有默认行为——如默认 Prompt 流水线、默认上下文构建、默认持久化策略——都应当由 `packages/preset-default` 提供。

### 理由
- 保持运行时核心足够薄，易于理解和测试
- 让用户可以通过替换 preset 来定制默认行为，而不需要修改运行时
- 与"空心核心"架构原则一致

## D-013 — preset 默认行为应长期放在 runtime 之外的独立包中

### 状态
已接受 (Accepted)

### 决策
即使 preset-default 在 Phase 1 是事实上的标配，它的代码也应长期保持在 `packages/preset-default` 独立包中，不合并进 `packages/runtime`。

### 理由
- 保持运行时和默认行为的独立版本演进
- 使第三方能够创建替代的 preset 包
- 避免运行时的 API 边界被默认行为的实现细节污染

## D-014 — 开发辅助能力应统一视为 devtools，而不是自举专属层

### 状态
已接受 (Accepted)

### 决策
Crai 自身的开发辅助能力（任务规划、实现跟踪、仓库巡检、代码补丁等）不应被标记为"自举专属"，而应统一归类为通用的 `devtools` 能力，这些能力同样可以服务于其他项目。

### 理由
- 扩大开发工具的使用范围，不只局限于 Crai 自身
- 降低开发工具的维护认知负担（不需要区分"给 Crai 用"和"给其他项目用"）
- 与已有开源项目的 devtools 惯例保持一致

## D-015 — `sessionManager` 保持为 runtime 内部实现细节，不作为 extension public API

### 状态
已接受 (Accepted)

### 决策
`SessionManager` 是运行时内部用来管理内存态 Session 的实现，不应当暴露为扩展的公共 API。扩展如需扩展 Session 行为，应当通过 hooks、events、storage 抽象或 Session 相关的公开 capability interface 来实现。

### 理由
- 保持 SessionManager 的实现自由度，允许未来重构而不破坏扩展兼容性
- 防止扩展直接依赖运行时内部状态，导致强耦合
- 遵循最小 API 表面原则

## D-016 — 引入中间件 (Middleware) 模式以增强生命周期包裹能力

### 状态
已接受 (Accepted)

### 决策
借鉴 Eino 等行业框架，在原有的点状 Hook 基础上，引入 Middleware 接口，允许扩展对模型调用和工具执行进行“环绕”处理。

### 理由
- 支持更复杂的逻辑注入（如重试、性能监控、自动缓存控制）
- 相比 Hook 更容易实现跨调用周期的状态保持
- 与成熟行业标准对齐，降低开发者的认知成本

## D-017 — 引入检查点 (Checkpoint) 机制以支持可中断执行

### 状态
已接受 (Accepted)

### 决策
在运行时流程中明确 Checkpoint 触发点，支持在长任务或需要人机交互的环节保存中间状态。

### 理由
- 支持 Human-in-the-loop 场景
- 增强系统的容错与故障恢复能力
- 优化长会话的上下文重载效率

## D-018 — 核心设计借鉴 pi-mono

### 状态
已接受 (Accepted)

### 决策
Crai 的 Agent 循环设计和模型提供者（Provider）适配层将参考 pi-mono 的实现，保持执行引擎的精简和高效。

### 理由
- pi-mono 证明了 TS 环境下高性能 Agent 循环的可行性
- 减少在执行引擎底层设计上的探索成本

## D-019 — 缓存机制借鉴 reasonix

### 状态
已接受 (Accepted)

### 决策
Crai 将引入以缓存为中心的语义索引和状态持久化机制，参考 reasonix 的设计。

### 理由
- 显著提升重复任务的响应速度
- 降低 Token 消耗，提高 Token 利用率

## D-020 — 记忆是跨层关注点，不归属单一层级

### 状态
已接受 (Accepted)

### 决策
记忆功能不归属于 Core、Runtime 或 Preset 中的单一层级，而是分布在三个层面上：

- **Core 层**：定义 `MemoryEntry` 类型、`MemoryScope` 枚举和 `MemoryAdapter` 接口，仅关注记忆的数据形状和抽象契约
- **Runtime 层**：在 Session 生命周期中提供记忆事件/钩子触发点（`session:beforeStart`、`session:afterStop`、`turn:beforeModel`、`turn:afterToolExec`），不实现任何记忆策略
- **Preset/Extension 层**：实现具体的记忆策略，包括摘要生成、上下文注入、混合检索、记忆整理等

### 理由
- 保持 Core 和 Runtime 的空心特质，与 D-002（空心核心架构）一致
- 让用户可以通过替换 preset 来定制记忆行为，而不需要修改 Core 或 Runtime
- 记忆策略的复杂度较高，放在 Preset 层可以独立版本演进

## D-021 — 借鉴 SimpleMem 的多视图索引模型与三阶段流水线

### 状态
已接受 (Accepted)

### 决策
Crai 的记忆策略设计将参考 SimpleMem 的核心设计：

- **多视图索引模型**：每条记忆同时包含语义层（密集向量）、词汇层（稀疏关键词）和符号层（结构化元数据）三个索引维度
- **三阶段流水线**：MemoryBuilder（语义结构化压缩）→ HybridRetriever（意图感知混合检索）→ ContextInjector（分层 Token 预算注入）
- **跨会话记忆生命周期**：`start → record → stop → end` 四阶段生命周期管理
- **记忆整理机制**：衰减（Decay）、合并（Merge）、裁剪（Prune）

### 理由
- SimpleMem 在 LoCoMo 和 Mem-Gallery 基准上验证了其有效性
- 多视图索引模型为检索提供了语义+关键词+结构的综合覆盖
- 分层 Token 预算注入直接解决了"如何在上下文和 token 友好的情况下减少幻觉"的问题

## D-022 — 记忆按作用域分三层：全局/项目/会话

### 状态
已接受 (Accepted)

### 决策
记忆条目的作用域分为三个层级，决定生命周期和注入优先级：

- `global`（全局）：用户偏好、安全规则、系统级约束，持久有效，注入优先级最高
- `project`（项目）：项目规范、架构决策、代码约定，跨 Session 有效，注入优先级中
- `session`（会话）：当前对话上下文，Session 级有效，注入优先级低

### 理由
- 与 reasonix 的三层记忆作用域设计对齐（user/project/session）
- 越底层的约束越稳定，应优先注入以保持行为一致性
- 分层优先级注入可有效控制 Token 成本

## D-023 — 默认 Summary 记忆策略由 preset-default 提供

### 状态
已接受 (Accepted)

### 决策
在 Phase 1 中，默认的轻量级 Summary 记忆策略（Session 结束时生成摘要，Session 启动时注入摘要）由 `packages/preset-default` 提供。完整的记忆策略（包括混合检索、向量存储、记忆整理等）属于 Phase 2 的 `packages/preset-memory`。

### 理由
- 保持 preset-default 在 Phase 1 即可提供有意义的记忆行为
- 避免在 Phase 1 中引入向量数据库等重依赖
- 与 D-012（默认行为优先落到 preset extensions）一致

## D-024 — UI 与 Markdown 渲染借鉴 crystalagents

### 状态
已接受 (Accepted)

### 决策
Crai 的前端应用层（apps/*）将参考 crystalagents 的现代交互风格和 Markdown 渲染逻辑。

### 理由
- 提升开发者体验 (DX) 和产物展示质量
- 保持 UI 层与核心内核的解耦

## D-025 — 扩展能力借鉴 snow-cli (MCP/LSP)

### 状态
已接受 (Accepted)

### 决策
Crai 将吸收 snow-cli 在 MCP (Model Context Protocol) 和 LSP (Language Server Protocol) 集成方面的经验。

### 理由
- 增强对外部工具链和代码分析能力的连接
- 复用成熟的工具确认流 (Tool Confirmation Flow) 设计
