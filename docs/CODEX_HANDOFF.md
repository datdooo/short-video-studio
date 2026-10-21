# Latest: source checkpoint / push authorized, NO further packaging (2026-10-21)

Repo `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Actual branch `recovery/visual-dev-reconstructed`, base HEAD
`0621d442435847c92ab200e10fabb86561c882b7`. Origin verified
`https://github.com/datdooo/short-video-studio.git`; fetched successfully, remote
ancestor of base HEAD (7 local commits ahead,0 behind before checkpoint).
User explicitly requests push all valid source after fixes; WAIT before packaging.
Never infer final commit/push SHA from this static file: read actual Git and remote.

Latest SOURCE changes, not runtime acceptance:
- Audio mix: balanced VAD expression + st/ld, task-owned graph file for both preview
  and common export encoders; no giant nested chain/argv. Versioned mix cache,
  obsolete audio ownership cleanup, explicit retry, safe stage diagnostics and no
  unrelated-part teaser gate on music preview. `docs/music-mix-fix.md` records the
  actual user error versus code-confirmed parser defect; real fix not reproduced.
- Text-only Gemini/Muse: shared native hookInput, full evidence collector and
  winner/main rules. Complete collected transcript/comments/replay/local numeric
  signals, IDs/locks/gaps/padding. No images/video/file/ZIP/base64; no vision claim.
  Ordered clipboard blocks/manifest when long. Exact cue track + full revision
  bound to prompt, worker-side external hook attachment/validation; errors preserve
  plan, no automatic provider replacement. See `docs/web-ai-text-workflow.md` for
  data comparison, boundaries and manual acceptance steps.
- UI: source260→320px (narrow drawer360px max), provider outside Advanced; one
  Tạo prompt/Copy row and bounded128px JSON box, no duplicate Generate action;
  original title appears once, ready source styled semantic success. Inspector
  equal tab cells; select long labels grow to fit instead of overflowing fixed
  height; Kho search focus kept inside frame. Shared Copy error text shortened.
- Candidate video click now toggles play/pause; compact transport mostly one row,
  two rows only under170px width; reclaimed height allocated to larger9:16 picture.
  Existing handlers/source timestamps, part drafts/catalog order, preview1x,
  export1.25x/foreground framing, snapshots and render-resource fixes preserved.
- Auto model explicitly gpt-6-luna + reasoning.none + requested service_tier.fast.
  Diagnostics distinguish requested/actual Fast; OAuth account access/tier remains
  UNVERIFIED. No silent model/effort/tier fallback on rejection. Earlier no-Fast
  notes are historical. See latest `docs/ai-efficiency.md`.

No tests, lint/typecheck, browser automation, AI/YouTube/ASR/render/listening or
benchmark was started. Diff reviewed only. No production/auth/media/export/backup
mutation, job interruption or application restart. Preserve all prior source work.

LAST completed DEV package: `/tmp/shortcut-dev-pinned-gpt6-luna-20261021.log`,
exit0, app `release/dev/ShortCut Studio Dev.app`. Completed before the audio/UI/
external-text/Faster changes above; it DOES NOT contain these latest source fixes.
Do not package again until owner requests. Read-only worker68988 cwd was preserved
at `release/dev/.build-XSxlbm/previous-build.app/Contents/Resources/app`; do not
restart it or kill its jobs. No newer artifact equivalence/runtime QA is claimed.

All pending source at base HEAD is included in the reviewed source checkpoint,
including earlier AI efficiency/resources/cancel/delete/UI work documented below.
Only available reconstructed history is publishable; no missing original local
checkpoints were recovered. Media/build/cache/runtime/log data stay ignored.

---

# Active update — AI efficiency + usable editor during render (2026-10-21)

LATEST owner model pin: GPT-6 Luna (2026-10-21)
- User explicitly permits fixed model. Shared ANALYSIS_MODEL='gpt-6-luna' in
  lib/ai-reasoning.mjs (+declaration) now selects native main/teaser/Custom/retry/
  repair and legacy OpenAI route. No models[0]/first-gpt heuristic or legacy
  OPENAI_MODEL override. External Gemini/Muse intentional imports unchanged.
- reasoning.effort=none, the documented lowest supported effort. Light/Faster
  labels are not API values; no Fast/priority/pro service mode added. Native model
  selection no longer needs /models per Generate; existing auth check on actual
  requests and model/capability rejection remain, no silent model/effort fallback.
- Official GPT-6 Luna page confirms Responses, image input, structured outputs,
  none effort. Account availability/inference NOT verified: no AI call/tests.
  New logs will distinguish requested/actual; cannot promise quota percentage or
  measured latency improvement. Cache keys already include model+policy; old
  Sol selections/history/jobs remain readable and are never relabeled as Luna.
- Source diff checked; DEV package status to be recorded after completion.
  All prior uncommitted work preserved, HEAD0621d44, no push/merge.

LATEST active follow-up (same dirty source preserved; base0621d44):
- User asks thorough AI latency/quota fix, adds opened Nâng cao border and delete
  after cancel fix. Scope complete in source, no tests/provider/render/ASR/YouTube/
  browser QA or new benchmark. High refers to Codex, not app reasoning/model.
- Existing112163ms log diagnosed: main cache, discovery1 + separate repair1/
  final1;229879 input/2798 output, all low, no provider cache. Discovery catch
  replaced range/schema subtype with generic code; no raw output was logged,
  so exact original Part1 subtype cannot be recovered honestly.
- worker/ai-input.mjs new dependency-free JSON table/string transport. Exact
  roundtrip guard/fallback, no value sampling/clipping/rounding; used by native
  main/teaser/repair. Metrics raw/sent characters + format, not token/quota guess.
  Purely architectural reference to TOON/OpenAI latency docs; NO code copied or
  new package/framework/model. See docs/ai-efficiency.md for design and links.
- Complete evidence fitting120k chars AFTER encoding skips discovery. Keep
  existing successful caches (content/full evidence already in identity).
- Discovery now intervalId+source anchor, bounded local inspection neighborhood
  only; final AI/manual cut timestamps never adjusted. Keep valid moments even
  if another proposal is invalid; legacy cached start/end moments supported.
  Precise safe rejection codes and anchor frame, existing image caps preserved.
- Failed discovery of one part repaired IN final paired request when budget
  remains instead of splitting both finals. Same two opportunities/part, only1
  winner/part, native low unchanged. No local heuristic promoted as winner.
- Delete root: isBusy was SOURCE scoped even for per-job output moves; unrelated
  render/ASR/BGM of same source blocked a finished/cancelled job. Part/parts guard
  now job scoped, original-source guard unchanged; bulk eligible helper aligned.
  Zero-output deletion already handles ENOENT. API/paths/trash/confirm semantics
  retained. Poll read errors separate from mutation errors so successful1.2s
  polling cannot erase DELETE failure. No actual user job/file deleted to test.
- Nâng cao button unchanged, opened content now bordered card via CSS; secondary
  Yêu cầu AI kept; mounted inputs/drafts and callbacks retained.
- Final combined Node22 DEV packaging completed exit0, log
  `/tmp/shortcut-dev-ai-payload-discovery-delete-20261021.log`. New app:
  `release/dev/ShortCut Studio Dev.app`; includes ALL changes above. Artifact hash
  comparison6 worker/library files +1395 frontend runtime files:0 mismatches,
  excluding existing declaration/map trim policy. Signing/compatibility steps
  succeeded as part of packaging; no runtime QA or inference was performed.
- Live DEV67217/67218 preserved at
  `release/dev/.build-5y9trs/previous-build.app/Contents/Resources/app`; no restart,
  render cancellation/deletion or other job interruption. Reopen NEW DEV normally
  when current jobs finish to load the changes. Only docs changed after build.
  Source still uncommitted on recovery/visual-dev-reconstructed, HEAD0621d44;
  no push/merge. Old entries below describe earlier artifacts.

LATEST cancel-render correction + final DEV artifact (2026-10-21):
- User screenshot shows cancelled0% job still “Đang hủy” while another job runs.
  Source confirms queued controller was retained until serial renderQueue reached
  that promise; renderSnapshot treated its presence as active cleanup. Fixed
  worker/server.mjs: track started controllers separately, release unstarted
  cancellation immediately + detach parent abort listener. Old queued promise
  skips work and catch/finally are controller-identity guarded so resume/delete
  cannot be overwritten by stale cleanup. Running-job cancellation still retains
  controller until actual owned-command cleanup; SIGTERM/3sSIGKILL group behavior
  unchanged. No running render stopped/reproduced to test this change.
- One combined Node22 DEV package completed exit0, log
  `/tmp/shortcut-dev-ai-single-winner-20261021.log`, including latest AI/secondary
  button changes below. Cancel report arrived during packaging after worker copy;
  copied final worker/server.mjs only into NEW DEV app, signed+verified exit0.
  No second frontend build. App `release/dev/ShortCut Studio Dev.app`.
- Artifact hashes:4 changed worker modules +1395 generated frontend runtime files
  match final source/output (existing declaration/map trim excluded). Only docs
  edited afterward. No tests/provider/YouTube/ASR/render/browser/listening QA.
- Live DEV65089/65090 retained at
  `release/dev/.build-D6gBf1/previous-build.app/Contents/Resources/app`. No restart,
  signals, job cancellation, production/credential/media/export/backup changes.
  Current live worker does NOT have this patch; reopen NEW DEV normally only when
  active work finishes. Do not imply the stuck live job was fixed in place.
- Source still uncommitted on recovery/visual-dev-reconstructed, HEAD0621d44.
  No push/merge. Do not claim measured speed/quota improvement or cancel QA pass.

LATEST follow-up after user's real 13-minute-video Generate report:
- Existing DEV AI_OPERATION log matches249544ms/5 calls: main1 + discovery/final
  separately per part. gpt-6.1-sol, actual reasoning low all5,281389 input tokens,
  6557 output,274 reasoning,0 cached. About230.7s provider/reading,15.5s frames.
  No new inference, source download, ASR, tests or benchmark run for diagnosis.
