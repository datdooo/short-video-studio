# Phase 8 qualification — curated title animations

DEV worktree: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch: `feature/visual-preset-engine`. Phase 7 base:
`7abe5f23fded5bcd195907d00f606d5524fa40ad`. Node 22.23.3.

This chat initially found uncommitted Phase 8 work and two concurrent bridge runs.
It preserved those edits and waited for both runs to finish, as requested, before
continuing. The resumed worktree was not clean; no reset/stash/discard was used to
manufacture a clean start. The existing implementation was inspected and reused.
Independent focused checks passed 41/41 before further edits. The bridge sandbox's
localhost, browser-launch and yt-dlp semaphore failures are not qualification
passes. Final evidence below comes from completed real worker/browser/package runs.

## Delivered model and behavior

VisualStyle v1 gains optional `titleAnimation`:

```ts
titleAnimation?: "none" | "fade-in" | "slide-up" | "pop-in"
```

Missing/explicit None normalizes to absence, preserving legacy object shape and
serialization. Unknown IDs, null, containers, URLs, paths and expressions reject.
No user timing, easing, distance, scale or expression field is accepted. The local
registry and ID arrays are immutable; getters return independent copies.

| Preset | Duration in output | Opacity | Translation | Scale / easing |
| --- | --- | --- | --- | --- |
| None | No entrance | 1 | 0 | 1, static |
| Fade in | 500 ms | 0 → 1 | 0 | 1, linear |
| Slide up | 500 ms | 0 → 1 | +20 → 0 canvas pixels Y | 1, linear |
| Pop in | 500 ms | 0 → 1 | 0 | 0.975 → 1 about canvas center, linear |

Original title, part title, part number and existing moving shine form one title
group. Source footage, background, scene overlays, controls and subtitle cues stay
outside it. Each part begins at pose zero, completes once, then retains its normal
geometry. The selector is a labelled native select with visible selected text,
focus and keyboard typeahead. No separate animation preference state is added.

Preview uses the existing edited-part playback clock, including retained cuts,
seek and 1.25× playback. Source-only preview uses its source clock. Selection does
not reset/seek/remount video. Export uses trusted expressions within the existing
FFmpeg graph and static title/shine assets. Active entrances separate the static
scene input from moving text. There is no per-frame PNG sequence or second renderer.

500 output milliseconds correspond to 625 ms before the existing speed adjustment.
Active graphs use a precise time base before that adjustment and explicit final
30 fps sampling to avoid CFR timestamp rounding stretching the entrance. None
bypasses every new filter/input/timing branch and retains the old scene/title
flattening optimization. Exact mappings: [text-animations.md](text-animations.md).

## Templates, content and snapshots

Applying a Phase 7 template preserves motion. Template matching ignores only the
independent animation field in addition to its existing metadata/operational
exclusions; all existing typography/appearance fields still participate. Text,
font, filter, background and overlay controls retain animation. Appearance changes
still become Custom; motion alone does not change template identity.

Animation changes only its effective style field and the existing synchronized
subtitle alias. Content, captions, subtitle enabled/source, parts, cuts, Custom
Time, speed, audio and output settings remain unchanged. Existing normalized plan,
render and batch snapshots own independent complete styles. Tests defer a queue,
append another animation and legacy None, then mutate callers; accepted styles
stay independent. Old plans need no migration or history rewrite.

## Current / None compatibility

`qa-visual-style.mjs --baseline 7abe5f2 --current-template --slow-host` passed:
**all decoded frames and title/subtitle PNGs are identical** to Phase 7 Current.
1080×1920, 30 fps, 2.4 seconds per part, geometry, shine, subtitle timing, background,
filter, absent scene overlays and environment overrides pass unchanged assertions.
Evidence: `.isolation-verification/visual-style-qa-XtNLiv` and
`phase8-root-current-baseline.log`.

The Phase 3–7 render regression results also match their Phase 7 evidence: all nine
text results, ten filter comparison frames/samples (plus two environment jobs),
all 15 background comparisons, all 21 overlay comparisons and all 12 template
results. Evidence: `phase8-root-regression-parity.json`.

## Animation render evidence

Source and completed DEV package each pass **10 jobs / 20 MP4s**: all four modes on
Current with mixed English/Japanese/Korean text; all four on a black measurement
canvas with static REC scene; Farming JP/Pop and Korean Tutorial/Slide. Every job
has two parts with a removed range inside each part, supplied fixed caption cues
and samples at output 0, 0.2, 0.6 and 1 second.

All **80 sampled source/package frames** and **102 title/shine/subtitle assets**
match exactly. Subtitle assets do not change across the four animations for a
given recipe. Every active title settles to the exact static None bounds at 0.6
and 1 second. Title layout and glyph coverage checks pass for both parts; local
seven-font/license verification and actual Japanese/Korean text pass. Contact
sheets were inspected: titles enter together, captions/REC remain stationary,
and the finished title geometry stays readable and unclipped.

On both parts, the original-title signal at 0.2 seconds is 0.4145 of settled for
Fade/Slide and approximately 0.3943 for Pop (including its smaller raster area).
Slide's remaining displacement is 12 pixels. Pop's measured width grows from
568 to 577 pixels; final bounds equal None `[249,195,826,247]`. Entry title signal
is effectively zero. These are decoded export measurements on the black canvas,
not a claim of full browser/export pixel identity.

Evidence: `animation-source-7ztisC`, `animation-package-BTSsTw`,
`phase8-root-animation-parity.json` under `.isolation-verification/`.

