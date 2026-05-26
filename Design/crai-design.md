# Crai — Style Reference
> AI agent chat interface with Inspector-driven live themability — a neutral canvas where color enters only as accent and user attribution. Surface hierarchy is expressed through foreground-tint mixing rather than shadows.
Theme: light / dark (toggled via color presets)

Crai's chat interface is designed as a distraction-free reading environment. The page background sits at oklch(0.98 0.003 265), one step off pure white, creating a soft canvas that never competes with content. What distinguishes Crai from typical chat UIs is its **color-derived surface system**: every elevation level (bg-2 through bg-12) is calculated by mixing the foreground color into the background at increasing percentages — `color-mix(in oklch, var(--crai-fg) N%, var(--crai-bg))`. This means a single foreground color change cascades uniformly through all surface depths, preserving hierarchy without manual color selection.

The accent color (default oklch(0.58 0.22 293), a muted violet) appears only on interactive elements — send button, active tabs, hover states. User messages are subtly tinted with 5% foreground mix (barely perceptible as a slight elevation above the page canvas). AI messages sit flush against the page with no background at all, relying on typographic hierarchy alone. The entire color system uses the oklch color space, chosen for its perceptual uniformity: a 10% lightness shift looks like a 10% shift to the human eye, unlike hex or RGB.

Typography centers on system UI fonts at a compact 15px base size, with JetBrains Mono as the code face. Markdown content uses @tailwindcss/typography for prose styling. Shadows are a two-layer system: a 1px border-ring tinted from foreground RGB at 6% opacity (creating a colored edge that adapts to theme), plus blur layers using plain black rgba — the border color tracks theme, the blur depth stays consistent.

## Tokens — Colors
| Name | Value | Token | Role |
|------|-------|-------|------|
| Background | oklch(0.98 0.003 265) | --crai-bg | Base page canvas. All surfaces derive from this. |
| Foreground | oklch(0.185 0.01 270) | --crai-fg | Primary text, headings. All text levels derive from this. |
| Foreground RGB | 38, 36, 42 | --crai-foreground-rgb | RGB components for shadow border-ring tinting |
| Accent | oklch(0.58 0.22 293) | --crai-accent | Interactive elements: send button, active tabs, hover states, focus rings |
| Accent RGB | 104, 78, 133 | --crai-accent-rgb | RGB components for accent-derived shadows |
| Info | oklch(0.75 0.16 70) | --crai-info | Ask mode indicator, warning badges |
| Success | oklch(0.55 0.17 145) | --crai-success | Success states, completed indicators |
| Destructive | oklch(0.58 0.24 28) | --crai-destructive | Error states, remove buttons, failure indicators |
| Surface 2% | color-mix(in oklch, var(--crai-fg) 2%, var(--crai-bg)) | --crai-bg-2 | Subtle separators, dividers |
| Surface 3% | color-mix(in oklch, var(--crai-fg) 3%, var(--crai-bg)) | --crai-bg-3 | bg-secondary, input container background, code block background |
| Surface 5% | color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg)) | --crai-bg-5 | bg-tertiary, inline code background, user message bubble |
| Surface 8% | color-mix(in oklch, var(--crai-fg) 8%, var(--crai-bg)) | --crai-bg-8 | Hover/selected state backgrounds |
| Surface 12% | color-mix(in oklch, var(--crai-fg) 12%, var(--crai-bg)) | --crai-bg-12 | Active selected state |
| Text 40% | color-mix(in oklch, var(--crai-fg) 40%, var(--crai-bg)) | --crai-fg-40 | fg-secondary, secondary/muted text |
| Text 60% | color-mix(in oklch, var(--crai-fg) 60%, var(--crai-bg)) | --crai-fg-60 | fg-tertiary, code block text, tool group titles |
| Border | color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg)) | --crai-border | All borders, dividers, input outlines |
| Border Hover | color-mix(in oklch, var(--crai-fg) 10%, var(--crai-bg)) | --crai-border-hover | Hovered border states |
| Input Border | color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg)) | --crai-input-border | Input field borders |
| Focus Ring | color-mix(in oklch, var(--crai-fg) 25%, var(--crai-bg)) | --crai-ring | Input/button focus ring, 1px width |
| Scrollbar | color-mix(in oklch, var(--crai-fg) 12%, var(--crai-bg)) | --crai-scrollbar-color | Custom scrollbar thumb |
| Thinking Block BG | var(--crai-bg-3) | --crai-thinking-bg | Thinking/collapsed reasoning background |
| Tool Block BG | var(--crai-bg-3) | --crai-tool-bg | Tool call activity background |
| User Msg BG | color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg)) | --crai-msg-user-bg | User message bubble, subtle elevation |
| AI Msg BG | transparent | N/A | AI messages have no background — flat on page |