- Source now pairs long-catalog discovery and final selection across2 eligible
  parts; normal long cold path3 total calls including main, short path2. Common
  video evidence factored recursively without dropping coverage/frames/content;
  exact original neighboring evidence still retrieved for final decisions.
  Same2 inference opportunities per part, no additional hidden retry; successful
  caches/locks/custom/one-part operations retain independent behavior.
- Latest user request: only1 native winner per part, request schema alternatives
  maxItems0/output ceiling2500single/5000pair, concise Vietnamese explanation.
  Historic/external schema, saved candidate catalogs and job snapshots preserved.
- Request diagnostics now include phase/input characters/images/part count.
  Discovery-to-final no longer presented as failed retry. Actual reasoning stays
  low; no model/auth change or fabricated quota/speed saving.
- UI steering: Nâng cao unchanged. Yêu cầu AI has transparent secondary styling,
  light hover/expanded background; same size/focus/state/mounted input.
- See docs/ai-efficiency.md for updated bounds; old counts/alternatives below
  describe prior state. Diff reviewed only; app update status to be recorded after
  final combined DEV packaging. Source remains uncommitted, no push/merge.

LATEST packaging update: user explicitly resumed packaging after UI cleanup.
- Node22 DEV package completed exit0. App:
  `release/dev/ShortCut Studio Dev.app`; final log:
  `/tmp/shortcut-dev-ui-cleanup-package-final-20261021.log`.
  Includes all pending source changes below, including Advanced/instruction
  buttons, bounded prompt input and copy cleanup across workspaces.
- First attempt compiled frontend but sandbox denied yt-dlp's startup semaphore
  during the packager's version check. Retried normal DEV packager with required
  permissions; launcher, runtime compatibility audit and signing completed.
  First log `/tmp/shortcut-dev-ui-cleanup-package-20261021.log`.
- Artifact-only comparison: 11 changed worker/library files and 1395 frontend
  runtime files match source/generated output. 1362 declaration/source-map files
  intentionally omitted by existing trimRuntime policy. No runtime UI/inference/
  playback/render tests, no app opened or restarted, no job cancellation.
- DEV listeners62618/62619 existed before packaging; final read-only lsof found
  no listeners on5273/8887. Do not assume the app is currently running. Existing
  previous-build stages were preserved; production/media/exports/auth untouched.
- Branch remains recovery/visual-dev-reconstructed, HEAD0621d44; all source work
  remains uncommitted, no push/merge. Only this documentation changed after build.
  The earlier WAIT notes below are historical and superseded by this build.

LATEST source-only UI follow-up (same uncommitted work preserved, base0621d44):
- Latest copy cleanup: removed redundant static guidance across Editor, Batch,
  Kho, render history, template/filter/text/animation/transition panels; shortened
  empty states and music status copy. The OAuth Keychain/DPAPI paragraph was
  already absent from source before this follow-up (old running app can show it).
  Removed stale render-history claim that each part drops one second. Retained
  actual errors/progress, teaser AI evidence/explanations, timing warnings,
  destructive-action confirmations and concise unverified music-link notice.
  UI text/conditional empty status only; no processing/API/auth/payload changes.
  Diff reviewed + git diff --check only; no tests/build/package/runtime QA.
  Additional presentation files touched: music-panel, media-library-panel,
  editor-render-list, teaser-candidate-review, teaser-editor, visual-template-panel,
  video-filter-panel, text-style-panel, text-animation-panel, cut-transition-panel.
- Latest refinement: Nâng cao and Yêu cầu AI now use shared
  `components/source-options-section.tsx` with actual shadcn Button, aria-expanded/
  controls, theme border/chevron and hidden-but-mounted content. Outer uses the
  existing persisted sourceAdvancedOpen; inner defaults closed, never resets
  instruction text. Textarea's shared field-sizing-content caused prompt-driven
  unbounded height; only this input overrides field-sizing:fixed,120px height,
  96–180px resize bounds and inner scroll. No global Textarea behavior changed.
- Gemini/Muse inside Nâng cao now always has Tạo Prompts (actual full prompt
  generation) + Copy prompt (actual clipboard), no web-open anchor or manual
  Prompt view/copy disclosure. Copy disabled if missing/stale/processing.
- Removed hook-only prompt generation/import branch from the editor and its
  imports/button. Legacy saved hookPlan context remains readable but stale and
  requires new full prompt; saved selected teasers/plans are not deleted.
- Yêu cầu AI is a compact default-closed disclosure, same instruction state/
  payload. Yêu cầu bổ sung stays outside/visible. Advanced and child disclosure
  headers share theme tokens/control radius/height/chevron/focus/selected style.
- Removed verbose static web/manual/security instructional paragraphs from this
  Advanced area; retain actual errors, stale warnings and AI explanations.
- Earlier disclosure/prompt UI changes are app/page.tsx + globals.css + new
  source-options-section.tsx; latest copy cleanup also touches files listed above.
  No tests/QA/provider/build/package/restart/push. Last built app below predates
  these UI changes. User explicitly asked to WAIT before packaging any more.

Actual start branch `recovery/visual-dev-reconstructed`, clean HEAD
`0621d442435847c92ab200e10fabb86561c882b7`, cached origin ahead7; no fetch/remote
verification or push/merge. All prior render/preview/candidate/source work kept.
Latest three user scopes are combined, no build/provider/test yet at this note:

- `docs/ai-efficiency.md`: native Responses adapter now explicitly lowest
  supported reasoning from numeric API capability metadata or documented catalog,
  not Light-label mapping. Same selected model/retry policy, config error rather
  than implicit default/escalation. Unknown/Qwen capability explicitly unsupported;
  Gemini/Muse web effort beyond app control. Actual effort only confirmed if
  response echoes it; no real inference was run. Cache/version includes policy.
- Shared provider per Generate; eligible short2part teaser request combined,
  exact common evidence serialized once, independently validated/part-local
  repair. Long catalogs keep discovery/original-neighborhood evidence and bounds.
  Main retry keeps images unless explicitly unsupported and sends rejection
  detail. No auth/quota/config retries disguised as repair. Short normal2 total
  AI requests; max5 short,6 long,2 for single-part retry (inference calls only).
  Frame cache12MiB disk +8MiB LRU replaces repeated sample decoding; fresh mốc
  still accurate individual seek, max48/45s. No decoder batching/quality claim.
- Real NDJSON phases+elapsed+Stop for Generate/custom/retry; safe per-operation
  model/requested+actual effort/count/usage/retry/timing logs. No prompt/token/
  source payload logs. Shared join explicitly0newrequests; terminal log can record
  later usage after first subscriber cancels. No fake %/ETA.
- Removed silent transcript100k-prefix at UI/canonical binding. Guard1M chars
  reports error, no tail dropping; old selected long-prefix bindings can need
  reselection on NEW jobs. Saved jobs/files not mutated. Full-video catalog and
  raw regional retrieval remain; coverage limitations disclosed.
- `docs/editor-during-render.md` supersedes old pause-on-export: main/candidate/
  Batch playback, BGM, source preparation/edit/Generate/style/Timeline continue.
  Resource dispatcher1export +1serial Editor task, nested owner/cancel preserved,
  Editor queue64; metadata1serial with export-only reserved slot. No app kills,
  extra export or old fan-out graph. Old global-one-heavy requirement superseded.
  One long EditorASR/upscale can delay other heavyEditor tasks, not browserplayback.
  Actual M2 RAM/latency unmeasured. Job submission response no longer overwrites
  current editor plan; queued snapshot remains immutable.
- User later requested lower bitrate: VT16→12Mbps, max20→14,buf32→24. CPU default
  CRF17→ABR12M/max14/buf24; explicit FFMPEG_CRF overrides retained. Still1080×1920,
  30fps, preview1×/export1.25×, framing125%, AAC192k, Rec.709 and metadata clean.
  TikTok official guide does not prescribe universal middle bitrate;12M is our
  engineering choice. No promise bitrate change alone speeds filter-heavy graph.

Implementation/diff and independent resource/selector review only. NO tests,
lint/typecheck, browser QA, provider/AI/YouTube/ASR/render or benchmark. Official
OpenAI/TikTok docs read for capability/specs only. No credential/auth change,
new model/dependency/framework, production/source media/export/backup changes.
LATEST USER STEERING: wait before packaging any more. Do not start another build
or refresh until the user resumes packaging. Current source remains UNCOMMITTED;
base HEAD0621d44, no push. Preserve all pending files in git status.

Build already finished immediately before that instruction arrived:
- Full Node22 DEV package exit0, log
  `/tmp/shortcut-dev-ai-editor-12mbps-20261021.log`. User then finalized target12M /
  MAX14M (not16M). Worker was refreshed and app signed again, exit0.
- Final UI request-identity/double-click correction required a frontend-only
  refresh (runtime/launcher reused), exit0; log
  `/tmp/shortcut-dev-ai-editor-final-refresh-20261021.log`. App signed+verified by
  packaging, no runtime QA. Latest app `release/dev/ShortCut Studio Dev.app`.
  No independent final all-file hash comparison performed after the stop request.
- No app opened/restarted or job interrupted. Last read-only cwd for live DEV
  PIDs57591/57592: `release/dev/.build-I2UnVd/previous-build.app/Contents/Resources/app`.
  Preserve that active old app. No further package/process/cleanup actions after
  user requested waiting. This build's temporary Swift cache is still present;
  do not broadly clean old stages/media. No backup/bundle created.
Next action: wait for user's next changes; continue source only if requested.
Do not start a package automatically merely because these notes are read.

---

# Active fix — source probe during export / redundant render work (2026-10-21)

Actual base HEAD `0bbc6ff3d696d63698c1226f226c0316d2d99e1e`, clean at start,
branch `recovery/visual-dev-reconstructed`, cached upstream ahead6. Remote was
not fetched/reverified; no push/merge. Preserve all earlier fixes.
Read `docs/source-probe-render-performance.md` for cause, paths and limits.

