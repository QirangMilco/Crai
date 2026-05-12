# Crai 最小内核示例 (Minimal Kernel Example)

## 1. 目的

本笔记描述了 Phase 1 中应当可用的最小端到端示例。

目标是为贡献者和评审者使架构变得具体。

## 2. 示例行为

一个最小运行时示例应当能够：
- 启动运行时
- 注册一个模型适配器
- 注册一个存储适配器
- 加载一个扩展
- 创建一个 Session
- 处理一个 Prompt
- 触发生命周期事件
- 干净地卸载扩展

## 3. 预期的事件序列

一个简单的快乐路径应当产生类似于以下的序列：

```txt
runtime.started
session.created
input.received
turn.started
context.built
model.requested
model.completed
tool.requested
tool.completed
message.appended
turn.completed
runtime.stopped
```

> 注：Middleware 包裹模型/工具调用，不产生独立事件。Middleware 的 wrap/before/after 行为通过 `model.requested/model.completed` 等事件对外可见。

## 4. 示例输出预期

示例应当使以下内容易于观测：
- Session ID
- Turn ID
- 触发的事件
- 任何工具调用
- 最终响应

## 5. 为什么这很重要

一个最小的可运行示例有助于验证内核是否真正精简，以及在添加更多服务之前端到端流程是否易于理解。
