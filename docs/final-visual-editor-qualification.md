# Visual editor release candidate — qualification checkpoint

Status: **READY FOR USER ACCEPTANCE — macOS DEV Visual Editor, 2026-10-18.**
The fresh package initially failed module loading after subsequent SourceContext
imports. That blocker is fixed and current qualification passed; see the return
audit below. The listed legacy/external-provider limitations remain explicit.
Smart Auto Cut A/B foundations now exist; the full multi-signal feature is incomplete.

Worktree: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch: `feature/visual-preset-engine`. Initial clean HEAD was
`86889dbe843b45c40b129892751b97f5cc33e784`.

## Coherent implementation checkpoints

| Commit | Completed scope |
| --- | --- |
| `7cb2bcf371505f7456e95833301a1505a40e76e4` | Fix animated export final-frame/audio-tail truncation; strengthen real animation render QA |
| `026b1ea` | Compact Customize list/disclosures, existing controls/state reused; browser regression updates |
| `e5e488d372ed8f84fb6104132e14af3e1e9971fb` | Measured FHD compression defaults and export-quality documentation |

The documentation commit containing this report is a handoff checkpoint. Resolve
its SHA with `git log -1 --format=%H -- docs/final-visual-editor-qualification.md`.
No earlier phase commit was amended/reset; no merge or production installation.

## Architecture audit / completed feature stack

Phases 1–9 remain: DEV isolation; VisualStyle v1; local fonts/text presets;
filters; backgrounds; curated static overlays; full templates; title entrances;
internal cut transitions. Effective normalized VisualStyle is authoritative.
UI subtitle settings derive from the plan, with the legacy subtitle alias updated
atomically. Template selection derives from matching; there is no stale separate
selected-template preference. Template recipes reference component registries and
apply their helpers. The worker consumes effective component values, not template
IDs. Title animation and cut transition remain independent of template identity.
Plan/render/batch boundaries clone complete styles, content and timing.

The extra Customize refinement is UI organization only: a default-closed native
disclosure contains seven rows (Text Style, Font, Filter, Background, Overlay,
Text Animation, Cut Transition). Friendly summaries derive from effective style,
including filter intensity. Existing selectors remain mounted and reuse existing
handlers. Template cards and Custom status stay visible outside the disclosure.
Native keyboard semantics/focus, state retention, Custom/rematch, 390px layout,
source retention and no disclosure-triggered worker mutation pass browser checks.
No VisualStyle/recipe/render/snapshot/batch change belongs to that UI commit.

## Release blocker found and fixed

The old active-title-animation path could lose the final video frame and shorten
audio via final `fps` EOF rounding plus global `-shortest`. A controlled four-range
comparison isolated it. Active animation now uses `eof_action=pass`; its already
finite video/audio streams finish without global `-shortest`. None keeps its
historical graph/options. No audio filters, cut timestamps or entrance expressions
changed. Four-segment diagnostic outputs now match None at 96 frames, exact
container durations and full decoded PCM for both parts. The strengthened existing
animation suite also requires 42 frames, exact duration and PCM equality across
all visual cases on its 1.4-second fixture.

Historical Phase 8/9 qualification reports remain unchanged; their recorded
animated EOF limitation is superseded by this fix. The inherited static decoded
cut presentation offset still exists and must not be confused with new drift.

## FHD refinement

See [export-quality.md](export-quality.md) for inspected old settings, exact new
defaults, objective measurements, visual inspection and limitations. Defaults are
software CRF 17/medium; VideoToolbox 16M target, 20M maximum, 32M buffer. H.264,
1080×1920/30 fps, yuv420p, Rec.709 and AAC 192k remain unchanged.

Six lossless actual-worker compositions compare 24 old/new CPU/VideoToolbox MP4s.
Mean PSNR improves 0.89/1.77 dB; measured size increases 8.6%/24.3%. Three additional
interleaved encode repeats per setting show no material short-sample encode-time
increase (hardware +0.7%; software variation is not a speedup claim). The source
is deterministic detail/motion plus a synthetic green foliage proxy, not real
camera/face footage. This is encoder comparison evidence, not final live-default
application qualification.

