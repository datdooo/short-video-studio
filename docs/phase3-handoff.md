# Phase 3 WIP handoff — text presets and offline fonts

**Historical checkpoint, now superseded.** Phase 3 was resumed on 2026-10-16
from the remaining tasks below. Final status and evidence are recorded in
[`phase3-qualification.md`](phase3-qualification.md). The checkpoint details and
earlier test results remain below for provenance. The final work adds a scoped
measured-title-width guard and qualification coverage; it does not replace the
font/preset/UI implementation checkpointed here. Phase 4 still requires explicit
user acceptance and authorization to continue.

Checkpoint date: 2026-10-16. **WIP, not final Phase 3 qualification.** The user stopped implementation to preserve the remaining Codex budget. No more fixes, refactors, builds or render QA were started after that instruction. Only inspection, fast checks, this handoff and a WIP commit were authorized at checkpoint time.

**Phase 4 MUST NOT start before Phase 3 is fully qualified and explicitly accepted for continuation.** Do not treat this WIP checkpoint as a release or merge approval.

## Repository, commits and immutable resources

- Worktree: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`
- Branch: `feature/visual-preset-engine`
- HEAD immediately before this WIP checkpoint: `6e6695cb956d5ba7156ced552fdb25092dbd7f7e` (`feat(fonts): add curated offline font registry`). The font portion of Phase 3 is already committed there; remaining text/UI work is in the subsequent WIP commit containing this document.
- Phase 2: `6755f7f79dd78b6d700d39ab44781789bb85da49`
- Phase 1: `ba82f951fbade4289597fbb3163c6f13cad7ff8c`
- Stable tag: `stable-v1.1.0-before-visual-editor` -> `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`; do not move it.
- Never touch `main`, amend/rewrite the earlier commits, or edit the original checkout `/Users/datdo/Documents/tiktok-edit/short-video-studio`.
- Never change, rebuild in place, install over, launch for testing, resign or stop `/Applications/ShortCut Studio.app`.
- Never read/use/migrate production media, history, cache, OAuth or models from `/Users/datdo/Library/Application Support/ShortCut Studio/`. Preserve any unrelated external changes in production/original paths; do not attempt repairs.
- Every Node/npm command needs `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. Node 26 is unrelated and broken; do not repair it.
- DEV identity: `ShortCut Studio Dev`, bundle ID `local.datdo.shortcutstudio.dev`.
- DEV web `http://127.0.0.1:5273`; worker `http://127.0.0.1:8887/health`.
- DEV data `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`, `MEDIA_WORKER_DISABLE_LEGACY=1`. Synthetic QA instead uses private temporary data roots.
- DEV commands remain `npm run personal:dev-isolated` and `npm run package:mac:dev`. Only package output is `release/dev/ShortCut Studio Dev.app`; never install it. Production ports 5173/8787 were not used by DEV QA.

## Phase 3 file inventory at the checkpoint

Relative to Phase 2, including the committed font layer, WIP files and this handoff:

```text
app/globals.css
app/layout.tsx
app/page.tsx
components/text-style-panel.tsx
docs/fonts.md
docs/phase3-handoff.md
docs/text-styles.md
docs/visual-style.md
lib/fonts.test.mjs
lib/render-spec.ts
lib/subtitles.d.mts
lib/subtitles.mjs
lib/text-presets.test.mjs
lib/visual-style.test.mjs
lib/visual-style/effects.d.mts
lib/visual-style/effects.mjs
lib/visual-style/fonts.d.mts
lib/visual-style/fonts.mjs
lib/visual-style/normalize.mjs
lib/visual-style/text-presets-data.d.mts
lib/visual-style/text-presets-data.mjs
lib/visual-style/text-presets.d.mts
lib/visual-style/text-presets.mjs
lib/visual-style/text-render.d.mts
lib/visual-style/text-render.mjs
lib/visual-style/types.ts
public/Inter-OFL.txt
public/Inter-Variable.ttf
public/Oswald-OFL.txt
public/Oswald-Variable.ttf
public/RobotoCondensed-OFL.txt
public/RobotoCondensed-Variable.ttf
public/font-sources.json
scripts/qa-text-presets.mjs
scripts/qa-text-style-ui.mjs
worker/batch-queue.test.mjs
worker/server.mjs
```

