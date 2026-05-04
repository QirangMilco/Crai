# Crai Phase Plan

## Phase 1: Minimal Runtime Foundation

### Goals
- define core types and contracts
- implement minimal runtime kernel
- support extension loading
- support event and hook pipeline
- support at least one model adapter and one storage adapter
- establish a basic permission declaration path for extensions

### Deliverables
- `@crai/core`
- `@crai/runtime`
- `@crai/extension-sdk`
- basic local TS loader
- one minimal runtime entry point
- extension permission declaration support

### Acceptance Criteria
- runtime can start without UI
- runtime can create a session
- runtime can process one prompt flow
- runtime can load and unload an extension
- runtime can emit core events
- extension loading can consult declared permissions before setup

## Phase 2: Product Integration Layer

### Goals
- add richer transport adapters
- add command registry usage
- improve persistence strategy
- add cache-aware context building
- add better runtime diagnostics

### Deliverables
- web transport
- CLI or thin client transport
- improved storage adapter implementation
- baseline command support

### Acceptance Criteria
- runtime can work through at least one external transport
- extensions can register commands and hooks
- persistence can replay basic session history

## Phase 3: Hardening and Scale

### Goals
- stronger permission model
- sandbox options for extension loading
- multi-transport coordination
- more robust snapshot and migration strategy
- better UI shell support

### Deliverables
- permission policy improvements
- optional isolation strategy
- snapshot/replay tooling
- richer observability

### Acceptance Criteria
- extension lifecycle is safe and repeatable
- data model versioning is documented and testable
- runtime behavior remains stable across reloads and adapter swaps

## Implementation Priorities

1. runtime core
2. extension system
3. storage and persistence
4. transport integration
5. UI shell

## Notes

- Keep phase scope small and testable.
- Do not pull advanced capabilities into phase 1 just because the API could support them.
- Every phase should be shippable on its own.
