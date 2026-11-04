# ShortCut Studio — Design contract (v2)

Source style: **Minimalism & Swiss Style**, dense dashboard dials (variance 2, motion 3, density 8),
picked with the `ui-ux-pro-max` skill (`--design-system`). Brand colour stays warm dark + orange.
This file is the single source of truth. New UI must use these rules; `lib/design-contract.test.mjs`
guards the mechanical ones.

## Surfaces (dark, warm neutral)
| Token | Value | Use |
|---|---|---|
| `--background` | `#100e0c` | app canvas, inputs |
| `--surface` | `#171512` | panels, cards |
| `--panel` | `#211e1a` | controls (buttons, tabs, selects) |
| `--surface-3` | `#2a2621` | hover on controls |
| `--border` / `--border-strong` | `#322c27` / `#463e37` | rest / hover |

Cards sit on `--surface`. Nested boxes never repeat the same surface and border twice.

## Accent (orange `--primary`) is allowed in exactly 4 places
1. Primary button fill (one per view).
2. Selected state: tinted fill + muted accent 1px border (`--selected-border`). No inset ring.
3. Keyboard focus ring (2px, offset 2, `:focus-visible` only).
4. Progress bars and sliders.
Hover never turns a border orange.

## One state language
| State | Look |
|---|---|
| Rest | `--panel` fill, `--border` border |
| Hover | `--surface-3` fill, `--border-strong` border |
| Selected (tab, nav, part, toggle, pressed) | `--selection-bg` fill, `--selected-border`, `--selection-text` |
| Disabled (every variant, primary too) | `--panel` fill, border, muted text, no orange |
| Destructive | rest = red text + 45% red border; hover = red border + tinted fill |
| Focus | accent ring, keyboard only |

## Shape
Controls 8px, cards 12px, chips 6px. No pills (`9999px`). Heights: 36 control, 32 compact, 40 CTA.

## Type
Title 14/600, label 12/500 muted, control 13/500, body 14/400, page 20/600.
Sentence case everywhere: no `text-transform: uppercase`, no letter-spacing tricks.

## Status and notices
- Chip: rectangle, neutral fill, tone colours the text and a 30% border. Never filled.
- Notice (`inline-notice`): `--surface` fill, 1px neutral border, 3px left bar in the tone colour,
  body text stays foreground. Tone colours: `--success`, `--warning`, `--destructive`.
- Raw Tailwind palette colours (`amber-*`, `emerald-*`, `red-*`) map to those tokens.

## Motion
Colour/border/background transitions 120ms. Nothing else animates. `prefers-reduced-motion` disables all.
