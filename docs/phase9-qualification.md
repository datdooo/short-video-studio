# Phase 9 qualification — curated cut transitions

Worktree: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch: `feature/visual-preset-engine`. Verified clean starting HEAD:
`76aad14e3d9e1d593b3df730c77232a517359810` (qualified Phase 8).
No competing bridge/editor run was active when Phase 9 began. Node 22.23.3.

This report belongs to the separate `feat(transitions): add curated cut transitions`
commit. Resolve its complete SHA with
`git log -1 --format=%H -- docs/phase9-qualification.md`; the delivery response also
records that SHA. Prior phase commits were not amended/reset.

## Delivered schema, registry and timing

VisualStyle v1 gains one optional trusted ID:

```ts
cutTransition?: "none" | "dip-black" | "flash-white"
```

Canonical registry: `lib/visual-style/cut-transitions.mjs`. Frozen registry records
have `{ id, label, durationMs, color, behavior }`; the ID list is frozen and getters
return independent copies. Only identity persists. Missing/explicit None
normalizes to absence, preserving old style serialization. Unknown IDs, null,
objects, CSS, paths, URLs and expressions reject. Arbitrary duration/color siblings
are dropped by existing normalization policy and never reach FFmpeg.

| ID | Maximum output window | Target | Progression |
| --- | --- | --- | --- |
| `none` | 0 | None | Exact Phase 8 graph |
| `dip-black` | 400 ms | `#000000` | Linear normal → black → normal |
| `flash-white` | 400 ms | `#ffffff` | Linear normal → white → normal |

The shared boundary helper uses existing 30 fps / 1.25× timing. Nominal cut frames
are `round(cumulative retained source duration / 1.25 * 30)`. For each internal
boundary, `halfFrames = min(6, floor(outgoingFrames/2), floor(incomingFrames/2))`.
The window spans `cutFrame ± halfFrames`, at most 200 ms either side. Cumulative
durations remain unrounded until conversion, avoiding accumulated rounding drift.
Adjacent windows cannot overlap. Neighbors under two nominal frames skip the
effect safely; no negative timestamps or new minimum segment length is imposed.

The rendered short-middle fixture retains 1/3 source second (eight nominal output
frames): both boundaries clamp to four frames per half, 266.7 ms total. Unit tests
also cover a 250 ms source neighbor (three frames per half), sub-frame skip and
100 fractional segments. Part starts/ends and independent output files never
receive transitions. Existing start-trim/Custom Time resolution runs first.

`cutTransitionPose` and the FFmpeg adapter consume those shared descriptors. The
adapter multiplies output times by 1.25 before the existing final speed stage.
Gated fades restore the scene outside each half-window. No new timing, concat,
overlap, audio or final-sampling filter is introduced.

## Layers and independent editor state

The existing pipeline is source trim/concat → filter → background + foreground →
decorative scene overlays → **cut color ramp** → title/part-number/shine group
(existing title animation) → subtitles → existing speed/color/encoder output.
The part number remains in its established title group. All readable text stays
above the transition. Active scene decoration uses the existing static scene PNG
separately when necessary; there is at most one extra static input per part.
None retains the original flattening optimization and adds no transition filters,
image input, time-base operation or preview veil.

Audio remains a hard edit through the existing pipeline: no fade, crossfade,
timing change or added resampling. Subtitle enablement/source, content, cue times,
appearance and PNG/ffconcat assets are unchanged. Applying transition changes only
its VisualStyle field and the existing synchronized subtitle alias; content,
segments, Custom Time, AI/source/caption data and output settings are preserved.

Templates preserve transition and title animation. Matching ignores these two
independent controls while still comparing template appearance. Switching a
template retains Dip/Flash; switching transition alone does not cause Custom.
Lower controls preserve it. Title entrances replay only at part start, never at
internal cuts. Old plans/jobs need no migration or history rewriting and resolve
to None. Existing effective-style snapshots own independent complete values.

The compact native-button control sits beside Text Animation, exposes readable
labels, `aria-pressed`, focus and a visible checkmark. Preview uses the existing
retained-part clock: one pointer-transparent scene veil at z=8, below titles z=10
and subtitles z=20. No added video decoder/remount, preset-triggered seek/upload,
AI run, subtitle generation or worker mutation.

