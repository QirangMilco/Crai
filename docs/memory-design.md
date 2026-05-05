# Crai 记忆体系设计 (Memory System Design)

## 1. 目的

本文档定义了 Crai 的记忆体系 —— 一种跨层、可插拔的长期记忆方案，使 Agent 能够在 Session 间保持上下文、决策和学习成果。

记忆体系遵循 Crai 的整体架构原则：**核心只定义契约，运行时只提供触发点，策略实现主体位于预设扩展包中**。

## 2. 设计原则

### 2.1 记忆是跨层关注点

记忆不是单一层级，而是分布在三个层面上：

| 层级 | 职责 | 内容 |
|------|------|------|
| Core (契约层) | 定义记忆的数据类型和适配器接口 | `MemoryEntry` 类型、`MemoryAdapter` 接口 |
| Runtime (调度层) | 在 Session 生命周期中提供记忆触发点 | 记忆相关的 Event/Hook/Middleware |
| Preset/Extension (策略层) | 实现具体的记忆策略 | Summary 注入、向量检索、知识图谱、记忆整理 |

### 2.2 空心记忆策略

运行时内核不应拥有记忆策略实现。默认情况下，一个简单可靠的 Summary 记忆策略由 `preset-default` 提供；更高级的策略（如向量检索、知识图谱）由独立 preset 或扩展提供。

### 2.3 分层作用域

记忆按作用域分层，不同层级的记忆具有不同的优先级和生命周期：

```
全局约束记忆 (Global)  ← 用户偏好、安全规则、系统级约束    优先级最高 / 持久
项目级约束记忆 (Project) ← 项目规范、架构决策、代码约定        优先级中   / 跨 Session
上下文记忆 (Session)      ← 当前对话上下文、短期记忆            优先级低   / Session 级
```

### 2.4 Token 预算优先

记忆注入应始终遵循 Token 预算优先原则：先注入最关键的约束和摘要，在预算允许时再注入更多上下文细节。

## 3. 核心数据模型

### 3.1 MemoryEntry — 记忆单元

`MemoryEntry` 是记忆体系的最小单元，采用多视图索引模型：

```
I(m_k) = {s_k (Semantic), l_k (Lexical), r_k (Symbolic)}
```

- **语义层 (Semantic)**：密集向量，用于语义相似度检索
- **词汇层 (Lexical)**：稀疏关键词，用于 BM25 精确匹配
- **符号层 (Symbolic)**：结构化元数据（时间、人物、实体等），用于约束过滤

```ts
interface MemoryEntry {
  id: ID
  
  // Semantic Layer — 语义层
  losslessRestatement: string    // 自包含的事实陈述（无代词、绝对时间）
  embedding?: number[]           // 密集向量（由 EmbeddingAdapter 生成）
  
  // Lexical Layer — 词汇层
  keywords: string[]             // 关键词列表
  
  // Symbolic Layer — 符号层
  scope: MemoryScope             // 作用域：global | project | session
  projectId?: string             // 项目标识
  timestamp?: string             // ISO 8601 时间
  location?: string              // 地点
  persons: string[]              // 人物
  entities: string[]             // 实体（公司、产品等）
  topic?: string                 // 主题
  
  // 生命周期
  importance: number             // 重要性 [0, 1]
  createdAt: Timestamp           // 创建时间
  validFrom?: Timestamp          // 有效期开始
  validTo?: Timestamp            // 有效期结束
  supersededBy?: ID              // 被哪个新条目取代
  provenance?: MemoryProvenance  // 溯源信息
}

type MemoryScope = 'global' | 'project' | 'session'

interface MemoryProvenance {
  sessionId: ID          // 来源会话
  sourceKind: string     // 来源类型：message | tool_use | observation
  sourceId: string       // 来源标识
}
```

### 3.2 SessionSummary — 会话摘要

```ts
interface SessionSummary {
  id: ID
  sessionId: ID
  request?: string           // 用户请求摘要
  investigated?: string      // 调查内容
  learned?: string           // 学到的知识
  completed?: string         // 完成的内容
  nextSteps?: string         // 后续步骤
  observationCount: number   // 观察条目数
  memoryEntriesStored: number // 记忆条目存储数
  createdAt: Timestamp
}
```