Read-only live health/job snapshot: render active,2 waiting, part1/progress19,
VideoToolbox and no CPU fallback. Existing launcher tail had no probe failure.
No new render/download/AI/ASR/browser/test/lint/typecheck/benchmark was started.

SOURCE changes:
- ffprobe no longer waits for full export's heavy lease. Independent serial
  metadata lane,1 running/16 background waiting +1 reserved priority slot for
  heavy-owner verification,1 thread,5MB/5s probe. Background deadline30s including
  wait; heavy-owner deadline30s starts at execution. Retains inherited job abort,
  child group cleanup and process priority. Explicit busy/timeout errors, no
  full redownload fallback for these local errors. Cache/new source load and
  preflight/resume now carry existing signals into probe.
- FFmpeg mux/upscale still uses exclusive heavy lease; progress reports waiting
  render/resource versus actual work. Does not turn normalization into concurrent
  export. Download byte progress and API/result schema remain.
- Transition blend timeline-enable uses exact existing windows and math; no
  full-foreground pixel-expression work outside effects. Wash/alpha still run.
- Per-part subtitle SVG→PNG reuse capped256 entries; identical bitmaps only,
  unchanged concat order/durations/tail. No global media cache/dependency.
- No encoder/bitrate/CRF/resolution/FPS/speed/framing/audio/metadata-policy change.
  Finite packet range assembly and M2 thread/resource protections preserved.

Diff reviewed, including independent read-only cancellation/admission review.
No speedup/quality/UI runtime claim. User manually accepts. One final combined
Node22 `npm run package:mac:dev` (nice10) completed exit0; log
`/tmp/shortcut-dev-probe-render-efficiency-20261021.log`. App current with source:
`release/dev/ShortCut Studio Dev.app`; six changed packaged worker/lib modules
hash-match source, frontend compiled in this build. Only docs edited afterward.
Live DEV PIDs54307/54308 and active render left alone; cwd now
`release/dev/.build-sCvZgk/previous-build.app/Contents/Resources/app`. Retain this
old app until jobs finish. User normally quits/reopens the new DEV app afterward;
the live worker still has old code, so its waiting imports are not fixed in place.
No new bundle/backups and no user media/exports/credentials/production touched.
Removed only this build's generated Swift/icon scratch
`$TMPDIR/shortcut-mac-build-OxIzY0`; retained old app is in active use. App allocated
du size293748KiB; no APFS free-space recovery claim. No broad cleanup.
Source/docs checkpoint committed locally after build (use `git log -1` for SHA);
no push, cached upstream now ahead7; remote not live-verified.

---

# Active update — preparation button download percent (2026-10-21)

Actual clean base `286e7394947d22d6b13bb3fe8ada0fcf8451245b`, same DEV branch.
User requests % on the button after pasting link; interpreted explicitly as
“Chuẩn bị nguồn”. Read `docs/source-preparation-progress.md`.
- Reuse actual yt-dlp byte counters; per-stream video/audio/media %, ≈ for
  estimated byte totals. Other phases/fallback/local upload show stage labels,
  never timer-based %. Source ready only after full existing pipeline succeeds.
- Optional NDJSON progress on existing POST; default JSON201/API consumers and
  source-reuse/shared cancellation/cache identity unchanged. No polling/job/db,
  dependency or extra extraction. Numeric progress only, no signed URLs/cookies.
- Source/request guards discard stale UI events. Bounded observers/line buffers/
  writable queue; finally unsubscribes/readers release. Errors remain inline.
- Source edits only page.tsx and worker/server.mjs + youtube-downloader.mjs; worker
  packaging already copies these files, no new runtime manifest entries needed.
  No renderer/teaser/quality/auth/production/media/export/backup changes.
- Official yt-dlp progress-template documentation consulted, no upstream code copied.
NO tests/lint/typecheck/browser/YouTube/AI/ASR/render or trial download. Manual
acceptance remains user-owned. Initial package finished before a final missing-
field JSON-template correction (`|null` rather than NA) was made. Final combined
Node22 `npm run package:mac:dev` finished exit0; app
`release/dev/ShortCut Studio Dev.app`, final log
`/tmp/shortcut-dev-source-preparation-progress-final-20261021.log`. Two packaging
invocations: first superseded by final JSON-null correction; final includes all
current source. Packaged worker hashes match source. Only docs edited afterward.
No app/worker restart or job interruption; read-only lsof found no DEV listeners
on5273/8887 at delivery. No push/merge. Source/docs committed locally; use
`git log -1` for SHA. No download/runtime acceptance claim.

---

# Active fix — candidate Play waits for its source seek (2026-10-21)

Actual clean base `6069a757bc10df8d405cf0f1ccc5d4e3380eb584`, same DEV branch.
User reports option2 does not start with Play until nudging candidate seek slider.
Static source diagnosis only: RangePlayer wrote currentTime on metadata and
immediately requested play, had no seek-ready continuation, and wrote currentTime
again inside onSeeking for any exact-boundary deviation. Parent audition
coordinator correctly excluded the current part. No live event trace was taken;
these source races are consistent with the symptom, not runtime reproduction.

Only `components/teaser-candidate-review.tsx` player lifecycle changed:
- Explicit seek target -> available frame data (`readyState>=2`, not seeking,
  within one-frame tolerance) -> guarded Play. Exact plan range unchanged; decoder
  tolerance is not timestamp snapping. Initial metadata, cached/no-op seeks,
  paused scrubs, replay and reset share one readiness path.
- No corrective timestamp writes inside onSeeking. Clock/end guard waits out seeks;
  actual playback UI starts on playing. Button can cancel pending start.
- Newer seek/Play, Pause, choice/source/part/workspace teardown and export suspension
  abort listeners/clock/deadline. 15s bounded initialization; stale callbacks cannot
  start/pause a newer command. Native pause retains intent only during explicit
  startup, not during ordinary playback.
- No loading text/dark veil reintroduced, no additional player/decoder/dependency.
  Main preview, candidate order/Apply, source timings, export, BGM and locks unchanged.

NO tests/lint/typecheck/browser/render/AI/YouTube/ASR/media audition. User accepts
manually. One Node22 `npm run package:mac:dev` completed exit0. App
`release/dev/ShortCut Studio Dev.app`; log
`/tmp/shortcut-dev-candidate-play-start-20261021.log`. Current source is built;
only docs changed afterward. Build success is not playback QA.
No app/worker restart or job stop; listener PIDs49655/49656 left intact, still
using the old app tree moved to previous-build by packaging. Reopen DEV normally
when jobs finish to load the patch. No push/merge or production/data/credential/
export/backup changes. Source/docs committed locally; use `git log -1` for SHA.

---

# RESUMED — final UI integration (2026-10-21)

User explicitly resumed the paused handoff. Actual starting Git:
`recovery/visual-dev-reconstructed`, HEAD
`578ded553feb11ec7780eba213b582555a897fb3`, clean. All earlier checkpoint work
preserved. No push/merge; remote not fetched/reverified for this scoped UI turn.

Completed source review of candidate/editor/drafts, Batch/Kho layout and controls;
no new feature scope/research/engine changes. Narrow follow-up corrections:
- Review catalog was keyed by playback URL (temporarily empty on hydration, blob
  for local media). It could be overwritten before saved source reopened. Review
  now waits for session + managed source, uses canonical managed media identity,
  and exact content/cue/request hashes. Known legacy URL hashes migrate unchanged
  catalog order/focus. Unknown historic blob hashes are not guessed; selected
  teaser remains in the plan, and unrecoverable older UI catalog may need retry.
- Batch's forced180px+180px rows could overflow a short viewport while workspace
  clipping hid the bottom. Zero-minimum tracks let existing inner panes scroll.
- Long filenames in download actions may grow beyond common36px minimum rather
  than overflowing a forced36px box. Regular buttons/compact variants retained.

Latest loading-text/dark-overlay removals from578ded5 remain in source; buffering,
BGM timing/errors and transition presets are unchanged. Preview1×, export1.25×,
framing125%, main/locks/timestamps, provider algorithms and render-lag engine fixes
unchanged. No worker/production/credential/media/export/backup edits.

No tests/lint/typecheck/browser/smoke/render/AI/YouTube/ASR or listening run.
User manually accepts. One combined Node22 `npm run package:mac:dev` completed
exit0. App `release/dev/ShortCut Studio Dev.app`; log
`/tmp/shortcut-dev-handoff-resumed-final-20261021.log`. All current source changes,
including prior loading-overlay removal, are in this app; only docs edited after
build. No package retry, smoke or runtime QA. Never equate build success to
playback/layout/inference qualification. Running DEV web/worker PIDs39230/39231
remain on old `.build-8Qtejy/previous-build.app`, left alone. User normally quits
and reopens the new DEV app after jobs finish; do not restart active jobs.

Source/docs committed as a coherent follow-up (use `git log -1` for SHA), no push.
Manual checklist: retry -> candidates append / Apply keeps order -> reload both
parts; Space play/pause + seek without loading overlay; short-window Batch/Kho
scrolling, long filenames, icon insets and consistent Inspector controls.
Unknown old blob-URL catalog hashes may need new choices; saved selected teaser
and all main ranges/history/job snapshots are preserved.

---

# HANDOFF NOW — user paused implementation for quota (2026-10-21)

**Stop new implementation. Preserve all work.** User requested immediate handoff.
DEV `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Actual branch `recovery/visual-dev-reconstructed`; base HEAD
`ff4b6b7c5d2caa3549be89f94ffc6c9e715c83b9` before this handoff checkpoint.
Origin `https://github.com/datdooo/short-video-studio.git`, upstream
`origin/recovery/visual-dev-reconstructed`. No push/merge this turn; remote SHA
NOT rechecked live. Cached upstream comparison before checkpoint: local ahead2,
behind0 (not live remote verification). Use actual `git log -1` after checkpoint
for current HEAD.

## Current saved source / work in progress