## Exact None compatibility and inherited timing

`qa-visual-style.mjs --baseline 76aad14e3d9e1d593b3df730c77232a517359810 --current-template --slow-host`
passes all decoded frames and title/subtitle PNGs, geometry, 1080×1920/30 fps,
duration, environment overrides and legacy/canonical equivalence. The six current
outputs also have identical decoded PCM to the matching Phase 8 part. Evidence:
`visual-style-qa-foJKCQ`, `phase9-current-baseline.log`,
`phase9-none-baseline-audio.json`.

All rerun Phase 3–8 recipe/frame/sample/asset results match their Phase 8 evidence
after excluding only local paths, job IDs and measured performance times:
`phase9-regression-parity.json`. This includes all ten animation recipes, so None
also preserves existing active title-animation behavior.

The Phase 8 CFR/overlay clock presents Current/static fixture cuts at decoded
frames 26/50, versus nominal 24/48. Animated fixture controls present them at
24/48. Existing static outputs have 72 frames, while these existing animated
controls have 71. Phase 9 preserves each control's exact encoded duration/frame
count and decoded PCM rather than changing the established clock. Ramp peaks land
at each observed hard cut. QA detects those cuts independently in the matching
None control before sampling. There is no new cumulative offset across cuts or
parts. Browser nominal poses and encoded presentation are not universally
timestamp/pixel-identical.

An initial QA sampled nominal static cut times and correctly failed the peak
check. A clock-adjustment experiment changed established duration and was rejected
and reverted. Only the final unchanged-clock runs below qualify this phase.

## Actual source/package render matrix

Every row has two independent parts, each retaining three source ranges with two
internal cuts. Local structured red/green/blue media and fixed multilingual caption
cues make cuts measurable. Workers use isolated HOME/media/fontconfig and denied
network fetches. Text includes actual Japanese/Korean plus mixed Latin text; local
font/license/glyph and title/subtitle-safe-layout checks pass in the regression
sets. No personal source or production data is used for these render matrices.

| Recipe group | Components / title animation | Transition cases |
| --- | --- | --- |
| Current | Current / None animation | None, Dip Black, Flash White |
| Viral Fade | Vivid + Dark Blur + Grain / Fade in | None, Dip Black |
| Nature Slide | Nature + Black + Vignette / Slide up | None, Flash White |
| News Pop | News + Contrast + Dark Gradient + REC HUD / Pop in | None, Dip Black |
| Farming Slide | Farming JP / Slide up | None, Dip Black |
| Korean Pop | Korean Tutorial / Pop in | None, Flash White |
| Short middle | Current / None animation / 1/3-second source middle | None, Dip Black, Flash White |

Source and CPU DEV package each pass **16 jobs / 32 MP4s**. All **320 sampled
source/package frames** and **224 title/shine/subtitle assets** match exactly,
along with styles, durations, frame counts, decoded PCM and boundary measurements.
Every active recipe equals its own None control's timing, audio and text assets.
Both cuts in both parts reach the target; start/final scene samples remain normal.
Evidence: `transition-source-6eWKRd`, `transition-package-05tTtG`,
`phase9-transition-evidence.json`.

Native packaged smoke passes **five jobs / ten MP4s**: Current None/Dip/Flash and
News/Pop None/Dip. Every job confirms actual `h264_videotoolbox`, without CPU
fallback; silent input exercises existing audio synthesis and the News case
exercises gradient/scene/subtitle input indexing. Evidence:
`transition-package-oogU7R`, `phase9-transition-native.log`.

All 74 transition matrix/native MP4s receive independent H.264/AAC,
1080×1920/30 fps, Rec.709 and duration metadata assertions:
`phase9-media-metadata.json`.

## Objective image measurements

First Current cut, foreground luminance on decoded RGB (Rec.709 weights, 0–255):

| Measured offset | None | Dip Black | Flash White |
| --- | ---: | ---: | ---: |
| −8 frames (−266.7 ms) | 76.04 | 75.71 | 75.71 |
| −3 frames (−100 ms) | 76.04 | 38.66 | 165.24 |
| Cut | 80.94 | 0.00 | 253.00 |
| +3 frames (+100 ms) | 81.57 | 38.68 | 166.00 |
| +8 frames (+266.7 ms) | 81.57 | 80.29 | 80.56 |

