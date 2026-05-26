# Crai — Style Reference
> AI agent chat interface with Inspector-driven live themability — a neutral grey canvas where color enters only through a single accent and functional semantics. Surface hierarchy is expressed through foreground-tint mixing rather than shadows.
Theme: light / dark

Crai is a personal AI workbench — a distraction-free environment designed for sustained analytical work. The page background is pure white (#ffffff), creating a clean canvas that never competes with content. What distinguishes Crai from typical chat UIs is its **color-derived surface system**: every elevation level (bg-2 through bg-12) is calculated by mixing the foreground color into the background at increasing percentages using `color-mix`. A single foreground color change cascades uniformly through all surface depths.

The accent color (#2563eb, a clean, professional blue) appears only on the send button, active tabs, and hover states — the sole chromatic element in an otherwise greyscale interface. User messages are subtly tinted with 5% foreground mix. AI messages have no background at all, relying on typographic hierarchy alone. Colour enters only for functional semantics: green for success states, red for destructive actions.

The entire colour system uses hex values for base colours and oklch color-mix for derived surfaces. Typography centers on system UI fonts at a compact 15px base, with JetBrains Mono as the code face. Shadows are a two-layer system: a 1px border-ring tinted from foreground RGB at 6% opacity, plus blur layers using plain black rgba.

## Tokens — Colors
| Name | Value | Token | Role |
|------|-------|-------|------|
| Background | #ffffff | --crai-bg | Page canvas, modal root. All surfaces derive from this. |
| Foreground | #1a1a1a | --crai-fg | Primary text, headings. All text levels derive from this. |
| Foreground RGB | 26, 26, 26 | --crai-foreground-rgb | RGB components for shadow border-ring tinting |
| Accent | #2563eb | --crai-accent | Send button, active tabs, hover states, focus rings — sole chromatic accent |
| Accent RGB | 37, 99, 235 | --crai-accent-rgb | RGB components for accent-derived shadows |
| Info | var(--crai-accent) | --crai-info | Ask mode indicator, inherits accent by default |
| Success | #16a34a | --crai-success | Success states, completed indicators |
| Destructive | #dc2626 | --crai-destructive | Error states, remove buttons, failure indicators |
| Surface 3% | color-mix(in oklch, #1a1a1a 3%, #ffffff) | --crai-bg-3 | Input container, code blocks, secondary cards |
| Surface 5% | color-mix(in oklch, #1a1a1a 5%, #ffffff) | --crai-bg-5 | User message bubble, hover states |
| Surface 8% | color-mix(in oklch, #1a1a1a 8%, #ffffff) | --crai-bg-8 | Active hover, selected items |
| Text 40% | color-mix(in oklch, #1a1a1a 40%, #ffffff) | --crai-fg-40 | fg-secondary, secondary/muted text |
| Text 60% | color-mix(in oklch, #1a1a1a 60%, #ffffff) | --crai-fg-60 | fg-tertiary, code block text |
| Border | color-mix(in oklch, #1a1a1a 5%, #ffffff) | --crai-border | All borders, dividers, input outlines |

## Tokens — Typography
### System UI Sans — All interface labels, buttons, sidebar items, toolbar elements. · --crai-font-sans
- Stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif
- Weights: 400, 500, 600, 700
- Base size: 15px
- Line height: 1.6
- Role: All UI chrome — buttons, selects, sidebar lists, mode labels, chat headers, config panel

### JetBrains Mono — Code blocks, tool call arguments, inline code, file paths. · --crai-font-mono
- Stack: 'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace
- Size: 13px
- Role: All code rendering, tool parameter display, error messages

### Serif Reading Font — Markdown prose body text (optional). · --crai-font-serif
- Stack: Georgia, 'Noto Serif SC', serif
- Role: Long-form reading in assistant messages (opt-in)

### Type Scale
| Role | Size | Line Height | Token |
|------|------|-------------|-------|
| toolbar / caption | 11px | 1.4 | --crai-toolbar-font-size |
| code | 13px | 1.5 | --crai-md-code-font-size |
| input text | 14px | 1.6 | --crai-input-font-size |
| body / base | 15px | 1.6 | --crai-font-size |
| button label | 13px | 1 | --crai-btn-font-size |
| markdown h4 | 16px | 1.45 | --crai-md-h4-font-size |
| markdown h3 | 18px | 1.4 | --crai-md-h3-font-size |
| markdown h2 | 20px | 1.35 | --crai-md-h2-font-size |
| markdown h1 | 24px | 1.3 | --crai-md-h1-font-size |

## Tokens — Spacing & Shapes
Base unit: 8px (--crai-spacing)
Density: comfortable

### Spacing Scale
| Name | Value | Token |
|------|-------|-------|
| 2 | 2px | --crai-space-xxs |
| 4 | 4px | --crai-space-xs |
| 8 | 8px | --crai-space-sm |
| 12 | 12px | --crai-space-md |
| 16 | 16px | --crai-space-lg |
| 24 | 24px | --crai-space-xl |
| 40 | 40px | --crai-space-2xl |
| 64 | 64px | --crai-space-3xl |

### Border Radius
| Element | Value | Token |
|---------|-------|-------|
| Base | 0px | --crai-radius |
| Small (buttons, tags) | 4px | --crai-radius-sm |
| Large (panels, modals) | 8px | --crai-radius-lg |
| Extra large | 12px | --crai-radius-xl |
| Pill (badges, tags) | 999px | --crai-radius-pill |

### Layout
- Chat max-width: 720px (centered via mx-auto)
- Sidebar fixed bar: 36px (collapsed) / 160-520px (expanded by drag)
- Panel width: 320px
- Header height: 48px
- Input min-height: 44px / max-height: 120px
- Input padding: 14px horizontal
- Section gap: 24px (space-xl)
- Component gap: 12px
- Transition duration: 0.15s

### Z-Index Layers
| Name | Value | Token |
|------|-------|-------|
| Dropdown | 100 | --crai-z-dropdown |
| Sticky | 200 | --crai-z-sticky |
| Overlay | 300 | --crai-z-overlay |
| Modal | 400 | --crai-z-modal |
| Toast | 500 | --crai-z-toast |

## Components
### Send Button
Role: Sole message submission CTA
28×28px square, icon-only (lucide Send). backgroundColor: var(--crai-accent), color: #ffffff, borderRadius: var(--crai-radius-sm). Hover: accent darkened by 15%. No text label.

### Mode Selector
Role: Conversation mode toggle (execute / ask / safe / plan)
Dropdown button with mode-specific tinted styling: execute = accent (blue), ask = info (inherits accent), safe = success (green), plan = default (fg). Implemented as 8% background-tint + 20% border from the mode color.

### Model Selector
Role: Active model selection grouped by provider
Dropdown shows only model name, groups by provider. Transparent background, no border.

### User Message Bubble
Role: User's own messages
Max-width: 80%. Background: `color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))`. Border-radius follows --crai-radius.

### AI Message
Role: Assistant responses
No background — flat on page canvas. Max-width: 100%.

### Input Container
Role: Message composition area
Background: var(--crai-bg-3). Border: 5% foreground mix. Shadow: 6% foreground ring + 2% black blur. Focus-within: shadow elevates. Padding: 14px horizontal, input self-sizes between 44-120px.

### Toolbar
Role: Mode, model, and action controls below the input
Layout: left (mode) | center (todo progress) | right (model + thinking selector + send). All buttons (except send) have transparent backgrounds with hover→bg-5.

### Activity Timeline
Role: Tool call and thinking progress display
Compact rows with left border timeline. Status icons: running (⟳ accent), success (✓ green), error (✕ red). Completed activities collapse to single line, clickable to expand detail.

### TodoDisplay
Role: Plan mode task tracking
Collapsible card with three-state rendering: pending (○ grey), in_progress (⟳ accent), completed (✓ success + strikethrough). Compact toolbar variant shows `☑ completed/total`.

### Code Block
Role: Syntax-highlighted code in markdown
Background: var(--crai-bg-3). Border: var(--crai-border). Border-radius: var(--crai-radius-sm). Font: JetBrains Mono 13px.

### Config Panel
Role: Provider and model settings
Split layout: provider sidebar (160px) | content area (500px). Includes: provider list, API key/URL editor, model list with add/edit, global model selectors, general settings (sandbox toggle, compression slider).

### Inspector Panel
Role: Live design token editor
Right sidebar, 320px width. Includes: colour swatches, preset manager, token group browser with search, import/export (JSON + design.md format), locate mode for clicking UI elements.

## Surfaces
| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | #ffffff | Page background — pure white canvas |
| 1 | Surface-3 | color-mix(fg 3%, bg) | Input container, code blocks, secondary cards |
| 2 | Surface-5 | color-mix(fg 5%, bg) | User message bubble, hover states |
| 3 | Surface-8 | color-mix(fg 8%, bg) | Active hover, selected items |
| 4 | Modal | #ffffff | Modal dialog root with rgba(0,0,0,0.3) backdrop overlay |

All surfaces derive from foreground mixing — changing --crai-fg automatically adjusts every surface level.

## Elevation
Shadows are reserved for floating elements (panels, modals, input focus). Cards and surface elements use no shadows — elevation is expressed through background-color differential in the surface hierarchy.

**Shadow system** — Two-layer approach:
- **Border ring**: `rgba(var(--crai-foreground-rgb), 0.06) 0px 0px 0px 1px` (tracks theme colour)
- **Blur layers**: `rgba(0,0,0,opacity)` (consistent regardless of theme)

Shadow variants: Minimal (1px ring only), Bubble (ring + 2px blur), Panel (ring + multi-layer blur), Modal (progressive 6-layer blur), Input (ring + 2px blur for focus state).

## Icons
All icons use Lucide (lucide-react). Consistent 1.5px stroke width. Icon size system: sm (14px), md (16px), lg (20px). Mode icons: Play (execute), HelpCircle (ask), Lock (safe), Clock (plan).

## Motion
Primary duration: 0.15s (--crai-transition-fast). Hover states: background-color transitions. Expand/collapse: transform rotation. No spring or bounce easing — linear/ease transitions only.

## Imagery
Crai has no marketing imagery — the interface is purely functional. No product photography, no illustrations, no decorative graphics. Visual interest comes from typographic hierarchy and the surface depth system alone. The single allowable graphic element is syntax-highlighted code in markdown blocks. Icons are strictly functional (Lucide set), never decorative.

## Do's and Don'ts
### Do
- Express surface hierarchy through color-mix foreground tinting, not shadows.
- Keep AI messages flat on the canvas with no background.
- Reserve accent colour (#2563eb) for interactive elements only.
- Use the two-layer shadow system (foreground-rgb ring + black blur).
- Set focus rings to foreground 25% mix at 1px width.
- Limit chat content width to 720px centred for comfortable reading.

### Don't
- Do not add background to AI messages.
- Do not use accent-colored borders on focus states — use shadow elevation instead.
- Do not add shadows to cards or surface elements.
- Do not use decorative icons or illustrations — all graphics must be functional.
- Do not mix hex/RGB colour manipulation with oklch — choose one system.
- Do not use positive letter-spacing at any size.

## Agent Prompt Guide
QUICK COLOUR REFERENCE:
• Page background: #ffffff
• Card surface: color-mix(in oklch, #1a1a1a 3%, #ffffff)
• Primary text: #1a1a1a
• Accent / CTA: #2563eb
• Success: #16a34a
• Destructive: #dc2626

EXAMPLE COMPONENT PROMPTS:
1. **Chat input bar**: Container background: var(--crai-bg-3), border-radius: var(--crai-radius-lg, 8px), shadow: 1px foreground-ring + 2px black blur. Textarea: transparent background, 14px font, 1.6 line-height, auto-resizing between 44-120px. Bottom toolbar: mode selector (left), todo progress (centre), model selector + thinking selector + send button (right). Send button: 28×28px, var(--crai-accent) background, white lucide Send icon, 4px border-radius.

2. **Message list**: Full-height scroll container, max-width 720px centred. AI messages: no background, 15px font, 1.6 line-height. User messages: 80% max-width, color-mix(fg 5%, bg) background, same border-radius as base. Message gap: 8px. Last 2 messages animate in with spring (stiffness 300, damping 28).

3. **Activity timeline**: Compact rows with left border timeline (1px solid var(--crai-border)). Status icons: running (⟳ accent colour), success (✓ #16a34a), error (✕ #dc2626). Collapsed completed activities show single line, clickable to expand. ChevronRight icon rotates on expand.

4. **Inspector panel**: Right sidebar, 320px wide. Top section: colour swatches for 5 base colours (bg, fg, accent, success, destructive) with color-picker input. Presets section: dropdown for colour/style presets, save buttons. Token groups: collapsible sections with search filter, live CSS variable editing. Bottom: export/import buttons (JSON + design.md format).

## Similar Brands
- **OpenAI (ChatGPT)** — Minimal white canvas, single font, pill-shaped inputs, near-zero chromatic saturation. Crai shares the restraint but adds a colour-derived surface system that ChatGPT lacks.
- **Claude (Anthropic)** — Warm vellum background, custom serif headings, academic journal feel. Crai is cooler, more utilitarian, and replaces Claude's warm texture with precision greyscale.
- **Cursor / VS Code** — Developer tool aesthetic, monospace code rendering, compact information density. Crai takes the tool-like efficiency but applies it to a chat interface rather than an editor.
- **Perplexity** — Grey-scale palette, search-first layout, compact spacing. Crai similarly restrains to greys but adds a single accent colour and a more sophisticated surface hierarchy.

## Quick Start — CSS Variables
```css
:root {
  /* Colors */
  --crai-bg: #ffffff;
  --crai-fg: #1a1a1a;
  --crai-foreground-rgb: 26, 26, 26;
  --crai-accent: #2563eb;
  --crai-accent-rgb: 37, 99, 235;
  --crai-success: #16a34a;
  --crai-destructive: #dc2626;
  --crai-border: color-mix(in oklch, #1a1a1a 5%, #ffffff);
  /* Typography */
  --crai-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif;
  --crai-font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
  --crai-font-size: 15px;
  --crai-input-font-size: 14px;
  /* Radius */
  --crai-radius: 0px;
  --crai-radius-sm: 4px;
  --crai-radius-lg: 8px;
  --crai-radius-pill: 999px;
  /* Spacing */
  --crai-spacing: 8px;
  --crai-chat-max-width: 720px;
  --crai-panel-width: 320px;
  /* Z-Index */
  --crai-z-modal: 400;
  --crai-z-toast: 500;
}
```

## Presets
Crai ships with 6 colour presets accessible via the Inspector panel:
1. **Crai 默认（浅色）** — white background, near-black text, blue accent
2. **Crai 默认（深色）** — dark grey background (#1a1a1a), light text (#e5e5e5), lighter blue accent (#3b82f6)
3. **极光 (Aurora)** — cool blue-tinted white (#f0f5ff), indigo accent (#6366f1)
4. **暖橙 (Warm)** — warm cream (#fef9f0), dark brown text (#2d1b0e), orange accent (#e8590c)
5. **森林 (Forest)** — natural green-tinted (#f0faf0), dark green text (#0e2d1b), green accent (#16a34a)
6. **樱 (Sakura)** — soft pink (#fef5f5), rose text (#3a1a2a), pink accent (#ec4899)
