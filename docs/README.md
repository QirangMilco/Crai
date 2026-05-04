# Crai Docs

这组文档已经按“目标 / 规格 / 数据 / 流程 / 计划”重新组织。

## 推荐阅读顺序

1. [architecture-overview.md](./architecture-overview.md) — 项目目标、边界、分层原则
2. [core-api-spec.md](./core-api-spec.md) — 核心 API、事件、Hook、Adapter、扩展
3. [data-model.md](./data-model.md) — Session / Message / Artifact / Turn 等数据模型
4. [runtime-flow.md](./runtime-flow.md) — prompt、tool、extension 的执行流程
5. [phase-plan.md](./phase-plan.md) — 分阶段实施计划与验收标准
6. [runtime-kernel.md](./runtime-kernel.md) — 最小 runtime 内核定义
7. [error-recovery.md](./error-recovery.md) — 默认错误与恢复策略
8. [minimal-kernel-example.md](./minimal-kernel-example.md) — 最小内核示例设计
9. [terminology.md](./terminology.md) — 统一术语定义
10. [decision-log.md](./decision-log.md) — 关键架构决策记录
11. [repo-structure.md](./repo-structure.md) — 仓库目录结构草案
12. [implementation-tracker.md](./implementation-tracker.md) — 中文实现跟踪文档
13. [bootstrap-strategy.md](./bootstrap-strategy.md) — 自举策略与核心/扩展边界

## 现有文件说明

- `core-api-draft.md`：保留为旧草案入口，内部会指向新规格文档
- `development-plan.md`：保留为旧方案入口，内部会指向新架构与实施计划

## 文档原则

- 先写边界，再写接口
- 先写阶段，再写实现
- 先写数据流，再写 UI 细节
- 避免把愿景、规格、实施计划混在同一份文档里
