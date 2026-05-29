---
name: codebase-audit
description: "Systematic codebase health audit. Analyzes coupling, contradictions, layer violations, hardcoded secrets/values, doc-code mismatches, outdated docs, stale tests, and test security violations. Produces a structured severity-ranked report. Triggers on: audit the codebase, check code quality, review architecture, find technical debt, assess project health, check for inconsistencies, is this well-structured, code review, analyze dependencies, check for code smells, verify documentation matches code, check test quality, look for secrets or hardcoded values. Do NOT activate for simple linting, single-file review, or style formatting."
---

# Codebase Health Audit

A systematic multi-pass analysis that checks eight dimensions of a codebase. Each pass is independent and produces findings. The final report aggregates and prioritizes them.

## Philosophy

This audit prioritizes **actionable findings** over exhaustive coverage. A finding is actionable when it points to a concrete problem and suggests what to change. Saying "this module is too coupled" without showing the specific circular chain is not actionable. Saying "module A imports B, B imports C, C imports A" is.

The goal is not to produce a long list of everything wrong. It is to surface the **structural problems most likely to cause real bugs or prevent future changes**.

**Scope note**: For hardcoded secrets and credentials, this audit uses pattern matching to flag suspicious values. It does NOT have access to external secret scanners (truffleHog, Gitleaks, etc.) and may produce false positives. Every finding in this dimension requires manual verification before action is taken.

## Workflow overview

```
Phase 1: Project Map            → understand structure, find entry points
Phase 2: Coupling Analysis      → detect circular deps, god modules, import sprawl
Phase 3: Layer Analysis         → detect layer violations, mixed concerns
Phase 4: Doc Audit              → find doc-code mismatches, outdated docs
Phase 5: Hardcoded Audit        → find secrets, credentials, internal URLs, magic values
Phase 6: Test Audit             → find stale tests, untested changes, security issues
Phase 7: Report                 → aggregate, rank, suggest fixes
```

Phase 1 is prerequisite to everything else. Phases 2-6 are independent and can run in any order.

---

## Phase 1: Project Map

Build a mental model of the project before analyzing anything.

### 1.1 Identify project type and structure

