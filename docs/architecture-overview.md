# Crai Architecture Overview

## 1. Project Goal

Crai is a **minimal, hollow-by-default, highly extensible AI agent runtime and application base**.

The goal is not to build a heavy all-in-one agent product. The goal is to provide a small core that can be extended by:
- provider adapters
- UI shells
- IM transports
- storage/cache backends
- permissions policies
- external TypeScript extensions
- preset extensions that provide default behaviors

## 2. Non-goals

Crai does not aim to:
- hardcode a single provider
- hardcode a single UI framework
- require Electron
- require Feishu or any IM SDK in core
- require a fixed storage engine
- become a workflow engine in phase 1
- bundle product-specific business logic into core

## 3. Architecture Principles

### 3.1 Core only knows capabilities
Core should only understand abstract capabilities such as:
- `ModelAdapter`
- `ToolProvider`
- `StorageAdapter`
- `CacheAdapter`
- `PermissionAdapter`
- `TransportAdapter`
- `Extension`

Core should not know whether these capabilities come from OpenAI, Web UI, Feishu, SQLite, or any other implementation.

### 3.2 Event first
Every important runtime action should be observable as an event:
- session creation
- input reception
- context building
- model request/response
- tool execution
- persistence
- extension load/unload
- transport message passing

### 3.3 Hookable lifecycle
Extensions must be able to:
- observe
- block
- replace
- patch
- decorate
- append side effects

### 3.4 Hollow by default
Even with no provider, no UI, and no IM transport, the runtime should still be able to:
- start
- create sessions
- accept events
- load extensions
- persist state through injected adapters or preset extensions

## 4. Recommended Package Boundary

```txt
@crai/core
@crai/runtime
@crai/extension-sdk
@crai/loader-ts
```

### 4.1 `@crai/core`
Contains:
- shared types
- events
- hooks
- adapter contracts
- registry contracts
- error and logging types

### 4.2 `@crai/runtime`
Contains:
- the minimal runtime kernel
- session manager
- turn runner
- event bus
- hook bus
- extension lifecycle
- adapter dispatch

### 4.3 `@crai/extension-sdk`
Contains:
- `defineExtension()`
- helper utilities
- typed hook helpers
- re-exported core types

### 4.4 `@crai/loader-ts`
Contains:
- local TypeScript extension loading
- reload and unload support
- watch-mode helpers for development

## 5. Source Absorption Policy

This project follows **selective project absorption**, not full repo copying.

### 5.1 Good candidates to absorb
- agent event flow
- turn loop structure
- model stream representation
- context transform pipeline
- tool dispatch sequencing
- runtime hook mechanics

### 5.2 Things to rewrite for Crai
- product-specific state containers
- provider binding style that couples core and provider
- UI components
- storage layout tied to another product
- naming that reflects source project branding

### 5.3 Rule of thumb
If a piece of code would force provider/UI/IM into core, rewrite it instead of reusing it.

## 6. Phase Split

### Phase 1
- core types
- minimal runtime kernel
- extension loading
- basic event/hook pipeline
- one model adapter
- one storage adapter
- minimal UI or CLI entry point
- preset extensions for default behaviors

### Phase 2
- richer transport adapters
- cache strategy
- command system
- better persistence and snapshotting
- more optional runtime services

### Phase 3
- stronger permission model
- sandboxing options
- multi-transport coordination
- advanced UI shell / thin client support

## 7. Documentation Rules

- keep architecture separate from API spec
- keep data model separate from flow diagrams
- keep implementation plan separate from design intent
- prefer short, focused docs over one giant mixed draft
