# Crystal Agents Design System

> Package: `@craft-agent/ui` · Version 0.9.0

---

## Theme

Crystal Agents uses a dual-theme system with light mode (`:root`) as default and dark mode (`.dark` class) as the alternative. All colors are authored in the **OKLCH color space** for perceptual uniformity and smooth cross-mode transitions.

| Token        | Light                                        | Dark                                         |
|-------------|----------------------------------------------|----------------------------------------------|
| background  | `oklch(0.98 0.003 265)` — near-white cool    | `oklch(0.2 0.005 270)` — deep charcoal       |
| foreground  | `oklch(0.185 0.01 270)` — near-black         | `oklch(0.92 0.005 270)` — near-white          |

**Dark mode characteristics:** accent and destructive colors are made brighter to maintain contrast against the dark background. Shadow opacity doubles (border: 0.08→0.15, blur: 0.06→0.12). Dark mode `.shadow-tinted` disables blur glow layers and strengthens the border outline.

A `html[data-font="inter"]` attribute switch allows opting into the Inter typeface with optical sizing.

---

## Tokens — Colors

### 6-Color System

The palette is built on six semantic base colors. Every other token is derived from these.

| Token        | Light OKLCH                | Dark OKLCH                 | Role                                           |
|-------------|----------------------------|----------------------------|------------------------------------------------|
| background  | `0.98 0.003 265`           | `0.2 0.005 270`            | Primary surface                                |
| foreground  | `0.185 0.01 270`           | `0.92 0.005 270`           | Text and icons                                 |
| accent      | `0.58 0.22 293`            | `0.65 0.20 293`            | Brand purple — highlights, Auto mode           |
| info        | `0.75 0.16 70`             | `0.70 0.16 70`             | Amber — warnings, Ask mode                     |
| success     | `0.55 0.17 145`            | `0.60 0.17 145`            | Green — connected, checkmarks                  |
| destructive | `0.58 0.24 28`             | `0.70 0.19 22`             | Red — errors, failed                           |

### Color Variants

Two variant systems coexist:

**Opacity-based (Alpha):** `color-mix(in oklab, <color> <pct>%, <background>)` — used via CSS variables.

**Solid interpolation (Mix):** `color-mix(in oklch, foreground <pct>%, background)` — used for the foreground scale:

```
--foreground-2   —  2% mix toward background (barely visible)
--foreground-3   —  3%
--foreground-5   —  5%
--foreground-10  — 10%
--foreground-20  — 20%
--foreground-30  — 30%
--foreground-40  — 40%
--foreground-50  — 50% (midpoint — muted-foreground)
--foreground-60  — 60%
--foreground-70  — 70%
--foreground-80  — 80%
--foreground-90  — 90%
--foreground-95  — 95%
```

### Text Variants

Semantic colors mixed 50% toward foreground for readable text on any background:

```
--success-text      = color-mix(success 50%, foreground)
--destructive-text  = color-mix(destructive 50%, foreground)
--info-text         = color-mix(info 50%, foreground)
```

### RGB Variants

Stored as plain RGB tuples for use in `rgba()` shadow layers and tinted shadows:

| Token            | Light RGB        | Dark RGB         |
|-----------------|------------------|------------------|
| foreground-rgb  | 38, 36, 42       | 227, 226, 229    |
| accent-rgb      | 104, 78, 133     | 118, 92, 147     |
| destructive-rgb | 180, 60, 50      | 200, 80, 70      |
| info-rgb        | 180, 120, 40     | 200, 140, 60     |
| success-rgb     | 34, 120, 60      | 50, 140, 80      |

### shadcn Compatibility Layer

Derived from the 6 base colors for drop-in shadcn/ui compatibility:

```
--secondary          = foreground at 5% opacity
--secondary-foreground = foreground
--muted              = foreground at 5% opacity
--muted-foreground   = foreground-50
--card               = background
--card-foreground    = foreground
--popover            = background
--popover-foreground = foreground
--border             = foreground at 5% opacity
--input              = foreground at 10% opacity
--ring               = foreground at 25% opacity
--ring-width         = 1px
--ring-offset        = 0px
```

