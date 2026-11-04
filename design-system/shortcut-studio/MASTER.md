# ShortCut Studio — UI kit v3

Style: **Minimalism & Swiss Style**, dense dashboard (variance 2, motion 3, density 8), chosen with the
`ui-ux-pro-max` skill. Warm dark neutrals, one orange accent. This file is the contract;
`lib/design-contract.test.mjs` and `lib/ui-consistency.test.mjs` guard its mechanical rules.

## Architecture: where styling lives

`app/globals.css` is a thin entry point. The kit is `app/ui/*.css`, in CSS cascade layers declared in
`layers.css`: `kit-base`, `kit-controls`, `kit-layout`, `kit-state`. A later layer beats an earlier one,
so **no rule needs `!important` or inflated specificity**. All kit layers beat Tailwind utilities.

| File | Owns |
|---|---|
| `tokens.css` | every colour, size, radius, space, type size; Tailwind theme remap (zinc/amber/emerald/red → tokens, `text-xs` 12 / `text-sm` 13) |
| `base.css` | reset, headings, labels, scrollbar, reduced motion |
| `controls.css` | button, field, select, tabs, disclosure/section/card, chip, notice, progress, menus (`kit-controls`) |
| `shell.css`, `editor.css`, `workspaces.css` | layout and component structure (`kit-layout`) |
| `state.css` | hover, selected, disabled, invalid, focus — **the only file with `:hover`, `:disabled`, `:focus-visible`** (`kit-state`) |
| `media.css` | rendered video appearance; unlayered, never restyled |

Rules for code: Tailwind utilities are for layout only (`flex`, `gap`, `mt-2`, `w-full`). Never colour,
border, radius or font-size a component with a utility; use a kit class or `data-slot`.
Only `tokens.css` may contain a hex colour.

## Surfaces
`--background` canvas · `--surface` panels and cards · `--panel` controls and tonal blocks ·
`--surface-3` hover. One border `--border`, `--border-strong` on hover.
A card never contains a card: inner cards collapse to plain groups (`.studio-card .studio-card`,
panel in panel = tonal block).

## Accent (orange) is allowed in exactly 4 places
Primary fill · selected state · keyboard focus ring · progress and sliders. Hover never turns a border orange.

## One state language (defined once, in `state.css`)
| State | Look |
|---|---|
| Rest | `--panel` fill, `--border` |
| Hover | `--surface-3` fill, `--border-strong` |
| Selected (tab, nav, part, toggle, pressed) | `--selection-bg` fill, `--selected-border`, `--selection-text` |
| Disabled (every variant, primary too) | `--panel` fill, border, muted text |
| Destructive | red text + soft red border; hover red border + tint |
| Focus | 2px accent ring, keyboard only |

## Shape and size
Radius: control 8, card 12, chip 6. No pills. Height: 36 control, 32 compact/icon, 40 CTA.
Space on a 4px grid; panel padding 12, stack gap 10.

## Type
Caption 12/500 muted labels · control 13/500 · body 14 · title 14/600 · page 20/600. Sentence case, never uppercase.

## Status and notices
Chip: rectangle, transparent fill, tone colours text and a 30% border. Notice: `--surface` fill,
neutral border, 3px tone bar on the left, body text stays foreground.

## Motion
Colour/border/background 120ms. Nothing else animates. `prefers-reduced-motion` disables all.