Across five sampled scene locations at **20 Dip boundaries**, all peak RGB channels
are zero; across **16 Flash boundaries**, all are 253. Measurements include footage,
background and scene-decoration locations. Linear-ramp error allows one output
frame of interpolation quantization plus conversion tolerance; all checks pass.
Contact sheets were visually inspected for scene recovery and stationary readable
text. Evidence: `phase9-frame-metrics.json`, both matrix contact sheets.

At scene peaks, **88 opaque title/subtitle pixel checks** against None controls
pass (some checks reuse a frame in the short fixture). Maximum mean absolute RGB
error is 1.668 for title and 4.055 for subtitle pixels, below the five-level bound.
PNG assets/cue timing are exact; lossy video/chroma context prevents claiming
identical decoded text pixels. Title/animation/shine/indicator stay above the ramp.

## Browser, snapshots and packaged integration

Built frontend pass: `template-ui-PvA3Zr`. It makes 109 transition selections,
including 96 rapid switches, alongside 68 animation selections (64 stress) and
64 template stress switches. Both cut boundaries/parts, scrub poses, keyboard
activation, running playback, part reentry, subtitle geometry and title-no-replay
assertions pass. Video element/load count/playback position remain stable; no
browser errors, forbidden requests or automatic worker mutations. Render and batch
submissions preserve independent Dip/Flash/None styles and unchanged content.

The browser harness uses actual built media/UI with worker mutations mocked;
the real exported worker behavior is qualified separately above. Focused tests
also defer queue processing, append different transitions/animations and mutate
callers, proving independent accepted snapshots. A restarted packaged worker
restores all **16 completed transition/legacy jobs**, exact complete styles and
two outputs each: `phase9-transition-history.json`.

Actual DEV bootstrap reaches `SHORTCUT_READY`, HTTP 200 and healthy worker at
5273/8887. Storage exposes only `current`; media root is
`/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`.
Evidence: `phase9-bootstrap.json`, `phase9-bootstrap.log`.

The same browser pass through the actual DEV bootstrap also passes all assertions:
`template-ui-3Ej74g`, `phase9-bootstrap-ui.log`. Both passes independently record
109/96 total/stress transition selections, empty error/violation arrays and stable
playback, text and accepted snapshots. The bootstrap was stopped normally after
the pass, with its owned web/worker children cleaned up.

The full editor integration regression passes using the explicit DEV bundle
runtime, port 8788 and a private synthetic fixture root. It checks preparing source
2 while source 1 renders, own titles/ten hashtags/timestamps, per-job cancellation,
FIFO, four playable outputs, one-time start trimming, subtitle burn-in/cue
exclusion, recoverable deletion, original preservation, restart/restore and
filename reset. Evidence: `phase9-editor.log`,
`/private/tmp/shortcut-editor-qa-VDTu5z`.

## Regression results

Short artifact names are inside `.isolation-verification/`. Ignored fixtures and
the uninstalled bundle are local evidence, not checked-in assets. Reproduction
commands and exact mapping are in [cut-transitions.md](cut-transitions.md).

| Check | Result / artifact |
| --- | --- |
| Before-change focused tests | 47/47; `phase9-before-focused.tap` |
| New focused transition/queue tests | 23/23; `phase9-focused.tap` |
| Full Node suite | 193/193, no failures/skips; `phase9-tests.tap` |
| Isolation suite | 15/15; `phase9-isolation.tap` |
| Lint / TypeScript | Exit 0, no lint warnings; `phase9-final-lint.log`, `phase9-tsc.log` |
| Phase 3 fonts/text | Nine jobs / 18 MP4s; `text-source-aMSBtd` |
| Phase 4 filters | 12 jobs / 24 MP4s; `filter-source-w07RmT` |
| Phase 5 backgrounds | 15 jobs / 30 MP4s; `background-source-ffxBr5` |
| Phase 6 overlays | 21 jobs / 42 MP4s; `overlay-source-FgT2JV` |
| Phase 7 templates | 12 jobs / 24 MP4s; `template-source-wvMLY3` |
| Phase 8 animations | Ten jobs / 20 MP4s; `animation-source-OhsGbL` |
| Phase 9 source/package/native | 16/16/5 jobs, 32/32/10 MP4s; matrix evidence above |
| Existing text browser stress | 40 cases; `text-ui-5tFIYL` |
| Filter/background/overlay browser parity | `filter-ui-2oXewk`, `background-ui-TzsMGm`, `overlay-ui-P7zIWi` |
| DEV package/native audit | Completed; `phase9-package.log` |
| Bundle freshness | 110 copied runtime/public files byte-identical; `phase9-package-freshness.json` |
| Signature | `codesign --verify --deep --strict` passed |
| Actual-bootstrap mixed browser stress | Passed; `template-ui-3Ej74g` |
| Editor / queue / cancel / restore / restart | Passed; `phase9-editor.log` |