All current dirty changes belong to this UI follow-up; preserve all12 files:
`app/globals.css`, `app/page.tsx`, `components/media-library-panel.tsx`,
`components/music-panel.tsx`, `components/studio-render-status.tsx`,
`components/teaser-candidate-review.tsx`, `components/teaser-editor.tsx`,
`components/visual-customize-panel.tsx`, `components/visual-template-panel.tsx`,
`lib/editor-session.ts`, this file, `docs/teaser-candidate-review-ui.md`.
Planned checkpoint is explicitly unverified UI work, not acceptance completion.

Implemented in SOURCE, no runtime acceptance:
- Candidate panel always open, 9:16 player LEFT/options RIGHT; no toggle/closeX.
  Removed lower duplicate view/details/help and Apply/Discard buttons. Upper
  Apply remains canonical. New/retried choices append to bounded24 UI catalog,
  Apply does not reorder; source/part/context SHA and restore whitelist included.
- Main transport centered under its own portrait column, slider own row. Space
  toggles MAIN via existing Play/Pause/BGM lifecycle (no typing/button hijack).
  User withdrew arrow-key issue: DO NOT change arrow/seek behavior for that report.
- Removed main “Đang giải mã đoạn kế…” row. **Latest edit also removes candidate
  “Đang tải đoạn nguồn…” dark overlay.** Actual buffering/audio/error handling
  retained. Do not remove transition presets based on this UI-loading request.
- URL/search icon padding specificity fixed. Success restore notice clears4s;
  corrupt/save/source warnings retained. Header/footer compact controls; footer
  blockers reflect actual worker/analysis/subtitle/part validation states.
- Inspector4 disclosure headers common padding/min36px. Normal actions36px,
  chrome/Timeline/icon compact variants retained; no force sizing of video cards.
- Full-width Batch: setup ABOVE queue in main column, real preview on right,
  independent scroll; advanced requirements folded, callbacks/state unchanged.
- Full-width Kho:4 tabs remain. Fixed search/tabs, only selected content scrolls,
  compact file/job rows, existing preview; no extra thumbnail loads or mock data.
- User ZIP design reference `PLWhL13ZgwoMsXXn-grok-workspace.zip`: read batch/library
  TSX + relevant CSS and viewed bundled screenshots. DESIGN ONLY, no copied
  mock/context/model/auth code/assets/dependencies. Editor geometry/rates, worker,
  render lag fixes, provider algorithms and data handlers preserved.

## Build / app state — distinguish from source

App target `release/dev/ShortCut Studio Dev.app`.
Several earlier builds completed before incoming user refinements; they do NOT
prove newest source. A sandbox build compiled frontend but failed at bundled
`yt-dlp --version` semaphore probe (Operation not permitted); elevated packaging
succeeded afterward. No AI/download/ASR/render QA occurred.

Most recent packaging command was already running when user requested pause:
Node22 `npm run package:mac:dev`, log
`/tmp/shortcut-dev-grok-workspaces-final-20261021.log`, exec session16561.
At handoff preparation log reached “Compiling macOS launcher…”. It includes
Grok Batch/Kho design, but **does NOT include latest candidate loading-overlay
removal made after frontend compilation**. Do not call app source-current even if
this packaging finishes successfully. Do not start another build during handoff.
Final build state: packaging completed exit0 during documentation preparation.
Latest overlay removal remains SOURCE ONLY, not in this app. No more build run.
Next session must finish diff review
then build once ONLY when user resumes; no runtime tests/QA/provider calls.

Read-only lsof: DEV web/worker PIDs39230/39231 still running. Earlier confirmed cwd
`release/dev/.build-8Qtejy/previous-build.app/Contents/Resources/app`; app not
restarted, jobs not interrupted. User normally closes/reopens latest app once
jobs finish. Do not kill app/worker to refresh UI.

## First actions for next session

1. Read this entire file and actual Git/status. Preserve checkpoint + any newer
   modifications; no reset/clean/stash/branch switch. No push unless newly asked.
2. Ask for/receive resume scope; user currently paused implementation. Do not
   silently resume features just because handoff is read.
3. If resumed: inspect the12-file checkpoint, especially CSS breakpoints/scroll
   ownership and candidate catalog/draft restoration. Review source only; user
   manually accepts. No tests/lint/typecheck/browser/render/AI/YouTube/ASR.
4. Latest source needs a final DEV package build because overlay edit postdates
   compilation. Use Node22. Do not interrupt live jobs/restart worker. No bundles,
   production/data/credential/media/export/backup operations.

Not verified: runtime sizing/scroll/focus, media playback/audio, candidate reload/
stable order/Apply and Space behavior. Build success is NOT visual QA.

---

# Active follow-up — compact chrome / preview controls (2026-10-21)

Preserves all pending candidate layout/catalog changes below, base `ff4b6b7`.
- Removed main-preview “Đang giải mã đoạn kế…” presentation. The same bool is
  raised during ordinary seeking too, so it was misleading and added/removed a
  row while scrubbing. Keep actual buffering/BGM synchronization, timeout/error
  handling and all transition presets; no decoder/engine change. Candidate player
  loading text/dark overlay also removed; internal buffering flag retained so it
  does not flash a Play overlay while waiting. Actual media errors still visible.
- Search/YouTube icon overlap: generic input padding had higher CSS specificity
  than icon field overrides. Explicit icon-input class wins that rule, reserves
  36px left inset; search icon vertically centered. Source/search handlers unchanged.
- Successful restore notice clears after 4s; corrupt/missing-source/save errors
  remain visible. Cleanup cancels old timeout; no draft or job data discarded.
- Header/footer use compact 32px controls / 40px base bar; small panel toggles.
  Footer reports actual worker/analysis/subtitle/validation state, correct part
  for teaser issues and still shows real job errors/progress/download actions.
- Space toggles MAIN preview via existing Play/Pause coordination, ignores key
  repeat/IME/text entry/buttons/menus/dialogs; works on main seek slider too.
  User withdrew arrow-key bug report: left/right behavior deliberately unchanged.
- Inspector Template/Customize/Subtitle/Music use common disclosure padding and
  36px minimum header; normal text actions share36px across Editor/Batch/Kho,
  compact chrome/Timeline/icons retain compact variants. No handler changes.
- Kho workspace no longer scrolls globally: search/tabs fixed, only selected
  TabsContent scrolls; removed nested file/job-list scroll cap within Kho only.
- Batch now fills viewport: setup / queue / existing preview, independent pane
  scroll and responsive stacking. Queue JSX moved only; callbacks/state/job IDs
  unchanged. Latest Grok ZIP reference uses setup ABOVE queue in the wide main
  column and existing preview on the right. Advanced batch controls grouped in a
  disclosure. Kho removes max-width and uses compact file/job list rows plus its
  existing preview. Only selected tab content scrolls, not whole workspace.
- Design reference only: user ZIP `PLWhL13ZgwoMsXXn-grok-workspace.zip`,
  read batch-view/library-view/styles and viewed bundled batch/library screenshots.
  No mock/provider/model/auth code, sample images, new dependency or upstream
  code copied. Existing data/actions retained; no thumbnail fetches introduced.
- No tests/lint/typecheck/browser/render/provider/ASR/YouTube. First combined build
  compiled frontend but sandbox denied bundled yt-dlp semaphore probe; final
  package retry succeeded before late Batch/Kho steering; final full-source build
  pending; no app/worker restart, job interruption or push.

---

# Active update — remove duplicate teaser presentation (2026-10-21)

Base `ff4b6b7`, same DEV branch. Removed lower “Xem ứng viên và phát thử” button,
“Teaser Part … · AI API” accordion and “Trợ giúp teaser”. The upper review panel
remains authoritative for viewing choices/explanations; Timeline edit controls,
validation, source timings, stable candidate order and all handlers preserved.
Follow-up layout: inside candidate area, portrait9:16 player LEFT; options and
explanations RIGHT. Main clock/transport now lives in the main portrait's own left
column, seek slider in its own centered row under that video. Candidate area is
ALWAYS OPEN: no toggle/close X. Compact center<680px stacks the two areas with
internal scrolling, never hides main behind a closeable overlay.
Retry/new proposals append to a bounded24-choice source/part/context UI catalog,
including AI alternatives; Apply never reorders it. One Apply in the upper review,
no lower Apply/Discard buttons. Manual Timeline edits enter the upper review too.
Catalog/focus UI draft keys are included in the existing restore whitelist.
Catalog context is a local SHA of source/main/cues/request; stored parts are
validated and only chosen teaser/custom fields go through the existing parent
Apply handler. No source crop/zoom/rate/engine changes. No tests/browser/AI/render.
Earlier small UI-removal builds finished before additional user instructions;
final combined layout build pending. No app/worker restart or push.

---

# Active update — candidate cards + audition player (2026-10-21)

- Starting clean at `0ef1399672d0a3ea37eefadfd1804718c33f9b94`, same DEV branch.
  Read `docs/teaser-candidate-review-ui.md`. Candidate review portal beside the
  existing main portrait; compact fallback inside preview. One explicitly loaded
  source-range player1×, existing main/BGM audition coordination and teardown.
- Saved card order/focus are source/part/analysis UI drafts; Apply changes the
  selected badge, not card order. Canonical alternative Apply/validation preserved;
  no backend/schema/provider/render engine edits. Main portrait stays mounted.
- No tests/browser/render/AI/YouTube/listening/QA. User accepts manually.
  One Node22 DEV package build succeeded (exit0); app
  `release/dev/ShortCut Studio Dev.app`, log
  `/tmp/shortcut-dev-teaser-candidate-review-build-20261021.log`.
  Only documentation changed afterward. Read-only lsof: active DEV worker/web
  PIDs37083/37084 use `release/dev/.build-n1YQsU/previous-build.app`.
  User normally quits/reopens the new DEV app once jobs finish; no automatic
  restart or job interruption. Build success does not establish runtime UI QA.
  No push/merge, production/credentials/media/exports/backups changes.

---

# Active checkpoint — teaser evidence/replay + audit fixes (2026-10-21)

