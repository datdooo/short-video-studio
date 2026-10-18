# Phase 7 qualification — full visual templates

Worktree: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch: `feature/visual-preset-engine`. Base: Phase 6
`9e69e14896fafa42bc15581e0c8ac1fb97b08704`. Node 22.23.3.
The initial worktree was clean, the phase history and implementation/qualification
documents were inspected, and the existing focused VisualStyle/preset suite passed
41/41 before changes. This qualification covers Phase 7 only.

## Delivered composition

One immutable, copy-safe local registry and canonical application/matching helpers;
eight accessible template cards above the existing Customize controls. The
registry schema is `{ id, label, description, category, textPresetId, fontId,
filterPresetId, backgroundPresetId, overlayPresetId }`. It stores existing stable
component IDs, without duplicated styling parameters or asset paths.

| Template ID | Text preset | Font ID | Filter | Background | Overlay |
| --- | --- | --- | --- | --- | --- |
| `current` | `current` | `auto` | `current` | `current` | `none` |
| `viral-shorts` | `shorts-bold` | `Roboto Condensed` | `vivid` | `dark-blur` | `grain` |
| `clean-tutorial` | `clean` | `Inter` | `clean` | `light-blur` | `none` |
| `farming-jp` | `jp-clean` | `Noto Sans JP` | `nature` | `dark-blur` | `vignette` |
| `korean-tutorial` | `kr-clean` | `Noto Sans KR` | `clean` | `dark-blur` | `none` |
| `news` | `news` | `Montserrat` | `contrast` | `dark-gradient` | `rec-hud` |
| `cinematic-dark` | `minimal` | `Inter` | `muted` | `dark-gradient` | `film-frame` |
| `bright-social` | `yellow-hook` | `Oswald` | `bright` | `soft-gradient` | `soft-glow` |

No component registry, renderer, FFmpeg composition, VisualStyle normalization
boundary or schema version changed. The only worker-file change is a batch test.
The editor delegates to existing Phase 3–6 application helpers and stores the
resulting normalized VisualStyle. There is no template metadata in jobs/plans.
Detailed architecture and precedence: [visual-templates.md](visual-templates.md).

Application starts from the canonical shipped canvas, applies text/font/filter/
background/overlay, and preserves normalized subtitle enabled/source. All subtitle
visual overrides reset to the recipe; cues/content/timing remain untouched. Every
explicit non-Current filter resets to 100%. Current restores the exact legacy
filter representation and Auto/Current/None composition. Reselecting a recipe
restores it after customization without changing content or subtitle operations.

Matching compares all normalized visual fields except `textPresetId` metadata and
subtitle enabled/source. Different font, text, intensity, background, overlay or
subtitle appearance yields Custom. Exact restoration rematches. Enabled/source-only
changes retain the match, including disabled subtitles. No stale selected ID is
stored. Old plans resolve from effective style without migration/history rewriting.

The subtitle settings callback also preserves timeline/caption references while
updating its normalized style/compatibility alias. This prevents visual subtitle
customization from triggering the existing timeline effect and seeking playback.
Template updates likewise preserve parts, cues, source and Custom Time state.

## Current compatibility

`node scripts/qa-visual-style.mjs --baseline 9e69e14 --current-template --slow-host`
passed. Current Full Template versus Phase 6 legacy Current/None has **exactly
identical decoded frames and title/subtitle PNGs**, 1080×1920, 30 fps, 2.4 seconds
per part. Geometry, background, filter, absent scene overlays, duration/timing and
environment overrides pass unchanged assertions. Evidence:
`.isolation-verification/visual-style-qa-ABlrYh` and
`phase7-current-baseline-final.log`.

An earlier run exceeded the original 90-second polling budget under heavy host
load. The rerun uses an explicit QA-only longer deadline; image/timing assertions
were not relaxed. The initial timeout is not qualification evidence.

## Template renders and language coverage