### 3.3 Observation — 观察/发现

```ts
interface Observation {
  id: ID
  sessionId: ID
  type: 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery' | 'change'
  title: string
  subtitle?: string
  narrative?: string
  facts?: Record<string, unknown>
  files?: string[]
  createdAt: Timestamp
}
```

### 3.4 ContextBundle — 上下文注入包

```ts
interface ContextBundle {
  sessionSummaries: SessionSummary[]
  observations: Observation[]
  memoryEntries: MemoryEntry[]
  totalTokensEstimate: number   // Token 预算估算
}
```

## 4. 记忆生命周期

### 4.1 核心流程

```
Session 启动
  │
  ├── Context Injection (SessionStart Hook)
  │     ├── 1. 注入全局约束记忆
  │     ├── 2. 注入项目级约束记忆
  │     └── 3. 注入相关历史记忆 (Token 预算内)
  │
  ├── Session 进行中
  │     ├── Event Collection (Message/ToolUse/FileChange)
  │     └── Observations 提取 (可选的实时钩子)
  │
  └── Session 结束时
        ├── Summary Generation (LLM 摘要)
        ├── Memory Extraction (提取新事实)
        ├── Memory Consolidation (衰减/合并/裁剪)
        └── Persistence (持久化到存储)
```

### 4.2 触发点 (在 Runtime 中的位置)

| Runtime 生命周期点 | 记忆触发点 | 职责 |
|-------------------|-----------|------|
| `session:beforeStart` | ContextInjection Hook | 注入历史记忆到系统提示 |
| `turn:beforeModel` | MemoryQuery Middleware | 按需补充相关记忆 |
| `turn:afterToolExec` | ObservationExtraction Hook | 提取观察/发现 |
| `session:afterStop` | MemoryFinalization Hook | 生成摘要、提取记忆、整理、持久化 |

## 5. 检索策略

### 5.1 分层注入 (Priority-based Injection)

参考 SimpleMem-Cross 的 `ContextInjector` 设计，按优先级逐层填充 Token 预算：

```
预算 = 2000 tokens (可配置)

1. SessionSummaries (最高优先级) → 消耗 ~200 tokens
2. Observations (中优先级)      → 消耗 ~300 tokens
3. MemoryEntries (语义检索)     → 消耗剩余预算
```

每一层采用贪心打包 (Greedy Packing)：从不超出 Token 预算的最近/最相关条目开始填充。

### 5.2 混合检索 (Hybrid Retrieval)

当需要进行语义检索时，支持三种检索方式的融合：

```
C_q = R_sem ∪ R_lex ∪ R_sym
```

- **语义检索 R_sem**：基于密集向量的余弦相似度
- **关键词检索 R_lex**：基于稀疏关键词的 BM25 精确匹配
- **结构化检索 R_sym**：基于元数据字段的约束过滤（时间、人物、实体等）

### 5.3 金字塔检索 (Pyramid Retrieval)

在 Token 成本敏感的场景下，按代价逐级展开检索结果：

```
级别 1: Preview (摘要，~10 tokens / 条目) → 判断相关性
级别 2: Details (全文 + 元数据，~50 tokens / 条目) → 获取具体信息
级别 3: Evidence (原始内容，高成本) → 需要详细验证时按需加载
```

### 5.4 反思式检索 (Reflective Retrieval)

当初始检索结果不足以回答问题时的反馈循环：

1. 用当前结果尝试生成答案
2. 检查答案是否充分（LLM 评估）
3. 如果不充分，生成追加查询并再次检索
4. 合并新旧结果，重复直到充分或达到最大轮次

## 6. 记忆整理 (Consolidation)

### 6.1 Decay (衰减)

基于重要性和时间计算条目的"活性分数"，周期性降低低活性条目的权重：

```
activity_score = importance × e^(-λ × Δt)
```

