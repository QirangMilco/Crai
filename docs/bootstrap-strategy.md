# Crai 自举策略

## 1. 目标

Crai 的目标不是一开始就完全自给自足，而是先依赖外部 coding 工具完成冷启动，再逐步把开发、验证、追踪和迭代能力迁移到自身系统内。

## 2. 核心原则

### 2.1 核心要保持干净
核心包只保留与运行时执行直接相关的能力，不承载项目管理、开发辅助、AI 辅助写码、任务调度面板等产品化功能。

### 2.2 自举能力优先放在扩展与应用层
凡是与“帮助 Crai 开发 Crai”直接相关的能力，优先放在：
- extension
- app layer
- dev server
- example tooling

而不是放进 `@crai/core`。

### 2.3 核心只提供必要钩子
核心可以提供：
- 事件
- hook
- registry
- command contract
- settings / permission / storage 等抽象接口

但核心不应该内建：
- 自动拆任务器
- 代码补丁编排器
- 规划器 UI
- 自举控制台
- 记忆管理器
- 仓库巡检器

这些都应作为可插拔能力存在。

## 3. 建议分层

### 3.1 `@crai/core`
只放最小运行时契约：
- 基础类型
- events
- hooks
- adapters
- runtime handle
- extension contract

### 3.2 `@crai/runtime`
只放最小内核与执行循环：
- session / turn flow
- tool dispatch
- extension load / unload
- event bus / hook bus
- adapter dispatch

### 3.3 `@crai/extension-sdk`
提供扩展开发所需的辅助 API。

### 3.4 `apps/*` 或 `extensions/*`
承载所有自举相关能力：
- implementation tracker UI
- task planner
- repo inspector
- small patch coordinator
- test runner integration
- AI assisted dev workflow

## 4. 判断标准

如果一个功能的目标是“让 Crai 更会开发自己”，先问这三个问题：
1. 它是否直接影响 runtime loop 的正确性？
2. 如果不是，它是否只是开发辅助能力？
3. 如果是开发辅助能力，是否可以放到扩展或应用层？

若答案依次是：否、是、是，那么它就不应该进 core。

## 5. 推荐落位规则

### 放进 core
- runtime 必需的抽象
- session / turn / message / artifact 基础契约
- events / hooks / adapters
- 最小错误与权限语义

### 放进 runtime
- 最小执行循环
- 状态调度
- 扩展生命周期
- 工具与模型调用编排

### 放进 extension 或 app
- 自举工作流
- 任务拆解
- 实现跟踪面板
- 仓库分析
- 自动 patch 生成
- 自动回顾与续跑

## 6. 维护原则

- 核心越薄越好。
- 自举能力可以强，但不要污染 core。
- 所有开发辅助能力都要优先考虑可替换、可卸载、可单独演进。
- 未来即使重写自举扩展，也不应影响 core 稳定性。