## Tokens — Typography
### System UI Sans — All interface labels, buttons, sidebar items, toolbar elements. The 15px base size is slightly compacted from the 16px standard for a denser chat layout. · --crai-font-sans
- Stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif
- Weights: 400, 500, 600, 700
- Base size: 15px
- Input font size: 14px (one step smaller for text entry)
- Toolbar font size: 11px (mode/model selector labels)
- Line height: 1.6 (comfortable reading)
- Role: All UI chrome — buttons, selects, sidebar lists, mode labels, chat headers, config panel

### Serif Reading Font — Markdown prose body text when enabled. Optional; default uses sans-serif for UI consistency. · --crai-font-serif
- Stack: Georgia, 'Noto Serif SC', serif
- Role: Long-form reading in assistant messages (opt-in via typography settings)

### JetBrains Mono — Code blocks, tool call arguments, inline code, file paths. Positioned first in the monospace stack before SF Mono to prioritize the wider, more readable character shapes. · --crai-font-mono
- Stack: 'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace
- Size: 13px (compact for code)
- Role: All code rendering, tool parameter display, error messages

### Type Scale
| Role | Size | Line Height | Token |
|------|------|-------------|-------|
| caption / toolbar | 11px | 1.4 | --crai-toolbar-font-size |
| input text | 14px | 1.6 | --crai-input-font-size |
| body / base | 15px | 1.6 | --crai-font-size |
| code | 13px | 1.5 | --crai-md-code-font-size |
| sidebar header | 12px | 1.3 | N/A |
| markdown h1 | 24px | 1.3 | --crai-md-h1-font-size |
| markdown h2 | 20px | 1.35 | --crai-md-h2-font-size |
| markdown h3 | 18px | 1.4 | --crai-md-h3-font-size |
| markdown h4 | 16px | 1.45 | --crai-md-h4-font-size |
| button label | 13px | 1 | --crai-btn-font-size |

## Tokens — Spacing & Shapes
Base unit: 8px (--crai-spacing)
Density: comfortable

### Spacing Scale
| Name | Value | Token |
|------|-------|-------|
| XXS | 2px | --crai-space-xxs |
| XS | 4px | --crai-space-xs |
| SM | 8px | --crai-space-sm |
| MD | 12px | --crai-space-md |
| LG | 16px | --crai-space-lg |
| XL | 24px | --crai-space-xl |
| Message gap | 8px | --crai-msg-gap |
| Chat padding | 16px | --crai-chat-padding |

### Border Radius
| Element | Value | Token |
|---------|-------|-------|
| Base | 0px | --crai-radius |
| Small (buttons, tags) | 4px | --crai-radius-sm |
| Large (panels, modals) | 8px | --crai-radius-lg |
| Input box | 8px | --crai-input-radius |
| Code block | 4px | --crai-md-code-radius |
| Thinking block | 4px | --crai-thinking-radius |
| Tool block | 4px | --crai-tool-radius |
| Message bubble | follows base | --crai-msg-*-radius |

### Layout
- Chat max-width: 720px (centered)
- Sidebar fixed bar: 36px (collapsed) / 160-520px (expanded)
- Panel width: 320px
- Header height: 48px
- Input min-height: 44px / max-height: 120px
- Input padding: 14px horizontal
- Component gap: 12px
- Transition duration: 0.15s

## Shadows
Crai uses a two-layer shadow system that separates border-tint from blur:

- **Minimal** (1px ring only): `rgba(var(--crai-foreground-rgb), 0.06) 0px 0px 0px 1px`
- **Bubble** (card, tool row): 1px border-ring + 2px blur: `rgba(var(--crai-foreground-rgb), 0.06) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 1px 2px -0.5px`
- **Panel** (Inspector, config): 1px ring + multi-layer blur: `rgba(var(--crai-foreground-rgb), 0.06) 0px 0px 0px 1px` + `rgba(0,0,0,0.04) 0px 2px 4px -1px` + `rgba(0,0,0,0.02) 0px 4px 6px -2px`
- **Modal** (dialog): progressive 6-layer blur: `rgba(0,0,0,0.02) 0px 12px 12px 0px` + `rgba(0,0,0,0.02) 0px 24px 24px 0px`
- **Input**: `rgba(var(--crai-foreground-rgb), 0.06) 0px 0px 0px 1px, rgba(0,0,0,0.02) 0px 2px 8px`