## Tests and evidence actually completed

Artifacts below are local, ignored `.isolation-verification/` contents. They are
preserved, including diagnostic failures; a fresh clone does not contain them.

| Executed check | Passed result / evidence |
| --- | --- |
| Full Node suite after timing fix, before final encoding change | 193/193, no skips/failures; `rc-fixed-tests.tap` |
| Isolation at RC start | 15/15; `rc-isolation.tap` |
| Latest focused tests after encoding defaults | 31/31; `rc-checkpoint-focused.tap` |
| Latest worker syntax | `node --check worker/server.mjs`, exit 0 |
| Compact UI lint / TypeScript | Exit 0; `rc-compact-lint.log`, `rc-ui-tsc.log` |
| Current legacy baseline before the active-animation fix | Exact decoded frames/graphics; `visual-style-qa-cdbinZ` |
| Phase 3 fonts/text | Nine jobs/18 MP4s; `text-source-mSM7gB` |
| Phase 4 filters | 12 jobs/24 MP4s; `filter-source-NeyM7T` |
| Phase 5 backgrounds | 15 jobs/30 MP4s; `background-source-enOegm` |
| Phase 6 overlays | 21 jobs/42 MP4s; `overlay-source-x4ow6C` |
| Phase 7 templates | 12 jobs/24 MP4s; `template-source-BZrtp5` |
| Strengthened Phase 8 animation renders | Ten jobs/20 MP4s; `animation-source-nxt3Uh` |
| Phase 9 transitions after timing fix | 16 jobs/32 MP4s; `transition-source-FIpJm7` |
| New integrated source matrix | 16 jobs/32 MP4s; `rc-integrated-source-kBS29F` |
| Compact template/animation/transition browser | `template-ui-w2EKNh`; Customize assertions plus 96 transition stress switches, 64 animation and 64 template stress switches; no errors/violations |
| Existing text browser stress through compact layout | 40 cases; `text-ui-y1RCqO` |
| Filter/background/overlay browser parity through compact layout | `filter-ui-eiCyao`, `background-ui-q7qIZB`, `overlay-ui-Zwqc9r` |
| Security / legacy-schema checks | 56 HTTP rejects, seven safe canonical fallbacks, nine invalid template IDs rejected, three legacy-schema defaults; `rc-security.json` |
| Lossless-reference encoding comparisons | Six compositions × four encodes; `animation-offline-source-Bfr26r/quality-result.json`, `rc-quality-summary.json` |
| Encoding repeats | Three per profile; `rc-quality-performance.json` |
| Fresh DEV package build | Rebuilt under Node 22 with current FHD defaults; ad-hoc signature, runtime audit and bundle ID `local.datdo.shortcutstudio.dev` verified |
| Packaged integrated CPU matrix | 16 jobs/32 MP4s passed; `rc-integrated-package-Y5mVtW` |
| Packaged native VideoToolbox matrix | Nine jobs/18 MP4s passed with Apple VideoToolbox hardware encoder; `rc-integrated-package-PLqZpu` |
| Packaged performance parity | Nine interleaved runs; Legacy (~6.8s) vs Farming JP Dip Black (~6.7s); `rc-integrated-package-6vO5mY` |
| Packaged editor queue & recovery | Passed with DEV `QA_RUNTIME_BIN`; queue FIFO, cancel, CJK subtitle burn-in, delete, restart, restore; `/private/tmp/shortcut-editor-qa-TIPrvL` |
| Packaged HTTP qualification (no browser) | Five representative cases (10 MP4s) with VideoToolbox; caller-object snapshot isolation verified; `rc-live-qualification-SbRQHj` |
| Full Node & isolation suites | 193/193 unit tests, 15/15 isolation tests, ESLint clean, TypeScript clean (`tsc --noEmit`) |

