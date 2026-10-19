# Smart Auto Cut D/E/F/G — technical delivery, 2026-10-19

Status: D–G implementation and bounded technical checks passed; updated DEV app
is built and running.
H real-video/editorial acceptance and live main-selection quality remain pending
with the user. This is not a claim that all Smart Auto Cut qualification is complete.

Repository: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch: `recovery/visual-dev-reconstructed`; clean starting HEAD `801a544`.
Commits: D `5ff7b83`, E `8e6731c`, F `407ca90`, G `db47b11`, hardening/QA `feac0c7`.
Final documentation HEAD is available with `git log -1 --oneline`.

## What runs and what consumes evidence

| Checkpoint | Actual path / behavior | Limits / fallback |
| --- | --- | --- |
| D | `lib/auto-cut/main-content.mjs` → `worker/main-content.mjs`: up to48 two-part source recipes, sentence-safe candidate boundaries, near-duplicate suppression, structural/lexical/chapter/engagement/local contributions; structured GPT chooses a known recipe and permitted exclusions | Heuristic scores, never probabilities. Correlated comments/replay use max, not additive inflation. Invalid/auth/rate/timeout AI returns explicitly labeled deterministic plan; no silent AI claim. |
| E | Existing FFmpeg `scdet`/MAFD, RMS and silence feed normalized source-second evidence to D; existing provider frame adapter supplies up to6 bounded JPEGs when accepted | At most180 source seconds, 2fps/160px scene input; mono16k audio metadata; 60s total; one analysis at a time; no retained media transcode. Sparse cues are not action/emotion recognition. Optional failure never fabricates signals. |
| F | One `createAutoCutWorkflow`: source context/local → main → independently selected same-part hooks. UI Auto, Gemini/Muse external context/import and manual review share it | Exactly two parts, established main-duration/start-trim and hook contracts. Locks retained. External ranges are not silently reranked/snapped. Cancel/stale-source guard; style changes do not reanalyze. |
| G | Existing FIFO/history extended: source→plan→submission persisted before advancing; source URL aliases share media/context while item plans/styles stay independent | <=20 links/submission, 100 pending; one link preparation and serial renderer. Explicit resume uses known source/job/output identity. Gemini/Muse wait for import; fallback waits for approval. Missing legacy settings are not guessed. |

A metadata/title/description/chapters, B timestamp-comment clusters and C relative
Most Replayed intervals actually reach D's bounded ranking and provider input.
Raw comment strings are not model instructions; engagement is supportive evidence,
not exact retention/views or a substitute for content. Transcript/source cue timing
and lexical evidence reach D; source cues also remain the authority for hooks.
E's scene/audio evidence influences bounded D contributions and supplied boundaries.
The existing hook selector receives bounded supporting SourceContext but remains a
separate per-part decision; no claim that all E fields alter its algorithm.

Auto uses the existing ChatGPT adapter/account configuration. New main schema is
fixture-tested; historical successful GPT two-part hook inference is preserved in
`teaser-hooks-qualification.md`, not rebranded as a live test of this new planner.
Gemini/Muse are manual web workflows with source/request/analysis-bound JSON import.
No analysis API or unattended web batch is invented; model labels remain external
self-reports. No live AI or YouTube calls were made for these D–G checks.

## Compatibility and durable state

- One renderer and unchanged encoding defaults/visual engines. Main plans remain
  ordinary EditPlan snapshots; source, captions, hook repetition and speed mapping
  reuse the existing contracts. No second persisted visual truth.
- Original/manual plans implicitly lock unless explicitly unlocked. Custom Time
  invalidates only the changed part's automatic evidence; exact persisted analysis
  shape/source is validated at plan boundaries. Title/range/provider/source edits
  cancel pending analysis; visual-only edits preserve it.
- Common source/main/local cache identities depend on source/actual analysis input,
  provider/model/prompt version, never style. Completed AI results cache; transient
  failed inference is not cached as successful AI. Duplicate source reuse persists
  across restart with metadata/identity checks; trash/locked sources are refused.