Native package smoke passes **three jobs / six MP4s**: Current/Slide, Farming
JP/Pop and News/Pop. Silent inputs exercise synthesized audio; News also covers
gradient + static scene + subtitle input indexing. Every completed job confirms
`h264_videotoolbox`, with no silent CPU fallback. Evidence:
`animation-package-6GRpOE`, `phase8-root-animation-native.log`.
All **46 animation MP4s** independently pass 1080×1920, 30 fps, audio and 1.4-second
edited-part durations: `phase8-root-media-metadata.json`.

## Regression and package evidence

Short artifact names below are under `.isolation-verification/` unless absolute.
Ignored fixtures/bundle are local evidence and do not accompany a fresh clone.

| Check | Completed result / artifact |
| --- | --- |
| Full Node suite | 183/183 passed, no failures/skips; `phase8-root-tests.tap` |
| Isolation | 15/15; `phase8-root-isolation.tap` |
| Lint / TypeScript / whitespace | `phase8-root-lint.log`, `phase8-root-tsc.log`, `git diff --check` |
| Current baseline | Exact all decoded frames and title/subtitle PNGs; `visual-style-qa-XtNLiv` |
| Phase 3 fonts/text | Nine jobs / 18 outputs; `text-source-rw5mHL` |
| Phase 4 filters | 12 jobs / 24 outputs; `filter-source-wsuzmW` |
| Phase 5 backgrounds | 15 jobs / 30 outputs; `background-source-YxqTLV` |
| Phase 6 overlays | 21 jobs / 42 outputs; `overlay-source-gD3vQQ` |
| Phase 7 templates | 12 jobs / 24 outputs; `template-source-UiLky5` |
| Phase 8 source/package | 10 jobs / 20 outputs each; `animation-source-7ztisC`, `animation-package-BTSsTw` |
| Native packaged animation | Three jobs / six outputs, actual VideoToolbox; `animation-package-6GRpOE` |
| Built animation/template stress | Passed; `template-ui-ypFjWF` |
| Actual-bootstrap animation/template stress | Source/part clocks, keyboard, poses, part reentry, 64 animation + 64 template stress switches, playback and subtitle geometry passed; `template-ui-xvyNgM` |
| Animated history through packaged worker | Ten completed animation/legacy jobs restore exact styles and outputs; `phase8-root-animation-history.json` |
| Existing text stress | 40 cases passed; `text-ui-TAZQDg` |
| Filter/background/overlay browser parity | Passed; `filter-ui-zw46oi`, `background-ui-ka1URd`, `overlay-ui-kwNaMu` |
| DEV build/native audit | Completed; `phase8-root-package.log` |
| Package freshness | 106 copied runtime/public files byte-identical; `phase8-root-package-freshness.json` |
| DEV bootstrap | SHORTCUT_READY, HTTP 200, healthy DEV worker/current-only storage; `phase8-root-bootstrap.json` |
| Editor / queue / cancel / restore / restart | Full existing regression passed with explicit DEV runtime; `phase8-root-editor.log`, `/private/tmp/shortcut-editor-qa-pbBD6B` |

The editor regression checks source preparation during another render, independent
titles/hashtags/timestamps, per-job cancellation, FIFO, four playable outputs,
one-time trim handling, subtitle burn-in/cue exclusion, recoverable deletion,
original preservation, restart/restore and filename reset.

Browser poses at 0.2 seconds assert opacity 0.4, remaining Slide offset 12 canvas
pixels and Pop scale 0.985. Export signal/geometry measurements above follow the
same progression within frame/raster quantization. Both UI runs preserve source
elements, playback position, subtitle geometry, Custom Time, accepted render and
batch snapshots, and template identity under motion; zero browser errors or
production/external requests. The final pass also checks source-only preview and
native-select keyboard typeahead. An initial keyboard harness assumed Home/End
selection on macOS; a native-control diagnostic established typeahead behavior,
and the corrected harness passed without a product change.

The completed DEV bundle remains uninstalled. Its identity/config is ShortCut
Studio Dev / `local.datdo.shortcutstudio.dev`, ports 5273/8887,
`existingDataRoot: null`, separate DEV media/current-only storage. All owned
QA/DEV listeners were stopped after qualification. The historical stable tag
remains `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.

## Files changed / added

Changed: `app/page.tsx`; `lib/visual-style/normalize.mjs`, `templates.mjs`,
`types.ts`; `worker/server.mjs`, `worker/batch-queue.test.mjs`;
`scripts/qa-template-ui.mjs`; `docs/visual-style.md`, `docs/visual-templates.md`.

Added: `components/text-animation-panel.tsx`; `lib/visual-style/animations.mjs`,
`animations.d.mts`; `lib/animations.test.mjs`; `worker/title-animation.mjs`,
`worker/title-animation.test.mjs`; `scripts/qa-text-animations.mjs`,
`scripts/qa-text-animations-offline.mjs`; `docs/text-animations.md` and this report.

## Limits and safety

Browser continuous transforms versus FFmpeg frame/even-pixel quantization can
differ by roughly one output frame/two canvas pixels; universal raster identity
is not claimed. The pop is deliberately subtle, without overshoot. No exit/repeat
or per-role timing controls. Existing browser/FFmpeg blur, glow and font rendering
approximations remain. Native Windows, every encoder and native menu-bar actions
are not qualified. The existing yt-dlp health-probe behavior was not changed.

No subtitle-cue animation, karaoke, generic keyframes/easing editor, transitions,
motion tracking, masks, free transform, animated overlays, multi-track timeline,
custom logo/image/video upload or new rendering subsystem. No Phase 9 work.

All code changes stay in this isolated worktree. Original checkout, main,
`/Applications/ShortCut Studio.app`, production data/credentials/models and ports
5173/8787 were untouched. No DEV install, merge, push, tag move, commit amend/reset,
previous-phase rewrite or unrelated Homebrew change.
