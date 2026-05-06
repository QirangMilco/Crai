# Crai 阶段计划 (Phase Plan)

## Phase 1: 最小运行时基础 (Minimal Runtime Foundation)

### 目标
- 定义核心类型与契约（包括记忆类型与适配器契约）
- 实现最小运行时内核 (Minimal runtime kernel)
- 支持扩展加载 (Extension loading)
- 支持事件与钩子流水线 (Event and hook pipeline)
- 支持至少一个模型适配器和一个存储适配器
- 为扩展建立基础的权限声明路径
- **在 Core 层定义最小记忆类型与 MemoryAdapter 接口**
- **在 Runtime 层建立 Session 生命周期中的记忆事件/钩子触发点**

### 交付物
- `@crai/core`
- `@crai/runtime`
- `@crai/extension-sdk`
- 基础本地 TS 加载器
- 一个最小的运行时入口点
- 扩展权限声明支持
- **记忆类型定义 (`MemoryEntry`, `MemoryScope`, `MemoryProvenance`)**
- **记忆适配器契约 (`MemoryAdapter`)**
- **Session 记忆事件触发点 (`session:beforeStart`, `session:afterStop`)**
- **安全类型定义 (`ToolSafetyLevel`, `PermissionMode`, `SandboxScope`)**
- **权限适配器契约 (`PermissionAdapter`)**
- **默认危险命令列表与匹配器**
- **权限模式运行时切换**

### 验收标准
- 运行时可以在没有 UI 的情况下启动
- 运行时可以创建一个 Session
- 运行时可以处理一个 Prompt 流程
- 运行时可以加载和卸载一个扩展
- 运行时可以触发核心事件 (Core events)
- 扩展加载可以在设置前咨询声明的权限
- **每个 ToolDefinition 必须携带 safetyLevel 声明**
- **dangerous 级工具在 safe 模式下被直接拒绝**
- **dangerous 级工具在 ask 模式下触发 permission 事件**

## Phase 2: 产品集成层 (Product Integration Layer)

### 目标
- 增加更丰富的传输适配器 (Transport adapters)
- 增加命令注册表的使用
- 改进持久化策略
- 增加缓存感知的上下文构建
- 增加更好的运行时诊断能力
- **实现完整的记忆策略（packages/preset-memory）**

### 交付物
- Web 传输层
- CLI 或瘦客户端传输层
- 改进的存储适配器实现
- 基础命令支持
- **完整的记忆策略：MemoryBuilder → HybridRetriever → ContextInjector → Consolidation**
- **分层 Token 预算上下文注入机制**

### 验收标准
- 运行时可以通过至少一个外部传输层工作
- 扩展可以注册命令和钩子
- 持久化可以重放基础 Session 历史
- **Session 结束时自动生成摘要并持久化**
- **Session 启动时自动注入历史记忆到上下文**
- **记忆检索支持混合模式（语义/关键词/结构化）**

## Phase 3: 加固与规模化 (Hardening and Scale)

### 目标
- 更强的权限模型
- 扩展加载的沙箱选项
- 多传输层协调
- 更稳健的检查点 (Checkpoint) 和迁移策略
- 更好的 UI 壳层支持
- **支持多模态记忆与知识图谱增强检索**

### 交付物
- 权限策略改进
- 可选的隔离策略
- 检查点/重放工具链 (Checkpoint / Replay toolchain)
- 更丰富的观测能力 (Observability)
- **多模态记忆支持（向量 + 知识图谱）**
- **可插拔的记忆后端（LanceDB / FAISS / SQLite 等）**

### 验收标准
- 扩展生命周期安全且可重复
- 数据模型版本化已文档化且可测试
- 运行时行为在重新加载和适配器交换时保持稳定
- **记忆支持跨模态检索（文本/图像/音视频）**
- **记忆整理（衰减/合并/裁剪）自动运行**

## 实施优先级 (Implementation Priorities)

1. 运行时核心 (Runtime Core)
2. 扩展系统 (Extension System)
3. 存储与持久化 (Storage and Persistence)
4. 传输集成 (Transport Integration)
5. **记忆系统 (Memory System)**
6. UI 壳层 (UI Shell)

## 注意事项

- 保持各阶段范围小且可测试。
- 不要仅仅因为 API 可以支持就将高级能力拉入 Phase 1。
- 每一个阶段都应该是可以独立交付的。
