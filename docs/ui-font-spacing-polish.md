# UI font and presentation pass — 2026-10-21

Continues on `recovery/visual-dev-reconstructed` at87c3135; preserve all pending
height-normalized foreground framing and previous typography/dropdown changes.
This pass edits presentation only, no business handlers/API/plan/media behavior.

## Font choice

The user's Grok ZIP declares Outfit. Official Google Fonts Outfit metadata lists
Latin/Latin-ext, not Vietnamese. Per-glyph fallback can explain inconsistent
Vietnamese forms, but the user's exact browser rendering was not reproduced.
Use **Plus Jakarta Sans** as a rounded/geometric alternative, not a claim of an
identical Outfit drawing. Official metadata explicitly includes Vietnamese.
One unmodified variable normal TTF, weights200–800,176288bytes; bundled in
`public/fonts/ui/`, with original SIL OFL1.1 notice, metadata and SHA256 provenance.
Pinned Google Fonts commit47d54ca1ebb14fd864695f1d39dc734f39017c33.
No external font request at app runtime, no new package/dependency. Local CSS
alias `Studio UI Jakarta` is first in the UI stack; existing Inter/Noto remain
fallbacks. Monospace timestamps/transcript remain. Video font registry, title/
subtitle font settings, video sample typography and export assets are unchanged.
No glyph rendering/browser audition was run; metadata is not visual acceptance.

## Source audit findings and corrections

Reviewed active Editor source/preview/Timeline/Inspector, Header/footer,
Batch queue, Kho's4 tabs/media/render lists, and shared/portaled controls.
No claim that source review discovers every possible visual issue.

- Teaser action buttons were independent inline children with a middle-button
  left margin; a shared wrapping action row now keeps left edge/gaps aligned.
- Timeline's old4.5rem action track was too small for32px delete + padded Xem.
  Track minimum6rem and aligned actions; narrow view still wraps below timecodes.
- Shared text-input inset12px; source URL/search icon insets retained36px;
  timecode inset6px with centered tabular monospace. Textareas use8×12px inset;
  one-line teaser textarea can grow to show Vietnamese accents without clipping.
- Music import label has the same control geometry/focus, with actual disabled
  state mirrored from its file input. Checkbox labels retain native behavior,
  consistent16px boxes and a minimum24px label target where directly associated.
- Editor provider label now explicitly targets the existing Select trigger.
- Internal list scroll areas reserve4px for focus outlines. Long render headings
  and their controls can wrap; no fixed single-row squeeze or truncated title.
- Shared disclosure/value labels wrap. Header status/nav can wrap within available
  width. Preview clocks reserve intrinsic width, avoiding42px time label clipping.
  Preview9:16,125% framing,1× clock and55/45 center geometry are not altered.
- Radix menu width/height constrained to viewport, existing collision positioning
  retained. Choice text has a shrinkable/wrapping box; scroller buttons24px.
- New-session popover was portaled outside `.prototype-shell`, missing some
  scoped button rules. It now receives the same UI font/padding/radius/focus/colors.
- Reduced-motion styling only disables chrome transitions, not media/effects.

No mock state, auto-save timers, worker calls, render submissions, extra decoders,
font entry in VisualStyle or UI state in EditPlan were introduced.

## Bounded web references (requested Google/web search)

- [Google Fonts Outfit metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/METADATA.pb)
- [Pinned Plus Jakarta Sans metadata](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/plusjakartasans/METADATA.pb)
- [Radix Select](https://www.radix-ui.com/primitives/docs/components/select):
  existing trigger/viewport and available-width/height variables, no code copied.
- [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/) and
  [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum):
  associated labels and usable targets; not an accessibility-conformance verdict.
- [Material typography](https://m3.material.io/styles/typography/applying-type):
  search excerpt consulted; full page requires JS, no browser automation run.
  Existing app layout/palette retained; no Material dependency or framework copied.

## Delivery

No tests/lint/typecheck, browser automation/smoke, QA renders, ASR/listening or
AI/YouTube verification. Source/diff review and packaging only. Combined Node22 `npm run package:mac:dev`
succeeded once, exit0. App: `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-jakarta-spacing-polish-build-20261021.log`. Native signing/
compatibility steps completed (build, not runtime QA). Font/OFL and shared framing
source exist in the app and match source by read-only SHA256 comparison. Only
delivery docs changed afterward.
No app/worker restart or job interruption, production/user data/backups changes,
commit/push/merge. User manual acceptance is outstanding: Vietnamese labels,
long titles, narrow windows, dropdowns, focus, disabled/import states, Timeline
editing/actions and all3 workspaces. Do not call this a full visual QA pass.

At delivery, DEV web/worker PIDs25664/25663 still use
`release/dev/.build-ZulbHx/previous-build.app/Contents/Resources/app` as cwd,
confirmed read-only with lsof after packaging. The new font/polish requires
normal app quit/reopen after active jobs finish. No process was stopped by this task.
