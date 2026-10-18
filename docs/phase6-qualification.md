# Phase 6 qualification — curated static overlay engine

Isolated worktree `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`,
branch `feature/visual-preset-engine`, Node 22.23.3; Phase 5 base
`98b6c13d3c1e657ca3cf42de938cea18a7923605`. Engineering qualification is separate
from merge/install/release approval. Stop after Phase 6; no full-template phase.

## Delivered scope

Six choices: None, Grain, Vignette, Soft Glow, Film Frame, REC HUD. Normal blending
only. Per-descriptor 0–1 opacity, enablement and array ordering are implemented;
the UI selects one preset and exposes opacity. Internal multi-overlay composition
is tested without a layer-manager UI. See [overlays.md](overlays.md) for exact
schema/defaults, original asset recipes, layer order, security and extension points.

Five deterministic 1080×1920 RGBA PNGs total **580,472 bytes**. No downloads,
external runtime dependency, launch-time generation or user assets. Exact IDs,
filenames, dimensions, byte counts and SHA-256 hashes are committed in
[`public/overlays/manifest.json`](../public/overlays/manifest.json). Generator
reproduction and asset dimensions/alpha regions pass focused automated tests.
The registry/defaults are immutable; returned objects and snapshots are copies.

Background → filtered foreground → scene layers → existing combined title/part
indicator card → existing shine → subtitles. The existing grouped text order is
retained deliberately for None compatibility; scene decoration is below every
readable text role. Browser controls remain UI-only. No arbitrary z-index or
serialized placement is interpreted. Source filters never recolor the PNG assets.

The worker flattens scene PNGs once per job and places the existing title PNG over
them once per part, using the existing FFmpeg static-card input. There is no extra
FFmpeg decoder/input, graph reordering or per-frame Sharp generation. None, zero
opacity and disabled layers reuse the original title input and graph. Titles,
shine and subtitle PNGs remain independent for regression checks. Source and
packaged renderers resolve assets relative to their own trusted public directory.

## Objective render and preview evidence

The final source and packaged contact sets each contain **21 jobs / 42 MP4s**:
all six controls; zero Grain; half-opacity HUD; Vignette + Soft Glow; Current
background with None/Grain/Vignette; all six requested text/filter/background/
overlay combinations; HUD on Black with Vivid/Muted; and a warm None control.
Every output checks 1080×1920, 30 fps, 0.8 seconds, audio and Rec.709 metadata.
Static points are compared at output times 0.4 and 0.6 seconds (maximum permitted
channel drift 2). All original title/subtitle/shine PNGs remain identical for the
same text/part across overlay changes. All 21 source/package comparison hashes
and samples are identical. Zero Grain matches None exactly.

Control frames use a deterministic gray source with Vivid at 0% and Black
background, allowing direct asset-alpha/color/placement analysis without inherited
CSS source-blur edge differences. Additional Current/blur/gradient combinations
exercise the actual background policies. Expected normal composition is computed
from the committed RGBA asset and decoded None pixels, separately from the
worker's flattened scene image.

| Overlay | Export composite sample MAE / max | Browser/export sample MAE / max | Browser vs asset math MAE / max |
| --- | ---: | ---: | ---: |
| Grain | 0.147 / 0.280 | 0.147 / 0.280 | 0.142 / 0.480 |
| Vignette | 0 / 0 | 0 / 0 | 0 / 0 |
| Soft Glow | 0.148 / 1.000 | 0.185 / 1.000 | 0.111 / 1.000 |
| Film Frame | 0.096 / 1.000 | 0.141 / 1.000 | 0.044 / 0.600 |
| REC HUD | 0.070 / 0.960 | 0.070 / 0.960 | 0 / 0 |

HUD at 50% has browser/export sample MAE 0.071, max 1.560, and exact browser
asset-composition samples. None matches within floating-point epsilon. These
are 5×5 patch averages on known 1:1 canvas locations, not full-frame pixel identity.
The export assertions require MAE ≤1.5/max ≤3; browser/export ≤2/3; browser asset
math ≤1/2. They were not relaxed to pass a shifted capture.

The enlarged QA canvas excludes UI-only play controls and aligns its layout to
integer device pixels. An initial fractional capture added a pixel to screenshot
width; using a transform still antialiased a thin HUD edge. Layout offsets fixed
the measurement. The product UI/assets were unchanged. Initial failed capture
artifacts are retained and are not qualification passes.

Additional region checks (`phase6-objective-regions.json`):

- Grain measurably changes the central 680×300 region: MAE **4.762**, RMS **5.333**,
  changed-channel fraction **98.31%**. The texture is static, not animated.
- Vignette darkens edges more than center; the central sampled point remains
  within 2 levels of None. Current-background corner reduction is **20 luma levels**; video-edge
  reduction is **23 levels** and the sampled center delta is zero. Central-region MAE is 0.285 where the vignette starts to fade inward.
