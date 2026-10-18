# Curated cut transitions (Phase 9)

Phase 9 adds `cutTransition?: "none" | "dip-black" | "flash-white"` to VisualStyle
v1. The immutable registry is `lib/visual-style/cut-transitions.mjs`; only preset
identity is persisted. Registry getters return copies. Missing/explicit None
normalizes to absence, preserving legacy style serialization. Unknown IDs, null,
containers, paths, URLs, CSS and expressions reject. Unrecognized duration/color
siblings are discarded by the existing normalization policy, never interpreted.

| ID | Color | Maximum window | Behavior |
| --- | --- | --- | --- |
| `none` | No color operation | 0 | Exact Phase 8 behavior |
| `dip-black` | `#000000` | 400 ms | Linear normal → black → normal |
| `flash-white` | `#ffffff` | 400 ms | Linear normal → white → normal |

There is no duration/color control, crossfade, overlap, clip subtraction, exit
transition or transition between files/parts. Only retained segment boundaries
inside each part participate. Existing one-second part-start trimming, Smart Cut
and Custom Time resolution happen before the boundary helper reads the part.

## Shared timing and short segments

`resolveCutTransitions(id, segments)` returns fresh window descriptors:

```ts
{ boundary, startFrame, cutFrame, endFrame, halfFrames }
```

Coordinates use the existing nominal edited/output clock (30 fps, speed 1.25).
Edges are `round(cumulativeSourceDuration / 1.25 * 30)`, calculated from cumulative
unrounded durations, not a sum of rounded segment lengths. For each internal edge:

```text
halfFrames = min(6, floor(outgoingFrames / 2), floor(incomingFrames / 2))
startFrame = cutFrame - halfFrames
endFrame   = cutFrame + halfFrames
```

Normal windows have six frames/200 ms on either side. Short neighbors reduce both
halves symmetrically. If either adjacent nominal interval cannot support one frame
per half, that boundary remains a hard cut. There are no negative timestamps,
overlapping windows or effects at part endpoints. Positive sub-frame segments
remain governed by the existing planner/renderer validation; this phase does not
add a new minimum cut length or change their content/timing.

`cutTransitionPose` evaluates the same windows for the preview, using a triangular
opacity: `max(0, 1 - abs(outputTime * 30 - cutFrame) / halfFrames)`. Multiple windows
combine by maximum opacity; they do not stack. Each part resolves its own windows.

## Layer and export mapping

The existing source trim/concat and final speed pipeline remain unchanged:

```text
source segments + existing audio concat
→ video filter
→ background + foreground
→ decorative scene overlays
→ cut color ramp
→ titles / part number / shine (existing title animation)
→ subtitle cards
→ existing color metadata / speed / encoder output
```

The part indicator stays inside the existing title group. No readable text enters
the cut-color stage. Titles animate once at part start; an internal cut never
restarts their entrance. Audio has no new filters: no fade, crossfade, overlap,
timestamp change or resampling beyond the existing pipeline. Subtitle cues, source,
enablement, appearance, assets and ffconcat timing remain unchanged.

`worker/cut-transition.mjs` maps trusted registry data/shared windows to FFmpeg
color fades. Output-frame times multiply by 1.25 before the existing final speed
adjustment. Each outgoing/incoming fade is enabled only within its half-window;
outside it, the scene passes through and recovers fully. Active scenes use RGB
interpolation. If needed, the existing static scene PNG is separated from the
title PNG so decoration fades while text remains readable. This adds at most one
static image input for a part, never a decoder per cut or per-frame image sequence.

None and single-segment parts add no cut filters/input/timing changes. None retains
the existing scene/title flattening optimization. There is no new renderer.

The existing Phase 8 CFR/overlay presentation can place a decoded hard cut later
than its nominal edited timestamp (two output frames in the Current/static QA
fixture). This phase preserves that clock. Ramp peaks follow the actual rendered
cut; export QA first measures cuts in an identical None control, then samples
around those observed frames. Changing the output clock to force nominal equality
would alter established output duration/audio and is deliberately excluded.
No new cumulative timing shift is introduced: controls and transitions have exact
matching encoded duration/frame counts and decoded PCM audio hashes.

## Preview and UI

Three native buttons beside Text Animation expose readable labels, `aria-pressed`,
focus and a checkmark. The chosen ID lives only in effective VisualStyle.
The preview resolves windows from `effectiveTiming` and uses the existing retained
part playback clock for both playback and scrubbing. A pointer-transparent color
veil sits above scene decoration (z=8), below title group (z=10) and subtitles
(z=20). Preview controls stay above the veil. None/parts without windows create no
veil. No additional video, source remount, seek, upload, AI or subtitle generation.

Browser and export share the event/window semantics; media sampling, inherited
CFR presentation, RGB/YUV conversion and encoder quantization prevent a universal
pixel/timestamp identity claim. See the measured limits in qualification evidence.

## Templates, persistence and snapshots

Full visual templates preserve `cutTransition` and `titleAnimation`. Matching
ignores these independent controls while still comparing recipe appearance.
Changing transition alone does not label a matching recipe Custom. Lower controls
preserve it. Applying a title animation does not alter transition, and vice versa.

Existing normalized edit-plan/render/batch snapshots persist complete independent
styles. No second preference store or template metadata is added. Old plans/jobs
default to None without history rewriting. Later editor changes cannot mutate
accepted styles or their content/timing/caption objects.

## QA entrypoints

Use `PATH="/opt/homebrew/opt/node@22/bin:$PATH"` with every Node/npm command.

```sh
node --test lib/cut-transitions.test.mjs worker/cut-transition.test.mjs worker/batch-queue.test.mjs
node scripts/qa-cut-transitions.mjs
node scripts/qa-cut-transitions.mjs --packaged
node scripts/qa-cut-transitions.mjs --packaged --native-smoke
node scripts/qa-cut-transitions.mjs --performance
node scripts/qa-cut-transition-evidence.mjs --source <isolated-source-result.json> --packaged <isolated-package-result.json> --output <isolated-evidence.json>
node scripts/qa-visual-style.mjs --baseline 76aad14e3d9e1d593b3df730c77232a517359810 --current-template --slow-host
```

Render QA uses fresh mock HOME/media/fontconfig, synthetic structured red/green/blue
media, local fonts, a fetch-denial worker preloader and ports 8887 (default) or
explicit `QA_TRANSITION_PORT=8897`. Two parts each contain three retained ranges.
Actual None-control cut detection provides independent objective frame measurements.
Every active recipe compares duration, frame count, decoded audio, title/shine PNGs,
subtitle PNGs and cue timing against its own None control. Additional image checks
protect opaque title/subtitle pixels at cut peaks. CPU source/package hashes and
native VideoToolbox smoke are separate qualifications.

Run performance QA without other render suites; backend job timestamps exclude
polling, decoding and contact-sheet work. It uses two interleaved None/Dip/None/
Flash/None sequences. Results are a small controlled observation, not a universal
throughput claim.

With the DEV frontend on 5273, run:

```sh
QA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qa-template-ui.mjs --animations --transitions --renders <isolated-transition-result.json>
```

The browser fixture retains three ranges after the existing one-second trim. It
tests both boundaries/parts, scrubbing, keyboard, running playback, 96 transition
stress switches, mixed templates/animations, stable subtitle geometry and accepted
render/batch snapshots. See [phase9-qualification.md](phase9-qualification.md) for
final executed evidence, performance and limits.