Source and DEV-package deterministic contact sets each pass **12 jobs / 24 MP4s**:
all eight recipes plus Viral Shorts in Japanese, Korean, French and German. The
eight-recipe set includes English, German/French, actual Japanese/Korean and mixed
Latin/Japanese/Korean text. Bundled font charset checks cover every non-whitespace
sample character through the existing fallback stacks, with seven local font/license
files verified. No missing sample glyphs, title clipping or foreground overlap;
subtitle bounds, 1080×1920 and 0.8-second edited durations pass.

Every accepted job receives the exact ordinary recipe VisualStyle and retains it
after caller mutation. All 12 source/package resolved recipes/styles, decoded
comparison-frame hashes and title PNG hashes are **identical**. The local contact
sheets were inspected: typography is readable, overlays/backgrounds are appropriate
and compositions distinct. Existing bounded filter recipes provide restrained
color changes; Cinematic uses Muted without an additional darkening stage. News
uses only the existing generic static REC marker, with no fabricated date/time.

Evidence: `.isolation-verification/template-source-xzsFaj`,
`template-package-UuQ73Q`, `phase7-template-parity.json`.
Contact sets use CPU libx264 for deterministic comparison.

An additional packaged `--native-smoke` run passes Viral Shorts and Farming JP
(two jobs / four MP4s) with silent input. Output audio is synthesized, titles and
subtitles stay safe, and each completed job reports **h264_videotoolbox**, rather
than merely checking the preferred encoder or accepting a silent CPU fallback.
Evidence: `.isolation-verification/template-package-C8KMWu` and
`phase7-template-native.log`. This exercises existing hardware output with ordinary
resolved template styles; it adds no encoder behavior.

## Browser and snapshots

Built UI and actual DEV-bootstrap UI each pass all eight selections and **64 stress
template switches**, interleaved with 32 Black-background Custom edits/reselections.
Additional checks cover Viral→Black, Farming JP→Grain, Korean→Auto, News→70%,
exact filter/font/intensity restoration, subtitle color override and operational
enable/disable/Whisper preservation. Every lower control remains usable and agrees
with the selected recipe. Native buttons expose names, `aria-pressed`, visible
checks/focus and keyboard Enter selection; Custom uses a labelled status.

All template/custom edits preserve video element identity, load count, source,
paused position (0.75 seconds), running playback and Custom Time values. Selection
alone issues no worker mutation: no re-upload, prepare, AI, caption request or
render. Source content/parts, captions and output settings are unchanged across
all eight explicit render submissions. Zero browser errors, external/production
requests or stale selected states were observed.

Independent accepted Viral/Farming editor styles survive later edits. Two batch
submissions/appends retain their respective complete styles. The real batch-queue
unit test also defers Viral, appends Farming and mutates callers before releasing
the queue; both jobs retain the correct independent styles. UI mutation endpoints
are mocked; actual worker renders are covered separately.

Evidence: `.isolation-verification/template-ui-Unoezo`, `template-ui-eHdYKw`.
Early harness attempts left a mocked job permanently queued or expected the initial
batch button after an active queue existed. Corrected mock lifecycle/button handling
passes; these were harness failures and required no product change.

## Completed regression evidence

Short artifact names in the table are under `.isolation-verification/` in this
worktree unless absolute. Ignored local evidence/bundle is not part of a fresh clone.

