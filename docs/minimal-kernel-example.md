# Crai Minimal Kernel Example

## 1. Purpose

This note describes the smallest end-to-end example that should be available in Phase 1.

The goal is to make the architecture concrete for contributors and reviewers.

## 2. Example Behavior

A minimal runtime example should be able to:
- start the runtime
- register one model adapter
- register one storage adapter
- load one extension
- create one session
- process one prompt
- emit lifecycle events
- unload the extension cleanly

## 3. Expected Event Sequence

A simple happy path should produce a sequence similar to:

```txt
runtime.started
session.created
input.received
turn.started
context.built
model.requested
model.completed
message.appended
turn.completed
runtime.stopped
```

## 4. Example Output Expectations

The example should make it easy to observe:
- the session id
- the turn id
- the emitted events
- any tool calls
- the final response

## 5. Why This Matters

A minimal runnable example helps verify that the kernel is truly small and that the end-to-end flow is understandable before more services are added.