No package/runtime configuration changes are part of Phase 3. Existing packagers copy public assets and the shared runtime modules. No unrelated source changes were found during the checkpoint diff review. QA artifacts and the built DEV bundle are ignored local files, not part of this commit.

## Architecture implemented so far

### Canonical font registry and bundled assets

`lib/visual-style/fonts.mjs` is shared by preview, subtitles and worker. It defines stable IDs, family/file/license metadata, supported scripts/weights, UI groups, script-aware fallbacks, CSS font-face generation, safe ID normalization and weight resolution. `.d.mts` supplies TypeScript declarations. Registry/default data is immutable and callers receive copies.

Eight choices (seven concrete font files):

| ID | Asset/source | Weights |
| --- | --- | --- |
| `auto` | Existing script-aware Noto choice | 400–900 |
| `Noto Sans` | Previously bundled Latin family | 400–900 |
| `Noto Sans JP` | Previously bundled Japanese family | 400–900 |
| `Noto Sans KR` | Previously bundled Korean family | 400–900 |
| `Montserrat` | Previously bundled Latin family | 400–900 |
| `Inter` | New upright variable TTF, version 4.001 | 400–900 |
| `Roboto Condensed` | New upright variable TTF, version 3.008 | 400–900 |
| `Oswald` | New upright variable TTF, version 4.103 | 400–700 |

Legacy font-name IDs are retained for persisted subtitle compatibility. Unknown font IDs become `auto`; arbitrary CSS/paths are not accepted. Weights resolve to nearest supported values. Latin display choices keep script-aware bundled JP/KR fallbacks, including mixed text. Auto retains the old family ordering, and trusted worker `FONT_LATIN_FAMILY` / `FONT_JAPANESE_FAMILY` / `FONT_KOREAN_FAMILY` overrides remain supported. Browser aliases use `Studio ...`; SVG uses actual registered family names. `app/layout.tsx` emits registry-derived local font faces; the worker registers all bundled files and fails if an asset is missing.

The three new fonts total 1,420,280 bytes and ship complete SIL OFL 1.1 license texts. Source is Google Fonts pinned revision `1d0e46c7933245c8180fe83e47917961c913bbdb`:

- Inter: `ofl/inter/Inter[opsz,wght].ttf`, SHA-256 `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`.
- Roboto Condensed: `ofl/robotocondensed/RobotoCondensed[wght].ttf`, SHA-256 `dace262afcee68a5276f200d8026c57221735c0118ab5fda8c2c0d3dc409a8d0`.
- Oswald: `ofl/oswald/Oswald[wght].ttf`, SHA-256 `5b38c246e255a12f5712d640d56bcced0472466fc68983d2d0410ec0457c2817`.

Exact URLs, byte counts, font-table versions and hashes: `public/font-sources.json`; design/source details: `docs/fonts.md`. Fonts were acquired only while preparing source. There is no runtime font download path. `fc-scan` verified family/version/coverage; no Python/fontTools dependency was installed.

### Text preset registry and schema

The full-video registry still contains only `presetId: "current"`. Schema version remains 1; optional `textPresetId` records the separate text selection without changing the shape of old normalized defaults. Raw frozen definitions live in `text-presets-data.mjs`, separate from normalization to avoid a circular import. `text-presets.mjs` returns normalized independent copies.

| Text preset ID | Font and appearance |
| --- | --- |
| `current` | Original Auto fonts, white glow/shadows and existing shine |
| `clean` | Inter 700, white, soft shadow |
| `shorts-bold` | Roboto Condensed 900, white, outline 4, heavy shadow |
| `yellow-hook` | Oswald 700, yellow `#ffe24a`, outline 3, heavy shadow |
| `minimal` | Noto Sans 700, white, no effects |
| `news` | Montserrat 800, white original and `#8de7ff` part title, outline 2, soft shadow |
| `jp-clean` | Noto Sans JP 700, outline 1, soft shadow |
| `kr-clean` | Noto Sans KR 700, outline 1, soft shadow |

