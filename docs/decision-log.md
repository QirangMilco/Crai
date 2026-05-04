# Crai Decision Log

This log captures decisions that should remain stable unless there is a strong reason to change them.

## D-001 — Use TypeScript as the primary implementation language

### Status
Accepted

### Decision
Crai will use TypeScript for core, runtime, extensions, and UI-facing infrastructure.

### Reasoning
- better fit for dynamic extension loading
- shared language across runtime and UI
- lower friction for provider and transport integration
- faster iteration for a small team / single developer workflow

## D-002 — Use a hollow core architecture

### Status
Accepted

### Decision
Core will stay dependency-light and will not depend on provider SDKs, UI frameworks, IM SDKs, or concrete storage engines.

### Reasoning
- keeps the runtime extensible
- makes the system easier to test and swap
- reduces coupling between product concerns and execution concerns

## D-003 — Prefer event-driven and hookable runtime flow

### Status
Accepted

### Decision
Important runtime steps should be represented as events, and key lifecycle points should be interceptable by hooks.

### Reasoning
- supports extension-driven customization
- allows observability and policy enforcement
- keeps the core runtime reusable across multiple surfaces

## D-004 — Keep provider, transport, storage, and UI external to core

### Status
Accepted

### Decision
These capabilities are extension points, not built-in product dependencies.

### Reasoning
- avoids premature product coupling
- allows multiple front ends and transports
- makes future migration easier

## D-005 — Phase 1 should remain minimal

### Status
Accepted

### Decision
Phase 1 should focus on runtime shell, extension loading, event/hook pipeline, and one minimal adapter path.

### Reasoning
- reduces implementation risk
- makes the first milestone shippable
- avoids overbuilding before the runtime shape is proven

## D-006 — Prefer `Session` and `Turn` as core conversation terms

### Status
Accepted

### Decision
Core docs and APIs should use `Session` and `Turn` as the default terms.

### Reasoning
- clearer lifecycle semantics
- fits runtime-oriented execution flow
- avoids ambiguity between product-level and runtime-level concepts