### Component Tokens

```
--user-message-bubble = foreground at 5% opacity
--md-bullets         = foreground-50
--md-counters        = foreground-50
```

---

## Tokens — Typography

### Font Stack

| Role  | Stack                                                        |
|-------|--------------------------------------------------------------|
| Sans  | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Mono  | `"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` |
| Serif | Same as mono (reserved)                                      |
| Default | `var(--font-sans)`                                        |

When `html[data-font="inter"]` is set, the sans stack becomes `"Inter", system-ui, ...` with `font-optical-sizing: auto` and OpenType features `"cv01", "cv02", "cv03", "cv04", "case"`.

### Font Sizes

| Context                 | Size  | Notes                       |
|------------------------|-------|-----------------------------|
| Base (html root)       | 15px  | `--font-size-base`          |
| TurnCard body          | 13px  | `text-[13px]` via SIZE_CONFIG |
| Markdown body (p)      | inherit from base           |
| Markdown H1/H2         | 16px  | H1 bold, H2 semibold        |
| Markdown H3            | 15px  | semibold                    |
| Inline code            | 13px  | `font-mono text-[13px]`     |
| Code block body        | 14px  | `text-sm` (Tailwind)        |
| Spinner (TurnCard)     | 10px  | `text-[10px]`               |
| Badges (diff stats)    | 10–11px | `text-[10px]` / `text-[11px]` |

### Line Height

- Body paragraphs: `leading-relaxed` (1.625)
- List items: standard (normal)

### Font Features