- DEV only `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
  Branch `recovery/visual-dev-reconstructed`, starting HEAD `69307f4a74150473e8078c2ee15d410a22e6584c`.
  All changes in this active entry are local; no push/merge. Use actual Git refs
  for the final checkpoint SHA, not old historical entries below.
- Read `docs/teaser-evidence-ranking-20261021.md`,
  `docs/video-cut-logic-fixes-20261021.md`, `THIRD_PARTY_NOTICES.md` first.
  Implements approved F1–F9 and defensive R1–R3 from the static audit, IME raw
  draft preservation, manual semantic-warning-only validation, relative GPT
  ranking/alternatives, full bounded evidence / long-video discovery+refinement,
  grouped same-part replay proposals and strong replay tie preference.
- MR.HiSum: **Được tác giả cấp phép riêng để tái sử dụng toàn bộ project, theo
  xác nhận của chủ dự án.** Authors/repo/module attribution only in repository
  notices. Public upstream LICENSE unchanged; no product/video credit or private
  correspondence. Narrow JS port of replay alignment; MomentSearch Apache cue
  chunking port; no VideoITG code/weights/new heavy dependencies.
- No new tests, test/lint/typecheck, browser, render, ASR, AI/YouTube inference or
  listening/benchmark executed. Source review/diff only; runtime quality remains
  unverified. Existing live account evidence does not verify the new selector.
- Build: one combined Node22 `npm run package:mac:dev` succeeded (exit0),
  `release/dev/ShortCut Studio Dev.app`; log
  `/tmp/shortcut-dev-teaser-evidence-replay-build-20261021.log`.
  Frontend build, native packaging/signing completed; chunk-size advisory only.
  No runtime smoke/QA. Only documentation changed afterward.
  Read-only lsof after build: web/worker PIDs29622/29621 still run from
  `release/dev/.build-IQ9dRO/previous-build.app/Contents/Resources/app`.
  Do not restart/interrupt jobs; user normally quits/reopens the new DEV app
  when jobs are finished to load the update.
- Keep manual teaser opening/toggle, exact source HH:MM:SS:FF, preview1×,
  export1.25×, shared height-normalized framing, BGM/ducking/VisualStyle unchanged.
  Old incomplete AI bindings/snapshots/partial final outputs require explicit
  editor reselection/new job where indicated; never silently mutate history.
- Next: user performs manual acceptance from the new app. Read this entry and
  current Git first; do not repeat research/build/provider campaigns. Source/docs
  are grouped into a local checkpoint; use `git log -1` for its actual SHA.
  Do not push, touch production/credentials/media/exports/backups or create bundles.

---

# Source delivery checkpoint — UI/framing/optional teaser (2026-10-21)

User authorized normal push of all current project source to origin on
`recovery/visual-dev-reconstructed`. Remote was fetched and matched local base
`87c3135c5ff176028f378c9f1d32833569e6c75c` before this checkpoint. Includes all
preserved normalized framing, local OFL UI font/controls, manual opening override,
per-part teaser enable/disable persistence/mapping and delivery documentation.
`docs/video-cut-logic-audit-20261021.md` is a REVIEW with proposed fixes, not an
implementation of those fixes. Do not report its findings as resolved.
Latest DEV package build remains the successful combined build recorded below;
no test/render/provider/YouTube/build run for this push. Current source tree
scanned for credential patterns without printing values: no findings. No outgoing
commits existed before this checkpoint; its staged blobs are reviewed separately.
Required font asset/license/provenance included; ignored media/music, exports,
credentials, dependencies, QA payloads, caches/apps/builds and recovery bundles
remain local. No app/worker restart, production changes, force push or main merge.
Use final Git refs/delivery response for the new SHA and remote verification;
this document does not assume a push has succeeded before it actually runs.

---

# Active update — manual teaser opening + per-part toggle (2026-10-21)

Same branch/base87c3135; all pending framing/font/UI work retained. Read
`docs/teaser-manual-toggle.md`. User now permits manual opening source timestamps
and adds per-part Bật/Tắt teaser. This supersedes mandatory hooks on both parts:
only enabled parts require valid teasers; explicit off means main-only. Persisted
optional boolean defaults to on for legacy plans. Shared presentation/transition/
caption/music/ducking mapping, preview mix key, readiness, autosave and AI/import
preservation updated. No main edits or queued-job mutation; no renderer rewrite.
Added/updated focused regression assertions, NOT run. No test/render/provider/
YouTube/browser QA. Browser Use still disabled despite user approval; no bypass.
Combined Node22 DEV build succeeded once (exit0), app
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. Read-only packaged-source/font checks match. Only docs changed afterward.
Current web/worker PIDs27107/27106 still use `.build-iLQdbs/previous-build.app`
(lsof confirmed); reopen the new app normally once jobs finish. No restart, job
interruption, commit, push/merge or production/credentials/media/exports/backups
changes.

---

# Active update — detailed UI audit (2026-10-21)

Read `docs/ui-detail-audit.md`. Same branch/base87c3135; ALL pending UI/font/framing
work preserved. Source fixes include select-arrow padding, base control token
conflicts, nested Inspector indentation, timecode/gap alignment, long controls,
Copy header wrap, native details ownership and a non-scrolling Render action area.
No business handler/API/schema/engine changes. User approved viewing/screenshots,
workspace tabs and panel/disclosure toggles ONLY; no Generate/Render/provider/
download/delete/plan changes. CUA still reports Browser Use disabled in Work
settings; user said they will enable it. NO screenshots obtained yet; no visual
QA claim. No unit/render/provider tests. Final combined DEV build succeeded once (exit0),
including manual teaser/toggle changes: `release/dev/ShortCut Studio Dev.app`;
log `/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. No app/worker restart, active-job interruption or new commit/push/merge.

---

# Active update — Grok-like Vietnamese font + UI polish (2026-10-21)

Read `docs/ui-font-spacing-polish.md`. Same87c3135 base; preserve all dirty
height-normalized framing and UI changes. Primary UI font is now local OFL
Plus Jakarta Sans (Vietnamese in official metadata),176288B variable asset with
license/source hashes under public/fonts/ui. It approximates Outfit's geometric
style; not identical Outfit and no live glyph QA. Inter/Noto fallback retained;
video fonts unchanged. Active UI audit fixes action-row indentation, Timeline
action width, text-field padding, long-heading wrap, label association, menu
viewport limits and portaled new-session controls; existing callbacks unchanged.
Google/web references bounded to official font/Radix/WAI docs. No tests/browser/
render/provider/ASR. Combined Node22 DEV build succeeded once, exit0; app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-jakarta-spacing-polish-build-20261021.log`. Bundled font/OFL
and framing source match local files; only docs changed afterward. No app/worker
restart, job mutation or push/merge. Running DEV PIDs25664/25663 still use
`.build-ZulbHx/previous-build.app` (lsof after build); reopen the new app normally
when jobs finish. User performs manual acceptance.

---

# Active update — restore height-normalized framing (2026-10-21)

Same branch/base87c3135. All newer uncommitted font/dropdown/UI changes retained.
Read `docs/foreground-height-normalized-framing.md`; this supersedes contain-fit
and direct CSS scale guidance below. Geometry now fixes base height1080 then
zoom1.25 once: every16:9 resolution ->2400×1350 centered/cropped inside1080×1350.
Both preview decks use shared geometry percentages without CSS scale; export
filter and transition masks use the same height/aspect/even-pixel rule. No viewport,
text/background positions, clocks, engine scheduling or quality changes.
No tests/browser/render/provider QA. Node22 DEV build succeeded once, exit0;
app `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-height-normalized-framing-build-20261021.log`. Packaged shared
geometry files match source. Only docs changed after build. Current DEV web/worker
PIDs24526/24525 still run from `.build-Z7enLa/previous-build.app` (lsof confirmed);
new framing requires normal quit/reopen when jobs finish. No restart/stop/job mutation.
Manual visual acceptance still required. No commit/push/merge or production changes.

---

# Active update — UI font / dropdown consistency (2026-10-21)

Starting clean at87c3135 on recovery/visual-dev-reconstructed; that checkpoint
was confirmed on origin. Read `docs/ui-typography-disclosures.md`. Actual bundled
Studio Inter name, shared13/12/11/14/20 typography, consistent16px chevrons and
portaled-menu styling. Source-tab inline overrides removed; shared36/40/32 controls
remain. Presentation only; no business handlers/engine/schema/preview geometry or
media changes. NO tests/lint/typecheck/browser/render/provider/ASR. Node22 DEV
package succeeded once, exit0; app `release/dev/ShortCut Studio Dev.app`, log
`/tmp/shortcut-dev-ui-typography-disclosures-build-20261021.log`. Native packaging/
signing only; no runtime QA. Only docs changed afterward; app/worker not restarted. User accepts manually; no new push/merge.

---

# Source delivery checkpoint — 2026-10-21

User authorized normal push of all current source on
`recovery/visual-dev-reconstructed` to
`https://github.com/datdooo/short-video-studio.git` (no merge/force).
Before this checkpoint, local HEAD27625fe matched the fetched remote branch.
This commit groups all preserved pending source: teaser candidate/repair and
speech-boundary refinements, VAD-controlled ducking, Whisper small configuration/
packaging, foreground fit/explicit125% preview zoom, source-panel/logo fixes,
ZIP theme/shared control sizes and four real-data Kho tabs, with delivery docs.
Latest DEV build succeeded: `/tmp/shortcut-dev-direct-125-preview-build-20261021.log`.
No runtime/manual QA was run; user acceptance remains outstanding. Small model
was not downloaded or loaded. Read the active delivery docs below; old QA does
not establish verification of the new checkpoint. No tests/render/AI/build rerun
for push. Current source tree scanned for credential patterns without printing
values; no findings. Only source/docs/runtime declarations are staged; ignored
media/music/exports/data/credentials/build/cache/QA payloads and bundles stay local.
Both portable project skills already tracked. No local data deletion or app restart.
Only available reconstructed history exists; missing original checkpoints were
not recovered. Use `git log -1`, upstream refs and the final delivery message for
this checkpoint SHA and verified push result (not a hard-coded self-referential SHA).

