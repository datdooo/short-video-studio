# Phase 5 qualification — curated backgrounds

Worktree `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`, branch
`feature/visual-preset-engine`, Node 22.23.3. Phase 4 base: `fb351e5`.
This document records engineering qualification, not installation/merge approval.
Stop after backgrounds; Phase 6 is outside this task.

## Delivered model and rendering

[backgrounds.md](backgrounds.md) records the complete schema, exact numeric values,
IDs, normalization and browser/worker mappings. Six backgrounds are implemented:
Current, Dark Blur, Light Blur, Black, Soft Gradient, Dark Gradient. Version is
still 1; Current's legacy JSON remains unchanged. New IDs live only inside
`VisualStyle.background`. No free-form gradients, blur slider or brightness
control are exposed. Render validation requires an exact curated recipe.

Source-blur presets retain the existing optimized 270×480 boxblur 12:2 pipeline,
with opacity 0.5/0.3/0.7 over black. Source video is filtered before splitting;
foreground/background share the source timeline. Black is a native synthetic
color source. Two safe vertical sRGB gradients use one generated 1080×1920 PNG
per job, shared by all parts/frames. Static backgrounds bypass video grading;
the foreground retains its Phase 4 treatment. Text rendering, foreground geometry,
1080×1920/30 fps, 1.25× speed, audio, Rec.709 metadata and encoding/queue policy
remain in the existing compositor. No external runtime dependency was added.

The compact native-button UI includes actual gradient samples, selected check,
`aria-pressed` and keyboard activation. Source elements stay mounted, including
the transparent background video behind synthetic backgrounds. Appearance edits
retain timeline references. Qualification exposed effective timing depending on
the whole plan; it now depends on parts/provider/times/duration, so appearance
changes do not seek/pause playback. `applyPartTimes`' declaration now accepts the
minimal timing input generically; its runtime algorithm is unchanged. Submission
snapshots still clone complete plans independently.

## Objective methodology and limits

All render media is synthetic. Source/package QA uses private data/HOME,
legacy lookup disabled, bundled-only fontconfig and a worker preload blocking
fetch. This is not an OS network sandbox. UI mutations are mocked at DEV worker
port 8887; real renders are separately tested with source/packaged workers.

Background QA renders all six presets plus neutral/filter interactions and all
five requested text/filter/background combinations: **15 jobs, 30 MP4 outputs**
per runtime. Every output checks 1080×1920, 30 fps, 0.8 seconds, audio and Rec.709.
Title/subtitle/shine PNG hashes remain identical for corresponding text/part
across background/filter changes. Real jobs retain styles after caller mutation.

A deterministic color-patch source becomes brighter in its second second.
Current + Vivid verifies both foreground and background brighten in part 2,
proving source-time tracking across the two cuts. Source Dark/Current/Light
uncovered RGB means are **38.315 / 64.845 / 89.752**, respectively. These are mean
RGB values, not physical luminance. Measured 10–90% gray-edge transitions are
**120 / 120 / 100 px** for Current/Dark/Light at the sampled row; the assertion
requires 80–140 px, distinguishing the retained strong blur from a sharp or
materially broader edge. The working blur is unchanged for every source preset.

Black's uncovered samples are **exactly RGB 0**. Both gradient exports differ
from shared pixel-center sRGB values by at most **1 channel level** on the tested
points. Samples span left/right and top/bottom uncovered regions; the generated
asset and CSS cover the full canvas. No seams were observed in contact sheets.
Static samples remain unchanged across Vivid 0/100% and Soft Gradient + Muted;
foreground samples change. Current's source-background samples change with Vivid.

The initial default FFmpeg PNG extraction introduced a dark RGB bias even for
an isolated gradient encode. Explicit accurate Rec.709 extraction
`scale=in_color_matrix=bt709:flags=accurate_rnd+full_chroma_int` removed that
avoidable measurement bias. This changes QA decoding only, not product output.
The first failed attempt is retained in ignored evidence; it is not a pass.