`applyTextPreset` replaces original title, part title, indicator and subtitle appearance, preserving non-text sections, version and subtitle enabled/source. Applying Current restores the original appearance. `applyFontOverride` changes all four font fields while preserving colors, outlines, effects, opacity, textPresetId and non-text fields; effective weights normalize to the chosen family. No layered/inheritance model is introduced.

`normalizeVisualStyle` remains the JSON/untrusted-input boundary. New text effect IDs are allowlisted. Worker render validation permits implemented text appearance only; custom size/layout/alignment policies and changed foreground/background/filter/overlays remain blocked. No arbitrary CSS, SVG or FFmpeg expressions enter serialized styles.

### UI, subtitle precedence and persistence

`components/text-style-panel.tsx` adds eight compact preview buttons and a grouped font select to the existing per-video sidebar. Buttons have `aria-pressed`, a visible selected check and native keyboard activation. The selected preset label remains visible beside the font override. Existing subtitle font options use the same registry.

There is one effective style in the edit plan. `subtitleSettings` is derived from `resolvePlanVisualStyle(plan)`, replacing separate React state. Existing controls write normalized updates to that same plan and synchronize the legacy `subtitles` alias. A preset replaces subtitle appearance; subsequent manual subtitle controls override only their edited fields. Enabled/source survive preset changes.

The canonical existing SubtitleStyle gains optional `fontWeight`, `opacity`, `effect`; missing fields keep the exact old subtitle representation/render path. Advanced weight/opacity without effect receives a defined soft-shadow path, and opacity zero is preserved. No production history is rewritten.

`replacePlan` preserves the selected effective style across generated/imported/manual/demo plans and source transitions. This is in-memory/current-plan state, not a newly implemented global preference. Browser QA verifies preservation after applying a new manual plan; do not claim persistence across browser restarts.

### Preview/export parity and snapshots

`effects.mjs` defines immutable named layer data. `text-render.mjs` shares font, weight, fill, outline, opacity, escaping and named effects through CSS and SVG adapters. CSS layers reverse SVG paint order; blur converts to Gaussian sigma. Worker title/indicator PNGs now consume normalized style. Existing shine remains only on its existing Current effect; new presets are static. Legacy subtitle rendering remains for old styles; advanced presets use the shared adapter with fractional subtitle baseline retained.

Current compatibility deliberately preserves historical approximations: SVG ambient shadow offset; old subtitle shadow; indicator preview weight 700/Latin Auto stack versus export weight 800/part family. Do not claim general browser/SVG pixel identity. Default CPU exports have been compared objectively with Phase 2.

Existing auto-fit/title zones/subtitle placement/foreground composition/playback rate/output dimensions/color grade remain. The duplicated heuristic title fitters were not broadly rewritten. Non-text rendering and environment contrast/saturation overrides remain unchanged.

Existing `snapshotPlanVisualStyle` clones plan/style plus an independent legacy subtitle alias. Editor requests and batch submissions carry the effective style; queued submissions/items/jobs own independent copies. Later UI or caller mutations cannot alter existing queued jobs. Batch uses the editor-selected style without new batch management UI.

## Tests and QA already run

All Node commands below used Node 22. Earlier stage counts reflect the smaller test set at that time; the final recorded complete suite is 141 tests.