- Immutable item settings/approved plan and submission ID precede enqueue. Explicit
  render retry reuses the same job; complete outputs are accepted only after probe
  checks for identity, dimensions, duration and audio. Completed parts do not rerender.
- Cancellation is subscriber-aware; an item cannot cancel another's shared work.
  Missing sources or ambiguous existing outputs fail safely instead of redownload or
  duplicate export. Interrupted/legacy work remains visible for review.

## Checks actually run

| Check | Result |
| --- | --- |
| D focused fixtures | 16 passed |
| E focused fixtures / actual tiny FFmpeg scene+silence fixture | 11 passed; <100KB transient fixture removed |
| F focused workflow/import/lock tests | 48 passed |
| G focused persistence/reuse/resume/cache/packaging closure | 25 passed |
| Final focused analysis/boundary hardening | 24 passed |
| Final full `node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs` | **313/313 passed**, zero failed/skipped |
| Node22 `npx tsc --noEmit` / `npm run lint` | Passed |
| Source UI/API/export smoke | Passed; details below |
| DEV package build / native dependency audit / signature | See package completion below |
| Packaged UI/restart/resume smoke | See package completion below |

Counts overlap; do not sum focused and full suites. Final TAP is
`/tmp/shortcut-defg-units-final.tap`; type/lint logs use the same prefix.
Tracked reproducible smoke: `scripts/qa-smart-auto-cut.mjs`.
Retained concise evidence:
`.isolation-verification/smart-auto-defg/smoke/{source,packaged}-report.json`,
phase editor screenshots and `resume.json` (IDs/hashes, no credential payload).

Source smoke used a synthetic 160s 320×180/2fps black/white+tone source <2MiB,
explicitly synthetic caption/context fixtures, private HOME and a nonexistent
QA-only Keychain service. Actual UI Auto→worker fallback and hook assembly passed;
style change caused no analysis request. Gemini-style context/prompt/import was
hand-authored fixture JSON, explicitly **not** a provider response. Main ranges
remained `[1,80]` / `[81,160]` after established start trim. Two URL aliases shared
one source; independent batch items waited for import.

To bound CPU, only export smoke used explicit short manual ranges, not full Auto
main content: two 1080×1920 outputs with repeated same-part hooks/subtitles and
existing transition/encoder pipeline. Durations11.201 /11.201375s, audio present;
planner min-duration constraints are checked separately. Output sizes1,379,130 /
1,569,524 bytes. Zero uncaught browser errors or unexpected browser destinations.
This synthetic smoke is not real speech/editorial playback acceptance.

Earlier smoke failures are retained: SSR hydration made the first scripted input
premature; the harness now waits for Worker ready. An initial long render fixture
was intentionally stopped after verifying its private QA worker ownership, then
shortened in the harness only. Product quality settings were not lowered.

## Package completion

One frontend build completed. Sandbox denied yt-dlp’s semaphore initialization
at its bundled `--version` probe, before app replacement. Resumed the same staging
outside sandbox using the unmodified remaining launcher/audit/sign steps; did not
rebuild the frontend or download a replacement runtime. Final 44 native binaries
passed compatibility/dependency audit; ad-hoc deep signature verification passed.
New main/local/workflow/batch/resume/analysis modules match source SHA256s.

Actual packaged bootstrap + UI context/import passed. A private fixture job marked
interrupted was explicitly resumed: same job ID, two existing MP4s retained byte-
identical SHA256s, second item still awaiting-import; no duplicate render. Zero
uncaught browser errors/unexpected browser destinations. No provider/network campaign.
Private HOME and fixture were removed after success; reports/screenshots retained.

Normal `open` launch then passed web200 and worker health with real DEV data root
`/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`, not mock HOME.
DEV app is left running on5273/8887. No login credentials were accessed by the QA
workflow (browser session route blocked; source worker used a QA-only service).
This proves startup/import/resume dependency closure, not live editorial quality.

