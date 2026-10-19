# Adaptive/editorial teaser integration — checkpoint, 2026-10-20

Base9c315ec, recovery/visual-dev-reconstructed. Final SHA: `git log -1`.
Technical checkpoint passes; editorial/auth/music audition limitations remain explicit.

## Contracts

- New selectionPolicy `adaptive-editorial-v3`, prompt `same-part-hook-v3-editorial`.
  Prefer5–9 rendered seconds; hard9 inclusive, minimum0.5 for a complete short unit.
  Source limits derive from PLAYBACK_RATE (currently1.25:6.25–11.25 source seconds).
  No automatic padding, forced truncation or boundary snapping.
- First10 rendered main seconds excluded cumulatively across retained gaps; one same-part
  range only. Main, locks/content, original occurrence, music and queued snapshots stay unchanged.
- Legacy per-part-v1 / same-part-hook-v1 / later-main-v1 remain readable with their original
  validators/hashes. Explicit reselection uses new cache identity. Styling/music do not analyze.
- Schema adds candidateId,kind,partUnderstanding,contentTypes,observed,startContext,
  standalone/complete gates,endingBasis,ending,cueIds,replayUse and up to2 diverse alternatives.
  These are concise evidence claims, not chain-of-thought or calibrated probabilities.
- Up to12 diverse proposals and12 overlapping part-wide cue-context windows avoid prefix-only
  coverage. No English genre keyword scoring/classification call. Speech/action/mixed/unknown
  are supported; uncaptioned temporal candidates are explicitly unverified visual proposals.
- Most Replayed peaks actually add up to3 candidate windows, aligned to available complete cue
  units or marked visual-review. First10s and9s bound still apply. Correlated comment/replay
  are corroboration only, never separate summed quality votes. Persist availability and whether
  an actual peak supported the selected event. Missing signal never fabricates evidence.
- One provider analysis (+at most1 bounded repair) compares the shortlist; up to9 local512px
  stills cover start/mid/end of3 diverse proposals. Still images do not prove continuous action.
  A visible settled end state requires a supplied near-end frame. Other motion claims unavailable.
- Fallback never masquerades as editorial ranking: if multiple speech proposals need a semantic
  choice, unavailable rather than earliest/longest/keyword winner. A single punctuation-delimited
  fallback is still explicitly editorial-unverified. No transcript alone does not forbid visual review.
- Cached alternatives/manual source-range controls preserve other parts/main/locks. Manual edits
  are labeled manual, not AI, and validated against cue timing/bounds/duration. No new timeline.

## Demonstrated diagnosis (not inferred user quality)

Previous code selected the first4–6s terminal cue. Global6 stills could miss its actual interval.
The earlier adaptive draft also had a domain-biased keyword heuristic; removed before delivery.
Uniform sampling existed, but lacked candidate-local context/images and a semantic eligibility
contract. No evidence identifies the user's exact poor-output example. Historical house-lift QA
is not broad genre validation. New varied regressions remain synthetic until user acceptance.

## Narrow reuse (no dependency added)

Reviewed exact source/license/dependencies without clones/install scripts:

| Source/revision | License | Decision |
|---|---|---|
| https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator/tree/3d11f2e6ecbbb9757d788e1bd05695c01f3e6c6c | MIT,2026 Anil Chandra Naidu Matcha | Narrowly adapted overlap suppression from highlights.py to JS; removed viral scores, added bounded temporal diversity/context. Notice in third_party/teaser-reuse, copied by both packagers. No MuAPI/Python dependency. |
| https://github.com/zhouxiaoka/autoclip/tree/8f32453dc850596a60110b8dc1482098bd014c90 | MIT,2024 AutoClip Team | Consulted step3_scoring.py and knowledge timestamp/reason prompts: exact excerpt evidence, natural ending, compare information value/completeness. No copied prompt/code;3–8min rules, Celery/Redis/backend stack unsuitable. |
| https://github.com/ClipsAI/clipsai/tree/8e73c8adc112c745b84ec240f11a91457bfd3141 | MIT,2023 Clips AI,Inc. | Consulted texttiler.py (numpy/torch embedding topic boundaries). No copied code or added embedding/Python/GPU runtime. pyproject.toml absent at inspected path. |

## Checks actually run