- System font anti-aliasing: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`
- Tabular nums used for duration/token displays in ActivityGroupRow

---

## Tokens — Spacing & Shapes

### Spacing Scale

The base unit is `--spacing: 0.25rem` (4px). Layout uses Tailwind's standard spacing scale throughout.

### Border Radius

| Token               | Value    | Usage                               |
|---------------------|----------|-------------------------------------|
| `--radius`          | 0rem     | Global default radius (sharp)       |
| `rounded-[8px]`     | 8px      | Code blocks, modals, popover-styled |
| `rounded-[4px]`     | 4px      | Badges, diff stats, tool icons      |
| `rounded-[3px]`     | 3px      | Detail buttons, small interactive   |
| `rounded-md`        | ~6px     | Input, dropdown trigger             |
| `rounded-[6px]`     | 6px      | Annotation highlight corners        |
| `rounded-full` / `rounded-[9999px]` | 9999px | Annotation index badges (pill) |

### Smooth Corners

Utility class `.smooth-corners` provides iOS-style superellipse rounding using the emerging `corner-shape: superellipse` CSS standard with WebKit prefix fallback. Expects a `border-radius` on the element.

### Animations

- **Spinner:** Grid-based 9-cube animation (SpinKit Grid), inherits from `currentColor` and `font-size`.
- **Shimmer:** Linear gradient sweep for optimistic UI states, 1.5s ease-in-out infinite.
- **TurnCard transitions:** Motion (framer-motion) staggered animations with 0.03s per-row delay (up to 10 items).
- **ActivityGroup expand/collapse:** Height transition 0.2s with custom cubic-bezier `[0.4, 0, 0.2, 1]`, opacity 0.15s.
- **Chevron rotation:** 0.15s easeOut.

### Shadows

| Utility Class       | Structure                          | Usage                                  |
|--------------------|------------------------------------|----------------------------------------|
| `shadow-minimal`   | 1px border ring + 2 blur layers    | Default card state, file badges        |
| `shadow-minimal-flat` | Border ring only                | Flat surfaces                          |
| `shadow-middle`    | 1px ring + 3 blur layers           | Elevated cards                         |
| `shadow-medium`    | 1px ring + 4 blur layers           | Medium elevation                       |
| `shadow-hero`      | 1px ring + 6 blur layers (up to 64px) | Floating UI islands, hero sections |
| `shadow-strong`    | 1px ring + 5 blur layers           | Strong emphasis                        |
| `shadow-modal-small` | 1px ring + 5 blur layers         | Modal dialogs                          |
| `shadow-tinted`    | Uses `--shadow-color` custom var   | Colorful shadows (diff badges, errors) |
| `popover-styled`   | 1px ring + 5 blur layers + 8px rad | Dropdowns, popovers                    |

**Dark mode:** `shadow-blur-opacity` doubles (0.06→0.12). `shadow-tinted` removes blur and thickens border outline.

### Z-Index Scale

```
z-base:               0
z-local:             10
z-sticky:            20
z-titlebar:          40
z-panel:             50
z-dropdown:         100
z-tooltip:          150
z-modal:            200
z-overlay:          300
z-fullscreen:       350
z-floating-backdrop: 390
z-floating-menu:    400
z-island-overlay:   390
z-island:           400
z-island-popover:   410
z-splash:           600
```

---

## Components

### TurnCard — Chat Turn Display

The core chat unit representing one assistant turn (tools + response).

**Variants:** Expanded / Collapsed (email-like threading). Collapsed shows `intent` preview.

**Structure:**
- **Header:** Intent summary, expand toggle, status dot, actions menu
- **Activity list:** Chronological tool/thinking/status activities
- **Response card:** Final AI response text (markdown), may be streaming
- **Accept Plan button:** For plan variant responses

**Size configuration (`--SIZE_CONFIG`):**
```
fontSize:          text-[13px]
iconSize:          w-3 h-3 (12px)
spinnerSize:       text-[10px]
spinnerSizeSmall:  text-[8px]
activityRowHeight: 24px
maxVisibleActivities: 15
```

**Color badges within activities:**
- Diff additions → `success` bg at 5% mix, `success` text, tinted shadow
- Diff deletions → `destructive` bg at 5% mix, `destructive` text, tinted shadow
- Error → `destructive` bg at 4% mix, tinted shadow
- Filename → `background`, `shadow-minimal`

### CodeBlock — Syntax Highlighted Code

**Modes:**
| Mode      | Chrome         | When                                 |
|-----------|----------------|--------------------------------------|
| terminal  | None           | Debug output, raw logs               |
| minimal   | Highlighting   | Chat inline, readability without chrome |
| full      | Header + copy  | Documentation, long-form             |

**Features:**
- Shiki syntax highlighting with LRU cache (200 entries max)
- GitHub light/dark theme (auto-detected from DOM or forced via prop)
- Language aliases (js→javascript, py→python, sh→bash, etc.)
- Copy button with checkmark feedback (2s timeout)
- Rounded 8px container with border and `bg-muted/30`

**In prop styles:**
- Header: `bg-muted/50`, uppercase tracking-wide language label, opacity-0→100 on hover for copy button
- InlineCode: `bg-foreground/[0.04]`, 13px, font-mono, no border

### Markdown Renderer

**Three render modes:** terminal/minimal/full with progressive richness.

**Renderer stack:**
- `react-markdown` — AST-based markdown parsing
- `remark-gfm` — GitHub Flavored Markdown (tables, task lists, strikethrough)
- `remark-math` + `rehype-katex` — Math rendering (`$$` only, single `$` disabled)
- `rehype-raw` — Raw HTML passthrough

**Special fenced code blocks:**
| Language       | Component             | Behavior                           |
|----------------|-----------------------|-------------------------------------|
| `diff`         | MarkdownDiffBlock     | Per-line diff viewer                |
| `json`         | MarkdownJsonBlock     | Interactive tree viewer             |
| `datatable`    | MarkdownDatatableBlock| Sortable/filterable data table      |
| `spreadsheet`  | MarkdownSpreadsheetBlock | Excel-style grid                  |
| `html-preview` | MarkdownHtmlBlock     | Sandboxed iframe                    |
| `pdf-preview`  | MarkdownPdfBlock      | Inline first page + expand          |
| `image-preview`| MarkdownImageBlock    | Inline image + expand               |
| `latex` / `math`| MarkdownLatexBlock   | KaTeX rendered display math         |
| `mermaid`      | MarkdownMermaidBlock  | Zinc-styled SVG diagram             |

**Heading hierarchy:**
```
h1: 16px bold    (mt-7 mb-4 full / mt-5 mb-3 minimal)
h2: 16px semibold (mt-6 mb-3 full / mt-4 mb-3 minimal)
h3: 15px semibold (mt-5 mb-3 full / mt-4 mb-2 minimal)
h4: 14px semibold (full only)
```

**Blockquote (full mode):**
- 4px left border (`border-foreground/30`)
- `bg-muted/30` background
- `rounded-r-md` right corners

**Table (full mode):**
- Wrapper: `rounded-md border`, scrollable on overflow
- Header: `bg-muted/50`
- Rows: `divide-y divide-border` with `hover:bg-muted/30` transition
- Cells: 12px vertical padding, 16px horizontal

**Collapsible sections:** Optional H2/H3 collapsible via `remarkCollapsibleSections` plugin.

**Streaming:** `MemoizedMarkdown` splits content into blocks and memoizes per-block to avoid re-rendering already-streamed content.

### Input — Text Input

```
height:          h-9 (36px)
border:          rounded-md, border opacity 15%
bg:              transparent
focus ring:      1px, foreground/30
placeholder:     muted-foreground
disabled:        opacity-50, cursor-not-allowed
padding:         px-3 py-1
transition:      colors
```

File input support built in: `file:border-0 file:bg-transparent file:text-sm file:font-medium`.

### ActivityRow — Tool Call Row

**Status indicators:**
| Status        | Icon                | Notes                    |
|---------------|---------------------|--------------------------|
| pending       | Circle              | Gray outline             |
| running       | Spinner (3×3 grid)  | Inherits currentColor    |
| completed     | CheckCircle2        | `text-success`           |
| error         | XCircle             | `text-destructive`       |
| backgrounded  | ActivityStatusIcon  | Task/shell ID displayed  |

**Tree connector:** `TreeViewConnector` renders vertical tree lines for parent-child nesting. Depth calculated incrementally during streaming.

### ResponseCard

**Variants:**
| Variant  | Purpose                    | Features                         |
|----------|----------------------------|----------------------------------|
| response | AI message                 | Smart buffering, Thinking indicator |
| plan     | Plan/approval message      | Header, Accept Plan button       |
| summary  | Transferred context        | Compact metadata display         |

**Annotation system:** Full text selection → highlight overlay pipeline:
- `AnnotationOverlayLayer` renders floating overlay chips
- `AnnotationIslandMenu` for editing/managing annotations
- Color-tinted backgrounds via `annotationColorToCss()`
- Index badges (pill shape, info background, tinted shadow)

**Branching:** `BranchDropdown` with GitBranch icon, opens new panel via callback.

---

## Surfaces

### Surface Hierarchy

| Surface   | CSS Token          | Visual                     | Opacity/Mix              |
|-----------|--------------------|----------------------------|--------------------------|
| Base      | `--background`     | Solid surface color        | 100%                     |
| Card      | `--card`           | = background               | 100%                     |
| Popover   | `--popover`        | = background               | 100% (elevated via shadow) |
| Muted     | `--muted`          | foreground at 5% opacity   | Very subtle              |
| Secondary | `--secondary`      | foreground at 5% opacity   | Very subtle              |
| Input     | `--input`          | foreground at 10% opacity  | Slightly stronger        |
| User bubble | `--user-message-bubble` | foreground at 5%    | Very subtle              |

### Elevation

Surfaces are stacked via shadow, not background color. All elevated surfaces (popovers, modals, dropdowns, islands) use `background` as their base color and achieve depth through multi-layer box-shadows.

**Island UI (annotation islands):**
- `--z-island`: 400 (floating above everything except splash)
- `--z-island-popover`: 410 (popovers originating from islands)
- `--z-island-overlay`: 390 (backdrop for island context)

### Scrollbar Styling

```
::-webkit-scrollbar:   8px width
::-webkit-scrollbar-track: transparent
::-webkit-scrollbar-thumb: border color, 4px radius
::-webkit-scrollbar-thumb:hover: muted-foreground
```

Utility: `.scrollbar-hide` (hide completely) / `.scrollbar-hover` (show on `.group:hover`).

---

## Do's and Don'ts

### Colors

| Do ✅ | Don't ❌ |
|---|---|
| Use the 6 base colors exclusively for all UI color decisions | Invent new color tokens outside the system |
| Use `foreground-50` for muted/secondary text | Hardcode gray values |
| Use `color-mix(in oklch, ...)` for solid background variants | Use opacity to create surface variants (use mix foreground→background instead) |
| Use `color-mix(in oklab, ...)` for text-on-color variants | Use opaque white/black overlays |
| Use `--shadow-tinted` with `--shadow-color` for colorful shadows | Rely on hardcoded rgba shadows |
| Prefer OKLCH for all new color values | Use hex or HSL for new tokens |
| Use `/50`-style alpha for borders and overlays | Use `-50` solid mix where transparency is semantically correct |

### Typography

| Do ✅ | Don't ❌ |
|---|---|
| Respect the `--font-size-base: 15px` root | Override the root font-size in app code |
| Use Tailwind `text-sm` or `text-[13px]` for chat UI | Use arbitrary px values outside the system |
| Load Inter via `data-font="inter"` attribute | Bundle a font without supporting the system attribute |
| Use `tabular-nums` for statistics and metrics | Use proportional figures for numeric displays |
| Use `font-semibold` (600) for H2, `font-bold` (700) for H1 | Use `font-bold` for body text |

### Markdown

| Do ✅ | Don't ❌ |
|---|---|
| Use `$$` delimiters for math (KaTeX) | Use single `$` for inline math (conflicts with currency) |
| Use `datatable`, `spreadsheet`, `mermaid`, etc. fenced blocks for rich rendering | Override standard code block rendering for special needs |
| Use `diff` fenced blocks for code diffs | Write raw unified diff in regular markdown |
| Use `collapsible` prop for long documents | Build custom collapse mechanisms outside the system |
| Use `MemoizedMarkdown` for streaming content | Re-render entire markdown tree on every streaming tick |
| Use the three-tier render mode (terminal/minimal/full) consistently | Mix rendering modes within a single content view |

### Components

| Do ✅ | Don't ❌ |
|---|---|
| Use `SIZE_CONFIG` values for TurnCard sizing | Hardcode icon/text sizes in TurnCard children |
| Use `SIZE_CONFIG.fontSize` + `cn()` for activity text | Use arbitrary text size classes in activity rows |
| Use `cn()` utility for Tailwind class merging | Rely on plain template literals for class composition |
| Use `CodeBlock` with `mode="minimal"` for chat, `mode="full"` for docs | Always use `mode="full"` regardless of context |
| Use `ResponseCard variant="plan"` for approval UI | Build a separate plan component outside the system |
| Use `TurnPhase` state machine to derive card state | Track phase as independent state |
| Use `motion` (framer-motion) for enter/exit transitions | Use CSS animation for component mount/unmount |
| Prefer staggered animation for lists of up to 10 items | Animate large lists (use `staggeredAnimationLimit: 10`) |

### Shadows & Elevation

| Do ✅ | Don't ❌ |
|---|---|
| Use `shadow-minimal` for default card state | Elevate content without semantic purpose |
| Use `shadow-hero` for floating islands | Use `shadow-hero` for modals (use `shadow-modal-small`) |
| Use `popover-styled` for all dropdowns and popovers | Custom-implement popover shadows |
| Let dark mode automatically strengthen shadows | Apply separate shadow values per theme |
| Use `smooth-corners` for iOS-style rounding | Apply large `border-radius` with no fallback |

### Surfaces

| Do ✅ | Don't ❌ |
|---|---|
| Use `--muted` for subtle backgrounds (hover, section headers) | Use `--foreground-10` directly as a background |
| Use `--card` / `--popover` only for their respective semantic roles | Overload `--card` as a general container color |
| Use elevated surfaces (popover, modal, island) through z-index scale values | Assign arbitrary z-index values |
