# Crai Data Model

## 1. Model Goals

The data model should be:
- small
- explicit
- versionable
- append-friendly
- suitable for replay and persistence

## 2. Core Entities

### 2.1 Workspace

A workspace is the top-level project container. It is optional in the core API draft, but should exist at the product level if Crai manages multiple projects or environments.

Suggested fields:
```ts
interface Workspace {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}
```

### 2.2 Session

A session is the primary runtime container for conversation and tool activity.

Suggested semantics:
- one session groups a continuous task or thread of work
- session state should be durable
- session metadata should remain small and descriptive
- session should be enough to reconstruct context from storage

### 2.3 Turn

A turn is one request/response execution cycle inside a session.

Suggested fields:
```ts
interface Turn {
  id: string
  sessionId: string
  createdAt: number
  completedAt?: number
  status: "running" | "completed" | "failed" | "stopped"
  metadata?: Record<string, unknown>
}
```

Turn is useful for:
- tracing one model call cycle
- grouping tool calls
- recording retry or failure state
- supporting stream replay

### 2.4 Message

A message is the persisted representation of an interaction unit.

Recommended behavior:
- message should be append-only
- parts should carry concrete payloads
- tool calls and tool results should remain traceable by `toolCallId`
- avoid mixing UI-only data into message core fields

### 2.5 Artifact

An artifact stores generated or attached content such as:
- source files
- rendered outputs
- snapshots
- logs
- images

Artifact should support both inline content and external URI references.

## 3. State Relationships

Recommended relationships:
- Workspace 1 -> N Session
- Session 1 -> N Turn
- Session 1 -> N Message
- Session 1 -> N Artifact
- Turn 1 -> N Tool execution records

## 4. Versioning Rules

### 4.1 Schema versioning

Every persisted record should have a version strategy. At minimum, the storage layer should know:
- record type
- record schema version
- migration path if needed

Recommended record envelope:
```ts
interface RecordEnvelope<T> {
  type: string
  version: number
  data: T
}
```

### 4.2 Migration hook

A storage adapter or runtime service should be able to migrate old records before they are used by the kernel.

Suggested helper shape:
```ts
interface MigrationContext {
  fromVersion: number
  toVersion: number
  recordType: string
}

interface MigrationStep<T = unknown> {
  fromVersion: number
  toVersion: number
  migrate(record: T, ctx: MigrationContext): T | Promise<T>
}
```

Suggested call timing:
- read record from storage
- inspect type and version
- run the applicable migration chain
- hand the migrated record to the runtime

### 4.3 Backward compatibility

Prefer additive changes over breaking changes.

Good changes:
- add optional field
- add new message part subtype
- add new event type

Risky changes:
- rename required field
- change semantic meaning of existing field
- remove a currently persisted property

## 5. Persistence Strategy

### 5.1 Append-first

Where possible, prefer append-only writes for:
- messages
- turns
- events
- tool execution traces

### 5.2 Snapshot plus log

For long-running sessions, a practical strategy is:
- append detailed events or messages
- periodically write a session snapshot
- rebuild the current state from snapshot + tail log

## 6. Recommended Missing Entities

These are not mandatory in the first core API draft, but they should be considered before implementation:
- Workspace
- Turn
- Attachment / File
- Task / Job
- Snapshot
- Execution trace

## 7. Migration Example

A simple example of a version upgrade could be:
- `Session v1` stores `title`
- `Session v2` renames it to `name`
- a migration step reads v1, maps `title -> name`, and returns the v2 shape

This keeps migration behavior explicit and avoids each storage adapter inventing its own upgrade style.

## 8. Notes for Implementation

- Do not store UI-only state in core entities.
- Do not overload Metadata to replace proper schema fields.
- Keep identity fields stable and predictable.
- Make replay and debugging a first-class consideration.
- Keep migrations explicit and testable.
