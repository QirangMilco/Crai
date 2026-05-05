# Crai 运行时流程 (Runtime Flow)

## 1. 目的

本文档描述了输入处理、上下文构建、模型调用、工具执行、持久化以及扩展拦截的运行时执行顺序。

## 2. 高层流程

```txt
接收到输入 (input received)
  -> 规范化输入 (normalize input)
  -> 触发输入事件 (emit input event)
  -> 运行预设/默认扩展 (run preset/default extensions)
  -> 构建上下文 (build context)
  -> 运行模型前钩子 (run before-model hooks)
  -> 调用模型适配器 (call model adapter)
  -> 流式处理模型输出 (stream model output)
  -> 收集工具调用 (collect tool calls)
  -> 运行工具预检钩子 (run tool preflight hooks)
  -> 执行工具 (execute tools)
  -> 持久化状态 (persist state)
  -> 运行 Turn 后钩子 (run after-turn hooks)
```

## 3. Prompt 流程

### 3.1 输入规范化

运行时应当在进入 Turn 循环之前，将输入规范化为 `RuntimeInput`。

### 3.2 Session 解析

如果没有提供 Session，运行时应当：
- 创建一个新 Session
- 或解析出一个默认 Session 策略

具体的策略应当在实现中明确定义，或由预设扩展 (Preset Extension) 提供。

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

## 6. Extension Load / Unload Flow

### 6.1 Load

On extension load:
1. import module
2. resolve extension default export
3. run `setup(ctx)`
4. register hooks, commands, and other side effects
5. emit `extension.loaded`

### 6.2 Unload

On extension unload:
1. call `dispose()` on extension if available
2. remove registered hooks and commands
3. clean up registries if owned by the extension
4. emit `extension.unloaded`

### 6.3 Reload

Reload should be treated as:
- unload old instance
- re-import module
- load new instance

## 7. Concurrency Rules

### Phase 1 rule
- same session: serialized turns
- different sessions: allowed to run in parallel

This keeps the runtime simple while leaving room for later upgrade.

## 8. UI and Transport Integration

UI and transport should consume events rather than depend on runtime internals.

Recommended pattern:
- runtime emits events
- transport forwards user input into runtime
- UI listens to events and renders state
- IM channels map to transport adapters, not to core objects

These integrations are important, but they should be treated as layers around the kernel rather than part of the kernel itself.

## 9. Implementation Notes

- keep the flow deterministic
- avoid hidden side effects in adapters
- keep hook order explicit
- make reload and teardown safe
- prefer the smallest possible kernel surface that still supports this flow