The border-ring layer always uses `var(--crai-foreground-rgb)` tinted at 6% — this makes the ring color adapt to theme (dark in light theme, light in dark theme) while maintaining the same perceived depth. Blur layers use plain black rgba for natural falloff regardless of theme.

## Components
### Send Button
Role: Sole message submission CTA
28×28px square, icon-only (lucide Send). backgroundColor: var(--crai-accent), color: #ffffff, borderRadius: var(--crai-radius-sm). Hover: accent darkened by 15%. No text label — pure icon communicates intent universally.

### Mode Selector
Role: Conversation mode toggle (execute / ask / safe / plan)
Dropdown button with mode-specific tinted styling: execute = accent (purple), ask = info (amber), safe = success (green), plan = default (fg). Implemented as 8% background-tint + 20% border from the mode color. Uses custom Select component with smart upward positioning.

### Model Selector
Role: Active model selection grouped by provider
Dropdown shows only model name, groups by provider (openhanako-inspired). All toolbar selects share transparent background + no border styling to keep focus on content.

### User Message Bubble
Role: User's own messages
Max-width: 80%. Background: `color-mix(in oklch, var(--crai-fg) 5%, var(--crai-bg))` — a subtle gray that reads as barely elevated above the page. Border-radius follows --crai-radius. The 5% mix is deliberate: enough to distinguish from AI messages, not enough to draw visual weight away from the AI's response.

### AI Message
Role: Assistant responses
No background — flat on page canvas. Typographic hierarchy alone creates separation. Max-width: 100%. This is crystalagents-inspired: the AI's words should feel like they're emerging from the interface itself, not from a contained bubble.

### Input Container
Role: Message composition area
Background: var(--crai-bg-3). Border: 5% foreground mix. Shadow: 6% foreground ring + 2% black blur. Focus-within: shadow elevates (no accent border change — subtle glow rather than colored outline). Padding: 14px horizontal, input area self-sizes between 44-120px.

### Toolbar
Role: Mode, model, and action controls below the input
Layout: left (mode) | center (todo progress) | right (model + thinking + send). All buttons (except send) have transparent backgrounds with hover→bg-5. Mode and model selectors share a unified dropdown design language.

### Activity Timeline
Role: Tool call and thinking progress display
Each activity as a compact row with left border timeline. Status icons: running (⟳), success (✓ green), error (✕ red). Completed activities collapse to single line, clickable to expand detail. ChevronRight rotates on expand. Slide-in mount animation.

### TodoDisplay
Role: Plan mode task tracking
Collapsible card with three-state rendering: pending (○ gray), in_progress (⟳ accent), completed (✓ success + strikethrough). Compact toolbar variant shows `☑ completed/total`.

### Code Block
Role: Syntax-highlighted code in markdown
Background: var(--crai-bg-3). Border: var(--crai-border). Border-radius: var(--crai-radius-sm). Font: JetBrains Mono 13px. Copy button in top-right on hover.

## Surfaces
| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | var(--crai-bg) | Page background — set by user theme |
| 1 | Surface-3 | var(--crai-bg-3) | Input container, code blocks, thinking blocks, secondary cards |
| 2 | Surface-5 | var(--crai-bg-5) | Inline code, user message bubble, hover states |
| 3 | Surface-8 | var(--crai-bg-8) | Active hover, selected items |
| 4 | Surface-12 | var(--crai-bg-12) | Active selected items |
| 5 | Modal | var(--crai-bg) | Modal dialog root with overlay backdrop |

All surfaces derive from foreground mixing — changing --crai-fg automatically adjusts every surface level's perceived depth without manual tuning.

## Elevation
Zero box-shadows on cards. Elevation is expressed entirely through background-color differential in the surface hierarchy. Shadows are reserved for input container (focus state), panels, and modal dialogs — these are the only elements that need to feel "above" the page rather than "on" it. The input container's shadow elevation on focus-within is the only animated shadow transition in the interface.

