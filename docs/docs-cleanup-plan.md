# 文档整理方案

## 立即修（不影响内容，只修过时字段）

1. `repo-structure.md` §3.9：YOLO → execute mode。补充 extension-sdk 包
2. `phase-plan.md` Phase 1 交付物：`@crai/base → @crai/core`
3. `data-model.md` 状态标签：Workspace → ✓，Turn → ✓
4. `security-model.md` §5.3：移除"待实现"段落（移入 phase-plan 的 Phase 3）

## 合并

5. `minimal-kernel-example.md` → 并入 `runtime-flow.md` 附录
6. `error-recovery.md` → 并入 `runtime-flow.md` 错误处理章节
7. `bootstrap-strategy.md` → 精简，去重后只保留 bootstrap 特有的内容

## 内容更新

8. `architecture-overview.md` + `phase-plan.md`：关联 `frontend-architecture.md`
9. `core-api-spec.md`：EventMap 事件名改为与实际代码一致的横线命名

## 新增

10. `transport-protocol.md`：从 `types/messages.ts` + `protocol.ts` 提取为独立文档
11. `provider-adapter.md`：记录 OpenAI/DeepSeek adapter 架构（可选，非阻塞）

## 不需要动的

- `implementation-tracker.md` — 准确
- `decision-log.md` — 准确
- `memory-design.md` — 标注清晰
- `terminology.md` — 干净
- `coding-standards.md` — 准确（未读但基于其他文档的品质）