---

# Active update — direct foreground zoom (2026-10-21)

Read `docs/preview-direct-125-zoom.md`. Both visible/standby decks now use explicit
centered scale1.25 on a100% contain-fit video box, rather than measured-pixel sizing.
No extra zoom, viewport/background/text scaling, timing or engine changes. User's
reported missing zoom has NOT been reproduced with runtime QA. All previous dirty
work retained. Node22 DEV package build succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-direct-125-preview-build-20261021.log`. Only docs changed after
build. No tests/browser/render/provider calls or app/worker restart. Reopen the new DEV app normally once jobs finish to load it.

---

# Active update — ZIP theme / Kho / shared sizes (2026-10-21)

Same branch/base HEAD27625fe; inherited dirty implementation preserved. Read
`docs/grok-theme-library-controls.md`. User's ZIP palette supersedes prior warm
colors. Shared normal36/action40/Timeline32/icon32 controls applied to Editor,
Batch and Kho. Kho now has 4 real-data tabs with shared search; original handlers,
polling, job IDs and physical Part files retained. No mock/prototype logic imported.
UI-only changes; previous render/AI/audio/Whisper/geometry work untouched.
Combined Node22 `npm run package:mac:dev` succeeded once, exit0; app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-grok-theme-kho-build-20261021.log`. Native packaging/signing
completed; chunk-size advisory only. Only delivery docs changed afterward.
Source/diff review and build only. NO tests/lint/typecheck,
browser/smoke/render/AI/YouTube/ASR/listening. Do not use older QA/build evidence
below as verification of this source. No restart, commit/push/merge or production/
credentials/media/exports/backups changes. User performs manual acceptance.

---

# Active update — warm controls / fit-based zoom / complete speech (2026-10-21)

Same branch/base HEAD27625fe; ALL inherited uncommitted work preserved. Read
`docs/warm-controls-fit-zoom-speech-endings.md` first. New user styling supersedes
the old Batch/Library palette instruction: warm black/brown/orange#FF5733 controls,
same layout/hit areas/state. Actual foreground uses contain-fit baseline then125%
image zoom, center clip; matching shared export spatial filter, no canvas/text/
background zoom, clocks remain1× preview/1.25× export. Shared speech boundary gates
and v7 prompt/cache require full spoken thought plus short tail; no timestamp
auto-fix, duration-cap truncation or main mutation. Existing plans load; risky old
hooks may need reselection. Cue/phoneme accuracy and semantic quality unverified.
NO tests/lint/typecheck/browser/smoke/render/provider/ASR/listening verification.
Final combined Node22 `npm run package:mac:dev` succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-warm-fit-complete-speech-build-20261021.log`.
Built-in packaging/signature audits completed, not functional QA. Read-only SHA256
matches packaged render-config/teaser-boundaries to current source; only delivery
docs changed afterward. App/worker were NOT restarted and jobs were NOT interrupted.
No push/merge or production/credentials/media/exports/backups modifications.

---

# Active update — editor / teaser / ducking + Whisper small (2026-10-21)

Same branch/base HEAD `27625fe78dc5177f88355a6c98613d6407d02f09`; inherited dirty
logo source preserved. Read `docs/editor-teaser-ducking-refinement.md` and
`docs/whisper-small.md` for exact findings, changes, reuse and manual acceptance.
Source order/title/prompts, original theme reuse, decoded foreground geometry,
independent AI-ranked choice validation + one bounded repair, fair bounded frame
coverage, honest partial completion, VAD-controlled BGM sidechain/status/cache,
and actual Whisper base→small/backend packaging are implemented in source.
Policy9s export/first10s export-main, preview1×/zoom125%/export1.25×, main/manual
locks, caption mapping, snapshots, autosave, sequential range rendering and quality
caps are preserved. Small model NOT downloaded or loaded; old models/captions remain.
No tests/lint/typecheck, runtime/browser/smoke/render/listening/ASR or AI/YouTube
verification. Combined Node22 `npm run package:mac:dev` succeeded, exit0. First
attempt stopped on sandbox-denied yt-dlp version-check semaphore; authorized
retry completed packaging/signing. No YouTube extraction/download request.
App: `release/dev/ShortCut Studio Dev.app`; final log:
`/tmp/shortcut-dev-editor-teaser-whisper-small-build-20261021-retry.log`.
Bundled whisper-cli/ggml backends/MIT notices exist; read-only hashes match packaged
speech/teaser/config modules to source. Only delivery docs changed after build.
This is packaging evidence, NOT functional/ASR/audio/AI qualification.
No app/worker restart or job
interruption, production/credentials/media/exports/backups changes, commit or push.
Do not confuse historical QA below with verification of this new source.

---

# Active update — restore original Header logo (2026-10-21)

Started clean on `recovery/visual-dev-reconstructed` at
`27625fe78dc5177f88355a6c98613d6407d02f09`. Header had replaced the original
brand asset with an `SC` text tile; `public/favicon.svg` itself was intact.
`components/studio-header.tsx` now uses that original red/white SVG, with
32×32 non-shrinking, aspect-preserving CSS in `app/globals.css`. Shared Header
remains outside workspace/panel visibility conditions. Read-only SHA256 comparison
matched the source SVG and the existing standalone/DEV package SVG: no missing
packaged asset was found. No new asset, application state or engine changes.
Source/diff review only; no tests, browser, render or provider calls. This logo
fix is included in the combined build recorded above; appearance remains unverified.

---

# Git delivery checkpoint — 2026-10-21

User authorized normal push of `recovery/visual-dev-reconstructed` to
`https://github.com/datdooo/short-video-studio.git`. Previous base13f3c90 matched
remote at inspection. This source checkpoint groups bounded render/resource work,
fixed260/300px columns +55/45 center, TSX black/orange UI, preview1× with zoom125%,
export1.25× and related docs/runtime manifest. Prior DEV build succeeded; functional
QA/performance/manual acceptance remain unverified. No tests/render/AI/build rerun
for this delivery. Source/index reviewed; secret/path scan found no matches in489
unique blobs before this documentation note. No media/music/credentials/build/cache
or recovery bundles staged. Available reconstructed history only; missing original
local checkpoints are not recovered. Use `git log -1` and remote refs for exact
checkpoint/push state; older sections below describe their original delivery time.

---

# Active update — fixed columns, unchanged speed/zoom (2026-10-20)

Read `docs/fixed-editor-layout.md` first. Source260px / Inspector300px, flexible
center; no resize handles or persisted panel dimensions. Narrow≤1050px uses
in-place drawers; footer stays outside overlay; mounted editor state preserved.
Preview RATE1, foreground VISUAL SCALE1.25, export RATE1.25 remain separate and
unchanged. No render/worker/plan edits in this layout turn. Same branch/base
HEAD13f3c90 with all dirty work preserved. Center now55% Preview /45% Timeline; source zoom125% unaffected. Source/diff
review only; no tests/QA/render/provider. Fixed-column build succeeded once before
incoming55/45 adjustment; final ratio build then succeeded, exit0. Current app:
`release/dev/ShortCut Studio Dev.app`; final log:
`/tmp/shortcut-dev-fixed-55-45-build-20261020.log`. Only delivery docs edited after
build; native packaging audits completed, no runtime QA. Prior fixed-column log:
`/tmp/shortcut-dev-fixed-columns-build-20261020.log` (superseded).
No app/worker shutdown or restart, no commit/push/merge.

---

# Active update — TSX black/orange UI + Preview1× (2026-10-20)

Same branch/base HEAD13f3c90, inherited dirty source preserved. New primary design:
`shortcut_studio_dev_ui_prototype_codex_handoff.tsx` from user Downloads, replacing
ZIP design. Read `docs/preview-1x-ui.md` first. Preview video/audition/playhead/
durations/music+ducking now1×, source timecodes unchanged; export/policy1.25×
unchanged. Existing effect clock adapter aligns phases to the same footage.
UI token theme black/charcoal/orange; existing real callbacks, drafts and jobs.
Only worker/music-preview.mjs and optional speed argument in music-audio changed
for preview. server/range-input/media-resources and render-lag fix unchanged from
turn start. Cache and draft clock versions prevent old1.25× mixes/playheads being
silently reused under new labels. New runtime config added to package manifest.
NO tests/QA/render/provider/YouTube. One combined Node22 `npm run package:mac:dev`
build succeeded, exit0. App: `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-tsx-preview-1x-build-20261020.log`. Current implementation is
packaged; only delivery docs edited afterward. No app/worker restart, commit,
push or merge. Old build records below are historical.

---

# Active update — approved prototype UI integration (2026-10-20)

