# Crai

Crai 是一个 **极简的、默认空心的、高度可扩展的 AI Agent 运行时和应用基座**。

其 Extension API 的核心设计借鉴了 [OpenHanako](https://github.com/liliMozi/openhanako) 的权限模型与资源管理模式。

## 项目文档

这组文档已经按“目标 / 规格 / 数据 / 流程 / 计划”重新组织。

### 推荐阅读顺序

1. [架构概览](docs/architecture-overview.md) — 项目目标、边界、分层原则
2. [核心 API 规格](docs/core-api-spec.md) — 核心 API、事件、Hook、Adapter、扩展
3. [数据模型](docs/data-model.md) — Session / Message / Artifact / Turn 等数据模型
4. [运行时流程](docs/runtime-flow.md) — prompt、tool、extension 的执行流程
5. [阶段计划](docs/phase-plan.md) — 分阶段实施计划与验收标准
6. [运行时内核](docs/runtime-kernel.md) — 最小 runtime 内核定义
7. [错误与恢复策略](docs/error-recovery.md) — 默认错误与恢复策略
8. [最小内核示例](docs/minimal-kernel-example.md) — 最小内核示例设计
9. [术语表](docs/terminology.md) — 统一术语定义
10. [决策记录](docs/decision-log.md) — 关键架构决策记录
11. [仓库结构草案](docs/repo-structure.md) — 仓库目录结构草案
12. [实现跟踪](docs/implementation-tracker.md) — 中文实现跟踪文档
13. [自举策略](docs/bootstrap-strategy.md) — 自举策略与核心/扩展边界

## 核心原则

- **核心只感知能力**：Core 应该只理解抽象的能力（ModelAdapter, StorageAdapter 等），不感知具体实现。
- **事件优先**：每一个重要的运行时动作都应该是可观测的事件。
- **可钩入的生命周期**：扩展必须能够观测、拦截、替换或补丁运行时行为。
- **默认空心**：即使没有模型供应商和 UI，运行时仍然能够启动并管理基本逻辑。

## 开发指南

- [编码规范](docs/coding-standards.md) — 裸字符串管理、i18n 国际化、类型与值一致性
- [文档维护检查清单](docs/docs-maintenance.md)
- [仓库目录结构](docs/repo-structure.md)

## 许可

[LICENSE](LICENSE)