- `importance`：条目重要性 [0, 1]
- `Δt`：距离上次访问的时间
- `λ`：衰减率（可配置）

### 6.2 Merge (合并)

检测重复或相似的记忆条目并合并：
- 基于语义相似度阈值触发
- 保留更完整的事实陈述
- 合并关键人物/实体列表
- 保留最早和最新的时间戳

### 6.3 Prune (裁剪)

移除不再有用的条目：
- 被取代的条目（`supersededBy` 已指向新条目）
- 过期的条目（`validTo` 已过当前时间）
- 重要性低于阈值且长期未被引用的条目

## 7. 参考实现借鉴

### 7.1 SimpleMem — 三阶段流水线

| SimpleMem 组件 | Crai 对应 | 借鉴内容 |
|---------------|-----------|---------|
| `MemoryBuilder` | `preset-memory` 中 | 语义结构化压缩：滑窗分割 + LLM 提取 → 多视图索引 |
| `HybridRetriever` | `preset-memory` 中 | 意图分析 → 三路并行检索 → 结果合并 → 反思轮次 |
| `AnswerGenerator` | 不直接对应 (Crai 使用 ModelAdapter) | 基于检索上下文的答案生成模式 |
| `ContextInjector` | `preset-default` 中 | 分层 Token 预算上下文注入 |

### 7.2 SimpleMem-Cross — 跨会话生命周期

- **Session 生命周期管理**：`start → record → stop → end` 映射到 Crai Runtime 的会话钩子
- **SQLite + Vector Store 双层存储**：结构化数据 + 向量数据的组合模式
- **Provenance 溯源**：每个记忆条目链接回源事件

### 7.3 reasonix — 三层记忆作用域

- **user.ts**：全局用户级记忆（安全规则、偏好）
- **project.ts**：项目级记忆（架构决策、代码约定）
- **session.ts**：会话级记忆（当前对话上下文）

### 7.4 Omni-SimpleMem — 多模态记忆

- **多模态原子单元 (MAU)**：统一的多模态记忆表示
- **热/冷存储分层**：摘要+向量在热存储，原始媒体在冷存储
- **知识图谱增强**：跨模态多跳推理

## 8. 推荐包落位

```
packages/
  core/                               ← MemoryEntry 类型, MemoryAdapter 接口
  runtime/                            ← 记忆相关 Event/Hook/Middleware 触发点
  preset-default/                     ← 默认 Summary 记忆策略（轻量级）
  preset-memory/         (新增)       ← 完整记忆策略实现（借鉴 SimpleMem）
    ├── memory-builder.ts             ← 语义压缩 + 多视图索引
    ├── hybrid-retriever.ts           ← 语义/关键词/结构化混合检索
    ├── context-injector.ts           ← Token 预算分层上下文注入
    ├── consolidation.ts              ← 记忆衰减/合并/裁剪
    └── memory-orchestrator.ts        ← 记忆生命周期编排器
  storage-vector/        (可选新增)    ← 向量存储适配器（LanceDB/FAISS 等）
```

## 9. 最小启动路径

### Phase 1 可完成的内容

1. 在 `packages/core` 中定义 `MemoryEntry` 类型、`MemoryScope` 枚举、`MemoryAdapter` 接口
2. 在 `packages/runtime` 的 Session 生命周期钩子中加入 Session 结束时的记忆提取触发点
3. 在 `packages/preset-default` 中实现最简单的 Summary 记忆策略：
   - Session 结束时调用 LLM 生成摘要
   - 下一次 Session 启动时将摘要注入系统提示

### Phase 2 可完成的内容

4. 创建 `packages/preset-memory`，实现完整的记忆策略
5. 实现 `ContextInjector` 的分层 Token 预算注入逻辑
6. 实现 `HybridRetriever` 的三路并行检索
7. 实现 `Consolidation` 的衰减/合并/裁剪机制

### Phase 3 可完成的内容

8. 支持多模态记忆（向量 + 知识图谱）
9. 支持记忆的分层冷热存储
10. 支持可插拔的记忆后端（LanceDB / FAISS / SQLite 等）