Browser QA compares actual native video/CSS screenshots against decoded exports,
checks foreground geometry, gradient stops, relative brightness, blur class,
filter independence, no media reloads/seeks, running playback, keyboard controls,
no automatic source/AI/caption/render requests, plan transitions, and independent
accepted editor/batch snapshots. CSS gradient dithering can vary a channel by
one level between captures; that explicit bound is used for static filter
independence, rather than requiring identical dither placement.

The existing CSS source blur fades at canvas edges differently from FFmpeg's
cropped/downsampled box blur, and native decoding differs. Initial passing source
capture raw blur-background MAE was **14.548 Current, 8.129 Dark, 19.323 Light**,
with maximum sampled channel errors **27.714 / 16.184 / 38.735**. This pre-existing
approximation is preserved intentionally for Current; these are not close pixel
parity claims. Relative brightness and strong blur class are assessed separately.
Static gradients had raw MAE **0.405 Soft / 0.678 Dark**, maximum **1.020 / 1.306**;
CSS versus shared stop math maximum **0.592 / 0.531**, and Black error zero.
The final built run reproduces these color measurements. Browser blur widths
are **98 / 128 / 99 px** for Current/Dark/Light, within the same strong-blur
class as export. The small preview border/legacy scale convention is retained;
foreground geometry checks account for it. Artifact paths are recorded below.

No universal pixel parity, subjective quality for every real clip, HDR/linear
light processing, browser-restart preference storage, Windows package, native
menu interaction, or every encoder/hardware combination is claimed. Existing
`yt-dlp` cached probe timeout remains out of scope and unchanged.

## Combination and snapshot coverage

Focused tests cover Shorts Bold + Vivid + Current; Yellow Hook + Nature + Dark
Blur; JP Clean + Clean + Light Blur; KR Clean + Muted + Black; News + Contrast +
Soft Gradient. Applying any layer preserves the other two, including font
changes. Background application preserves foreground and reserved overlays.
Registry/defaults are immutable; getters/application/snapshots return copies.
Invalid IDs/modes/containers/gradients reject, non-finite numbers fall back,
legacy bounds clamp, unknown expressions disappear, and custom recipe rendering
rejects. Appended real batch-queue submissions retain independent Soft Gradient
and Black backgrounds together with News + Contrast after caller mutation.

## Final evidence

Artifact paths below are relative to this worktree unless absolute. Ignored
artifacts and the local DEV bundle do not accompany a fresh clone.

| Check | Result / evidence |
| --- | --- |
| Pre-edit focused suite | 31/31 passed |
| Final full suite | 160/160 passed, zero failed/skipped; `.isolation-verification/phase5-tests.tap` |
| Separate isolation suite | 15/15 passed; `.isolation-verification/phase5-isolation.tap` |
| Lint / TypeScript / whitespace | Passed; `phase5-lint.log`, `phase5-tsc.log` under `.isolation-verification`; `git diff --check` |
| Current vs Phase 4 | Exact compared decoded frames, title/subtitle PNGs, geometry/timing/color, environment overrides; `.isolation-verification/visual-style-qa-zWN1vx` |
| Phase 4 filter render regression | 12 cases, 24 MP4s; `.isolation-verification/filter-source-C6xCmp`; all ten recorded frames/metrics equal Phase 4, `phase5-filter-regression.json` |
| Source backgrounds | 15 cases / 30 outputs passed; `.isolation-verification/background-source-vDog9C` |
| Packaged backgrounds | 15 cases / 30 outputs passed; `.isolation-verification/background-package-0vSt21` |
| Source/package parity | All 15 frame hashes, samples, temporal metrics and blur measurements identical; `.isolation-verification/phase5-package-parity.json` |
| Source background UI | Passed; `.isolation-verification/background-ui-kp7x0a` (before final extra geometry/blur/running-playback assertions) |
| Final built background UI | All final assertions passed; `.isolation-verification/background-ui-S1wZO0` |
| Built Phase 4 filter UI | All preview/export, independence, keyboard and snapshot checks passed; `.isolation-verification/filter-ui-rbT78w` |
| Source Phase 3 text/font renders | 9/9 passed; `.isolation-verification/text-source-RwSdwM` |
| Source Phase 3 UI stress | Existing checks + 40 cases passed; `.isolation-verification/text-ui-b7ehqJ` |
| DEV package | Build/native audit/deep strict signature verification passed; `.isolation-verification/phase5-package.log` |
| Package freshness | 89 runtime/public files byte-identical to final source; `phase5-package-parity.json` |