## Icons
All icons use Lucide (lucide-react). Consistent 1.5-2px stroke width. Mode icons: Play (execute), HelpCircle (ask), Lock (safe), Clock (plan). Send button icon: Send. Sidebar panel icons: MessageSquare, FolderTree, Settings, Palette. Icon size system: sm (14px), md (16px), lg (20px).

## Motion
Primary duration: 0.15s (--crai-transition-fast). Hover states: background-color transitions. Expand/collapse: Chevron rotation with 0.15s transform. Slide-in mount: new message and activity entry animations. No spring or bounce easing — linear/ease transitions only for a clean, tool-like feel.

## Do's and Don'ts
### Do
- Express surface hierarchy through color-mix foreground tinting, not shadows. Every surface level should be `color-mix(in oklch, var(--crai-fg) N%, var(--crai-bg))`.
- Use oklch color space for all base colors — its perceptual uniformity ensures 5% mixing steps look equally deep at every shade.
- Keep AI messages flat on the canvas with no background. The user's bubble (5% tint) provides the only visual anchor — two background levels is enough.
- Reserve accent color for interactive elements only. Send button, active tabs, selected items — not decorative borders or headings.
- Use the two-layer shadow system: 1px border-ring from foreground-rgb, blur layers from plain black. This makes shadows theme-aware without hard-coding.
- Set focus rings to foreground 25% mix at 1px width. Subtle enough to not distract, present enough for keyboard navigation.
- Limit chat content width to 720px centered for comfortable reading line lengths.
- Use JetBrains Mono before SF Mono in the font stack — wider characters improve code readability.

### Don't
- Do not add background to AI messages. The entire design relies on AI text being flush with the page surface.
- Do not use accent-colored borders on focus states. Use shadow elevation instead — the input container should glow, not outline.
- Do not hard-code shadow colors. Always use `rgba(var(--crai-foreground-rgb), opacity)` for border rings and `rgba(0,0,0,opacity)` for blur layers.
- Do not mix hex/RGB color manipulation with oklch. Choose one color space and stay in it. Crai's system assumes oklch for all color-mix operations.
- Do not add shadows to cards or surface elements. The surface hierarchy (bg-3/5/8/12) provides sufficient depth through color alone.
- Do not use positive letter-spacing at any size. The system relies on natural typeface spacing.
- Do not create custom component backgrounds outside the surface token system. New surfaces should derive from existing bg-N tokens.

## Design System Architecture
The token system is organized into groups for Inspector-panel discoverability:
- **base** — Colors, shadows, rings, scrollbars
- **font-size** — All type sizes, font family stacks
- **line-height** — Line height cascade
- **radius** — Border radius cascade
- **spacing** — Spacing values, message gaps
- **user-msg** — User message bubble (bg, fg, max-width)
- **ai-msg** — Assistant message (bg, fg, max-width, padding)
- **code-block** — Code rendering (bg, fg, border, font-size)
- **table** — Markdown tables
- **blockquote** — Blockquotes, inline code, links
- **heading** — Markdown heading color/weight
- **input-box** — Input container
- **input-bar** — Toolbar
- **layout** — Chat/sidebar dimensions
- **thinking-block** — Thinking activity
- **tool-block** — Tool call activity

## Quick Start — CSS Variables
```css
:root {
  --crai-bg: oklch(0.98 0.003 265);
  --crai-fg: oklch(0.185 0.01 270);
  --crai-foreground-rgb: 38, 36, 42;
  --crai-accent: oklch(0.58 0.22 293);
  --crai-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif;
  --crai-font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
  --crai-font-size: 15px;
  --crai-radius: 0px;
  --crai-radius-sm: 4px;
  --crai-radius-lg: 8px;
  --crai-spacing: 8px;
  --crai-chat-max-width: 720px;
}
```

## Presets
Crai ships with 6 color presets accessible via the Inspector panel:
1. **Crai 默认（浅色）** — neutral light theme
2. **Crai 默认（深色）** — inverted dark theme (bg=oklch(0.2 0.005 270), fg=oklch(0.92 0.005 270))
3. **极光 (Aurora)** — cool blue-purple tones
4. **暖橙 (Warm)** — warm orange-brown
5. **森林 (Forest)** — natural green
6. **樱 (Sakura)** — soft pink
