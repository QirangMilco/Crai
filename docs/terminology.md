# Crai Terminology

This document defines the preferred terms used across Crai docs and code.

## Core Terms

### Runtime
The executable engine that coordinates sessions, hooks, events, model adapters, tools, storage, and extensions.

Do not use runtime to mean UI, desktop shell, or provider SDK.

### Core
The dependency-light contract layer. It contains shared types, adapter interfaces, event definitions, hook definitions, registry contracts, and basic errors/logging types.

Core should not depend on provider SDKs, UI frameworks, Electron, IM SDKs, or concrete storage engines.

### Extension
A user-provided or package-provided module that can register hooks, commands, providers, tools, transports, cache policies, permission policies, or other runtime behavior.

### Adapter
An implementation of an external capability contract, such as model, storage, cache, permission, or transport.

### Registry
A runtime-owned collection where extensions and bootstrap code can register adapters, tools, commands, or other capabilities.

## Conversation Terms

### Workspace
A product-level container for projects or environments. Workspace is not required for the minimal core runtime, but is useful for UI/product layers.

Workspace should not be treated as a required core entity in Phase 1.

### Session
The primary runtime container for one continuous user task or conversation. A session owns messages, turns, artifacts, and metadata.

### Turn
One execution cycle inside a session. A turn usually starts from input and may include context building, a model request, model streaming, tool calls, persistence, and completion/failure.

### Message
A persisted interaction unit made of typed parts. Messages should remain UI-agnostic.

### Message Part
A typed piece of message content, such as text, image, tool call, or tool result.

### Artifact
A generated or attached asset associated with a session, such as a file, rendered output, snapshot, image, or log.

## Execution Terms

### Event
An emitted fact about something that happened. Events are observational and should not directly mutate runtime state by themselves.

### Hook
An interception point that may observe, block, replace, or patch a value in the runtime lifecycle.

### Command
A named operation registered into the runtime command registry. Commands are useful for UI, CLI, automation, and extensions.

### Transport
An adapter that connects the runtime to an external input/output channel, such as WebSocket, CLI, or IM.

### Provider
A model service implementation, such as OpenAI, Anthropic, DeepSeek, or a custom model endpoint. In Crai docs, prefer `ModelAdapter` when referring to the core contract.

Use `provider` mainly in product explanations, not in core contracts.

## Storage Terms

### Storage Adapter
A concrete implementation for sessions, messages, artifacts, and eventually turns/snapshots.

### Snapshot
A persisted summary of current session state used to avoid replaying the entire append log.

### Append Log
An append-only sequence of records such as messages, events, or turn traces.

## Naming Rules

- Prefer `Session` over `Conversation` in core docs.
- Prefer `Turn` over `Run` for one input-to-completion cycle.
- Prefer `Transport` over `Notification` unless the capability is only outbound notification.
- Prefer `ModelAdapter` over `Provider` in API contracts.
- Prefer kernel-specific terms only for behavior required by the runtime loop.
- Avoid placing UI-only terms in core entities.