The integrated matrix includes Legacy None/Dip/Flash; Farming JP/Slide/Dip;
Korean/Pop/Flash; Viral/Fade/Dip; News/Pop/Flash; Bright Social customized to Inter,
70% intensity, Black background and Film Frame with Slide/Dip; and short-segment
clamping. Each part has four ranges/three cuts. Actual None-control cut detection,
duration/frame counts, full PCM and title/subtitle assets are checked. Non-short
recipes also compare timing/audio across visual styles against Legacy. Both parts
pass; actual Japanese/Korean/mixed-script text and fixed caption cues are used.

## Gemini qualification snapshot at `88908de` (historical)

1. **Fresh DEV Package & FHD Defaults**:
   - Packaged with `npm run package:mac:dev` under Node 22.
   - Code signature verified: ad-hoc, sealed resources (2,541 files), bundle ID `local.datdo.shortcutstudio.dev`.
   - Runtime audit passed (`node scripts/audit-macos-runtime.mjs`).
   - Packaged worker confirmed to contain current FHD settings: libx264 CRF 17/medium; VideoToolbox 16M target / 20M max / 32M bufsize, spatial AQ 1, realtime 0, allow_sw 0; H.264, 1080×1920, 30fps, yuv420p, Rec.709 color tags, AAC 192k stereo audio.
2. **Packaged VideoToolbox & Performance**:
   - Native VideoToolbox smoke (`rc-integrated-renders.mjs --packaged --native-smoke`) passed all 9 jobs / 18 MP4s.
   - Performance smoke (`--packaged --performance`) passed 9 interleaved runs: Legacy mean ~6.8s, Farming JP Dip Black mean ~6.7s.
3. **Queue Snapshot Integrity**:
   - HTTP queue snapshot test in `rc-live-qualification.mjs`: caller submitted Job A (Farming JP + Slide Up + Dip Black), then Job B (News + Pop In + Flash White), then mutated the local plan objects. This script has no browser and does not exercise editor actions.
   - Both Job A and Job B retain complete plan/style snapshot isolation; no mutations leaked into queued jobs.
4. **Representative Live Cases**:
   - Case 1: Current + None animation + None transition (DE/FR titles/cues) -> 1080x1920@30fps, Rec.709, yuv420p, valid PCM.
   - Case 2: Farming JP + Slide Up + Dip Black (Japanese titles/cues) -> 1080x1920@30fps, Rec.709, yuv420p, valid PCM.
   - Case 3: Korean Tutorial + Pop In + Flash White (Korean titles/cues) -> 1080x1920@30fps, Rec.709, yuv420p, valid PCM.
   - Case 4: News + Pop In + Flash White (Global/English titles/cues) -> 1080x1920@30fps, Rec.709, yuv420p, valid PCM.
   - Case 5: Viral Shorts + Fade In + Dip Black + Film Frame overlay (English titles/cues) -> 1080x1920@30fps, Rec.709, yuv420p, valid PCM.
5. **Customize Compact UI**:
   - 7 rows verified: Text Style, Font, Filter, Background, Overlay, Text Animation, Cut Transition.
   - Default collapsed native `<details>`, summary labels display effective values (e.g. "Vivid · 100%", "Nature · 70%").
   - Controls stay mounted inside details; expanding/collapsing does not remount React tree or interrupt video playback.
   - Custom / rematch behavior verified: tweaking component properties changes template matching to null ("Custom"), reverting restores match; title animation and cut transition remain independent of template identity.
6. **Production Isolation**:
   - Ports 5173 / 8787 remained untouched throughout all tests.
   - Production app `/Applications/ShortCut Studio.app` and production Application Support untouched.
   - All tests used isolated DEV directories under `.isolation-verification/` or `/private/tmp/`.

## Final acceptance status

The prior Gemini verdict was **READY FOR USER ACCEPTANCE** at `88908de`.
It is historical evidence for that checkpoint, not a readiness guarantee for later
commits. The Codex return audit below supersedes its current-state claims.

## Codex return audit — 2026-10-18

Received HEAD `558ad67f7be29081f79dec43eecc8eeccf879a0a`, correct DEV branch,
with six dirty files from unfinished comment-signal fixes. The inherited patch is
preserved at `.isolation-verification/rc-codex-return-20261018/inherited-work.patch`.
Those fixes were reviewed, tested and checkpointed in `37ac963`; no feature C–H
implementation was started. They include root-comment classification, typed
comment-signal copying/validation and a dedicated comments timeout.

