# Phase 4 qualification — curated video filters

Qualified on 2026-10-16, branch `feature/visual-preset-engine`, isolated worktree
`/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`, Node 22.23.3.
Phase 3 base is `8e813ba`. The Phase 4 commit follows it without amending any
checkpoint. This is engineering qualification, not merge/install/release approval.
**Stop after Phase 4. Phase 5 has not started.**

## Delivered behavior and exact schema

Eight presets, a compact native-button/swatch selector, real video preview,
FFmpeg export, optional strength and independent plan/job/batch snapshots are
implemented. Filter application changes only `VisualStyle.filter`; text/font
application preserves it. No new external runtime dependency is required.

Schema version remains 1. Current/missing/old filter objects keep exactly:

```json
{ "contrast": 1.04, "saturation": 1.06 }
```

Explicit new filters normalize to:

```ts
{
  presetId: "clean" | "vivid" | "nature" | "soft" | "contrast" | "bright" | "muted";
  brightness: number; // additive encoded RGB, clamped -0.08..0.08
  contrast: number;   // clamped 0.8..1.3
  saturation: number;// clamped 0.8..1.4
  intensity: number;  // clamped 0..1
}
```

Non-finite/non-number values fall back to the selected recipe; invalid IDs and
non-JSON containers reject. Unknown fields are discarded. Legacy objects without
an ID continue ignoring all fields other than contrast/saturation. Explicit
Current cannot request changed brightness/strength, and changed legacy
contrast/saturation still reject at render validation as before. No expressions,
CSS, file paths, temperature or tint enter serialized filter data.

| Preset ID | Brightness | Contrast | Saturation | Full strength |
| --- | ---: | ---: | ---: | ---: |
| current | 0 | 1.04 | 1.06 | Fixed legacy treatment |
| clean | 0.005 | 1.02 | 1.02 | 1 |
| vivid | 0.005 | 1.08 | 1.16 | 1 |
| nature | 0.010 | 1.04 | 1.12 | 1 |
| soft | 0.015 | 0.94 | 0.94 | 1 |
| contrast | 0 | 1.14 | 1.02 | 1 |
| bright | 0.035 | 0.98 | 1.03 | 1 |
| muted | 0.005 | 1.02 | 0.86 | 1 |

Warm/Cool are omitted to avoid implying temperature support. Bright and Muted
are original alternative recipes. Nature affects general saturation, not HSL.

Strength is implemented for new presets: `b = brightness*t`,
`c = 1+(contrast-1)*t`, `s = 1+(saturation-1)*t`. At 0%, color contribution is
identity RGB; at 100%, the full recipe applies. A new selection resets strength
to 100%. Current's slider is disabled and its legacy treatment stays fixed.

## Rendering, scope and precedence

The shared affine matrix uses weights `[0.2126, 0.7152, 0.0722]`, color terms
`c*((row===column?s:0)+(1-s)*weight[column])`, and offset `(1-c)/2+b`.
The browser uses a local SVG `feColorMatrix` with explicit sRGB interpolation,
referenced only by the two existing source-video elements. No per-frame JS,
extra thumbnail video decoders or remote images are used.

FFmpeg generates fixed numeric `colorchannelmixer` options on RGBA video, retains
RGB through the existing overlays/compositor, then explicitly converts to
limited-range Rec.709 YUV. This new-preset-only mapping avoids unnecessary YUV
round trips discovered during parity QA. Current retains its old `eq` graph and
CSS contrast/saturate approximation unchanged.

Treatment applies to **both foreground and source-derived blurred background**,
before text is composed. Existing geometry, blur, black backing/50% opacity,
1080×1920 output, playback rate, audio, encoder selection and Rec.709 metadata
remain. The text/shine/subtitle source PNGs remain identical across filters.

Current precedence: existing `FFMPEG_CONTRAST`/`FFMPEG_SATURATION` coercion,
finite fallback and clamping override legacy defaults. The browser reads the
same effective values from health. New explicit presets use normalized stored
values/intensity and ignore machine grade overrides. Source/package QA proves
Vivid remains byte-identical under 1.19/0.87 overrides while Current changes.

## Objective evidence

The static synthetic patch fixture uses 24 interior patch centers with 7×7
averaging. All statistics below use 8-bit RGB units and the deterministic CPU
export, not full-frame perceptual quality scores. Gray contrast is standard
deviation over six grayscale patches; chroma is average RGB max-minus-min over
colored patches. Source and packaged results matched exactly.

