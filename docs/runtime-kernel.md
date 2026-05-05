# Crai Runtime Kernel

## 1. Purpose

This document defines the smallest runtime that Crai must keep in order to function as an extensible agent core.

The preferred direction is: **runtime = pure scheduler**, while default behaviors live in preset extension packages outside the runtime package. The kernel should therefore stay as thin as possible, and only keep what is required to schedule and coordinate the runtime loop.

## 2. Kernel Responsibilities

The runtime kernel should own only:
- session lifecycle
- turn orchestration
- input normalization
- event emission
- hook execution
- extension lifecycle hooks
- minimal tool resolution
- adapter dispatch
- scheduling persistence checkpoints through injected capabilities

## 3. What the Kernel Should Not Own

The kernel should not directly own product-layer concerns such as:
- workspace management
- UI state
- window management
- IM-specific workflows
- command palette UI behavior
- advanced permission UX
- product-specific settings screens

These concerns may be implemented by app-layer services or preset extensions.

## 4. Recommended Kernel Shape

```txt
kernel/
  session manager
  turn runner
  event bus
  hook bus
  extension lifecycle
  adapter dispatch
```

### 4.1 Session manager
Responsible for creating, loading, and updating session state.

### 4.2 Turn runner
Responsible for executing the input -> context -> model -> tool -> persist loop.

### 4.3 Event bus
Responsible for broadcasting runtime facts.

### 4.4 Hook bus
Responsible for interception and mutation at defined lifecycle points.

### 4.5 Extension lifecycle
Responsible for loading, unloading, and reloading extensions.

### 4.6 Adapter dispatch
Responsible for calling the currently registered model, tool, storage, cache, permission, and transport adapters.

## 5. Optional Runtime Services

These capabilities are useful, but they should remain optional services layered on top of the kernel or moved into preset extension packages outside runtime:
- command registry
- settings store
- transport coordination
- permission policy orchestration
- cache policy orchestration
- thin-client routing helpers
- workspace-specific product logic
- custom tool catalog merge policies
- default context building
- default persistence strategy
- default telemetry/logging strategy

## 6. Boundary Rule

If a feature is required to schedule and coordinate the runtime loop, it belongs in the kernel.
If a feature can be expressed as a default behavior without changing the kernel contract, it should live in a preset extension package or app-layer service.
If a feature exists mainly to support UI, product management, or external integration, it belongs outside the kernel.

## 7. Design Goal

The kernel should be small enough that it can be understood as the executable heart of Crai, not as the full product platform.
It should schedule behavior, not accumulate behavior.