Branch `recovery/visual-dev-reconstructed`, base HEAD
`13f3c90f28afb30a3e6e53c87d40695197914712`; inherited dirty render-resource/UI work
preserved. Read `docs/prototype-ui-integration.md` and
`docs/editor-workspace-layout.md` for current UI; `docs/render-resource-fix.md`
for the separately inherited UNMEASURED render fix. All66 worker modules match
pre-UI hashes; this UI turn does not edit worker/engine/FFmpeg/selection algorithms.
Header/workspace, real source/Generate, existing preview, active-part Timeline,
Inspector tabs and actual render status are wired without prototype mocks/types.
No tests, browser/smoke/render or provider/YouTube calls; user tests manually.
One combined Node22 `npm run package:mac:dev` succeeded, exit0. Current app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-prototype-ui-build-20261020.log`. It contains current implementation
including preserved render changes; only delivery docs updated afterward. Native
packager audits/signing completed, no app/worker restart, runtime QA or commit/push.
Keep historical build/QA records below distinct from this unverified new source.

---

# Active update — editor autosave / restore (2026-10-20)

Started clean at `9da73bed886f340f5e346e476f89b3ffa6a147f8` on
`recovery/visual-dev-reconstructed`. Current scope: `docs/editor-autosave.md`.
Versioned/bounded local editor draft, separate partial Timeline/teaser fields,
managed-source read-only restore, paused playhead, read-only job/batch reconnect,
interrupted browser-task notices, explicit “Phiên mới”. Passive restore guards
prevent automatic extraction/AI/render/subtitle/music preparation. Existing
source/plan/media/credentials and qualified previous implementations preserved.
No push, production changes or backups. NO tests/lint/typecheck, runtime QA,
render, browser automation or live AI/YouTube calls; user accepts manually.
Combined DEV build succeeded once: Node22 `npm run package:mac:dev`, exit0.
App: `release/dev/ShortCut Studio Dev.app`; build includes the current source
(only delivery docs updated afterward). Log:
`/tmp/shortcut-dev-autosave-build-20261020.log`. Native build/signature audits
completed as part of packaging; no launch or functional verification. Existing
running app was untouched. User first checks reload with partial inputs, paused
playhead, job/batch reconnect, missing/local source and “Phiên mới”.
No push. Use `git log -1` for the final commit SHA.

---

# Active update — consolidated source-timecode Timeline (2026-10-20)

Started clean on `recovery/visual-dev-reconstructed` at
`69db1cb236b7e2310828661f0c0ec639cce73893`; previous lifecycle/ChatGPT work preserved.
Read the new top section of `docs/custom-main-ranges.md`. Changes: per-part Teaser
before Main in one Timeline, shared source HH:MM:SS:FF30fps inputs, untouched AI
precision retained, Custom Teaser description/timestamp button inline, lock/restore colocated; Apply enabled for valid candidates; optional audition, no confirmation checkbox. Hook→Main selector moved near the first teaser,
shared two-part value preserved, constrained narrow-window layout. Vietnamese
explanation rules in existing ChatGPT/main/external requests; legacy notes retained
in plans with honest Vietnamese fallback display, no translation calls. No plan schema,
renderer, source/caption/BGM timing or queued-snapshot migration. New runtime file
`lib/source-timecode.mjs` and `lib/explanation-language.mjs` added to shared packager manifest. NO tests, QA/render,
browser or live AI/YouTube; user accepts manually. No push/production/backups.
Latest policy: BOTH parts must have valid teasers; main-only consent removed.
Shared readiness guards cover UI render/save, API before/after normalization,
queued execution, batch submit and resume; legacy plan loading still permissive.
No automatic fill at export. Visual Template stays in place, collapsed native
accordion, derived label/Custom; Background Current recipes untouched.
An initial combined build finished before these last user requirements could be
stopped. Final review also localized remaining batch fallback warnings; completed
intermediate packages are superseded by the final combined build recorded below.
No running app or unrelated process was stopped (build processes had finished).

Final delivery build: Node22 `npm run package:mac:dev`, exit0.
App: `release/dev/ShortCut Studio Dev.app`.
Log: `/tmp/shortcut-dev-timeline-final-build-20261020.log`.
Three package invocations completed during this turn: the first was superseded
by incoming mandatory-teaser/template requirements; final review also localized
batch warnings/memoized readiness, requiring the last build. Intermediate logs:
`/tmp/shortcut-dev-timeline-timecode-vi-build-20261020.log` and
`/tmp/shortcut-dev-timeline-required-teasers-build-20261020.log`.
Only the final app is current. Existing running DEV app was not stopped/launched.
No tests, lint/typecheck, browser automation, render, provider/YouTube calls or
manual playback/audition performed. Built-in packager native/signature audits
completed; runtime/AI compliance/layout acceptance is still unverified.

Manual acceptance: source60–70s displays00:01:00:00–00:01:10:00 and8s at1.25×;
invalid/partial/FF30 stays draft; untouched AI endpoints stay exact; Apply works
without audition/checkbox; both parts missing/invalid hooks block export/batch/
resume; repair each through Timeline; toggle template without changing style,
select a template and customize while it stays open; narrow-window Hook→Main
control and optional source audition; new AI explanations Vietnamese while source
quotes/title/subtitles/hashtags remain original. No old outputs/history deleted.

---

# Active update — preview source ownership + ChatGPT teaser revision (2026-10-20)

Started clean at ca4c3c5bd4bb534a6defdcecc1f3c17a466daef9 on
`recovery/visual-dev-reconstructed`. Read `docs/preview-source-lifecycle-fix.md`
and the latest section of `docs/per-part-teaser-hooks.md`. Source fixes cover
mutable preview-ref ownership, stale callbacks/requests/BGM on source change,
and part-arc/curiosity candidate/evidence selection with ChatGPT default and no
silent heuristic winner. Earlier H/I/J/F changes remain intact. No tests, browser,
render, live AI/YouTube or music audition permitted/performed. Combined Node22 `npm run package:mac:dev` succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`. Build log:
`/tmp/shortcut-dev-preview-lifecycle-teaser-build-20261020.log`. This includes the
current implementation below; only delivery documentation changed afterward.
No launch/listening/runtime qualification. No push authorized. User first checks
source-switch crash and ChatGPT Retry/Custom/no-teaser behavior. Use `git log -1`
for the final checkpoint SHA; no unrelated work or old QA was repeated.

---

# Active checkpoint — canonical Custom Time and gentle music (2026-10-20)

Branch `recovery/visual-dev-reconstructed`, clean starting HEAD
`3708a4d4c830e010ba6e7ab527515a7e5c91b2a9`. Actual final HEAD: `git log -1`.
Read `docs/custom-main-ranges.md` and `docs/gentle-music-expansion.md` for this scope.
H/I/J source is implemented: canonical per-part main segment rows, exact manual
range application, AI restore checkpoints, lock handling, explicit invalid-teaser
review, removal of cut-details/Pipeline and Reset demo. F source/import is added;
actual acquisition:32 new MP3 assets (86 total),28 gentle/general-use,
212.76MiB library growth and212.71MiB downloaded,0 errors,0 auditions. No audio
is versioned/bundled. Combined DEV build status is recorded in the scope docs. Earlier A–G/QA evidence is not new functional proof.

User performs manual acceptance. NO tests, QA render/browser automation or live
AI/YouTube campaigns. Only source/diff review, authorized real music acquisition
and one final combined DEV package build. No push, new bundle, production,
credentials, backups or prior source/media/export deletion. Existing app left running.
Combined DEV build succeeded once (Node22 `npm run package:mac:dev`, exit0).
App: `release/dev/ShortCut Studio Dev.app`; same final source below plus docs.
Local log: `/tmp/shortcut-dev-main-ranges-gentle-music-build-20261020.log`.
No app launch, listening or functional QA. Next action: user manual acceptance;
do not restart implementation or automatic QA. Pending audit concerns in the
historical handoff remain unresolved/out of scope.

---

# Codex handoff — 2026-10-20 (Asia/Saigon)

## Verified Git / safety

- Repository: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`
- Branch: `recovery/visual-dev-reconstructed`
- Local implementation HEAD before this documentation checkpoint:
  `19be62910a26835a16702b63a60c94e061d6024b`.
  After handoff commit, use `git rev-parse HEAD`; implementation is unchanged.
- Origin: `https://github.com/datdooo/short-video-studio.git`
- Upstream: `origin/recovery/visual-dev-reconstructed`.
- **Remote read directly with git ls-remote during handoff:**
  `d0eae09bc97d6fdc7a399ee64e63ad1abf147cac`.
  `124a635`, `19be629` and this handoff are NOT pushed. No push during handoff.
- Initial `git status --short` and diff were empty. No inherited or unfinished
  source edits exist at handoff; only this document is being added/committed.