- Soft Glow increases target-region luminance by **9.136 levels**, with low
  bounded alpha and central-region MAE 2.043.
- Film Frame reduces tested edge luma by **57.237 levels**, while the tested central region is **exactly
  unchanged** (MAE 0).
- HUD changes the expected dot/corner locations; red dot increase exceeds 80
  levels. The unrelated tested central region is **exactly unchanged** (MAE 0).
  HUD marker samples remain identical under Vivid and Muted on Black.
- In all **16 active-scene cards**, every fully opaque original title/indicator
  pixel is unchanged in the flattened scene/text PNG. Independent text PNG hashes
  and layout/typography checks also pass; subtitles are composited afterward.

Browser interactions verify all six choices, opacity, checks/aria-pressed,
keyboard selection, source element/URL/load/time retention, running playback and
background synchronization, pointer-events disabled, correct scene z-index,
unchanged text, no automatic source/AI/caption/render requests, plan transitions,
and independent accepted render/batch snapshots. All assets load locally, with
no production/HTTPS requests or browser errors. Actual worker rendering is tested
separately; UI mutation endpoints are mocked.

## Snapshot and security coverage

All six requested combinations pass application independence tests, including
font override and manual subtitle settings. Overlay changes preserve text/filter/
background/foreground; changes to those sections preserve overlays. Actual worker
jobs retain their submitted style after caller mutation. A real deferred batch
queue test appends Vignette after Grain while preserving Yellow Hook + Vivid +
Dark Blur and confirms independent styles after caller mutation.

Tests reject unregistered asset IDs, paths/traversal/URLs/file URLs, unknown
preset/kind/blend/layer/scale/enablement, malformed containers and duplicate/overlong
IDs. Unsupported SVG/CSS/FFmpeg/z-index fields are dropped, never interpreted.
Finite opacity clamps; non-finite/non-number opacity falls back. Legacy Phase 2
reserved descriptors still normalize as before but reject at render validation.
No filesystem path can be supplied as a trusted asset source.

## Completed regression evidence

Paths below are relative to this worktree unless absolute. Ignored QA evidence
and the local bundle do not accompany a fresh clone.

| Check | Result / artifact |
| --- | --- |
| Full automated suite | 166/166 passed, zero failed/skipped; `.isolation-verification/phase6-tests.tap` |
| Separate isolation | 15/15 passed; `.isolation-verification/phase6-isolation.tap` |
| None vs Phase 5 | Compared decoded frames and title/subtitle PNGs exact; geometry/color/timing/environment overrides preserved; `.isolation-verification/visual-style-qa-kvG1ET` |
| Source overlays | 21 jobs / 42 outputs passed; `.isolation-verification/overlay-source-E48TKN` |
| Packaged overlays | 21 jobs / 42 outputs passed; `.isolation-verification/overlay-package-W6bByQ` |
| Overlay parity | All 21 hashes/samples exact; `.isolation-verification/phase6-overlay-parity.json` |
| Built overlay UI | All final assertions passed; `.isolation-verification/overlay-ui-umomvo` |
| Source/package text/font renders | 9/9 each; `.isolation-verification/text-source-fRHdE8`, `text-package-Skm8B5` |
| Text regression parity | All nine source/package results match Phase 5; `.isolation-verification/phase6-regression-parity.json` |
| Phase 4 filter renders | 12 cases / 24 outputs passed; `.isolation-verification/filter-source-YEE1Mg`; ten comparison frames/metrics exactly match Phase 5 |
| Phase 5 background renders | 15 cases / 30 outputs passed; `.isolation-verification/background-source-UCKvZU`; all 15 comparison frames exactly match Phase 5 |
| Built background UI | Passed; `.isolation-verification/background-ui-NIxKOk` |
| Built text UI stress | Existing checks + 40 cases passed; `.isolation-verification/text-ui-oJLuxu` |
| DEV package | Build/native audit and deep strict signing verification passed; `.isolation-verification/phase6-package.log` |
| Package freshness | 100 runtime/public files byte-identical, including all assets/manifest/modules; `phase6-regression-parity.json` |
| Actual bootstrap | `SHORTCUT_READY`, web HTTP 200, healthy DEV worker, only current DEV storage; `.isolation-verification/phase6-bootstrap.json` |
| Built Phase 4 filter UI | All preview/export, keyboard and snapshot checks passed; `.isolation-verification/filter-ui-5oiEfc` |
| Overlay UI through actual DEV bootstrap | All final assertions passed using packaged render controls; `.isolation-verification/overlay-ui-erPMWi` |
| Packaged native no-audio smoke | Grain + Vivid + Dark Blur and REC HUD + Muted + Black + News; two jobs/four outputs, VideoToolbox encoder confirmed, synthesized audio/subtitles/static checks passed; `.isolation-verification/overlay-package-Y7nJrY` |
| Lint / TypeScript / whitespace | `npm run lint`, `npx tsc --noEmit`, `git diff --check` passed; `phase6-lint.log`, `phase6-tsc.log` |