| Command/check | Result and evidence |
| --- | --- |
| Phase 2 VisualStyle tests before edits | 14/14 passed |
| Font-stage focused tests | 17/17 passed |
| Font-stage full suite | 134 passed |
| Preset/compatibility/batch focused tests before final batch case | 30/30 passed |
| `node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs` | Final 141/141 passed, zero skipped/failed, ~1.18 s; `.isolation-verification/phase3-tests.tap` |
| `npm run test:isolation` | 15/15 passed, including ports, identity, data, symlink fail-closed and separate Keychain service |
| `npm run lint` | Passed at multiple milestones and final pre-checkpoint run, exit 0 |
| `npx tsc --noEmit` | Passed at multiple milestones and again during checkpoint, exit 0 (~3 s) |
| `git diff --check` | Passed at checkpoint |
| Checkpoint `node --test lib/fonts.test.mjs lib/text-presets.test.mjs lib/visual-style.test.mjs worker/batch-queue.test.mjs` | 31/31 passed (~0.25 s) |
| `node scripts/qa-visual-style.mjs --baseline 6755f7f79dd78b6d700d39ab44781789bb85da49` | Passed after fonts and shared rendering; latest completed run `.isolation-verification/visual-style-qa-JwzmQO`: all decoded frames and title/subtitle PNGs exactly match baseline, 1080×1920, 30 fps, 2.4 s/part; environment overrides preserved |
| `node scripts/qa-text-presets.mjs` | Final 9/9 cases passed (all eight presets + isolated Current/Montserrat font-only comparison); `.isolation-verification/text-source-70DXs0` |
| `npm run package:mac:dev` | Passed build, native audit and signing; output `release/dev/ShortCut Studio Dev.app`; not installed |
| `node scripts/qa-text-presets.mjs --packaged` | 9/9 passed using packaged Node 22/FFmpeg/worker; `.isolation-verification/text-package-VGqUTN` |
| Source/package results comparison | All nine result objects, title PNG hashes and output metrics matched exactly; all seven font files/licenses verified |
| `QA_RUNTIME_BIN=... node scripts/qa-editor-renders.mjs` | Passed using isolated Node22/tool symlinks; artifacts `/private/tmp/shortcut-editor-qa-b3lxAL` |
| `QA_PLAYWRIGHT_MODULE=... node scripts/qa-text-style-ui.mjs` against source DEV web | Passed; `.isolation-verification/text-ui-M0meqg` |
| Visual inspection | Source/package rendered contact sheets, browser `controls.png` and `preview.png` inspected; representative Latin/JP/KR/mixed text readable with safe placement |

Contact-set QA used synthetic test-pattern/sine media, private mock HOME/data, fontconfig restricted to bundled fonts and a worker preload replacing global fetch with an error. No font/network requests were needed for rendering. It checked glyph coverage, 1080×1920, 0.8 s/part, title frame edges/foreground exclusion, subtitle bounds, actual job snapshots and changed glyph hash for font-only override. This is worker fetch blocking, not a claim of an OS network sandbox.

Existing editor QA used port 8788 and temporary synthetic data (not production 8787); checked source changes during rendering, queue/cancel, four outputs/timing/subtitle burn-in/safe zones, delete/restore/restart and naming reset. **Always set QA_RUNTIME_BIN** because that older script defaults to the installed production runtime; do not use that default.

Browser QA mocked worker routes at 8887, used synthetic media only, blocked HTTPS/production-port requests and reported no browser errors. It passed preset selection, font override preserving appearance, subtitle precedence, style retention after a new plan, keyboard Enter selection, unchanged accepted queued snapshots and local load of all seven concrete font faces. This source web QA does not prove the packaged frontend/bootstrap has been exercised.

The latest baseline/full-test/lint outputs had already finished before the stop instruction; their results were retrieved during checkpoint without restarting them. No long QA was started during checkpoint.

## Issues encountered and resolutions already made