## Disk and temporary-file policy

Before task: `df -k` available83,200,000KiB; apparent `du -sk`:
release/dev1,347,576KiB; all existing QA2,450,268KiB; normal DEV cache6,244KiB;
normal DEV sources3,480,604KiB. Historical evidence/user media untouched.

Each new main/local JSON cache is bounded to24MiB,14days,512 entries,2MiB/entry.
Active and queued/running/recoverable referenced keys are protected. A full protected
cache skips new writes rather than deleting resume data. Old A–C/historical caches
are not bulk-pruned. Cache writes are atomic and own temporary files are removed
on success/failure; per-operation media/frame intermediates reuse existing finally
cleanup. Local E analysis streams metadata and keeps no WAV/video intermediate.

Download preflight uses actual estimated size or conservative duration allowance,
15% overhead plus512MiB reserve; unknown size starts only with1GiB allowance and
is monitored every2s. Existing downloader owns partial cleanup on cancellation.
Upload Content-Length is checked; stream failure removes only its partial upload.
Complete uploaded media is retained even if later probing fails. ASR uses only an
already installed model, source<=30min,60s budget and PCM-space preflight; no model
is automatically downloaded. No automatic source/export/plan/history pruning.

After: `df -k` available80,400,000KiB (~76.68GiB), versus83,200,000KiB
(~79.35GiB) before. This filesystem-wide -2,800,000KiB is an observation, not task-
exclusive usage or an APFS physical-reclamation claim. Final apparent `du -sk`:
release/dev1,356,148KiB; existing+new QA2,453,400KiB; dist116,276KiB; .next4KiB;
normal DEV cache6,244KiB; sources3,432,220KiB. Source-tree size changes are not
attributed to cleanup; no user source/export/history deletion was requested or run.

Removed task-created previous-package staging269,564KiB, private QA
HOME28,616KiB and compiler scratch136,724KiB (combined434,904KiB apparent,
~424.7MiB), plus the small synthetic fixture. Compiler scratch ownership was
verified against this build’s start time and expected icon/cache contents. All four preexisting staging directories, latest usable app, historical
QA, user media/exports/plans/credentials and Git/recovery backups were retained.
Evidence: `smart-auto-defg/build-cleanup.json` and packaged report under the QA root.
No research clones or analysis media transcodes were retained.

## Remaining limitations and user acceptance

No fresh live main-schema GPT quality test, real YouTube campaign, ablation matrix
or full historical RC rerun was performed. Sampling can miss unsampled events;
no transcript and sparse frames can yield weaker explanations. Conservative disk
estimates may refuse a large source; source-reuse legacy discovery is capped at2000
folders /10000 index entries, with safe refusal past bounds. Legacy batch items
without saved settings need editor review. Existing yt-dlp health-probe issue is
outside this task. Visual/hook historical qualifications remain unchanged.

1. Open the updated app in place (not `/Applications`):
   `open "/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app"`.
2. Prepare one representative YouTube/local source, run Auto; inspect the actual
   method/provider, evidence, exclusions and fallback limitations for both parts.
   Watch/listen for relevant, coherent main segments and same-part hooks.
3. Lock Part1, alter Part2 and regenerate; verify lock retention. Change only a
   visual template and confirm source analysis is not restarted.
4. Generate Gemini/Muse prompt, submit with supported source inputs manually,
   import original JSON; inspect both parts, captions and hook boundaries. No API
   claim follows from importing user-supplied text.
5. Submit two aliases of one source plus another link. Verify independent plans,
   web waiting/import, fallback approval, cancellation and explicit retry/resume.
   Restart DEV and verify known completed outputs are reused without duplicate jobs.
6. Preview/export representative parts with the existing FHD defaults; check
   title/subtitle repetition, transitions, complete audio tail and final duration.

Production app/data/ports, recovery backups and unrelated projects were not touched.
No push, merge, new dependencies, duplicate YouTube stack or new renderer.