Bundle identity is ShortCut Studio Dev / `local.datdo.shortcutstudio.dev`;
development config is 5273/8887 with `existingDataRoot: null`. It remains at
`release/dev/ShortCut Studio Dev.app`, uninstalled.

## Controlled performance

With every other QA/browser/render process stopped, ten short CPU jobs run as two
interleaved `None → Dip → None → Flash → None` sequences. Each has two parts and
two cuts per part (six retained source seconds, nominal 4.8 output seconds total),
same subtitles/title assets and encoder settings. Backend started/finished job
timestamps exclude QA polling, decoded-frame extraction and contact-sheet work.

| Selection | Mean job time | Mean adjacent None controls | Measured overhead |
| --- | ---: | ---: | ---: |
| Dip Black (two samples) | 8.034 s | 6.963 s | +15.4% |
| Flash White (two samples) | 8.492 s | 7.390 s | +14.9% |

All six None jobs average 7.101 s. Dip pair overhead ranges 11.2–18.8%; Flash
14.3–15.6%. Adjacent controls account for visible host/warm-up variation, without
discarding the first job. This is a small controlled observation, not a universal
long-video/encoder performance claim. No per-frame assets/decoders are introduced.
All ten jobs also pass duration/frame-count/audio/text-asset control assertions.
Evidence: `transition-source-9xabQZ`, `phase9-performance.json`,
`phase9-transition-performance.log`. These add 20 short performance MP4s to the
74 full matrix/native outputs; they are not counted as extra visual-matrix cases.

## Files changed / added

Changed: `app/page.tsx`; `lib/visual-style/normalize.mjs`, `templates.mjs`,
`types.ts`; `worker/server.mjs`, `worker/batch-queue.test.mjs`;
`scripts/qa-template-ui.mjs`, `scripts/qa-text-animations-offline.mjs`;
`docs/visual-style.md`, `docs/visual-templates.md`, `docs/text-animations.md`.

Added: `components/cut-transition-panel.tsx`; `lib/visual-style/cut-transitions.mjs`,
`cut-transitions.d.mts`; `lib/cut-transitions.test.mjs`;
`worker/cut-transition.mjs`, `worker/cut-transition.test.mjs`;
`scripts/qa-cut-transitions.mjs`, `scripts/qa-cut-transition-evidence.mjs`;
`docs/cut-transitions.md` and this report.

## Limits and safety

Fixed curated color ramps only; no duration/color controls, crossfade, overlapping
clips, audio transition, keyframe/timeline editor, masks, motion tracking, custom
logo/image/video uploads, animated overlays or new rendering subsystem. No
per-frame render assets/temporary full-video frame sequence or decoder per cut.
Very short neighbors can skip a transition as documented. Browser/export color
conversion, inherited CFR presentation and encoding quantization remain limits.
Native Windows/every encoder/menu-bar interaction are not qualified. The existing
yt-dlp health-probe behavior remains unchanged and out of scope.

All implementation changes stay in this DEV worktree. Main, original checkout,
`/Applications/ShortCut Studio.app`, production Application Support and ports
5173/8787 are untouched. No DEV installation, production credential/model access,
unrelated Homebrew change, merge, push, tag move or prior-phase rewrite. Historical
stable tag remains `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.
All owned QA/DEV listeners on 5273/8887/8897/8788 were stopped after qualification.
Stop after Phase 9; no Phase 10 work.
