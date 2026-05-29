# Codebase Audit: Crai

**Scale:** 126 source files (.ts), 30 test files, 38 documentation files
**Audited dimensions:** Coupling | Hardcoded | Layering | Docs | Tests
**Overall health:** PASS

---

## Top findings (ranked by severity)

### 🟠 HIGH (should fix)
1 finding

### 🟡 MEDIUM (consider fixing)
4 findings

### 🔴 CRITICAL
None

---

## Detailed findings

### [MD-1] Transport protocol docs missing `pinned`/`archived` fields

- **Location**: `docs/transport-protocol.md:26`, `docs/transport-protocol.md:57`
- **Problem**: Two protocol type definitions are outdated
  - `session:list:data` response type missing `pinned` and `archived` fields
  - `session:update` request type missing `pinned` and `archived` fields
- **Evidence**: Line 26 shows `{ type: 'session:list:data', sessions: Array<{ id, title?, createdAt, updatedAt }> }` but the actual implementation now returns `{ pinned?, archived? }` as well. Line 57 shows `{ type: 'session:update', sessionId: string, title?: string, mode?: string, thinkingLevel?: string }` but the implementation now also accepts `pinned?` and `archived?`.
- **Impact**: Anyone reading the docs will build clients that don't send/receive these fields. The frontend session list depends on these fields for archive/pin features.
- **Recommendation**: Add `pinned?: boolean` and `archived?: boolean` to both type definitions in the doc.

**Severity:** HIGH — this is a documentation error that causes real integration issues.

---

### [SZ-1] Four source files exceed 500 lines

- **Location**:
  - `packages/provider/src/deepseek/adapter.ts` **609 lines**
  - `packages/runtime/src/turnRunner.ts` **593 lines**
  - `packages/transport-ws/src/index.ts` **564 lines**
  - `packages/runtime/src/createRuntime.ts` **558 lines**
- **Problem**: These files exceed the 500-line hard limit.
- **Impact**: Larger files are harder to review, harder to merge without conflicts, and harder to understand in one pass.
- **Assessment per file**:
  - `deepseek/adapter.ts` (609) — DeepSeek adapter has inline model definitions, constants, and adapter logic. The `models.ts` file exists separately but is empty of model definitions. The 609 lines include both stream handling and REST API fallback. Could split into `adapter.ts` (core logic) + `stream.ts` (stream handling).
  - `turnRunner.ts` (593) — Central orchestration logic for turn execution. High cohesion but large. Could extract confirmation flow and result handling into separate modules.
  - `transport-ws/index.ts` (564) — All WebSocket message handlers in one file. Could split each message case group into separate handler files.
  - `createRuntime.ts` (558) — Runtime assembly and dependency injection. The `handlePrompt` function alone is substantial.
- **Recommendation**: Split each file where there's a clear seam. Start with `transport-ws/index.ts` (easiest — handlers are already organized by case).

**Severity:** MEDIUM (aggregate — 4 files, all over 500 by a moderate margin).

---

### [TC-1] Low test coverage in key packages

- **Location**: Multiple packages
- **Evidence**:
  | Package | Source files | Test files | Coverage |
  |---|---|---|---|
  | `provider` | 12 | 2 | 16% |
  | `core` | 9 | 2 | 22% |
  | `transport-ws` | 4 | 1 | 25% |
  | `tools-web` | 4 | 1 | 25% |
  | `storage-fs` | 3 | 1 | 33% |
  | `config` | 3 | 1 | 33% |
- **Impact**: Core packages (`provider`, `core`, `transport-ws`) govern model communication, session persistence, and transport. Low coverage means regressions in these areas are more likely to escape detection.
- **Recommendation**: Priority targets for new tests:
  1. `transport-ws` protocol handling (the `case 'prompt'`, `session:update`, etc.)
  2. `provider/deepseek/adapter.ts` adapter logic
  3. `core/types.ts` and `core/hooks.ts` type definitions and hook execution

**Severity:** MEDIUM (aggregate — not critical individually, but the pattern across key packages is concerning).

---

### [DO-1] No test for code-doc alignment

- **Location**: `docs/` directory (19 files)
- **Problem**: 19 documentation files with no automated check that the code matches the docs. During this audit, at least one doc (`transport-protocol.md`) already diverged from the implementation.
- **Impact**: Without automated validation, doc rot is inevitable in an actively developed project.
- **Recommendation**: Add a CI step that checks the protocol doc against the type definitions in `packages/transport-ws/src/protocol.ts`. This could be as simple as a grep-based smoke test.

**Severity:** MEDIUM — no active bug, but guarantees future drift.

---

### [HA-1] No hardcoded secrets found

- **Result**: Clean. No API keys, passwords, private keys, or connection strings in source code (outside test fixtures). The PII guard config file at `packages/base/src/pii-guard.ts` properly defines detection patterns.
- **Note**: The `.crai-dev` config directory in `~/.crai-dev/config.json` contains encrypted API keys (prefix `$aes$`). This is proper practice.

**Severity:** NONE — good practice confirmed.

---

### [LY-1] Clean layer separation

- **Result**: No layer violations found. The package dependency graph is a DAG:
  ```
  core ← base ← [security, config, storage-fs, tools-*, provider, transport-ws]
                ↓
              runtime ← persistence
  ```
  No package imports from a higher layer. Core has zero external dependencies.

**Severity:** NONE — clean architecture.

---

### [CP-1] No circular dependencies

- **Result**: Verified through package-level import analysis. No circular chains found in the cross-package dependency graph.

**Severity:** NONE — good coupling hygiene.

---

## Summary by dimension

| Dimension | Findings | Health |
|---|---|---|
| Coupling | 0 | 🟢 Clean DAG, no circular deps |
| Hardcoded values | 0 | 🟢 Clean, encrypted secrets in config |
| Layering | 0 | 🟢 No violations |
| Documentation | 1 HIGH | 🟡 Outdated protocol doc |
| Tests | 1 MEDIUM | 🟡 Low coverage in key packages |
| File size | 1 MEDIUM | 🟡 4 files over 500 lines |

## Key action items (ordered by impact)

1. Fix `docs/transport-protocol.md` to include `pinned`/`archived` fields — 5 minute fix, prevents integration bugs
2. Add test coverage for `transport-ws` protocol handlers — prevents protocol drift
3. Split 4 oversized files — reduces merge conflict surface, improves readability