1. Browser QA timed out on a subtitle selector. The test used `Màu chữ` instead of the actual `Màu chữ phụ đề` aria-label. Inspection corrected the selector. The file input also required selecting the native `Local video` tab, and the render action required the exact `Render 2 MP4 files` button. Final browser QA passed; these were test interaction corrections, not an outstanding subtitle bug.
2. Initial JP/KR QA original titles became `UNTITLED` because the existing upload filename sanitizer is ASCII-oriented. Only temporary fixture `source.json` title metadata is now corrected to the actual synthetic Unicode phrases. No upload feature/sanitizer change was made. Final JP/KR original and part titles passed source/package QA.
3. A snapshot QA expected-style object aliased its submitted plan; the caller-mutation test changed its own expectation. Saved an independent expectedStyle before mutation. Real job snapshots remained independent.
4. React lint required the stable `replacePlan` dependency in document-control registration; it was added. Canonical subtitle state exposed the source-reset set-state-in-effect rule; reset state now runs in a source-guarded microtask while request invalidation refs update immediately.
5. Advanced subtitle weight/opacity could otherwise use the legacy hardcoded weight path. Normalization now supplies soft-shadow when advanced fields exist; zero opacity is handled explicitly. Fractional new-subtitle SVG baseline is retained via `roundBaseline: false`.
6. Current indicator preview originally had a different family/weight convention than export. Shared preview adapter explicitly preserves that unchanged legacy case; explicit overrides/new presets use the selected style. Existing ambient SVG shadow offset was likewise retained. Current baseline remained exact.
7. Python fontTools was unavailable. Existing `fc-scan` plus file metadata/hash checks supplied validation; no environment repair or package installation was made.

## Exact remaining Phase 3 work at the checkpoint (historical)

Do these only when the user resumes Phase 3; this checkpoint does not authorize continuing now.

1. Review the full Phase 3 diff against Phase 2 and this WIP checkpoint, including safety/compatibility boundaries and docs. There is no known failing test at checkpoint.
2. **Still pending:** smoke-test the actual DEV packaged bootstrap/web frontend, then run the browser UI script against its built assets. Packaged worker render QA is already complete; do not confuse it with packaged frontend/launcher coverage. Check bundled Info.plist/config identity/ports/data isolation again. Do not install or launch production.
3. Review remaining edge coverage: current representative fixtures pass, but the unchanged font-independent heuristic title fitter has not been exhaustively stress-tested with adversarial wide Latin strings (many W/m/@), very long text and every display font. No metric/fitting fix was implemented. If additional coverage exposes a real issue, preserve Current regression behavior and keep changes scoped to Phase 3. Do not invent a broad fitter rewrite or begin Phase 4.
4. Confirm browser preview and exported representative text styles meet the intended acceptance criteria, keeping documented Current legacy approximations explicit. Existing contact sheets and UI screenshots are available; do not claim universal pixel parity.
5. If any source changes result from final qualification, rebuild only DEV and rerun affected source/package render checks, full tests, isolation, lint and tsc. Existing package represents the tested functional implementation; verify freshness before trusting it after further edits. If no implementation changes occur, reuse completed evidence where appropriate.
6. Finish the final Phase 3 review/feature commit/report on this branch, keeping the existing font commit and this WIP commit. Do not amend Phase 1/2, move the stable tag, merge main or include unrelated cleanup. Report actual tests and limits, all fonts/presets, package location and production safety. **Phase 4 remains prohibited until Phase 3 qualification is complete.**

Corrected synthetic JP/KR titles, isolated font-only comparison, packaged worker render checks, source/package parity, existing editor render QA and final complete regression run are already DONE. Do not repeat them solely because older conversation context listed them as pending.

## Exact continuation commands (not run during checkpoint)

Start by inspecting the checkpoint and safety state:

```sh
cd /Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node --version
git branch --show-current
git status --short
git log --oneline -5
git diff 6755f7f79dd78b6d700d39ab44781789bb85da49 HEAD --stat
git show stable-v1.1.0-before-visual-editor --no-patch --oneline
npm run test:isolation
node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
npm run lint
npx tsc --noEmit
git diff --check
```

Packaged metadata inspection (read-only, DEV bundle only):

```sh
plutil -p 'release/dev/ShortCut Studio Dev.app/Contents/Info.plist'
cat 'release/dev/ShortCut Studio Dev.app/Contents/Resources/config.json'
```

To exercise packaged bootstrap without installing or opening the production app, first ensure no other DEV server owns 5273/8887. In one terminal run the DEV bundle's own Node/bootstrap, then in a second run the browser QA. Stop only that test bootstrap with Ctrl-C afterward; its signal handler stops its own child processes. This uses the separate normal DEV data root; browser worker calls are mocked.