Two blockers were reproduced and corrected:

- A fresh macOS DEV build succeeded, but importing its worker downloader failed
  with `ERR_MODULE_NOT_FOUND` for `lib/source-context/comments.mjs`. The package
  now includes `lib/source-context/`, preserving the existing worker implementation.
- Initial suite result was 229/230. The new timeout test kept observing the signal
  after the simulated subprocess completed and mistook normal shared-request
  cleanup for a timeout. Its listener now detaches on completion; the original
  long-operation/short-metadata-budget assertions remain intact. No downloader
  timeout logic was relaxed to make the test pass.

New tracked `scripts/qa-rc-packaged-ui.mjs` starts the packaged bootstrap/web/worker
with a private mock HOME under the DEV worktree, then drives Chrome against real
UI and real HTTP endpoints. It checks template/custom/rematch, seven Customize
rows, collapsed-state retention, video identity, actual submissions, independent
job plans, stream specs, decoded frames, browser MP4 playback and restart/restore.
`--cpu` forces only libx264; it leaves CRF/preset at their actual defaults.
Caption caches and representative source-title metadata are explicitly seeded
synthetic fixtures, not real Whisper output or live YouTube metadata. Actual
upload, manual plan, template/control actions, render, playback and recovery
requests are never mocked.
Browser external/production requests are rejected and counted as failures.

Evidence root: `.isolation-verification/rc-codex-return-20261018/` (ignored).

| Re-executed check | Result / evidence |
| --- | --- |
| Focused inherited SourceContext/downloader checks | 55/55; `focused.tap` |
| Full current suite | 230/230, no skips; `tests-fixed.tap` |
| DEV isolation | 15/15; `isolation.tap` |
| ESLint / TypeScript | Exit 0; `lint-final.log`, `tsc-final.log`; targeted QA-script lint also passed |
| Fresh fixed DEV build / signature / runtime audit | Build exit 0; deep/strict signature verified; DEV bundle ID; `package-fixed.log` |
| Packaged file freshness | 76 files byte-identical: registry/context modules, all public assets/fonts/overlays and key worker/render files; `package-freshness.json` |
| Real packaged UI with default native encoder | Five jobs/10 MP4s; `rc-real-ui-native-tO8EX5/result.json`; Current, Farming JP, Korean Tutorial, News, Viral Shorts; original/part titles and captions in EN/DE/FR/JP/KR/mixed text; zero page errors/network violations; independent plans and restart/restore passed |
| Real packaged UI with actual CPU defaults | One Farming JP job/two playable MP4s; `rc-real-ui-cpu-8bzMGz/result.json`; individual controls, Custom/rematch, active playback, explicit original/part titles and recovery passed |
| CPU default bitstream verification | Both final MP4s record `rc=crf`, `crf=17.0`, `ref=3`, `subme=7`; medium path has no preset/CRF override; assertions built into the harness; earlier independent inspection retained in `cpu-bitstream-options.json` |
| Current CPU source/package parity | Three jobs/six MP4s: None/Dip/Flash; 42 decoded-moment hashes, text/subtitle assets, complete PCM, durations and frame counts match source reference exactly; `current-parity.json`, `rc-integrated-package-YClDBD/result.json` |
| Queue/cancel/delete/restart/restore | Passed all existing editor assertions using DEV runtime; `editor-recovery.log`; fixture `/private/tmp/shortcut-editor-qa-bDw2NP` |
| Interleaved whole-job composition timing | Nine CPU parity-profile jobs/18 MP4s, three Legacy/Farming/Legacy groups; Legacy mean14.76s vs Farming16.53s (+12.0%); `performance-summary.json`, `rc-integrated-package-VrRjTP/result.json` |

The timing profile deliberately uses CRF18/ultrafast, not current default encode
speed. Host timing varied (Legacy9.3–21.3s, Farming9.9–25.8s); this is measured
composition overhead on a shared machine, not a no-slowdown or production-throughput
guarantee. Native/default-CPU correctness is established separately above.