| Packaged Phase 3 text/font renders | 9/9 passed; `.isolation-verification/text-package-fUFPLs` |
| Phase 3 parity | All nine result objects/title hashes match source/package and Phase 4; `.isolation-verification/phase5-text-parity.json` |
| Final built Phase 3 UI stress | Existing checks + 40 cases passed; `.isolation-verification/text-ui-Z8O1b4` |
| Packaged native no-audio smoke | Black/Soft Gradient + Vivid + Yellow Hook + subtitles, two jobs/four outputs; Apple VideoToolbox confirmed, synthesized audio, 1080×1920/Rec.709; `.isolation-verification/background-package-RsTufF` |
| Actual DEV bootstrap | `SHORTCUT_READY`, web HTTP 200, healthy worker, only DEV current storage; `.isolation-verification/phase5-bootstrap.json` and `phase5-bootstrap.log` |
| UI through actual bootstrap | All final background assertions passed against packaged render fixtures; `.isolation-verification/background-ui-2gf9RD` |

The native no-audio smoke is a reproducible ignored local derivative of the
background QA script (`.isolation-verification/qa-background-native-smoke.mjs`),
not a new shipped feature or dependency. It explicitly selects VideoToolbox,
removes fixture audio and verifies the actual reported encoder. The full static
parity set uses CPU libx264 for deterministic hashes.

Source/package contact sheets and browser controls were visually inspected.
One initial editor regression attempt exceeded its fixed 180-second polling
budget while the baseline and packaged render sets ran concurrently. That run
is retained as a failed attempt (`phase5-editor.log`), not qualification evidence.
The isolated rerun passed with the existing default encoder: source changes,
independent plans, FIFO/cancel, four playable 1080×1920 outputs, audio/timing,
subtitle burn-in and safe zones, delete/restore/restart and naming reset.
Evidence: `.isolation-verification/phase5-editor-final.log`, fixtures
`/private/tmp/shortcut-editor-qa-XVKwq6`. The DEV runtime override was explicitly
set; installed production tools were never used.

All own QA/bootstrap processes and listeners were stopped after qualification.
Info.plist/config and deep/strict signing were rechecked. The stable historical
tag remains `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`. The separate Phase 5 commit
is reported in the final response; no earlier commit was rewritten.

## Files changed and added

Changed: `app/page.tsx` (background UI/layer, timeline-stable style edits),
`lib/custom-time.d.mts` (minimal generic timing input, no runtime change),
`lib/visual-style/defaults.mjs`, `normalize.mjs`, `types.ts` (shared constrained
background schema/boundary), `worker/server.mjs` (source/synthetic composition,
once-per-job gradient), `worker/batch-queue.test.mjs` (appended snapshots), and
`docs/visual-style.md`.

Added: `components/background-panel.tsx`; `lib/visual-style/backgrounds.mjs`,
`backgrounds.d.mts`, `background-presets.mjs`, `background-presets.d.mts`;
`lib/backgrounds.test.mjs`; `scripts/qa-backgrounds.mjs`,
`scripts/qa-background-ui.mjs`; `docs/backgrounds.md` and this report.

## Scope and safety

Only this DEV checkout and synthetic/DEV data roots were used. Original checkout,
`main`, installed `/Applications/ShortCut Studio.app`, production data,
credentials/models and ports 5173/8787 were untouched. No installation, merge,
push, tag move, commit amendment, Homebrew repair or new dependency occurred.
DEV remains `ShortCut Studio Dev`, `local.datdo.shortcutstudio.dev`, ports
5273/8887, `existingDataRoot:null`, separate DEV media, legacy lookup disabled.

No overlay, grain, texture, light leak, sticker, upload, transition, animation,
mask, keyframe or timeline editor system was added. Existing text shine is
unchanged. Phase 6 must not start as part of this task.
