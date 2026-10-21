# Foreground framing correction — 2026-10-21

Branch `recovery/visual-dev-reconstructed`, base HEAD
`87c3135c5ff176028f378c9f1d32833569e6c75c`. Preserve all newer uncommitted UI font,
dropdown, icon and source-tab changes. This note supersedes the earlier contain-fit
and direct-scale framing instructions; historical QA/delivery records remain intact.

## Before → after

Before: fit=min(1080/sourceWidth,1350/sourceHeight), then multiply by1.25.
A1920×1080 source becomes1350×759.375 before even-pixel rounding (~1350×758),
which is the wrong reference framing. A CSS scale on a contain-fit video repeats
that same basis error; it does not restore the former2400×1350 image.

After: displayAspect=displayWidth/displayHeight; baseHeight=1080 canvas pixels;
baseWidth=displayAspect×1080; finalHeight=1080×1.25=1350;
finalWidth=displayAspect×1350. Round both final dimensions down to even pixels
(min2), center them, then clip/pad inside the unchanged1080×1350 foreground.
1280×720,1920×1080 and3840×2160 therefore all resolve to2400×1350 for16:9,
with a centered1080-pixel visible crop (660 pixels removed per horizontal edge).
This is a formula/source review, NOT executed image/render verification.

## Code paths

- `lib/render-config.mjs:foregroundGeometry` owns canvas-normalized dimensions,
  centered visible-image bounds and narrow-source padding.
- Both actual video decks in `app/page.tsx` use those scaled dimensions as
  percentages of the fixed foreground (no ResizeObserver dependency). Transform
  only translates to center; the former CSS scale1.25 is removed. There is one
  geometric zoom, not contain-fit plus another zoom. Native aspect is preserved.
- `foregroundFilter` in the same shared module expresses the identical target
  height/aspect/even-rounding formula for FFmpeg, including SAR in display aspect.
  CPU/VideoToolbox and render-spec paths already call this function; no changes
  to worker orchestration, sequential range inputs, audio, quality or encoder caps.
- `foregroundLeakClip` already delegates to foregroundGeometry; all preview
  transition masks inherit corrected image bounds. Export transitions preserve
  the alpha from the same scaled/padded image. No overlay/background spill.

Foreground viewport, outer canvas, title/subtitle positions, background and UI
layout unchanged. Preview playback1× and export playback1.25× remain independent
of image zoom. No plan/source timestamps, queued snapshots or existing MP4 files
are rewritten. Older exports are not evidence of the corrected framing.

## Delivery / active app

No tests/lint/typecheck, browser/smoke, render samples or provider/ASR requests.
Source/diff review and packaging only. Node22 `npm run package:mac:dev`
succeeded once, exit0. Latest app: `release/dev/ShortCut Studio Dev.app`. Log:
`/tmp/shortcut-dev-height-normalized-framing-build-20261021.log`. Native signing/
compatibility steps completed; this does not establish visual/render QA. Read-only
SHA256 comparison matches packaged render-config and vr-light-leak source.
Only delivery docs changed after build.
Before build, local DEV ports5273/8887 were owned by PIDs24526/24525, both with
cwd under `release/dev/ShortCut Studio Dev.app/Contents/Resources/app`.
No processes stopped/restarted and no job action submitted. New build requires
normal app exit/reopen when jobs have finished; merely refreshing is not a worker
restart. Runtime/visual/rotated-source acceptance remains with the user.

After build, the SAME PIDs24526/24525 still have cwd under
`release/dev/.build-Z7enLa/previous-build.app/Contents/Resources/app` (read-only lsof).
Thus the running frontend/worker are still the previous build, not the new app.
They were not interrupted. Finish/cancel jobs explicitly as desired, quit DEV
normally, then reopen `release/dev/ShortCut Studio Dev.app` to load the new code.
No production app/data, source media/exports, credentials or backups touched;
no commit/push/merge in this turn.