| Preset at 100% | Export luma | Gray contrast | Chroma | Raw preview/export MAE | Browser matrix MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| current | 115.607 | 48.070 | 65.944 | 7.375 | Legacy path |
| clean | 120.700 | 46.885 | 64.500 | 3.847 | 0.234 |
| vivid | 119.988 | 50.258 | 77.833 | 4.431 | 0.280 |
| nature | 120.971 | 48.214 | 71.833 | 4.444 | 0.240 |
| soft | 122.879 | 43.332 | 54.056 | 4.000 | 0.227 |
| contrast | 118.358 | 52.401 | 72.111 | 4.278 | 0.210 |
| bright | 127.784 | 45.297 | 62.389 | 4.375 | 0.258 |
| muted | 120.596 | 46.999 | 54.611 | 3.708 | 0.265 |

Neutral (Vivid 0%): luma 119.171, gray contrast 46.045, chroma 61.722;
raw native-browser/export MAE **4.125**, maximum patch-channel difference 14.
Vivid 50%: luma 120.022, gray contrast 47.922, chroma 69.778; raw MAE 4.000,
browser matrix MAE 0.243.

For new presets, browser treatment matches the shared matrix with average error
**0.210–0.280**, maximum single-channel residual **under 0.500**. Export matrix
MAE is **0.767–1.076** at 100% (1.054 at 50%). Raw new-preset preview/export MAE
is **3.708–4.444**, maximum patch-channel difference 15. Brightness, grayscale
contrast and chroma directions agree between actual preview and decoded export
for all meaningful measured changes.

The neutral control showed a native video decoder/color-management discrepancy
before any filter was applied, also reproduced with a standalone unfiltered video.
QA therefore measures that input error separately, verifies each renderer's own
matrix contribution, and bounds raw differences by propagated neutral error,
measured export conversion/encoding residual and browser quantization. It does
not hide raw differences or claim general pixel equality. Early QA also exposed
an avoidable RGB/YUV round trip, which was fixed in the new preset path. Enlarged
capture uses only QA layout changes; the product preview remains compact.

Current regression against Phase 3 (`8e813ba`): **all compared decoded frame
hashes and title/subtitle PNGs identical**, 1080×1920, 30 fps, 2.4 seconds/part,
including environment override/fallback checks. Thus the retained Current
browser/export approximation is pre-existing, not a Phase 4 baseline regression.

## Snapshot, performance and text evidence

- Unit combinations cover Yellow Hook + Current/Vivid, JP Clean + Nature and
  KR Clean + Soft, including font overrides and manual subtitle settings.
  Filters preserve all other normalized sections; applying text preserves filter.
- Real source/packaged worker jobs retain submitted styles after caller mutation.
  All title, subtitle and shine PNG hashes remain identical for corresponding
  parts across twelve filter/strength/environment cases.
- Actual source and built browser UIs submit Vivid at 50% with Yellow Hook;
  later Nature/JP and Soft/KR edits do not mutate accepted queued snapshots.
- Mocked UI batch submission carries Soft + KR Clean; a later Bright selection
  leaves its accepted snapshot unchanged. The real batch queue unit test also
  defers preparation, appends Nature after Vivid 50%, mutates caller state and
  verifies independent styles, strengths and unchanged text.
- Native video object/source and metadata-load count remain unchanged across
  selection/strength changes. No preparation, AI/caption or render mutations
  occur until the explicit render/batch actions. Keyboard and plan-transition
  retention checks passed. Persistence is editor-memory state, not a new global
  browser-restart preference.

## Final test and package record

All paths below are relative to this worktree unless absolute. Ignored evidence
and the local bundle are preserved but do not accompany a clean clone.

| Check | Result / artifact |
| --- | --- |
| Pre-edit VisualStyle/font/text tests | 23/23 passed |
| Full suite | **154/154 passed**, zero failed/skipped; `.isolation-verification/phase4-tests.tap` |
| Separate isolation suite | **15/15 passed**; `.isolation-verification/phase4-isolation.tap` |
| Lint / TypeScript / whitespace | `npm run lint`, `npx tsc --noEmit`, `git diff --check` passed |
| Current/Phase 3 baseline | `.isolation-verification/visual-style-qa-CS5odf` |
| Source filter render QA | **12/12 cases**, 24 MP4 outputs; `.isolation-verification/filter-source-AH1g3d` |
| Packaged filter render QA | **12/12 cases**, packaged Node/FFmpeg/worker; `.isolation-verification/filter-package-w5GnHA` |
| Packaged default encoder smoke | Vivid + Yellow Hook passed on **Apple VideoToolbox**, two 1080×1920 Rec.709 outputs, 0.8 s/part; `.isolation-verification/filter-default-Kb9vrk` |
| Source/package filter parity | Ten recorded comparison frames, hashes/statistics identical; `.isolation-verification/phase4-filter-parity.json` |
| Source filter UI/parity/batch | Passed; `.isolation-verification/filter-ui-6Y3moa` |
| Built filter UI/parity/batch | Passed; `.isolation-verification/filter-ui-Wc5xR8` |
| Phase 3 text/font renders | **9/9 source + 9/9 packaged**; `text-source-a0Vydp`, `text-package-vzDV8J` under `.isolation-verification` |
| Phase 3 text output parity | All nine results/title hashes match Phase 3 and source/package; `.isolation-verification/phase4-text-parity.json` |
| Phase 3 browser regression | Existing checks + **40 stress cases each**; `.isolation-verification/text-ui-rcPbpo` (source), `.isolation-verification/text-ui-uiorRO` (built) |
| Existing editor render QA | Source changes, independent plans, FIFO/cancel, four playable outputs/timing/subtitles, delete/restore/restart, filename reset passed; `/private/tmp/shortcut-editor-qa-CwHq3i` |
| DEV package build | Native audit and deep/strict signing verification passed; `.isolation-verification/phase4-package.log` |
| Package freshness | **85 runtime/public files byte-identical** to final source, including font files/licenses and filter modules |
| Packaged bootstrap | `SHORTCUT_READY`, web HTTP 200, healthy worker, only DEV storage; `.isolation-verification/phase4-bootstrap.json` |