Start by reading the project root:
- `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `CMakeLists.txt` — language and dependency manifest
- `tsconfig.json`, `webpack.config.js`, `vite.config.ts` — build configuration
- `README.md`, `CONTRIBUTING.md`, `docs/` — documentation entry points
- `.gitignore`, `.editorconfig`, `.env.example` — project conventions

If the project has a `docs/` or `Design/` directory with architecture docs (`design.md`, `architecture-overview.md`), read them now. They establish the **intended architecture** that you'll compare the actual code against.

### 1.2 Map the source tree

Use `find` and `ls` to understand:
- Top-level directory layout (src/, packages/, apps/, libs/)
- Entry point files (index.ts, main.ts, app.ts, lib.rs)
- Module boundaries: does the project use packages, workspaces, or flat files?
- Test file locations: co-located (`*.test.ts`) or in a separate `__tests__/` directory?

```
Example:
apps/web/src/          → frontend code (React components)
apps/server/src/       → backend server
packages/core/src/     → shared core types and interfaces
packages/runtime/src/  → runtime logic
packages/*/test/       → test files in each package
```

### 1.3 Establish baselines

```bash
# Total code files by type
find . -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | wc -l
# Test files
find . -name "*.test.ts" -not -path "*/node_modules/*" | wc -l
# Documentation files
find . -name "*.md" -not -path "*/node_modules/*" | wc -l
```

This gives you scale context. "200 imports in a 1000-file project" is normal. "200 imports in a 10-file project" is a smell.

---

## Phase 2: Coupling Analysis

Look for three types of coupling problems: circular dependencies, god modules, and import sprawl.

### 2.1 Circular dependencies

A circular dependency exists when module A imports B, B imports C (directly or transitively), and C imports A. These make the code impossible to reason about in isolation and often lead to initialization order bugs.

**How to detect:**

For each directory or package boundary, trace import chains:

```bash
# Find all import statements in a directory
grep -rn "from ['\"]\.\." --include="*.ts" --include="*.tsx" packages/core/src/ | head -30
grep -rn "import.*from" --include="*.ts" --include="*.tsx" apps/web/src/ | head -30
```

Then manually trace suspicious chains. Focus on:
- Cross-package imports (packages importing sibling packages)
- Shared types importing implementation details
- Index files that export from many places (potential circular entry points)

**Severity:** Circular dependency = HIGH. Cross-package import that shouldn't exist = MEDIUM.

### 2.2 God modules

A god module is a file or package that too many other modules depend on. It becomes a bottleneck for change.

**How to detect:**

```bash
# Find files imported by many others
grep -rn "from ['\"]\.\./utils" --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
# Find barrel exports (index.ts that re-exports everything)
find . -name "index.ts" -not -path "*/node_modules/*" | xargs grep -l "export \* from\|export {" 2>/dev/null
```

Read the god module candidate. Look for:
- Multiple unrelated responsibilities in one file
- Mixed concerns (e.g., a file that both parses data AND formats output AND writes to disk)
- **More than 500 lines** — a hard limit. Files exceeding this should be split. React components and generated code are the only exceptions.

**How to detect:**
```bash
# Files exceeding 500 lines
find . -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs wc -l 2>/dev/null | awk '$1 > 500' | sort -rn | head -20
```

**Severity:** Over 500 lines = MEDIUM (aggregate with count). 3+ distinct concerns = HIGH.

### 2.3 Import sprawl

A module that imports from many different packages indicates it knows too much about the system.

**How to detect:**

```bash
# Count unique import sources per file
for f in $(find packages -name "*.ts" -not -path "*/node_modules/*"); do
  count=$(grep -c "from " "$f" 2>/dev/null)
  if [ "$count" -gt 15 ]; then echo "$count $f"; fi
done | sort -rn | head -10
```

For files with many unique imports, read the first few to understand if the imports serve a single cohesive purpose or scattered responsibilities.

**Severity:** 20+ unique import sources = HIGH. 10-20 = MEDIUM.

---

## Phase 3: Layer Analysis

Compare the actual dependency graph against the intended architecture. Without a documented architecture, infer one from the directory structure (e.g., packages/ are independent, apps/ depend on packages).

### 3.1 Detect layer violations

A layer violation is when lower-level code imports higher-level code. For example:
- A shared types package imports a UI component
- A data layer imports a service layer
- Platform-independent code imports platform-specific code

**How to detect:**

First, establish the layer ordering from the project structure or architecture docs. Then check for reverse imports:

```bash
# Check if "lower" layer imports "higher" layer
# Example: packages/core/ (lower) should NOT import from packages/runtime/ (higher)
grep -rn "from ['\"]@crai/runtime\|from ['\"']\.\./runtime" packages/core/src/ | head -10
grep -rn "from ['\"]@crai/web\|from ['\"']\.\./web" packages/ | head -10
```

**Severity:** Importing from a higher layer = HIGH. Importing from a sibling when it should be isolated = MEDIUM.

### 3.2 Mixed concerns

A file or module that handles multiple architectural layers in one place. Classic signals:
- A React component that also makes API calls directly (instead of delegating to a service)
- A data access file that also formats presentation output
- A utility function that also has side effects

**How to detect:**

Read files flagged in Phase 2 (large files, many imports, god modules). For each, ask:
- Can I name the single responsibility in one sentence?
- If not, what would the split look like?

**Severity:** 3+ concerns mixed = HIGH. 2 concerns that are adjacent = MEDIUM.

### 3.3 Leaky abstractions

An abstraction that exposes implementation details of its underlying layer. For example, a repository interface that returns database-specific error types instead of domain errors.

**How to detect:**

Read exported interfaces and types. If they reference types from a specific implementation (database driver, HTTP client, file format parser), that's a leak.

**Severity:** Implementation types in public API = HIGH. Implementation types in internal API = MEDIUM.

---

## Phase 4: Documentation Audit

### 4.1 Code-doc mismatch

Compare documented behavior against actual code. Focus on:
- API endpoints documented but not implemented
- Function signatures that differ from their JSDoc/TSDoc comments
- Configuration options documented but not read by the code
- Return types described differently in docs vs actual

**How to detect:**

For any documentation files found in Phase 1 (`docs/*.md`, `Design/*.md`, README):

1. Extract documented interfaces, APIs, configuration keys, and behaviors
2. Search the codebase for corresponding implementations
3. Flag anything mentioned in docs that has no code counterpart
4. Flag anything in code that contradicts documentation

Example checks:
```bash
# Read design docs for API specs
grep -rn "interface\|function\|endpoint\|route" docs/ --include="*.md" | head -30
# Search for their implementation
grep -rn "specificFunctionName\|specificEndpoint" apps/server/src/ | head -10
```

### 4.2 Outdated documentation

Documentation that references code, APIs, or behaviors that no longer exist.

**How to detect:**

For each doc file, extract:
- File paths mentioned — verify they still exist
- API endpoints or function names — search for them
- Configuration keys — search for them
- Architecture decisions — verify the decisions are still reflected in the code
- Setup/install instructions — verify they still work (dependency versions, required tools)

**Severity:** Entire doc file is wrong = HIGH. A few outdated sections = MEDIUM. Minor version bumps = LOW.

### 4.3 Missing documentation

Significant public interfaces without any documentation.

**How to detect:**

```bash
# Find exported functions/interfaces without JSDoc/TSDoc
grep -rn "^export.*function\|^export.*interface\|^export.*type" --include="*.ts" packages/core/src/ | head -50
```

Read a sample. If a public API has no doc comment and its purpose isn't obvious from the name, flag it.

**Severity:** Public API without docs = MEDIUM. Internal function without docs = LOW.

---

## Phase 5: Hardcoded Audit

Secrets, credentials, and hardcoded values in source code are the most common cause of accidental exposure and environment-specific bugs. This phase covers all code (source and tests).

### 5.1 Secrets and credentials

Search for anything that looks like an authentication credential embedded directly in code, config files committed to the repo, or test fixtures.

**Checklist (run ALL checks):**

1. **API keys and tokens** — known patterns for major providers
   ```bash
   grep -rn "sk-[a-zA-Z0-9]\{20,\}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go" --include="*.json" --include="*.yaml" . 2>/dev/null | grep -v "node_modules" | grep -v ".env" | head -20
   grep -rn "api_key\|apikey\|API_KEY\|apiKey" --include="*.ts" --include="*.tsx" --include="*.json" . 2>/dev/null | grep -v "node_modules" | grep -v "\${.*}\|process\.env\|import.meta.env" | head -20
   ```
   Common patterns: `sk-*` (OpenAI), `ghp_*` (GitHub PAT), `AKIA*` (AWS Access Key), `xox[bpsa]-*` (Slack), `pk_live_*`/`sk_live_*` (Stripe)

2. **Passwords and connection strings**
   ```bash
   grep -rn "password\|passwd\|pwd\|jdbc:\|postgres://\|mysql://\|mongodb://\|redis://" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go" --include="*.json" --include="*.yaml" . 2>/dev/null | grep -v "node_modules" | grep -v "\${.*}\|process\.env\|import.meta.env" | grep -v "\*\*\*" | head -20
   ```

3. **Private keys and certificates**
   ```bash
   grep -rn "BEGIN.*PRIVATE KEY\|BEGIN.*CERTIFICATE" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yaml" --include="*.pem" . 2>/dev/null | grep -v "node_modules" | head -10
   ```

4. **Encryption salts and JWT secrets**
   ```bash
   grep -rn "jwt.*secret\|session.*secret\|encrypt.*key\|salt\|csrf.*secret" --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | grep -v "node_modules" | grep -v "\${.*}\|process\.env" | head -15
   ```

For each match, verify: is the value a hardcoded literal, or is it loaded from environment/config? If hardcoded, flag.

**Severity:** Live API key or database credential = CRITICAL. Test-only key (with warning in comments) = MEDIUM. Sample/placeholder value = LOW.

### 5.2 Hardcoded internal URLs and IPs

Production URLs, internal service endpoints, and IP addresses should be configurable, not baked into code.

```bash
# Internal IPs (10.x, 172.16-31.x, 192.168.x)
grep -rn "\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b\|\b172\.\d{1,3}\.\d{1,3}\.\d{1,3}\b\|\b192\.168\.\d{1,3}\.\d{1,3}\b" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yaml" . 2>/dev/null | grep -v "node_modules" | grep -v "example\|sample\|localhost" | head -15

# Production URLs
grep -rn "https://[a-zA-Z0-9.-]*\.com\|https://[a-zA-Z0-9.-]*\.io\|https://[a-zA-Z0-9.-]*\.app" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yaml" . 2>/dev/null | grep -v "node_modules" | grep -v "example\.com\|localhost\|github\.com\|npmjs\.com" | head -15

# Port literals in connection code
grep -rn ":\d{4,5}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" . 2>/dev/null | grep -v "node_modules" | grep -v "date\|timeout\|timestamp" | head -20
```

Distinguish:
- Port in a constructor that accepts config → flag as config leak
- Port in framework boilerplate (e.g., `vite.config.ts port: 5173`) → skip
- Internal API URL in test fixture → MEDIUM
- Internal API URL in production code → HIGH

**Severity:** Production URL in source code = HIGH. Internal IP = HIGH. Port literal in non-config = MEDIUM.

### 5.3 Environment-specific values

Values that should differ per environment (dev/staging/prod) but are hardcoded.

```bash
# Feature flags locked to true/false
grep -rn "featureFlag\|feature.*flag\|newFeature\|enable.*Feature" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep "= true\|= false" | head -15

# Debug/log level locked
grep -rn "debug: true\|logLevel: 'debug'\|debugMode" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | head -10

# Environment string literals
grep -rn "'production'\"production\"\"'development'\"'staging'" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep -v "process\.env\|import\.meta\.env" | head -15
```

**Severity:** Debug mode hardcoded true in production code = HIGH. Feature flag locked = MEDIUM.

### 5.4 Magic numbers and strings

Literal values in code that should be named constants. The rule: **any literal that appears or could reasonably appear in 2+ locations must be a named constant.**

This includes:
- Business logic thresholds (`0.85`, `100_000`)
- Timeout values (`3000`, `60000`)
- Size/batch limits (`25`, `1000`)
- UI dimensions (`240`, `16`, `8`)
- Repeated string literals that are not natural language

**How to detect:**
```bash
# Find files with repeated numeric literals
for f in $(find . -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*"); do
  repeated=$(grep -on "\b[3-9][0-9]\{1,\}\b" "$f" 2>/dev/null | sort | uniq -c | sort -rn | awk '$1 >= 3' | head -3)
  if [ -n "$repeated" ]; then echo "=== $f ===" && echo "$repeated"; fi
done | head -50

# Global search for widely used literals
grep -rn "\b[3-9][0-9]\{1,\}\b" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "node_modules" | grep -v "import\|export\|date\|version\|port\|console" | cut -d: -f2- | sort | uniq -c | sort -rn | awk '$1 >= 3' | head -20
```

For each: if the same literal value appears in 3+ locations, flag it as a candidate for extraction.

**Severity:** Literal appearing 3+ times across the codebase = MEDIUM. Business threshold in one file without constant = MEDIUM. Single-use timeout = LOW.

### 5.5 TODO / FIXME debt

Stale TODOs are not secrets, but high density correlates with technical debt.

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go" . 2>/dev/null | grep -v "node_modules" | head -30
```

If more than 20, report the count and the most stale ones (sorted by file name), not every match.

**Severity:** FIXME with known bug = MEDIUM. TODO with no ticket = LOW.

---

## Phase 6: Test Audit

### 6.1 Stale tests

Tests that are no longer meaningful but still pass, creating a false sense of security.

**How to detect:**

```bash
# Find test files for deleted source files
for tf in $(find . -name "*.test.ts" -not -path "*/node_modules/*"); do
  source=${tf%.test.ts}.ts
  sourcex=${tf%.test.ts}.tsx
  if [ ! -f "$source" ] && [ ! -f "$sourcex" ]; then
    echo "ORPHAN TEST: $tf"
  fi
done
```

For existing tests, spot-check:
- Tests that only test trivial getters/setters
- Tests that pass with empty implementations
- Snapshot tests that are never reviewed
- Tests importing from paths that no longer resolve to the same code

**Severity:** Test passes with broken source = CRITICAL. Orphan test = HIGH. Trivial test = LOW.

### 6.2 Untested changes

New or modified code without corresponding test coverage for logic paths.

**How to detect:**

Compare recent changes or key files against test coverage:

```bash
# List source files without corresponding test files
for f in $(find packages -name "*.ts" -not -path "*/node_modules/*" -not -name "*.test.ts" -not -name "index.ts"); do
  test_file="${f%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    echo "NO TEST: $f"
  fi
done | head -20
```

Focus on files containing business logic, data transformations, and security-critical code.

### 6.3 Test security violations

Tests that violate security norms, potentially leaking credentials or bypassing important safeguards.

**Checklist (run ALL checks):**

1. **Hardcoded secrets**: Search for API keys, tokens, passwords in test files
   ```bash
   grep -rn "apiKey\|api_key\|secret\|password\|token\|sk-[a-zA-Z0-9]" --include="*.test.ts" --include="*.spec.ts" .
   ```

2. **Disabled security**: Tests that explicitly disable auth, validation, or sanitization without justification
   ```bash
   grep -rn "skipAuth\|disable\|bypass\|noCheck\|allowAll\|insecure" --include="*.test.ts" .
   ```

3. **Insufficient isolation**: Tests that share state, depend on execution order, or modify global state without cleanup
   ```bash
   grep -rn "beforeAll\|afterAll\|global\." --include="*.test.ts" .
   ```

4. **Broad snapshots**: Snapshot tests that capture too much data
   ```bash
   find . -name "__snapshots__" -type d -not -path "*/node_modules/*" | head -5
   ```

5. **Mock insecurity**: Mocks that only return success paths, masking error handling gaps
   Read a sample mock — does it include a failure scenario?

6. **PII in test data**: Test fixtures with real-looking personal data
   ```bash
   grep -rn "@.*\.com\|phone\|ssn\|credit\|address" --include="*.test.ts" --include="*.spec.ts" . | grep -v "expect\|assert\|mock" | head -10
   ```

**Severity:** Hardcoded API key = CRITICAL. Disabled auth without comment = CRITICAL. Shared mutable state = HIGH. Missing error path in mocks = MEDIUM. PII-like test data = MEDIUM.

---

## Phase 7: Report

### Format

```markdown
# Codebase Audit: <project-name>

**Scale:** N source files, N test files, N doc files
**Audited dimensions:** Coupling | Hardcoded | Layering | Docs | Tests
**Overall health:** PASS / WARN / FAIL

---

## Top findings (ranked by severity)

### 🔴 CRITICAL (must fix)
N findings

### 🟠 HIGH (should fix)
N findings

### 🟡 MEDIUM (consider fixing)
N findings

---

## Detailed findings

Each finding must include:
1. **Location**: exact file path(s) and line(s)
2. **Problem**: what is wrong
3. **Evidence**: the specific code, import, or pattern
4. **Impact**: why it matters (what bug it will cause, what change it blocks)
5. **Recommendation**: concrete next step (what to change, what to remove, what to add)

### [CR-1] <title>

- **Location**: `packages/foo/src/bar.ts:42`
- **Problem**: Circular dependency between Foo, Bar, and Baz
- **Evidence**: `bar.ts:42 imports from baz.ts`, `baz.ts:15 imports from foo.ts`, `foo.ts:8 imports from bar.ts`
- **Impact**: Initialization order is non-deterministic; changing any of these modules can cause runtime crashes in unrelated code
- **Recommendation**: Extract the shared types into a new `core-types` module that both can depend on

---

## Summary by dimension

| Dimension | Findings | Health |
|---|---|---|
| Coupling | N | 🟢/🟡/🔴 |
| Hardcoded values | N | 🟢/🟡/🔴 |
| Layering | N | 🟢/🟡/🔴 |
| Documentation | N | 🟢/🟡/🔴 |
| Tests | N | 🟢/🟡/🔴 |

### Ranking rules

- **CRITICAL**: Circular dependency, hardcoded API key, test passes with broken source, disabled security without comment
- **HIGH**: God module, layer violation, orphan test, outdated entire doc file, leaky abstraction, production URL in source code
- **MEDIUM**: Import sprawl (10-20), mixed concerns (2 adjacent), files over 500 lines, missing public API docs, trivial tests, PII-like test data, business logic magic number, literal appearing 3+ times across codebase
- **LOW**: Import sprawl (<10), minor doc version bumps, internal function without docs, TODO without ticket

### Final output

Write the report to `<project-root>/audit-report.md`. If the project already has one, append a section noting what changed since the last audit.

Do NOT flag every finding you can find. Use judgment: if you see 50 files with the same pattern (e.g., "all test files lack error mocks"), report it as ONE aggregated finding with a representative example, not 50 separate entries. The report should be readable in 5 minutes and actionable in an afternoon.
