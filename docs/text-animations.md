# Curated title animations (Phase 8)

Qualified in the isolated DEV worktree. See
[phase8-qualification.md](phase8-qualification.md) for executed checks and limits.

`lib/visual-style/animations.mjs` is the immutable local registry. The compact
labelled **Text animation** select beside text controls offers four options:

| ID | Entrance, in edited/output seconds |
| --- | --- |
| `none` | Exact legacy static title rendering |
| `fade-in` | Opacity 0 → 1, linear, 0.5 s |
| `slide-up` | Opacity 0 → 1 and vertical offset +20 → 0 canvas pixels, linear, 0.5 s |
| `pop-in` | Opacity 0 → 1 and centered scale 0.975 → 1, linear, 0.5 s |

The deliberately restrained pop avoids a large excursion into the source-video
zone. All three title-card roles (original title, part title and part number)
share the same transform and opacity, including the existing title shine.
There is no overshoot, delay, exit animation, per-role control, scripting, dynamic
external content, keyframe engine or extra renderer. Subtitles are separate cues.

## Model, precedence and snapshots

VisualStyle **version 1** gains optional `titleAnimation`, an allowlisted string.
Missing means `none`. Explicit `none` normalizes to absence, so the normalized
legacy object/serialization stays unchanged. Null, objects, unknown IDs, paths,
URLs and expression strings reject. A client cannot supply duration, distance,
scale or FFmpeg expressions. Registry records/ID arrays are frozen and getters
return independent copies.

The single effective normalized style remains authoritative. Existing plan/job
and batch snapshot boundaries clone the animation with the complete style;
no migration, history rewrite, selected-animation side state or preference store
is introduced. Old styles/plans keep static titles.

Motion is independent of Phase 7 template recipes. Applying/reselecting any
recipe preserves `titleAnimation`; applying text/font/filter/background/overlay
controls also preserves it. Template matching ignores this independent motion
field while still comparing every existing typography/appearance field. Thus
“Farming JP” describes its recipe even with Pop in selected; the separately
visible animation select describes motion. Changing title font/color still
produces Custom. No text appearance mismatch is hidden by this rule.

Phase 9 cut transitions are also independent. Their color stage is below the
entire title group, so an internal cut never fades or replays a title entrance.
Both choices persist through templates and ordinary style/job snapshots; see
[cut-transitions.md](cut-transitions.md).

## Preview and export

The browser groups the existing three title elements in one absolute full-canvas
container above the video/scene and below subtitles. It calculates opacity and
transform from `previewCurrentTime`, the existing edited-part clock derived from
source playback, retained ranges and playback rate. This works for play, pause,
seek and part changes, without CSS wall-clock animations. Source-only preview
uses its source clock. Values clamp to the start/end pose; switching a preset
at a paused position updates that pose immediately. It does not restart playback
or seek to show an entrance. The selector changes only style and its existing
subtitle alias, preserving cuts/source/video identity. Both built UI and actual DEV
bootstrap checks verify these behaviors, including the source-only clock.

Every part gets its own FFmpeg graph, starting at timestamp zero. The graph runs
before the existing final 1.25× speed change, so entrance duration is 0.625 graph
seconds (0.5 output seconds). Fade uses FFmpeg alpha fade; slide uses overlay
coordinates; pop uses a bounded frame-evaluated scale of the one static title
asset. Title + moving shine are composed into one transparent group before
motion. Active entrances keep scene overlays on their own static input below
the title group. Scene pixels, source/filter/background and subtitle inputs never
enter the title transform.

Animated exports explicitly set a precise time base before the speed adjustment
and resample to 30 fps afterwards. This avoids CFR encoder timestamp rounding
stretching the entrance. Scaling rounds raster dimensions to even pixels;
alpha fade duration and frame sampling quantize to the 30 fps grid. Browser
continuous CSS and FFmpeg pixels can differ within approximately one output
frame and two raster pixels; identical preview/export rasterization is not claimed.

`none` bypasses all new graph filters, keeps the old combined scene/title PNG
optimization and uses the original final timing path. There are no per-frame
PNG sequences: each part retains its static title/shine assets and the existing
subtitle images. Scene separation adds one static decoder only when needed by
an active animation. Actual renderPart geometry, audio, cuts and color pipelines
remain the existing implementation.

## Reproducible QA entrypoints

Every Node/npm command uses `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.

```sh
node --test lib/animations.test.mjs worker/title-animation.test.mjs worker/batch-queue.test.mjs lib/templates.test.mjs
node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
npm run test:isolation
npm run lint
npx tsc --noEmit --incremental false
node scripts/qa-text-animations.mjs
node scripts/qa-visual-style.mjs --baseline 7abe5f23fded5bcd195907d00f606d5524fa40ad --current-template --slow-host
npm run package:mac:dev
node scripts/qa-text-animations.mjs --packaged
node scripts/qa-text-animations.mjs --packaged --native-smoke
```

HTTP render QA uses only worker port **8887**, temporary mock HOME/media, local
fonts, synthetic video/audio, a worker network-denial preloader, two parts and
sampled frames at 0/.2/.6/1 s. Worker job snapshots are checked independently
of the caller. The animation contact set also exercises cuts within each part.

With a DEV web server on **5273** and a source render `result.json`:

```sh
QA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qa-template-ui.mjs --animations --renders .isolation-verification/<render-set>/result.json
```

The new optional UI checks cover selection/defaults, timeline poses, part reentry,
64 stress switches, video retention/no seeks/loads, running playback, stationary
subtitle geometry, render snapshots, independent batch choices, preserved template
motion and the existing full template regression. They pass against the completed
DEV package, including native-select keyboard typeahead on macOS.

For offline diagnostic render evidence only:

```sh
node scripts/qa-text-animations-offline.mjs
node scripts/qa-text-animations-offline.mjs --baseline
node scripts/qa-text-animations-offline.mjs --packaged
```

This evaluates the actual trusted local worker rendering definitions without
starting its server, substitutes a local subprocess runner and CPU encoder, and
uses bundled-font-only fontconfig. It does not exercise HTTP acceptance, restored
history, browser or native VideoToolbox. `--baseline` archives the exact Phase 7
commit without changing the checkout. `--staged <DEV-stage-Resources>` can inspect
an interrupted in-worktree package stage, explicitly marked `staged: true` in its
result; that is **not** a completed package smoke test.
