# Apple — Style Reference
> Gallery wall at natural light — enormous type casts shadows on a white surface, color enters only as product.
Theme: light

Apple's MacBook Neo product page features a gallery-white canvas (#f5f5f7) where weight-700 headlines at 80-96px dominate above light body copy. Negative letter-spacing tightens with size (display at -0.022em, body at -0.003em). The single accent (#0071e3 CTA blue) appears only on the Buy button and nav links.

## Tokens — Colors
| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink | #1d1d1f | --color-ink | Primary text, headings, nav labels |
| Graphite | #707070 | --color-graphite | Secondary body copy, captions |
| Slate | #474747 | --color-slate | Tertiary body text |
| Fog | #f5f5f7 | --color-fog | Page canvas background |
| Snow | #ffffff | --color-snow | Card surfaces |
| Silver Mist | #e8e8ed | --color-silver-mist | Input backgrounds, pill buttons |
| Azure | #0071e3 | --color-azure | Primary CTA button (sole accent) |
| Cobalt Link | #0066cc | --color-cobalt-link | Inline text links |

## Tokens — Typography
### SF Pro Display
- Stack: SF Pro Display, ui-sans-serif, system-ui, -apple-system, sans-serif
- Weights: 600, 700
- Sizes: 24px - 96px
- Letter spacing: -0.022em at 96px to -0.005em at 28px
### SF Pro Text
- Stack: SF Pro Text, ui-sans-serif, system-ui, -apple-system, sans-serif
- Weights: 300, 400, 500, 600
- Sizes: 12px - 44px
- Line height: 1.24-1.50

## Tokens — Spacing & Shapes
Base: 4px. Page max-width: 1200px. Card padding: 28px.
Radius: cards 28px, buttons 999px, small buttons 10px.

## Components
- **Primary Buy Button**: #0071e3 bg, white text, 999px radius, 8px 16px padding
- **Ghost Text Button**: transparent bg, #1d1d1f text, no radius
- **Frosted Pill Selector**: rgba(210,210,215,0.64) + backdrop-blur(20px), 36px radius
- **White Feature Card**: #ffffff bg, 28px radius, no shadow, 28px padding
- **Fog Feature Card**: #f5f5f7 bg, 28px radius, no shadow, 28px padding
- **Dark Feature Card**: #000000 bg, 28px radius, white text
- **Global Nav Bar**: #f5f5f7 bg, ~44px height, 12px nav links
- **Sticky Product Sub-Nav**: #ffffff bg, 1px #e8e8ed bottom border, ~52px height

## Elevation
Zero box-shadows on all cards. Elevation through bg-color differential only.

## Do's and Don'ts
- Do use 28px radius for all feature cards
- Do reserve #0071e3 exclusively for Buy CTA
- Do not add box-shadow to any card
- Do not use link blue (#0066cc) for button backgrounds

## Quick Start — CSS
```css
:root {
  --color-ink: #1d1d1f;
  --color-graphite: #707070;
  --color-slate: #474747;
  --color-ash: #333333;
  --color-fog: #f5f5f7;
  --color-snow: #ffffff;
  --color-silver-mist: #e8e8ed;
  --color-azure: #0071e3;
  --color-cobalt-link: #0066cc;
  --surface-canvas: #f5f5f7;
  --surface-card: #ffffff;
  --radius-cards: 28px;
  --radius-buttons: 999px;
}
```