Native smoke uses the reproducible ignored derivative
`.isolation-verification/qa-overlay-native-smoke.mjs`. It deliberately removes
fixture audio and checks the actual reported VideoToolbox encoder. The complete
contact sets use CPU libx264 for deterministic comparison, not every encoder.

## Performance

`node scripts/qa-overlays.mjs --performance` repeats two interleaved sequences,
placing None before/after each overlay. Worker `finishedAt-startedAt` excludes
polling, PNG sampling and QA decoding. No other render suite ran concurrently.
Each job produces two 0.8-second 1080×1920 MP4s with the same subtitle fixture.
Evidence: `.isolation-verification/overlay-source-kEgMeV` and
`.isolation-verification/phase6-performance.json`.

| Preset | Mean job time | Adjacent None mean | Mean relative cost |
| --- | ---: | ---: | ---: |
| Grain | 4.350 s | 4.053 s | 1.073× |
| Vignette | 4.429 s | 3.698 s | 1.198× |
| Soft Glow | 3.983 s | 3.653 s | 1.090× |
| Film Frame | 3.840 s | 3.752 s | 1.023× |
| REC HUD | 3.840 s | 3.844 s | 0.999× |

The approximate observed overhead is 0–20%; differences near zero are timing
noise. Two repetitions on short synthetic CPU jobs are not a broad throughput
benchmark. Unlike the earlier concurrent contact timings, this uses interleaved
controls and backend timestamps. Flattening/PNG work is once per job/part, and
FFmpeg reuses its existing static card stream. There is no unbounded image
sequence, per-frame Sharp generation or extra stream/decoder. All buffers and
layer counts are bounded; process peak memory was not benchmarked.

## Changed/added files

Changed: `app/page.tsx`, `lib/visual-style/normalize.mjs`, `types.ts`,
`worker/server.mjs`, `worker/batch-queue.test.mjs`, `docs/visual-style.md`.

Added: `components/overlay-panel.tsx`; shared `overlays.mjs`, `overlays.d.mts`,
`overlay-presets.mjs`, `overlay-presets.d.mts` under `lib/visual-style/`;
`worker/scene-overlays.mjs`; `lib/overlays.test.mjs`;
`scripts/generate-overlay-assets.mjs`, `scripts/qa-overlays.mjs`,
`scripts/qa-overlay-ui.mjs`; five PNGs and manifest under `public/overlays/`;
`docs/overlays.md` and this report.

## Final editor regression and cleanup

The existing `scripts/qa-editor-renders.mjs` passed with the explicit DEV runtime
override, synthetic port 8788/data and default encoder. Source changes preserve
independent plans/title/hashtags; per-job cancel and FIFO yield four playable
1080×1920 outputs; subtitle burn-in/timing/safe zones, delete/restore/restart and
filename reset all passed. Evidence: `.isolation-verification/phase6-editor.log`,
fixtures `/private/tmp/shortcut-editor-qa-fyhquo`. An unrelated production render
was observed using CPU and left untouched. The original polling deadline was
sufficient; no extended-deadline rerun was needed.

All own QA/bootstrap processes/listeners were stopped after qualification.
The DEV app was not installed. Stable historical tag remains
`255a23cf2a1ae128066f2bbaa6e91daca998e6ea`. The separate Phase 6 commit is reported
in the final response; no earlier phase commit was amended or rewritten.

## Known limits and safety

Grain is static. No custom/logo/image/video upload, remote asset, GIF, animation,
transition, text animation, mask, keyframe, free transform, motion tracking or
multi-track timeline is implemented. Only normal blending and fixed full-canvas
static image kinds are supported. Schema extension points are not claims of
animated/custom rendering support. No full visual template phase was started.

No universal final-pixel parity, subjective quality for all media, OS network
sandbox, browser-restart preference persistence or every encoder/hardware claim.
Existing browser/FFmpeg source-blur and Current color/text approximations remain.
Windows assets/modules are structurally packaged by existing rules, but native
Windows launch/render qualification was not performed. Native macOS menu-bar
interaction was not tested. The existing yt-dlp cached probe issue is unchanged.

Only this isolated worktree and synthetic/DEV roots were used. Original checkout,
main, installed production app, production data/credentials/models and ports
5173/8787 were untouched. No install into /Applications, merge, push, tag move,
commit amendment, Homebrew repair or new dependency. DEV identity/config stays
ShortCut Studio Dev / local.datdo.shortcutstudio.dev, ports 5273/8887,
existingDataRoot null, separate DEV media and legacy lookup disabled.