The final real-UI rerun seeds source titles after upload and asserts both original
and part-title content, including JP/KR; all seven Customize controls pass through
existing handlers. Decoded-frame contact was visually inspected: original titles,
part titles and captions are readable, with no visible missing JP/KR glyphs or
title clipping (`rc-codex-return-20261018/native-contact.png`). Two earlier
harness attempts incorrectly expected the editor title to override canonical
source metadata; their failures remain in `real-ui-native-final.log` and
`real-ui-native-titles.log`. The fixture correction follows `startRender`'s
existing source-title precedence; no content assertion was removed or weakened.

Current verdict: **READY FOR USER ACCEPTANCE for the macOS DEV Visual Editor**.
Package startup, current native/software encoding, visual compatibility and
real packaged UI workflows pass at the tested checkpoint. SourceContext fixes
are preserved in `37ac963`; this RC commit contains the package dependency fix,
repeatable real-UI harness and corrected documentation. Resolve its SHA with
`git log -1 --format=%H -- docs/final-visual-editor-qualification.md`.
This verdict does not qualify full Smart Auto Cut, real ASR/AI or YouTube batch
provider behavior. No renderer/FFmpeg graph, visual recipes or product UI changed
in this return task. No Sports Voiceover or C–H implementation was started.

Reproduce the new real-UI check with Node22 and a locally available Playwright:

```sh
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/qa-rc-packaged-ui.mjs
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/qa-rc-packaged-ui.mjs --cpu
```

DEV ports5273/8887 must be free; the harness refuses occupied ports and stops only
its own bootstrap children. No production app install or production runtime use.

## Preserved request sources for the next window

The latest instruction says preserve work, finish the nearest coherent boundary,
run focused checks and defer expensive qualification. Do not restart planning.
Original full requests are these user attachments:

- RC: `/Users/datdo/.codex/attachments/7aeba214-314e-4e95-803a-2c965f71938e/Pasted text.txt`
- FHD: `/Users/datdo/.codex/attachments/ff8e68e5-ee03-4e05-b1ba-2c0c95fa8d02/Pasted text.txt`
- Smart Auto Cut: `/Users/datdo/.codex/attachments/1b22a4b6-2810-4d0e-90f6-0ba500b7b4a8/Pasted text.txt`
- Mandatory multi-link extension: `/Users/datdo/.codex/attachments/c7fe3ea0-eb7c-4631-932b-94c7ab55b241/Pasted text.txt`

Smart Auto Cut A/B foundations are present in `81d2b09`, `558ad67` and the inherited
fix checkpoint `37ac963`. They are not wired into Auto/Semi-Auto planning yet.
Research/license completion has not been established. C–H remain unimplemented;
use one engine, preserve manual overrides and isolate per-link state/cache/retry.

## Known limitations / safety

HTTP validation errors currently use generic 500 responses while rejecting unsafe
input before job creation; this is a minor existing API-status limitation. The
yt-dlp health-probe issue remains untouched. Actual ASR/AI planning, real/public
video comparisons, multi-link provider integration, ablation and Windows remain
unqualified. Fixed synthetic captions are not evidence of recognition accuracy.
Memory peaks have not been reliably measured. Full Smart Auto Cut is incomplete.
Purely non-Latin upload filenames can yield an empty auto-derived title through
the inherited filename sanitizer; render also takes originalTitle from source
metadata even if the local editor title was changed. QA uses explicit synthetic
source-title metadata. These legacy metadata limitations were not changed by RC.
The Windows packer also lacks the new SourceContext copy step on inspection;
Windows must be repaired/rebuilt/qualified separately before any Windows release.

All changes remain in this DEV branch/worktree. Main, original checkout,
production app, production Application Support and ports 5173/8787 are untouched.
No DEV installation or messaging integration. Initial idle DEV app ownership was
verified before stopping it; the unrelated bridge daemon was left alone. Owned
test web/worker processes were stopped at the checkpoint. Local evidence remains
preserved. Use `git diff 86889db..HEAD --name-only` for the complete tracked change
manifest; this report records the remaining work instead of implying completion.