| Check | Result / evidence |
| --- | --- |
| Full Node suite | 174/174, zero failures/skips; `phase7-tests.tap` |
| Separate isolation | 15/15; `phase7-isolation.tap` |
| Phase 2/Current baseline | Exact all decoded frames and title/subtitle assets; `visual-style-qa-ABlrYh` |
| Phase 3 source/package | 9/9 each; `text-source-4jM9Cj`, `text-package-p0okWn`; all nine results exactly match Phase 6 |
| Phase 4 filters | 12 jobs / 24 outputs; `filter-source-CruOdC`; ten comparison hashes/samples exactly match Phase 6 |
| Phase 5 backgrounds | 15 jobs / 30 outputs; `background-source-iz6IY9`; all comparison hashes/samples exactly match Phase 6 |
| Phase 6 overlays | 21 jobs / 42 outputs; `overlay-source-WLSJ8n`; all comparison hashes/samples exactly match Phase 6 |
| Phase 7 source/package | 12 jobs / 24 outputs each; `template-source-xzsFaj`, `template-package-UuQ73Q`; all 12 results exact |
| Native packaged templates | Two jobs / four outputs, actual VideoToolbox and synthesized audio; `template-package-C8KMWu` |
| Built text stress | Existing interactions + 40 stress cases; `text-ui-8Gs5Ln` |
| Filter/browser parity | Passed; `filter-ui-VGWlEd` |
| Background/browser parity | Passed; `background-ui-P23pMX` |
| Overlay/browser parity | Passed through DEV bootstrap; `overlay-ui-cFJ4mf` |
| Template UI/stress | Passed built UI and actual DEV bootstrap; `template-ui-Unoezo`, `template-ui-eHdYKw` |
| DEV package build | Build/native audit completed; `phase7-package.log` |
| Package freshness | 102 copied runtime/public files byte-identical; `phase7-package-freshness.json` |
| Actual DEV bootstrap | `SHORTCUT_READY`, HTTP 200, healthy DEV worker/current-only storage; `phase7-bootstrap.json` |
| Editor / queue / cancel / restore / restart | Full existing regression passed using explicit DEV runtime; `phase7-editor.log`, `/private/tmp/shortcut-editor-qa-cidxUO` |
| Lint / TypeScript / whitespace | `npm run lint`, `npx tsc --noEmit`, `git diff --check` |

QA scripts include `qa-visual-templates.mjs` (source/package/offline local fonts and
real rendering), `qa-template-ui.mjs` (browser/state/snapshots), and an optional
`--current-template`/`--slow-host` mode on the existing baseline script. They add no
production runtime dependencies. Existing Phase 3–6 QA scripts remain unchanged.

The editor regression confirms independent titles/hashtags/timestamps while another
source prepares, per-job cancellation, FIFO, four playable 1080×1920 outputs,
one-time trim handling, subtitle burn-in/cue exclusion, recoverable deletion,
original preservation, restart/restore and filename reset. The interrupted initial
run had only partial evidence; the final uninterrupted rerun passed completely.
All owned QA/DEV web/worker listeners were stopped afterward. The local bundle was
not installed. Deep strict code-signature verification and DEV bundle identity/
config checks pass. The stable historical tag still resolves to
`255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.

## Files and limits

Added: `lib/visual-style/templates.mjs`/`templates.d.mts`,
`components/visual-template-panel.tsx`, `lib/templates.test.mjs`,
`scripts/qa-visual-templates.mjs`, `scripts/qa-template-ui.mjs`,
`docs/visual-templates.md` and this report.
Changed: `app/page.tsx`, `worker/batch-queue.test.mjs`,
`scripts/qa-visual-style.mjs`, `docs/visual-style.md`.

Matching is deliberately conservative exact normalized configuration matching,
not general perceptual equivalence. Card thumbnails are lightweight illustrations;
the main preview is authoritative. Existing browser/FFmpeg blur and text/color
approximations remain. Synthetic sample coverage is not a guarantee for every
possible language/text/media. Native Windows launch, every encoder, OS network
sandbox and native menu-bar interaction are not qualified. Existing browser-restart
preference behavior is unchanged. The yt-dlp health-probe issue was not modified.

There is **no new rendering subsystem**. No custom logo/image uploads, video/GIF
overlays, animation, transition, keyframe, mask, tracking, LUT, HSL/curves, arbitrary
visual parameters, multi-track timeline, template import/download/marketplace or AI
template generation was added. No Phase 6.5 or Phase 8 work.

Only this isolated DEV worktree, its ignored QA fixtures, private synthetic editor
fixtures and the existing DEV runtime storage were used. Production/original
checkout, main, installed `/Applications/ShortCut Studio.app`, production data,
credentials/models and ports 5173/8787 were untouched. No DEV install, Homebrew
modification, merge, push, tag move, amend/reset or earlier-phase rewrite.
