# OpenHanako Design System

> A structured design language built on paper-and-ink metaphors, with accent-driven personality and unified motion principles.

---

## Table of Contents

1. [Theme System](#theme-system)
2. [Tokens — Colors](#tokens--colors)
3. [Tokens — Typography](#tokens--typography)
4. [Tokens — Spacing & Shapes](#tokens--spacing--shapes)
5. [Tokens — Motion](#tokens--motion)
6. [Tokens — Shadows & Elevation](#tokens--shadows--elevation)
7. [Components](#components)
8. [Surfaces](#surfaces)
9. [Do's and Don'ts](#dos-and-donts)

---

## Theme System

Themes are applied via a `data-theme` attribute on `<html>`. Each theme defines a complete set of CSS custom properties covering backgrounds, text colors, accent, border, shadow, and overlay layers. There is no `prefers-color-scheme` auto-switch — the user explicitly chooses a theme.

### Available Themes

| Theme ID | Name | Type | Description |
|---|---|---|---|
| `new-warm-paper` | 新暖纸 | Light | Default. Paper-like warm beige with seal blue accent |
| `warm-paper` | 暖纸 | Light | Legacy warm paper variant |
| `grassy-aroma` / `grass-aroma` | 草香 | Light | Green-tinted morning dew palette |
| `deep-think` | 深思 | Light | Clean white + DeepSeek-inspired blue-violet accent |
| `absolutely` | Absolutely | Light | Bright and minimal |
| `contemplation` | 静思 | Light | Low-contrast meditative palette |
| `delve` | 深潜 | Light | Focused deep reading light theme |
| `midnight` | 青夜 | Dark | Deep blue-green base with warm rose accent |
| `midnight-contrast` | 青夜·高对比 | Dark | Enhanced contrast dark variant |
| `high-contrast` | 高对比 | High-contrast | Accessibility-optimized |

### Theme Definition Pattern

Each theme file is a `[data-theme="..."]` selector block overriding the same set of `--*` custom properties. The default (preferred) theme is `new-warm-paper`; it represents the canonical design direction.

---

## Tokens — Colors

### Structural Token Layer (theme-independent)

Defined in `:root` within `styles.css`. Themes override these via `[data-theme]`:

```css
--link:           var(--accent, #537D96);
--link-hover:     var(--accent-hover, var(--link));
--link-rgb:       var(--accent-rgb, 83, 125, 150);
```

### Default Theme: `new-warm-paper` (Canonical Light)

The system is conceived as a "paper world" with 5-tier ink levels and a single seal-blue accent.

#### Backgrounds

| Token | Value | Description |
|---|---|---|
| `--bg` | `#F5EFE4` | Main surface (宣纸主面) |
| `--bg-card` | `#FBF7EE` | Elevated card surface (浮起的卡) |
| `--bg-glass` | `rgba(251, 247, 238, 0.92)` | Glassmorphism surface |
| `--sidebar-bg` | `#EFE8DB` | Sidebar, one level deeper |

#### Text (墨 — 5-tone Ink Scale)

| Token | Value | Name |
|---|---|---|
| `--text` | `#2A2622` | 浓墨 (full ink) |
| `--text-light` | `#4A433C` | Secondary |
| `--text-muted` | `#6B6158` | Tertiary / captions |
| *(unmapped)* | `#8F867B` | Ink-4 |
| *(unmapped)* | `#B8B0A3` | Ink-5 |

#### Accent (印章青蓝 — Seal Blue)

| Token | Value | Description |
|---|---|---|
| `--accent` | `#537D96` | Primary interactive color |
| `--accent-hover` | `#3F6179` | Pressed state |
| `--accent-light` | `rgba(83, 125, 150, 0.08)` | Active/hover surface tint |
| `--accent-rgb` | `83, 125, 150` | RGB components for rgba() usage |

#### Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `--green` | `#4A6B4A` | Success states (墨绿) |
| `--coral` | `#8B2C1F` | Danger text (深朱) |
| `--danger` | `#8B2C1F` | Danger (same as coral) |
| `--mood-text` | `#3F6179` | Plan-mode / assistant mood text |
| `--mood-bg` | `rgba(83, 125, 150, 0.05)` | Mood area background |
| `--mood-border` | `rgba(83, 125, 150, 0.18)` | Mood area border |

#### Overlay Layers (on ink basis)

| Token | Value | Usage |
|---|---|---|
| `--overlay-subtle` | `rgba(42, 38, 34, 0.03)` | Hover on cards |
| `--overlay-light` | `rgba(42, 38, 34, 0.04)` | Borders, dividers |
| `--overlay-medium` | `rgba(42, 38, 34, 0.08)` | Secondary borders |
| `--overlay-strong` | `rgba(42, 38, 34, 0.15)` | Focus rings, emphasis |

#### Borders & Shadows

| Token | Value |
|---|---|
| `--border` | `#D8CFBE` |
| `--shadow` | `rgba(42, 38, 34, 0.04)` |

#### Chat-specific Colors

| Token | Value | Description |
|---|---|---|
| `--hana-text` | `#2A2622` | Assistant message text |
| `--tool-bg` | `rgba(83, 125, 150, 0.06)` | Tool call card background |
| `--tool-text` | `#6B6158` | Tool call text |
| `--user-bg` | `rgba(83, 125, 150, 0.08)` | User message background |
| `--drop-overlay-bg` | `rgba(245, 239, 228, 0.85)` | Drag-drop overlay |
| `--attach-bg` | `rgba(42, 38, 34, 0.04)` | Attachment area |
| `--jian-note-bg` | `#FBF7EE` | Side-note card |
| `--jian-note-border` | `rgba(216, 207, 190, 0.4)` | Side-note border |

### Dark Theme: `midnight` (Deep Blue-green + Warm Rose)

| Token | Light Value | Dark Value |
|---|---|---|
| `--bg` | `#F5EFE4` | `#3B4A54` |
| `--bg-card` | `#FBF7EE` | `#445560` |
| `--text` | `#2A2622` | `#E1EAF0` |
| `--text-light` | `#4A433C` | `#B7C5CE` |
| `--text-muted` | `#6B6158` | `#A3B5C0` |
| `--accent` | `#537D96` | `#C99AAF` (warm rose) |
| `--accent-hover` | `#3F6179` | `#D8AFC0` |
| `--border` | `#D8CFBE` | `rgba(170, 121, 141, 0.16)` |
| `--green` | `#4A6B4A` | `#8CC790` |
| `--coral` | `#8B2C1F` | `#EAB2A0` |

### Color Usage Rules

- **Accent is singular.** Only one accent color per theme. No secondary accent. No tertiary accent. The accent is the seal stamp on a page.
- **Semantic colors are muted.** No bright reds or greens; they remain within the ink palette.
- **Overlay layers** build on the text color's rgba, not black/white, for natural blending.
- **Links** can be independent from accent in dark themes (e.g., blue link + rose accent in midnight).

---

## Tokens — Typography

### Font Families

| Token | Value | Usage |
|---|---|---|
| `--font-ui` | `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif` | All UI elements |
| `--font-serif` | `'EB Garamond', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', serif` | Markdown content, assistant messages |
| `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` | Code blocks, logs |

All three fonts are bundled as self-hosted woff2 files in `themes/fonts/`.

#### Font Weights Available

| Font | Weights |
|---|---|
| Inter | 300, 400, 450, 500, 600 |
| EB Garamond | 400 (italic), 400, 500, 600 |
| JetBrains Mono | 400, 500 |
| Noto Serif SC | 300 |

### Font Size Scale

| Token | Value | Scope |
|---|---|---|
| `--editor-markdown-font-size` | `16px` | Editor body text |
| `--editor-markdown-h1-font-size` | `24px` | Markdown h1 |
| `--editor-markdown-h2-font-size` | `20px` | Markdown h2 |
| `--editor-markdown-h3-font-size` | `18px` | Markdown h3 |
| `--editor-markdown-h4-font-size` | `16px` | Markdown h4 |
| `--editor-markdown-h5-font-size` | `15px` | Markdown h5 |
| `--editor-markdown-h6-font-size` | `14px` | Markdown h6 |
| `--editor-markdown-line-height` | `1.72` | Markdown line height |

### Body Defaults

```css
body {
    font-family: var(--font-ui);
    font-size: 15px;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
}
```

### Typography Rules

- **UI text defaults to non-selectable** (`user-select: none`); only actual content (inputs, editor, markdown, code) is selectable.
- **Assistant messages use serif** (`var(--font-serif)`) for the `md-content`, reinforcing the paper/reading metaphor.
- **User messages use UI font** (sans-serif).
- **Code blocks and logs use monospace** (`var(--font-mono)`).
- **Sans-serif mode** (`body.font-sans`) overrides `--font-serif` to `--font-ui`.

---

## Tokens — Spacing & Shapes

### Spacing Scale

| Token | Value |
|---|---|
| `--space-xs` | `0.25rem` (4px) |
| `--space-sm` | `0.5rem` (8px) |
| `--space-md` | `1rem` (16px) |
| `--space-lg` | `1.5rem` (24px) |
| `--space-xl` | `2.5rem` (40px) |

### Border Radius

#### Default (non-themed)

| Token | Value |
|---|---|
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `16px` |

#### Themed override (new-warm-paper — square, hairline)

| Token | Value | Scope |
|---|---|---|
| `--radius-sm` | `2px` | Inputs, buttons, chips |
| `--radius-md` | `3px` | Cards, list blocks, drop zones |
| `--radius-lg` | `4px` | Modals |
| `--radius-input` | `2px` | Form controls |
| `--radius-card` | `3px` | Setting sections, skill list items |
| `--radius-chat-card` | `4px` | In-message chat cards |
| `--radius-chat-card-inner` | `max(2px, calc(var(--radius-chat-card) - 2px))` | Nested card corners |

The new-warm-paper theme enforces deliberately squared corners (2px/3px/4px), aligning with the "seal stamp" metaphor — controls are seals, seals are square.

### Border Width

| Token | Default | new-warm-paper |
|---|---|---|
| `--border-width` | `1px` | `0.5px` (hairline) |

### Layout Dimensions

| Token | Value | Component |
|---|---|---|
| `--chat-column-width` | `45rem` | Message column max-width |
| `--chat-input-column-extra` | `1.25rem` | Input column extra width |
| `--chat-input-column-width` | `calc(45rem + 1.25rem)` | Input area width |
| `--sidebar-width` | `240px` | Main sidebar |
| `--jian-sidebar-width` | `260px` | Side note panel |
| `--channel-inspector-width` | `280px` | Channel inspector |
| `--preview-panel-width` | `580px` | Preview panel |
| `--titlebar-h` | `44px` | Titlebar height |
| `CHAT_MIN_WIDTH` | `400px` | Constant: chat minimum |

### Scrollbar

```css
scrollbar-width: thin;
scrollbar-color: rgba(128, 128, 128, 0.2) transparent;
/* width: 4px, thumb: 2px border-radius */
```

Chat panels use "silent scrollbar" — thumb is transparent until hover or scrolling.

---

## Tokens — Motion

### Duration Triad

| Token | Value | Semantics |
|---|---|---|
| `--duration-instant` | `0.1s` | Transient: hover, close, exit, cancel |
| `--duration-fast` | `0.15s` | Default: buttons, panels, focus, state toggle |
| `--duration-slow` | `0.25s` | Slow: modals, entrance, emphasis |

### Easing Curves

| Token | Curve | Usage |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default exit, hover |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Enter (subtle deceleration) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Primary transitions |

### Animation Keyframes (Unified Namespace)

All keyframes use the `hana-` prefix and are defined in `animations.css` as the single source of truth.

| Name | Type | Usage |
|---|---|---|
| `hana-spin` | Rotate 360° | Loading spinners |
| `hana-globe-spin` | Y-axis rotation | Globe loading |
| `hana-fade-in` / `hana-fade-out` | Opacity | Overlays, backdrops |
| `hana-fade-up` / `hana-fade-down` | Opacity + translateY(~slide-y) | Dropdowns, tooltips, messages |
| `hana-scale-in` | Opacity + scale(0.96) + translateY(8px) | Modals, overlay containers |
| `hana-popout` | Opacity + scale(0.92) | Menus expanding from trigger |
| `hana-slide-in-left` / `hana-slide-out-left` | TranslateX + scale | Float panels, side panels |
| `hana-slide-in-top` / `hana-slide-out-top` | TranslateY(-6px) | Top panels (CWD, bars) |
| `hana-card-slide-down` | TranslateY(-110%) | Browser cards |
| `hana-pulse` | Opacity oscillation (`--pulse-lo` / `--pulse-hi`) | Breathing indicators, loading |
| `hana-expand` | Max-height + opacity | Accordion, expandable sections |
| `hana-rise` / `hana-retract` | TranslateY + clip-path | Confirmation cards |
| `hana-typewriter-dots` | Content cycling | Typing indicator |
| `hana-cycling-dots` | Content cycling | Short dots cycle |
| `hana-hint-fade` | Opacity, delayed auto-fade | Hints |
| `hana-folder-history-in` | TranslateX(-50%) + translateY(4px) | Folder history dropdown |

### Motion Rules

- Every interactive element uses at least a `background` or `opacity` transition with `--duration-instant`.
- Hover states use `var(--duration-fast)` with `var(--ease-out)`.
- Modal enters use `var(--duration-slow)` with `var(--ease-out)`; exits use `var(--duration-instant)` with `var(--ease-in)`.
- `prefers-reduced-motion` is respected (transitions set to `none`).

---

## Tokens — Shadows & Elevation

Shadow values are theme-dependent. The system uses layered shadows (2-tier or 3-tier) for depth.

| Elevation | Example Usage | Shadow Value (light) |
|---|---|---|
| Level 0 | Cards on surface | `0 1px 3px rgba(0,0,0,0.04)` |
| Level 1 | Dropdowns, popovers | `0 4px 16px var(--shadow)` |
| Level 2 | Modals, floating panels | `0 8px 32px rgba(0,0,0,0.18)` |
| Level 3 | Media viewer | `0 16px 48px rgba(0,0,0,0.18)` |
| Level 4 | Settings modal | `0 26px 70px rgba(20,18,14,0.18), 0 8px 24px rgba(20,18,14,0.12)` |

Floating panels (cards, menus) often compound a small proximity shadow + a large ambient shadow:

```css
box-shadow: 0 6px 28px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.08);
```

---

## Components

### Button

Defined in `Button.module.css`. Three sizes, four variants, loading spinner.

| Property | Options |
|---|---|
| Sizes | `size-sm` / `size-md` / `size-lg` |
| Variants | `variant-primary` (accent fill), `variant-secondary` (subtle bg), `variant-ghost` (transparent), `variant-danger` (red fill) |
| States | `:hover`, `:disabled` (opacity 0.5), `:focus-visible` (accent outline) |
| Loading | Inline spinner using `hana-spin` |
| Transition | background, color, border-color with `--duration-fast` / `--ease-out` |

```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    border: 1px solid transparent;
    border-radius: var(--radius-card);
    cursor: default;
    transition: background var(--duration-fast) var(--ease-out),
                color var(--duration-fast) var(--ease-out),
                border-color var(--duration-fast) var(--ease-out),
                opacity var(--duration-fast) var(--ease-out);
}
```

### Overlay

Defined in `Overlay.module.css`. Three-tier overlay system:

| Layer | Class | Visual |
|---|---|---|
| Backdrop | `.backdrop-dim` | `rgba(0,0,0,0.35)` |
| Backdrop + blur | `.backdrop-blur` | `rgba(0,0,0,0.3)` + `blur(4px)` |
| Content container | `.container` | Centered, max-90vw, enters with `hana-scale-in` |
| Card | `.card` | `var(--bg-card)`, `var(--radius-lg)`, `0 8px 32px shadow` |

### Select Widget

Defined in `SelectWidget.module.css`. Custom dropdown with popup positioning.

- Trigger: border with `var(--border)`, hover/active focus on `var(--accent)`
- Arrow rotates 180° when open
- Popup: `hana-fade-up` animation, `var(--bg-card)` background
- Option hover: `color-mix(in srgb, var(--accent) 8%, transparent)`
- Selected option: accent color, font-weight 600

### Input Area

Defined in `InputArea.module.css`. Complex multi-zone input surface.

| Zone | Description |
|---|---|
| `.input-wrapper` | Card-like container: `var(--bg-card)`, `var(--radius-lg)`, border `var(--overlay-light)`, hover border darkens |
| `.input-box` | `<textarea>`: font-size 0.95rem, line-height 1.6, max-height 120px, no scrollbar |
| `.send-btn` | Accent-filled button, streaming state switches to coral outline |
| `.plan-mode-btn` | Toggle pill: subtle accent border, active state uses mood colors |
| `.thinking-pill` | Thinking intensity selector pill |
| `.model-pill` | Model selector with dropdown, `hana-popout` animation |
| `.todo-bar` | Accent-colored todo badge with bottom-up popover |
| `.slash-menu` | Slash-command dropdown: `var(--bg-card)` + border, items highlight with accent-light |
| `.session-confirmation-prompt` | Rising confirmation card with `hana-rise` animation |

### Chat

Defined in `Chat.module.css`. Two message group types:

| Element | User | Assistant |
|---|---|---|
| Alignment | Right (`align-items: flex-end`) | Left (`align-items: flex-start`) |
| Message card | `rgba(0,0,0,0.045)` bg, `var(--radius-chat-card)` | No card — serif text only |
| Avatar | 32px, accent-light bg, monogram | 32px, image avatar |
| Footer actions | Hidden until hover, opacity 0.72 | Same |

Chat also includes:
- **Mood details**: Collapsible `<details>` with accent-colored left border
- **Cron confirmation cards**: Card with shadow, approve/reject buttons
- **Subagent cards**: Expandable, running pulse animation on avatar
- **Timeline navigation**: Right-side markers with hover-expand cards
- **Scroll-to-bottom FAB**: 36px circle, centered at bottom
- **Typing indicator**: Serif font, large, pulsing with `hana-typewriter-dots`

### Settings Modal

Defined in `SettingsModalShell.module.css` and `Settings.module.css`.

- Backdrop: `radial-gradient` + `backdrop-filter: blur(8px)`
- Card: `min(720px, calc(100vw - 2rem))` wide, `min(700px, calc(100vh - 2rem))` tall
- Scale entrance: `scale(0.96) → scale(1)` with `--ease-out`
- Left nav: 160px wide, items highlight with `accent-light`
- Main content: max-width 640px (960px wide mode)

### Floating Panel

Used for Activity, Automation, Bridge panels. Fixed positioning, slide-in from left:

```css
.floatingPanelInner {
    width: 66%;
    height: 80%;
    max-width: 560px;
    min-width: 320px;
    background: var(--bg-card);
    border: 1px solid var(--overlay-light);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px var(--shadow), 0 2px 8px rgba(0,0,0,0.04);
    animation: hana-slide-in-left var(--duration-slow) var(--ease-out) both;
}
```

### Preview Panel

Fixed-width right panel, 580px, collapsible to 0. Content area has card-like container with `--radius-lg` rounded corners.

### Media Viewer

Full-screen overlay with `rgba(14,16,20,0.64)` backdrop + `blur(5px)`. Top bar with semi-transparent gradient, caption bar with `blur(10px)`.

### Toast

Uses `hana-fade-in` for appearance.

### Status Bar

Bottom bar, 12px font, `var(--text-tertiary)` color.

---

## Surfaces

### Surface Hierarchy (top to bottom in z-index)

| Layer | z-index | Examples |
|---|---|---|
| Media viewer | 10000 | Image/video fullscreen |
| Tooltips | 10001 | Confirmation tooltips |
| Skill viewer | 2000 | Skill documentation overlay |
| Settings modal | 1800 | Full-window settings |
| Floating panels | 1000 | Activity, Bridge, Automation |
| Dropdown menus | 50-100 | Model selector, thinking, slash-menu |
| Float preview card | 300 | Titlebar hover card |
| Titlebar | 100 | Window chrome |
| Chat panels | 10 | Main chat, timeline |
| Surface layer | 1 | App body, sidebar |
| Backdrop | 0 | Background |

### Paper Texture System

A distinctive feature: the entire UI can be layered with a rice-paper texture (`assets/textures/rice-paper.png`).

- **Toggle**: `body.paper-texture` class
- **Two layers**: Surface layer (`body`, `.titlebar`, `.sidebar`) + Card layer (`.msg-card`, `.input-wrapper`, `.hana-toast`, etc.)
- **Blend mode**: Cards use `background-blend-mode: lighten` (warm themes) or `normal` (dark themes)
- **Brightness compensation**: Warm themes overlay a `rgba(255, 253, 247, 0.35)` screen on `::before`

### Glass Surface

| Token | Usage |
|---|---|
| `--bg-glass` | Titlebar, floating surfaces with slight transparency |

---

## Do's and Don'ts

### Do

- **Use the accent sparingly** — one seal-stamp color per theme. Highlight actions, links, and active states only.
- **Stay within the ink scale** for text hierarchy: `--text` → `--text-light` → `--text-muted` for primary/secondary/tertiary.
- **Use theme variables everywhere**, never hardcode colors. Every component references `var(--*)`.
- **Layer shadows** — combine a tight proximity shadow with a wide ambient shadow for natural depth.
- **Use the motion triad** (`--duration-instant`, `--duration-fast`, `--duration-slow`) consistently.
- **Prefer the unified keyframes** (`hana-*`) over inline animations.
- **Respect the serif content rule** — assistant messages (markdown content) should use `var(--font-serif)`.
- **Make content selectable, UI not** — `user-select: text` on content zones only.
- **Use the paper texture** through `body.paper-texture` for a unified tactile feel.

### Don't

- **Don't introduce a secondary accent** — the design has exactly one accent color. If you need a second, use the mood system (`--mood-*`).
- **Don't use bright saturated colors** for error/success. `--coral` and `--green` are intentionally muted ink tones.
- **Don't skip the `--*` token system** even for one-off values. New colors need at least an overlay or semantic token.
- **Don't mix border strategies** — use `var(--border)` for structural separators, `var(--overlay-light)` for subtle dividers.
- **Don't use sharp transitions everywhere** — distinguish between instant (hover), fast (buttons/panels), and slow (modals).
- **Don't forget `:focus-visible`** — keyboard focus must always show an accent outline. Use `:focus:not(:focus-visible)` to suppress mouse-focus rings.
- **Don't use `-webkit-focus-ring-color`** — it follows macOS accent and often shows orange; explicitly set outline with `var(--accent)`.
- **Don't assume default radii** — themes override `--radius-*`, always reference the tokens.
- **Don't scrollbar-width: thin without the companion** — set both `scrollbar-width` and `::-webkit-scrollbar` for cross-browser consistency.

---

> This document is generated from the canonical source files at `desktop/src/styles.css`, `desktop/src/animations.css`, `desktop/src/themes/*.css`, and the CSS Modules under `desktop/src/react/`.
