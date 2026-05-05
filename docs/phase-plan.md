# Crai 阶段计划 (Phase Plan)

## Phase 1: 最小运行时基础 (Minimal Runtime Foundation)

### 目标
- 定义核心类型与契约
- 实现最小运行时内核 (Minimal runtime kernel)
- 支持扩展加载 (Extension loading)
- 支持事件与钩子流水线 (Event and hook pipeline)
- 支持至少一个模型适配器和一个存储适配器
- 为扩展建立基础的权限声明路径

### 交付物
- `@crai/core`
- `@crai/runtime`
- `@crai/extension-sdk`
- 基础本地 TS 加载器
- 一个最小的运行时入口点
- 扩展权限声明支持

### 验收标准
- 运行时可以在没有 UI 的情况下启动
- 运行时可以创建一个 Session
- 运行时可以处理一个 Prompt 流程
- 运行时可以加载和卸载一个扩展
- 运行时可以触发核心事件 (Core events)
- 扩展加载可以在设置前咨询声明的权限

## Phase 2: 产品集成层 (Product Integration Layer)

### 目标
- 增加更丰富的传输适配器 (Transport adapters)
- 增加命令注册表的使用
- 改进持久化策略
- 增加缓存感知的上下文构建
- 增加更好的运行时诊断能力

### 交付物
- Web 传输层
- CLI 或瘦客户端传输层
- 改进的存储适配器实现
- 基础命令支持

### 验收标准
- 运行时可以通过至少一个外部传输层工作
- 扩展可以注册命令和钩子
- 持久化可以重放基础 Session 历史

## Phase 3: 加固与规模化 (Hardening and Scale)

### 目标
- 更强的权限模型
- 扩展加载的沙箱选项
- 多传输层协调
- 更稳健的快照 (Snapshot) 和迁移策略
- 更好的 UI 壳层支持

### 交付物
- 权限策略改进
- 可选的隔离策略
- 快照/重放工具链
- 更丰富的观测能力 (Observability)

### 验收标准
- 扩展生命周期安全且可重复
- 数据模型版本化已文档化且可测试
- 运行时行为在重新加载和适配器交换时保持稳定

## 实施优先级 (Implementation Priorities)

1. 运行时核心 (Runtime Core)
2. 扩展系统 (Extension System)
3. 存储与持久化 (Storage and Persistence)
4. 传输集成 (Transport Integration)
5. UI 壳层 (UI Shell)

## 注意事项

- 保持各阶段范围小且可测试。
- 不要仅仅因为 API 可以支持就将高级能力拉入 Phase 1。
- 每一个阶段都应该是可以独立交付的。