- Work ONLY here. Node22: `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- DEV ports 5273/8887; app/data identity ShortCut Studio Dev. Do not touch
  production 5173/8787, `/Applications/ShortCut Studio.app`, other projects,
  credentials/Keychains, media/exports, recovery bundles or backups.
- Do not repeat Git recovery: original missing local history remains unavailable.
  No reset/clean/checkout overwrite/stash/force-push/merge or automatic deletion.

## Binding execution policy

**User does manual acceptance. NO tests, QA, render, browser automation, live AI/
YouTube calls or provider campaigns.** Finish scoped source, review diff, then build
DEV ONCE after combining the outstanding changes; fix build errors if any. Do not
build merely for handoff or push. No new bundle/large backup. Do not claim new
functional qualification from old reports or successful packaging.

## Commits made in this conversation

| Commit | Purpose | Publication |
| --- | --- | --- |
| `9ae42dd` | Foreground transition atlas/compositing, two-deck preview, per-part Custom Teaser, Bright Social Current, credit UI removal | Pushed |
| `d0eae09` | Output metadata/chapter suppression, legacy-output/resume safeguards | Pushed; verified remote SHA |
| `124a635` | All eight template background IDs → Current; other fields unchanged | Local only |
| `19be629` | Remove entire selected-track information card under Music Panel | Local only |

No source changes/downloaded audio were made after `19be629`. Music expansion and
Custom Time requests below were only inspected/researched when quota stop arrived.

## Latest app: built versus verified

- `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app`
- Latest build: Node22 `npm run package:mac:dev`, exit 0, source subsequently
  committed as `19be629` (only handoff documentation changed after that build).
- Local log: `/tmp/shortcut-dev-remove-music-card-build-20261020.log`.
- Lightweight byte comparisons during handoff matched packaged versus current
  `worker/server.mjs`, `worker/export-metadata.mjs`, `lib/visual-style/templates.mjs`.
  Frontend provenance follows the recorded build; full bundle equivalence was not
  independently inspected. No new app launch/smoke/playback/export was performed.
- App includes B/C/E/G and A implementation below; **does not include F/H/I/J**.
- Existing app/processes were left alone; no QA/download/import process remains
  running from this work. Public listing HTML fetches completed. No music downloaded.

## Requirements ledger — source evidence is NOT acceptance

| ID | Source/build state | Evidence / remaining work |
| --- | --- | --- |
| A transitions | Source changed, built; smoothness/MP4 scope NOT verified | `components/cut-transition-panel.tsx`, `lib/visual-style/foreground-transitions.mjs`, `lib/preview-decks.mjs`, `components/preview-background.tsx`, `worker/cut-transition.mjs`, `worker/server.mjs:renderPart`. All existing effects below decorations/text and before background composition; shared atlas/clock, alpha mask, two preseeked decoders, independent audio concat. Runtime frame/AV continuity and VR appearance remain user acceptance; no Adobe parity claim. |
| B Current backgrounds | Source complete, built; manual acceptance pending | `lib/visual-style/templates.mjs`: all eight recipes use `current`; application handler unchanged. Old effective styles are not migrated and can derive Custom. Manual background control retained. |
| C Custom Teaser | Source implemented, built; new UI/inference unverified | `components/teaser-editor.tsx`, `lib/custom-teaser.mjs`, `worker/teaser-selection.mjs`, `app/page.tsx:resolveCustomTeaser`. Exact timestamp no AI; description uses existing ChatGPT selector with strict match/unavailable; explicit audition/confirm; same-part/no gaps/first10s exclusion/9s max, >=0.5s technical floor, no forced5s. No current provider call was performed. |
| D BGM preview | Lifecycle implementation present/built; both-part audible workflow NOT established | `components/music-panel.tsx`, `lib/music/preview-playback.mjs`, `worker/music-preview.mjs`. Preparation/play/error, autoplay recovery, mix identity/invalidation and canonical active deck ref implemented. Prior reports are not proof for new deck changes. |
| E music card | Source complete, built; no fresh UI acceptance | `components/music-panel.tsx`: entire trailing selected-track card removed at19be629; credit textarea/copy already removed. Selectors/import/audition/volume/ducking untouched; metadata retained internally. |
| F +30–50 gentle tracks | **UNIMPLEMENTED: 0 new audio downloads/imports** | Existing DEV library has54 assets; see research and next steps below. No new group/order implemented. |
| G export metadata | Source implemented, built; actual MP4 NOT inspected | `worker/export-metadata.mjs`, server common `renderPart.buildArgs`: output `-map_metadata -1 -map_metadata:s -1 -map_chapters -1 -sn -dn`, only [vout]/[aout], technical encoding/color/faststart preserved. `render-resume.mjs` and server require new history-only policy marker; unknown/legacy files cannot be adopted/overwritten, require NEW job. Old downloads/history remain untouched. No untraceability claim. |
| H multi-range Custom Time | **UNIMPLEMENTED** | Current UI still collapses each part to outer start/end via `partTimes`, with separate `customTimes` override. Must replace with actual main segments; details below. |
| I remove details/Pipeline | **UNIMPLEMENTED** | `app/page.tsx` still contains details block, cards, both duration rows and Pipeline/mock; remove presentation only. |
| J remove Reset demo | **UNIMPLEMENTED** | Button still at end of editor aside. Remove JSX and now-unused RotateCcw; Settings2 becomes unused after I. Keep mockPlan used by initial state/Mock provider. |
| K source push | Verified through d0eae09 only | Prior review:462 tracked files +2 outgoing commits, common secret-pattern scan and forbidden paths found no candidates; no media/build/dependencies uploaded. Later local commits NOT re-published. Before any future authorized push, recheck outgoing history/tree and remote ancestry; no force. |

## First next coding task: H + I + J (keep scope)

Read only targeted files first:

1. `app/page.tsx`: `timing`/`previewPlan` around400; `customTimes`/setters; Custom
   Time around1903; Custom Teaser onChange around1970; details block around2038;
   Reset demo near2108. `startRender`, `chooseTeasers`, `replacePlan`, `analyze`,
   `applyWebAiResult`, batch edit/load/save are related snapshot boundaries.
2. `lib/custom-time.mjs` + `.d.mts`, `worker/part-start.mjs`, `worker/smart-cut.mjs`,
   `lib/edit-plan.ts`, `worker/plan-validation.mjs`, `lib/auto-cut/locks.mjs`,
   `worker/auto-cut-workflow.mjs`, `lib/auto-cut/main-content.mjs`.
3. Current Custom Time is only outer-window trimming and can extend edges; it is
   unsuitable as the new multi-range editor. Do not bridge removed gaps. Rendered
   list must be canonical `part.segments` main entries, excluding teaser and padding.
   Invalid/blank UI drafts must not enter effective segments; show row errors and
   block submission while retaining last valid preview. Do not silently sort/snap.
4. Add/remove/edit each part's ranges using exact typed source times; set existing
   startTrimApplied/smartCutApplied appropriately so worker does not trim1s/snap
   manual edits again. Preserve source bounds/order/non-overlap and existing
   duration rules, padding behavior, manual locks and independent queued snapshots.
5. Retain the latest real AI/Smart Cut ranges as a per-part restore checkpoint
   (design NOT implemented). Restore only that part on “Dùng lại bản cắt AI”.
   Keep lock checkbox. Every downstream consumer uses the same effective segments:
   preview/export/captions/teaser eligibility/music/ducking.
6. Current `applyPartTimes` can choose fallbackTeaser after a main change. New
   behavior must instead explicitly flag invalid teaser for reselection, never
   silently choose a replacement. Ensure validation/reselection routes remain usable.
7. Remove whole details/Pipeline block and Reset demo JSX. Keep player/timeline,
   other reset mechanisms and internal analysis data. Explanation must be exactly:
   “Mặc định theo bản cắt AI. Thêm, sửa hoặc xóa từng đoạn để tùy chỉnh; mốc chỉnh tay được dùng nguyên khi xuất.”

## F music acquisition — research already done, no audio installed

- DEV library (read-only measurement):
  `~/Library/Application Support/ShortCut Studio Dev/media/music`:
  **54 assets,256293583 bytes (~244.42 MiB)** including metadata. Existing moods
  include acoustic/vlog, relaxed/lo-fi, action, suspense etc. Last measured free disk74GiB.
- Reuse `worker/music-library.mjs:createMusicLibrary().import` (SHA256 duplicate
  detection, compressed retention, normal import probe/decode,128 tracks/1GiB cap).
  `scripts/install-personal-music.mjs` demonstrates DEV-only import but its older
  Incompetech80-track acquisition/resume strategy is NOT suitable to rerun blindly.
- New user goal:30–50 **actual new files**, <=~300MiB new downloads; >=70% gentle/
  general-purpose, no known vocals/rap/voice samples; preserve current tracks and
  selection. Un-auditioned stays `auditioned:false,instrumentalVerified:false`.
  Metadata genre screening is not listening evidence. No Content ID guarantee.
- Put “Nhẹ nhàng / Đa dụng” first in UI group ordering without replacing selection.
  `components/music-panel.tsx` derives group order from asset list; sorting group
  labels locally or library list can do it. Preserve search/audition/audio handlers.
- Official sources inspected:
  - FreePD.com is CLOSED; do not use unverified mirrors as official sources.
  - Mixkit permits commercial social video use/no credit but its terms prohibit
    scripts/bots mass downloads. **No Mixkit audio downloaded**. Do not bulk scrape.
    https://mixkit.co/terms/ ; https://mixkit.co/license/modal/musicFree/
  - Promising **composer-direct** source: Liborio Conti,
    https://www.no-copyright-music.com/relaxing/ and /corporate/ .
    License https://www.no-copyright-music.com/wp-content/uploads/2023/03/LiborioContiLicense.pdf
    expressly allows commercial/monetized video and no required attribution;
    prohibits music redistribution/Content ID ownership claims. Keep audio local,
    never Git or bundled. Do not repeat the site's absolute no-claims marketing.
  - Official relaxing page HTML already saved at
    `/tmp/shortcut-liborio-relaxing.html`;72 MP3 URL entries observed, NOT72 approved
    tracks. Parse playlist `<li data-audiopath=... data-trackTitle=... data-artist=...
    data-trackTime=...>`; playlists also include bilateral/432Hz/long tracks, so
    curate suitable normal short gentle tracks, do not import all. Library max600s.
    Example observed URLs use composer `/wp-content/uploads/2021/09/*.mp3`.
  - `/tmp/shortcut-mixkit-calm.html` is public listing HTML only, not audio.
- Next: choose bounded subset from legitimate source; save source/license/date/hash
  internally, stream/import sequentially with total byte budget/cancellation,
  remove only task-owned intermediate downloads after successful import. Imports
  write outside repository to DEV data, requiring tool escalation under sandbox.
  User authorizes actual download/import, not tests/QA/render/browser campaigns.
  Record actual successful new count and byte delta; no false audition claims.

## Open audit concerns — not fixed here

- Origin: server guards `/api/chatgpt/` only; general CORS reflects origin or '*'.
  Broader local API write protection is incomplete (`server.mjs` ~283/~1657).
- Visual teaser evidence is bounded to selected candidates;
  `candidateFrameTimes` in `lib/teaser-candidates.mjs` and selector's frame call.
  Do not claim every candidate/action had video understanding.
- Gemini/Muse freshness: client `chooseTeasers` can return early for syntactically
  valid hooks before external freshness validation; customTeaser branch in
  `externalHooksCurrent` intentionally skips external key check. Some queue paths
  guard freshness; complete coverage is unproven. Audit both editor and batch.
- Shared pending teaser promise (`worker/teaser-selection.mjs`) is keyed by input,
  but request cancellation is not independently owned by each subscriber.
- Compressed music imports retain file and set durationLoop=duration; unlike FLAC
  conversion they do not run seamlessMusicFilter. Seamless loop joins unproven.

These are pending findings, NOT newly authorized broad feature work. Preserve and
report them; do not silently claim resolved or expand into provider campaigns.

## Resume/build instructions

Read this file, verify Git/status and latest user steering, then finish H/I/J and F
from current implementation. Do not rerun old RC/recovery/research wholesale.
Only after combining source changes and reviewing diff:
`PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev`.
Build failure: fix and retry. User performs all real/manual acceptance. Keep running
DEV app untouched unless instructed; close it normally before opening newer app.
