# Crai Repository Structure Draft

This draft reflects the current documentation split and the intended monorepo layout.

## 1. Layering Principles

Crai should be organized around four layers:
- **core**: minimal contracts and types
- **runtime**: executable kernel and orchestration
- **extension**: optional behavior and self-bootstrapping helpers
- **app**: product surfaces, demos, and developer tooling

The goal is to keep `packages/core` clean and prevent self-bootstrapping or product logic from leaking into the core layer.

## 2. Top-Level Layout

```txt
packages/
  core/
  runtime/
  extension-sdk/
  loader-ts/
  self-bootstrap/
  provider-openai/
  provider-anthropic/
  provider-deepseek/
  storage-fs/
  cache-default/
  transport-websocket/
  transport-cli/
  transport-feishu/
  ui-web/
  shell-electron/
apps/
  dev-server/
  web/
  bootstrap-console/
examples/
  minimal-runtime/
  web-chat/
  feishu-bot/
docs/
```

## 3. Phase 1 Target Layout

Start with only the minimum packages needed to prove the architecture:

```txt
packages/
  core/
  runtime/
  extension-sdk/
  loader-ts/
```

Optional Phase 1 add-ons if needed:
- one provider package
- one storage package
- one minimal transport package
- one self-bootstrapping extension package, if and only if it stays outside core

## 4. Package Responsibilities

### 4.1 `packages/core`
- shared types
- events
- hooks
- adapter contracts
- runtime errors
- logging types
- only the contracts required by the runtime kernel

### 4.2 `packages/runtime`
- minimal runtime kernel
- prompt flow
- session management
- hook execution
- event emission
- extension lifecycle
- adapter dispatch
- minimal tool resolution

### 4.3 `packages/extension-sdk`
- `defineExtension()`
- helper utilities
- typed re-exports from core
- extension authoring helpers

### 4.4 `packages/loader-ts`
- load local `.ts` extensions
- reload and unload support
- watch-mode utilities

### 4.5 `packages/self-bootstrap`
- task tracking helpers
- repo inspection helpers
- AI-assisted patch coordination
- development workflow helpers
- this package must not modify `packages/core` boundaries

## 5. App Layer

### `apps/dev-server`
A local development server for testing runtime behavior and loading extensions.

### `apps/web`
A web UI shell that consumes runtime events and interacts with transport adapters.

### `apps/bootstrap-console`
A product surface for self-bootstrapping workflows, task tracking, and developer assistance.

## 6. Example Layer

Examples should stay small and focused:
- minimal runtime bootstrap
- web chat demo
- Feishu bot demo

## 7. Directory Rules

- keep implementation code under `packages/`
- keep runnable demos under `apps/` or `examples/`
- keep design/spec material under `docs/`
- avoid placing product-specific logic in `packages/core`
- keep self-bootstrapping helpers outside `packages/core`
- if a feature mainly helps Crai build Crai, prefer `packages/self-bootstrap` or `apps/bootstrap-console`

## 8. Recommended First Files

When implementation begins, start with:
- `packages/core/src/types.ts`
- `packages/core/src/events.ts`
- `packages/core/src/hooks.ts`
- `packages/runtime/src/createRuntime.ts`
- `packages/runtime/src/turnRunner.ts`
- `packages/extension-sdk/src/defineExtension.ts`
- `packages/loader-ts/src/index.ts`
- `packages/self-bootstrap/src/index.ts`
