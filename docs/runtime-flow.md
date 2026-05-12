# Crai 运行时流程 (Runtime Flow)

## 1. 目的

本文档描述了输入处理、上下文构建、模型调用、工具执行、持久化以及扩展拦截的运行时执行顺序。

## 2. 高层流程

```txt
接收到输入 (input received)
  -> 构建上下文 (build context)
  -> 调用模型适配器 (call model adapter)
  -> 流式处理模型输出 (stream model output)
  -> 收集工具调用 (collect tool calls)
  -> 安全检查 + 执行工具 (safety check + execute tools)
  -> 有工具调用？→ 回到构建上下文（最多 10 轮）
  -> 运行 Turn 后钩子 (run after-turn hooks)
```

## 3. Prompt 流程

### 3.1 输入规范化

运行时应当在进入 Turn 循环之前，将输入规范化为 `RuntimeInput`。

### 3.2 Session 解析

如果没有提供 Session，运行时应当：
- 创建一个新 Session
- 或解析出一个默认 Session 策略

具体的策略应当在实现中明确定义，或由扩展 (Extension) 提供。

### 3.3 上下文构建 (Context Build)

上下文构建应当收集：
- Session 历史
- 相关消息 (Messages)
- 工具定义 (Tool definitions)
- 模型设置 (Model settings)
- 扩展修改 (Extension modifications)

在上下文被使用之前，`context:build` 钩子或预设扩展可以检查或修改这些数据。

### 3.4 模型请求 (Model Request)

在调用供应商 (Provider) 之前：
- 运行 `model:request:before`
- 如果需要，运行权限检查
- 如果可用，应用缓存策略

### 3.5 模型流式处理

运行时应当增量处理流式事件：
- 文本开始 (text start)
- 文本增量 (text delta)
- 工具调用 (tool call)
- 消息完成 (message completion)
- 最终完成/错误 (final done/error)

## 4. 工具流程 (Tool Flow)

### 4.1 工具解析

当模型发出工具调用时：
- 通过已注册的工具提供者 (Tool Providers) 解析工具名称
- 检查权限
- 运行 `tool:before`

### 4.2 工具执行

工具执行应当：
- 接收 Session + 工具调用 + 当前消息
- 返回规范化的工具结果
- 触发工具事件 (Tool events)
- 可选地发出 Turn 终止信号

### 4.3 工具失败

失败时：
- 触发 `tool.failed`
- 如果存储模型支持，持久化失败信息
- 允许钩子 (Hooks) 观测失败

## 5. 持久化流程 (Persistence Flow)

建议的持久化顺序：
1. 追加新的输入/消息数据
2. 持久化 Turn 开始状态
3. 持久化模型和工具结果
4. 持久化 Turn 完成状态
5. 运行 `persist:after`

默认的持久化行为可能存在于预设扩展中，但内核仍然拥有检查点 (Checkpoint) 的顺序。

## 6. 扩展加载/卸载流程 (Extension Load / Unload Flow)

> 扩展生命周期是运行时内核的核心职责之一，概述请参见 [运行时内核 → 扩展生命周期](runtime-kernel.md#45-扩展生命周期)。

### 6.1 加载 (Load)

在扩展加载时：
1. 导入模块
2. 解析扩展的默认导出 (default export)
3. 检查 `trust` 声明与运行时 `allowFullAccessExtensions` 配置
4. 运行 `setup(ctx)`，注入 `ExtensionContext`（含 events/bus、config、dataDir、register、registerTool）
5. 注册钩子、适配器和其他副作用
6. 触发 `extension.loaded`

### 6.2 卸载 (Unload)

在扩展卸载时：
1. 如果可用，调用扩展上的 `dispose()`
2. 逆序调用所有 `register()` 注册的 disposables
3. 移除已注册的钩子和命令
4. 如果注册表项由该扩展拥有，则清理注册表
5. 触发 `extension.unloaded`

### 6.3 重新加载 (Reload)

重新加载应当被视为：
- 卸载旧实例
- 重新导入模块
- 加载新实例

## 7. 并发规则 (Concurrency Rules)

### Phase 1 规则
- 相同 Session：串行执行 Turn
- 不同 Session：允许并行运行

这保持了运行时的简单性，同时为以后的升级留出了空间。

## 8. UI 与传输层集成 (UI and Transport Integration)

UI 和传输层应当消费事件，而不是依赖于运行时内部实现。

建议模式：
- 运行时触发事件
- 传输层将用户输入转发到运行时
- UI 监听事件并渲染状态
- IM 通道映射到传输适配器，而不是核心对象

这些集成很重要，但它们应当被视为内核周围的层，而不是内核本身的一部分。

## 9. 实现注意事项 (Implementation Notes)

- 保持流程的确定性
- 避免在适配器中隐藏副作用
- 保持钩子顺序显式化
- 使重新加载和销毁过程安全
- 优先选择支持此流程的最小内核表面