Contact sheets and actual source/built preview/control captures were visually
inspected. Synthetic results prove distinct, correctly applied restrained recipes;
they do not prove subjective quality for every real clip.

Package: `release/dev/ShortCut Studio Dev.app`. It was not installed. Info.plist
uses `ShortCut Studio Dev` / `local.datdo.shortcutstudio.dev`; config is development,
ports 5273/8887, `existingDataRoot: null`. Bootstrap health reports the separate
`~/Library/Application Support/ShortCut Studio Dev/media` root; storage exposes
only `current`. Render QA uses private synthetic data/HOME/fontconfig, legacy
lookup disabled and blocked worker fetch. Browser worker mutations are mocked;
packaged worker rendering is separately exercised with its own runtime and
private data. Editor QA explicitly uses the DEV runtime on its synthetic port
8788. Filter QA optionally uses isolated 8897; production ports are never used.
All test processes/listeners were stopped after qualification.

## Files changed and added

Changed:

- `app/page.tsx` — video-only preview adapter and independent filter callbacks.
- `lib/visual-style/defaults.mjs` — reuse canonical legacy filter defaults.
- `lib/visual-style/normalize.mjs` — normalize/validate implemented filters.
- `lib/visual-style/types.ts` — backward-compatible filter type extension.
- `worker/server.mjs` — shared grade/environment adapter and new-preset RGB path.
- `worker/batch-queue.test.mjs` — independent appended filter/strength snapshots.
- `eslint.config.mjs` — ignore generated `.isolation-verification` evidence;
  lint otherwise raced a temporary unpacked runtime file that disappeared.
- `docs/visual-style.md` — link Phase 4 extensions while retaining Phase 2 history.

Added:

- `lib/visual-style/filters.mjs`, `filters.d.mts` — registry, types, validation,
  environment compatibility, interpolation and shared renderer math.
- `lib/visual-style/filter-presets.mjs`, `filter-presets.d.mts` — composition helpers.
- `components/video-filter-panel.tsx` — compact swatches, selected check, slider,
  local matrix definitions; no advanced panel.
- `lib/filters.test.mjs` — focused normalization/composition/compatibility/math tests.
- `scripts/qa-video-filters.mjs` — real synthetic source/package render qualification.
- `scripts/qa-video-filter-ui.mjs` — native preview/export, interaction/batch QA.
- `docs/video-filters.md` and this report.

## Limits and safety

- Current intentionally retains historical CSS/YUV color and text approximations.
  The exact regression claim is limited to the tested deterministic CPU fixture.
- Native browser decoding/color management and lossy encoding differ. Raw
  statistics are disclosed above; universal pixel equality is not claimed.
- Foreground color patches establish measured parity; background retains its
  existing browser/export blur approximation. No full-frame blur pixel parity,
  HDR/linear-light workflow, or subjective creative quality is claimed.
- macOS packaged bootstrap/frontend/worker were tested. Native menu-bar UI
  interactions, Windows packaging and every encoder/hardware combination were
  not qualified here. No network downloads, real-user media or AI services were
  exercised. Worker fetch blocking is not an OS network sandbox.
- The Phase 3 `yt-dlp` health-probe timeout remains out of scope and unchanged.
- No overlays/assets, background variants, transitions, text animations, masks,
  LUT import, HSL, curves, keyframes or blend-mode system were added. Existing
  compositor overlays merely use RGB output internally for the new grade path.
- Work stayed in this DEV checkout and synthetic/DEV roots. Original checkout,
  `main`, installed `/Applications/ShortCut Studio.app`, production Application
  Support data, credentials/models, and production ports 5173/8787 were untouched.
  No Homebrew repair, install, merge, push, tag move or commit rewrite occurred.

The stable historical tag remains `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.
The separate Phase 4 commit is reported in the final response. Phase 5 must not
start as part of this task.
