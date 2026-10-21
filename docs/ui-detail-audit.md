# Detailed UI source audit — 2026-10-21

Continue in DEV on `recovery/visual-dev-reconstructed` at87c3135, preserving all
uncommitted font, UI and height-normalized foreground work. No push/merge, resets,
production/data/credential/backups modifications. This audit changes presentation;
the subsequent user-requested teaser behavior is separately documented in
`docs/teaser-manual-toggle.md`.

User now permits **view/screenshots + workspace tabs/disclosures/panel toggles**
in DEV only. Never Generate/Render/provider/download/delete/plan editing for this
inspection. Browser Use tool currently reports disabled in Work settings; user
said they will enable it. No screenshot or runtime visual result has been obtained.
Do not label this a completed pixel/visual audit unless that blocker is resolved.

## New source findings and implemented fixes

| Area | Specific finding | Correction | Evidence status |
| --- | --- | --- | --- |
| Inputs | Old44px/12px/white styles were still present before higher-specificity overrides | Base input/textarea now use shared36px/8px/theme/padding tokens; obsolete34px advanced override removed | Source reviewed; visual pending |
| Native selects | Generic `.studio-input` inset reset right padding reserved for chevron | Generic inset is now input-only; native selects explicitly retain12px/36px inset | Source reviewed; visual pending |
| Color controls | Generic text inset leaves tiny swatches | Color input4px inset, borderless rounded browser swatch; native value/handler preserved | Source reviewed; visual pending |
| Inspector | All nested details got12px padding, accumulating unnecessary indentation | Padding applies to outer details only; nested controls keep their own spacing | Source reviewed; visual pending |
| Customize | Header/body/card padding differed from other Inspector cards | Outer card padding0; header/body12px inset, matching other card text starts | Source reviewed; visual pending |
| Customize rows | Auto-width first column could squeeze long current value | Shrinkable proportional columns,8px gap; labels/values wrap | Source reviewed; visual pending |
| Main timecodes | Gap annotation began32px from left, timecode column begins38px | Shared index/gap/timecode-width tokens; gap aligns to the exact timecode start | Source reviewed; visual pending |
| Main actions | Delete used a font-dependent multiplication glyph | Existing click/aria-label now uses Lucide X16px inside32px target | Source reviewed; visual pending |
| Candidate disclosure | A details element itself was display:flex | Keep native details block behavior so closed/open content ownership stays native | Source reviewed; visual pending |
| Text/Copy | Final-title label and Copy button forced into one narrow row | Header can wrap with consistent8px gap; no action/content changes | Source reviewed; visual pending |
| Long buttons | Fixed height could clip wrapping text | Keep36/40/32 minimums, auto height and6px vertical inset for textual buttons; icon targets remain32px | Source reviewed; visual pending |
| Action rows | Mixed fixed/auto heights left short buttons vertically misaligned | Stretch row children with consistent min-height; no callback changes | Source reviewed; visual pending |
| Status bar | Entire footer scrolls for long messages, including Render | Grid keeps toggles/cancel/Render visible; message area alone scrolls, narrow≤640px uses2 rows | Source reviewed; visual pending |
| Part-fix links | Footer fix buttons had uneven underline-only targets | Compact32px bordered buttons with4px gaps and visible focus | Source reviewed; visual pending |
| Source tabs | Content inset4px differed from normal field rhythm | Shared8px inset, same source mode/value and handlers | Source reviewed; visual pending |
| Accessibility | Forced-color focus/chevron could lose visibility | Use system Highlight/ButtonText in forced-color mode | Source reviewed; visual pending |
| Disabled fields | Label/wrapper and input could each multiply opacity.5 to.25 | Fade checkbox/native-select wrapper once; un-nested controls retain disabled opacity | Source reviewed; visual pending |
| Menu markers | Global16px SVG rule also enlarges radio's intentionally8px dot | Preserve8px radio dot; ordinary action/check/chevron icons stay16px | Source reviewed; visual pending |
| Transcript | Scrollbar token was old cold gray | Warm shared border token; source text/timestamps remain untouched | Source reviewed; visual pending |

Previous pending fixes retained: local Plus Jakarta Sans/OFL/Vietnamese metadata,
shared sizes/chevrons, action-row grouping, input/label association, dropdown
viewport limits, portaled new-session controls, real4-tab Kho and preview1× /
2400×1350 normalized16:9 image / export1.25×. No plans/jobs mutated.

## Focused research/reuse

- [shadcn Select implementation](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/select.tsx)
  and [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md): compared
  existing component structure and shrinkable Select.Value/Viewport; no external
  source copied or dependency update.
- [Radix Themes Select source](https://github.com/radix-ui/themes/blob/main/packages/radix-ui-themes/src/components/select.tsx)
  and [Radix primitives](https://github.com/radix-ui/primitives): consulted trigger/
  viewport sizing and existing issue reports about content overflow; no framework
  imported and no upstream install/repo instruction executed.
- [Radix Select docs](https://www.radix-ui.com/primitives/docs/components/select),
  [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/),
  [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/),
  [WAI target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum):
  informed original presentation fixes. No accessibility conformance claim.

## Delivery state

Source/diff review only so far. No unit/full tests, render/AI/YouTube/ASR, fake
progress, new decoder/player or media mutation. Combined Node22 DEV package build succeeded once (exit0), including the subsequent
manual teaser/toggle request. App: `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. No functional QA. App/worker not restarted or stopped; preserve active jobs.
Read-only lsof confirms PIDs27106/27107 still use
`release/dev/.build-iLQdbs/previous-build.app/Contents/Resources/app`. Reopen the
new app normally when jobs finish. Packaged framing/hook source and font/OFL
hashes match source; only delivery docs changed after build. All visual findings remain unverified until actual DEV screenshots
are available. User manual acceptance remains necessary even after a build.
