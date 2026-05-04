# Crai Error and Recovery Policy

## 1. Purpose

This document defines the default runtime behavior when failures happen during model calls, tool execution, extension loading, or persistence.

## 2. Default Behavior

### 2.1 Model failure
If a model request fails:
- the current turn should fail
- the runtime should emit `turn.failed`
- any partial messages already produced should remain available for diagnostics
- the error should be surfaced as a `RuntimeError`

### 2.2 Tool failure
If a tool fails or times out:
- the runtime should emit `tool.failed`
- the current turn should continue or fail according to the tool result and hook policy
- the failure should be captured in a structured result when possible

### 2.3 Extension failure
If an extension throws during load or setup:
- the runtime should stop loading that extension
- the runtime should emit an error event or log entry
- the runtime should keep running unless the failure is fatal to the boot sequence

### 2.4 Persistence failure
If persistence fails:
- the runtime should report the error clearly
- the turn should not silently succeed
- the runtime may keep in-memory state temporarily, but persistence recovery should be explicit

## 3. Recovery Principles

- prefer failing the current turn over hiding errors
- preserve partial state when it helps debugging
- keep retry policy outside the core default unless explicitly configured
- make recovery behavior visible to extensions and transports

## 4. Retry Policy

The kernel should not hardcode aggressive retries.

Recommended default:
- no automatic retry for deterministic errors
- bounded retry only when a policy adapter or higher-level service explicitly enables it

## 5. Implementation Note

The runtime should not collapse all failures into a generic error string. Use structured `RuntimeError` values and keep the original cause when possible.
