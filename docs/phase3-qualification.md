# Phase 3 qualification — fonts, text presets and UI

Qualified on 2026-10-16 in `short-video-studio-visual-dev`, branch
`feature/visual-preset-engine`, using Node 22.23.3. Engineering qualification is
complete. User acceptance is separate; this is not merge, installation, release
or Phase 4 approval. **Phase 4 has not started and requires explicit acceptance
and continuation authorization.**

## Completed scope and review

The full Phase 3 diff against Phase 2 (`6755f7f`) and WIP checkpoint (`4c02dc8`)
was reviewed, including the font registry, bundled licenses/manifest, schema and
normalization boundaries, text render adapters, subtitle compatibility, sidebar,
plan transitions and batch/job snapshots. The existing font commit (`6e6695c`)
and WIP commit remain intact. Completed work was retained.

Font choices: **Auto, Noto Sans, Noto Sans JP, Noto Sans KR, Montserrat, Inter,
Roboto Condensed, Oswald**. Seven concrete families are bundled with OFL licenses;
Auto selects the bundled Noto stack. Latin display choices retain JP/KR fallbacks.
No font upload or runtime font download was added.

Text presets: **Current, Clean, Shorts Bold, Yellow Hook, Minimal, News, JP Clean,
KR Clean**. Preset selection and font override affect all text roles. Manual
subtitle edits remain authoritative for edited fields; enabled/source survive
preset changes. Plan transitions preserve the selected style in editor memory.
Submitted jobs and batch items own independent snapshots. Full-video presets
remain limited to Current, and unsupported non-text changes still reject.

Qualification exposed a real long/wide-title issue in the old heuristic. The
final change adds a shared measured-width guard for new presets and explicit
font/weight/outline choices. Fitting lines retain their old wrapping; overflowing
lines reflow within existing size, line and height limits, with a small width
reserve for browser borders/rounding. Browser measurement waits for local fonts
and rejects stale results. Worker measurement uses Sharp/Pango. Current's default
Auto path remains unchanged. Existing shine follows fitted sizes/baselines.
See [text-styles.md](text-styles.md) for the precise behavior.

## Final verification

All artifact paths below are relative to this checkout unless absolute. Ignored
QA files and the DEV bundle are local evidence and do not accompany a clone.

| Check | Result / evidence |
| --- | --- |
| Full automated suite | **145/145 passed**, zero failed/skipped; `.isolation-verification/phase3-final-tests.tap` |
| Isolation tests | **15/15 passed**; `.isolation-verification/phase3-final-isolation.tap` |
| ESLint / TypeScript | `npm run lint` and `npx tsc --noEmit` passed |
| Current vs Phase 2 | All compared decoded frames and title/subtitle PNGs identical; 1080×1920, 30 fps, 2.4 s/part; environment overrides preserved; `.isolation-verification/visual-style-qa-c19rXR` |
| Source render contact set | **9/9 passed**, eight presets plus isolated font-only override; `.isolation-verification/text-source-j9Zmx0` |
| Packaged render contact set | **9/9 passed** with packaged Node/FFmpeg/worker; `.isolation-verification/text-package-6j9Zlb` |
| Render parity | All nine source/package result objects and title hashes match, also unchanged from the WIP representative results; `.isolation-verification/phase3-render-parity.json` |
| Source title stress | **115/115 passed**; `.isolation-verification/title-source-BpzFG5` |
| Packaged title stress | **115/115 passed**; `.isolation-verification/title-package-XtiBbo` |
| Stress parity | **150 identical PNGs**, including shine, and all 115 result objects match; `.isolation-verification/phase3-title-parity.json` |
| Source browser UI | Passed existing interaction/snapshot checks plus **40 title stress cases**; `.isolation-verification/text-ui-Zvrtpd` |
| Rebuilt packaged browser UI | Same checks and **40 stress cases passed** against built assets, seven local font faces, zero page errors or production/HTTPS requests; `.isolation-verification/text-ui-JooobX` |
| Existing editor render QA | Passed source changes during rendering, independent plans, queue/cancel, four playable outputs/timing/subtitles/safe zones, deletion/restore/restart and filename reset; `/private/tmp/shortcut-editor-qa-FyIpd9` |
| DEV package | Build, native audit and deep/strict codesign verification passed; `.isolation-verification/phase3-final-package.log` |
| Package freshness | **81 runtime/public files byte-identical** to source, including all fonts/licenses and new fitter modules |
| Packaged bootstrap | Own bundled Node/bootstrap reached `SHORTCUT_READY`, web HTTP 200, healthy worker on DEV ports; `.isolation-verification/phase3-bootstrap-smoke.json` |