```sh
cd /Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin/node' \
  'release/dev/ShortCut Studio Dev.app/Contents/Resources/desktop/bootstrap.mjs'
```

```sh
cd /Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
curl --fail http://127.0.0.1:5273/ -o /dev/null
curl --fail http://127.0.0.1:8887/health
QA_PLAYWRIGHT_MODULE='/Users/datdo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs' \
  node scripts/qa-text-style-ui.mjs
```

For source UI QA instead, run `npm run personal:dev-isolated` in the first terminal. Never run source and packaged servers simultaneously on the same DEV ports. Browser script requires local Chrome and the indicated runtime Playwright path (or equivalent QA_PLAYWRIGHT_MODULE); no project dependency was added.

Only if justified by new changes/failures, these are the established longer regression commands; run serially with DEV servers stopped because render scripts need 8887:

```sh
node scripts/qa-visual-style.mjs --baseline 6755f7f79dd78b6d700d39ab44781789bb85da49
node scripts/qa-text-presets.mjs
npm run package:mac:dev
node scripts/qa-text-presets.mjs --packaged
QA_RUNTIME_BIN='/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin' \
  node scripts/qa-editor-renders.mjs
```

The existing editor QA additionally needs its own port 8788 free. Never stop unrelated listeners to satisfy these checks. Runtime dependencies include local Homebrew FFmpeg/ffprobe/fc-scan and DEV-local yt-dlp; source QA does not access production tools. New font hashes/licensing metadata are already checked into source.

## Temporary artifacts, processes, assumptions and risks

At checkpoint inspection no DEV web/worker/render-QA processes were running. The production app worker was already running and was left alone. No DEV listener/process was deliberately left active. Recheck ownership before starting tests; never kill production or arbitrary port owners.

Ignored `.isolation-verification/` contains synthetic fixtures/media/mock homes/caches/results/screenshots. Preserve it for evidence; no cleanup was performed. Useful paths:

- `phase3-tests.tap`: final 141-test transcript.
- `visual-style-qa-JwzmQO`: latest Current/Phase2 exact regression; earlier passes `visual-style-qa-mXEPCP` and `visual-style-qa-T2o0G2`.
- `text-source-70DXs0/result.json`, `contact-sheet.png`: corrected final source contact set.
- `text-package-VGqUTN/result.json`, `contact-sheet.png`: final packaged worker contact set.
- `text-ui-M0meqg/result.json`, `controls.png`, `preview.png`: final passing source browser QA.
- Earlier partial/failing browser attempts `text-ui-40yuHE`, `text-ui-lpSVeE`, `subtitle-ui-debug.png`; do not mistake them for final results.
- `text-source-gy6HPJ`: earlier eight-preset contact set before Unicode original-title fixture correction.
- `editor-qa-runtime-8LBxlV`: private tool symlinks used by the completed editor QA.
- `/private/tmp/shortcut-editor-qa-b3lxAL`: completed existing editor-render QA's synthetic sources/history/trash. This temp directory may be removed by the OS later.
- `release/dev/ShortCut Studio Dev.app`: previously built DEV artifact only. Not tracked or installed.

Ignored evidence/binaries will not accompany a fresh clone; another account on the same machine may reuse them. Regenerate only inside isolated DEV/temp roots if unavailable. No production media or credentials were copied.

Objective equality claims are limited to the deterministic CPU synthetic baseline and the tested source/package title PNGs/metrics. Browser CSS and SVG have different rasterizers and retained historical approximations. The current fitter remains heuristic; coverage is representative, not an exhaustive typography proof. UI persistence means new-plan transitions within editor state, not browser-restart preference storage. General Windows package QA was not run in this phase. No video filters, overlays, background variants, new animations, timeline features or font uploads were implemented.

This was the checkpoint stopping point. The user's subsequent instruction resumed
and authorized Phase 3 qualification; see the final qualification report above.
Preserve both checkpoint commits and do not begin Phase 4 without explicit user
acceptance and continuation authorization.
