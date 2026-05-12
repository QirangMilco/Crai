# Crai 开发策略

## 1. 目标

Crai 的目标不是一开始就完全自给自足，而是先依赖外部 coding 工具完成冷启动，再逐步把开发、验证、追踪和迭代能力迁移到自身系统内。

这些能力本质上属于通用开发能力，而不仅仅是“自举”能力；Crai 自身只是它的第一个用户。

## 2. 核心原则

### 2.1 核心要保持干净
核心包只保留与运行时执行直接相关的能力，不承载项目管理、开发辅助、AI 辅助写码、任务调度面板等产品化功能。

### 2.2 开发能力优先放在扩展与应用层
凡是与“帮助开发工作”直接相关的能力，优先放在：
- 扩展层 (extension)
- 应用层 (app layer)
- 开发服务器 (dev server)
- 示例工具 (example tooling)
- 开发工具包 (developer-tools package)

而不是放进 `@crai/core`。

### 2.3 核心只提供必要钩子
核心可以提供：
- 事件 (events)
- 钩子 (hook)
- 注册表 (registry)
- 命令契约 (command contract)
- 设置/权限/存储等抽象接口 (settings / permission / storage)

但核心不应该内建：
- 自动拆任务器
- 代码补丁编排器
- 规划器 UI
- 开发控制台
- 记忆管理器
- 仓库巡检器

这些都应作为可插拔能力存在。

### 2.4 SessionManager 是内部实现，不是公开扩展点
`sessionManager` 应保持为 runtime 内部实现细节，用于管理内存态 session。

如果未来需要扩展 session 行为，应通过：
- hooks
- events
- storage / persistence 抽象
- session 相关的公开 capability interface

而不是直接让 extension 依赖 `SessionManager` 本体。

### 2.5 安全是不可协商的核心关注点

工具安全性不应推迟到 Phase 3 再处理。安全是 runtime 的执行契约。Crai 从架构第一天内建四层纵深防御体系，详见 [security-model.md](security-model.md)。

## 3. 建议分层

### 3.1 `@crai/core`
只放最小运行时契约：
- 基础类型
- 事件 (events)
- 中间件与钩子 (middleware & hooks)
- 适配器 (adapters)
- 运行时句柄 (runtime handle)
- 扩展契约 (extension contract)

### 3.2 `@crai/runtime`
只放最小内核与执行循环：
- Session / Turn 流程 (session / turn flow)
- 中间件与钩子执行 (middleware & hook execution)
- 工具分发 (tool dispatch)
- 扩展加载/卸载
- 事件总线 / 中间件与钩子总线 (event bus / middleware & hook bus)
- 适配器分发 (adapter dispatch)

### 3.3 `@crai/core` (defineExtension)
扩展开发所需的辅助 API（`defineExtension`）已合入 `@crai/core`。

### 3.4 `packages/devtools` 或 `apps/*`
承载所有通用开发能力：
- implementation tracker UI
- task planner
- repo inspector
- small patch coordinator
- test runner integration
- AI assisted dev workflow

## 4. 判断标准

如果一个功能的目标是“让开发工作更高效”，先问这三个问题：
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
- **工具安全级别枚举（`ToolSafetyLevel`）**
- **权限模式枚举（`PermissionMode`）**
- **沙箱作用域类型（`SandboxScope`）**

### 放进 runtime
- 最小执行循环
- 状态调度
- 扩展生命周期
- 工具与模型调用编排
- **工具执行前的安全检查拦截**
- **文件路径沙箱校验**

### 放进 extension 或 app
- 开发工作流
- 任务拆解
- 实现跟踪面板
- 仓库分析
- 自动 patch 生成
- 自动回顾与续跑

## 6. 维护原则

- 核心越薄越好。
- 开发能力可以强，但不要污染 core。
- 所有开发辅助能力都要优先考虑可替换、可卸载、可单独演进。
- 未来即使重写开发工具，也不应影响 core 稳定性。
