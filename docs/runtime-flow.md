# Crai Runtime Flow

## 1. Purpose

This document describes the runtime execution order for input handling, context building, model calls, tool execution, persistence, and extension interception.

## 2. High-Level Flow

```txt
input received
  -> normalize input
  -> emit input event
  -> run preset/default extensions
  -> build context
  -> run before-model hooks
  -> call model adapter
  -> stream model output
  -> collect tool calls
  -> run tool preflight hooks
  -> execute tools
  -> persist state
  -> run after-turn hooks
```

## 3. Prompt Flow

### 3.1 Input normalization

Runtime should normalize the input into `RuntimeInput` before entering the turn loop.

### 3.2 Session selection

If no session is provided, runtime should either:
- create a new session
- or resolve a default session policy

The exact policy should be explicit in implementation or supplied by a preset extension.

### 3.3 Context build

Context building should gather:
- session history
- relevant messages
- tool definitions
- model settings
- extension modifications

Before context is used, `context:build` hooks or preset extensions may inspect or modify the data.

### 3.4 Model request

Before the provider is called:
- run `model:request:before`
- run permission checks if needed
- apply cache strategy if available

### 3.5 Model stream handling

The runtime should handle stream events incrementally:
- text start
- text delta
- tool call
- message completion
- final done/error

## 4. Tool Flow

### 4.1 Tool resolution

When the model emits a tool call:
- resolve the tool name through registered tool providers
- check permissions
- run `tool:before`

### 4.2 Tool execution

Tool execution should:
- receive session + tool call + current messages
- return a normalized tool result
- emit tool events
- optionally signal turn termination

### 4.3 Tool failure

On failure:
- emit `tool.failed`
- persist failure information if the storage model supports it
- allow hooks to observe the failure

## 5. Persistence Flow

Recommended persistence order:
1. append new input / message data
2. persist turn start state
3. persist model and tool results
4. persist turn completion state
5. run `persist:after`

Default persistence behavior may live in a preset extension, but the kernel still owns the checkpoint order.

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