Stress inputs cover repeated W/m/@, mixed wide tokens and long accented Latin
phrases, all eight font choices, Clean/Shorts Bold and explicit-font Current.
Overlay checks include heavy weights, shine, frame edges, foreground exclusion,
minimum size, line count and title-zone height. Browser checks cover both title
roles at actual preview scale. Unit tests cover compatibility opt-in, unchanged
fitting lines, word/long-token reflow, ellipsis, height, copy safety and errors.

Source/package contact sheets and source/built-browser controls, representative
previews and stress previews were visually inspected. Representative Latin,
accented Latin, Japanese, Korean and mixed text remain readable and safely placed.

## DEV isolation and delivery

Only this DEV checkout was edited. Package output is:

`release/dev/ShortCut Studio Dev.app`

Its Info.plist identifies `ShortCut Studio Dev`, bundle ID
`local.datdo.shortcutstudio.dev`. Bundled config is `profile: development`, web
5273, worker 8887, `existingDataRoot: null`. Bootstrap uses the separate
`~/Library/Application Support/ShortCut Studio Dev/media` root with legacy
lookup disabled. Its storage API exposed only `current`, with no media/history
entries. Isolation tests cover private HOME/XDG/TMP, credential-service separation,
occupied-port refusal and fail-closed symlink handling.

Render QA used synthetic media and private temporary roots; font QA restricted
fontconfig to bundled files and blocked worker fetch. Browser worker calls were
mocked and production/HTTPS requests rejected. Existing editor QA explicitly used
the DEV bundle runtime and its own synthetic port 8788, avoiding its production
runtime default. Test bootstrap/workers/web servers were stopped afterward.

The app was not installed. The installed production bundle, production data,
OAuth/models, original checkout, `main`, Phase 1/2 commits and stable tag were not
modified. No production service was stopped or used for QA. No merge or push was
performed.

## Qualification limits

- Current intentionally retains its historical heuristic and legacy CSS/SVG
  differences, including the indicator font/weight and shadow approximations.
  Its default Auto path can still overflow adversarial wide strings; explicit
  font overrides and new presets use the measured guard.
- Measurements come from different rasterizers. General browser/SVG pixel or
  line-break identity is not claimed. Exact equality is limited to the recorded
  CPU baseline, representative source/package title hashes and stress PNGs.
- Plan-transition persistence is editor-memory state, not a browser-restart
  preference. History is not rewritten or migrated.
- macOS packaged bootstrap/frontend/worker were exercised. Native menu-bar
  interactions and Windows packaging were not exercised in this phase.
- Network downloads, AI services and real-user media are outside these synthetic
  checks. Worker fetch blocking is not an OS network sandbox.
- The rebuilt bootstrap's health response cached `tools.ytDlp: null`. A direct
  `--version` run with the same isolated DEV environment succeeded (2026.08.19,
  exit 0, no stderr) in 5.464 seconds, exceeding the existing five-second cached
  version-probe timeout. Downloader behavior was not changed in this text phase;
  this is a known health-reporting limit, not a failed font/render check.

All six tasks in the historical handoff's remaining section are complete. The
next step is user review/acceptance of Phase 3; no Phase 4 work is authorized by
this report.