| Check | Result / evidence in `.isolation-verification/adaptive-teaser/` |
|---|---|
| Final full unit suite |342/342, no failures/skips; `/tmp/adaptive-final-unit.tap` |
| Focused replay/editorial/playback |23/23; real selector fixture chooses a lower eligible replay peak by semantic response, persists support, reuses cache across style. Web prompt also contains peak proposals/context. Synthetic tests do not establish editorial quality. |
| TypeScript/lint | Node22 `npx tsc --noEmit`, `npm run lint`, `git diff --check` passed |
| Actual source FHD render | `render-report.json`:9s/2s manual/fallback fixture hooks;31.015729/24.000750s,930/720frames,1080×1920; repeated subtitle groups, non-silent tails, unchanged main/snapshot. Generated MP4s removed after checks. |
| Foreground lossless control |72frames,243309 changed inside pixels,0 outside; frames28–44 active within27–45 window; text/labels/background untouched. Before/during/after images retained. |
| Short transition timing | `transition-timing-report.json`:72 unique decoded frames, PTS step0.033333±0.000001s. Real source editor played across warm boundary at output speed; no obvious abrupt entry/exit was seen in that short observation. No quantitative M2 browser dropped-frame/stutter benchmark. |
| Ordinary source editor | `source-ui-report.json`: real200s Vietnamese footage + real Sauropod Spotting MP3; synthetic plan/auth response clearly labeled. Music enabled before Generate survives; both parts enter successful mixed play; pause/seek past hook, Batch return, regenerate,0% and40%, duck OFF/ON work. Video rate1.25; main0–95/100–200 unchanged.0 browser warnings/errors observed.0 preview POSTs before Generate. Source muting occurs only after native audio play succeeds. No audible track-quality claim or detached-Audio clock telemetry. |
| Actual MP3/voice mix | `personal-music-audio-report.json`:29.313167s PCM vs29.3112 intended; zero-gain output exactly dry source (max difference0); repeated speech windows both music gain ratio0.25118865 (−12dB); pause restored1.0; non-silent tail. Known speech interval fixture, not fresh VAD accuracy proof. |
| One DEV package | `npm run package:mac:dev` completed once; existing runtimes reused;44 native binaries audited, deep/strict signature pass. No install. |
| Packaged runtime smoke | `package-report.json`: bundled Node/FFmpeg/VAD on5275/8894 private HOME; frontend/sprite HTTP200, exact new worker/module/sprite/license hashes, real local video +MP3 import,722702-byte playable AAC mix29.3112s, speech available. Native interactive app launch and fresh packaged-browser controls were NOT exercised; source UI was. |

## Real inference / reference limits

One fresh inference was authorized. First attempt stopped on expired OAuth refresh;
second stopped at secure Keychain read. **No new inference selection was produced.**
`live-editorial-{no-proxy-,}report.json` preserve public errors only. No repeated dialog,
credential reset/copy or secrets output. Historical GPT/Gemini/Muse two-part evidence
remains historical; user web model labels were self-reported imports. Current v3 real
provider/editorial quality and varied real fishing/vlog/action footage remain unverified.

Reference video was inspected in motion/frames; user selected54–58s warm yellow/orange/
red. Local original cloud/bloom approximation was viewed on real house-lift preview.
Warm plumes stay within source video; text/background stay unchanged. It is not Adobe
algorithm/parity: plume structure/exposure evolution differs and reference clip-entry
versus fixed600ms cut-centered timing differs. No reference footage/assets shipped.

## Personal music and storage

54 actual compressed files installed,256196532 audio bytes; all full-file decoded.
0 audition-verified instrumental /54 uncertain /26 bounded download failures.
Metadata mood grouping and arrangement variants require listening/diversity review;
this is not54 certified distinct instrumental compositions. Credits/source/license
are retained, visible and copyable; no audio in Git/app. Mixkit prohibits bulk scraping
so none was downloaded. Normal DEV library was initially empty; user media preserved.

Library128tracks/1GiB, individual64MiB/600s. Failed partial cache ~140MiB retained for
resume; updated acquisition refuses beyond512MiB, never evicts resume/user data. No
more downloads were attempted after54. Source VAD/preview cache budgets remain24MiB/
128MiB,14days, protected active/resume data; volume/style do not rerun selection.

Observed global free disk initial78000000KiB, after checks/cleanup73200000KiB before
bundle. This includes unrelated/APFS activity, not attributable space reclaimed.
App/staging release/dev1348204→1629312KiB: latest app plus old package still mapped by
normal DEV PIDs42221/42222. New `.build-4vG67H/previous-build.app` intentionally retained;
four older stages also preserved. Do not remove mapped app files while user app runs.
Task QA area ~158756KiB (mostly resumable partials). Music root ~250516KiB. New audio
files are read-only user assets, not automatic cleanup targets.

Removed only our two inactive partial-import files2364751bytes, two stopped private
QA HOME/fixture trees43747338bytes and reproduced `dist`114165724bytes: total160277813
logical bytes (~152.9MiB). Packaged copy proved independent before dist removal.
Logs, concise reports, small previews, failure evidence, source original, user data,
credentials and all recovery bundles remain. Logical bytes do not prove APFS reclaim.
Private QA PIDs46654/46666 and51036/51045/51080 stopped; packaged smoke children stopped.
Normal DEV5273/8887 remained running on its old loaded app, with normal DEV data root.

## Delivery / user acceptance

Implementation committed separately; see `git log -1`. New independently verified
bundle outside DEV: `../short-video-studio-dev-adaptive-20261020.bundle`; ignored
`bundle-report.json` records HEAD/SHA256 and independent bare-clone fsck. Existing
BGM/reconstruction bundles are untouched. Unavailable original21 commits stay unavailable.

Quit the existing DEV instance through its normal app controls, then open the new app:

```sh
open "/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app"
```

Test one known part with a real provider once auth is restored by the user; inspect
reason/ending and up to2 cached alternatives, replay availability/support. Try manual
range, verify first10 rendered-main exclusion and hard9s, main/manual locks and original
occurrence. Gemini/Muse existing hook-only workflow still requests both parts, with
main locked; GPT reselection and cached/manual UI controls operate on the active part.
Audition installed music, verify vocal absence/taste/loop seams and copy required CC-BY
credit when publishing. Test40%/0%, duck ON/OFF, both parts and queued snapshots. Review
warm scope/look at hook→main. No further feature/automatic download/research authorized.
Production paths/ports/data, other projects and credentials untouched. No push/merge.
