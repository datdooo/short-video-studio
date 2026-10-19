# Per-part teaser follow-up qualification

## Hook-only repair closure — 2026-10-19

The user returned both original hook-only repair JSONs. The pending precise-cue
boundary gate at05bb071 is resolved for these inputs. Qualification covers the
observed macOS DEV GPT API/UI path and canonical external web-import/render paths,
with the provenance/editorial limits below. No further provider request is pending.
Implementation remains05bb071; this closure changes documentation/evidence only.

Artifacts: `.isolation-verification/teaser-resume-20261019/`, original
`{gemini,muse}-hook-repair-response.json`; new measured results under `hook-repair/`.
Old responses, failed checks and prior exports remain preserved.

| Provider | Model/provenance | P1 source hook / output seconds | P2 source hook / output seconds | Locked main source ranges P1 / P2 |
| --- | --- | --- | --- | --- |
| Gemini web |`Gemini`, self-reported; version unknown |8.280–15.000 /5.376 |160.360–166.840 /5.184 |5–95 /101–200 |
| Muse web |`Muse Spark`, self-reported |61.800–68.439 /5.3112 |160.360–166.840 /5.184 |1–95 /101–200 |

- Both pass `parseExternalHookOnly` source/request/part/schema validation, then
  `attachExternalHooks` with the original precise source cues. Every start/end is
  an actual cue start/end within its own retained range and duration policy.
  `externalHooksCurrent` passes. Deep comparisons confirm main ranges, titles,
  hashtags, content strings, caption cues, subtitle settings and all other style/
  operational fields are unchanged; only teaser metadata changes. Original raw
  responses were saved without semantic edits, with SHA256 in validation reports.
- Real configured GPT inference for both parts remains proved by the earlier
  recorded `gpt-6.1-sol` API requests and ordinary UI upload/selection/preview/export.
  No GPT or other AI request was made during this repair closure. No heuristic
  substituted for a web selection. Video attachment was confirmed by the user in
  the preceding web roundtrips; no authenticated Gemini/Muse analysis API or
  independently established AV understanding is claimed. Web acceptance uses
  the same canonical app functions with saved context, not a live UI paste claim.

| Repaired job | Mux seconds P1 / P2 | Exact video frames P1 / P2 |
| --- | --- | --- |
| Gemini `2afc0569-4f61-4a10-9a61-b2d0424f13dd` |77.387167 /84.411854 |2321 /2532 |
| Muse `9d2d15a1-0202-4cef-8ddb-e54ba0d68ade` |80.532729 /84.411854 |2415 /2532 |

All four MP4s:1080×1920,30fps,H.264/AAC; the current packaged DEV worker byte-
matches source. Existing Black background and genuine preserved source captions
were reused; source files were hash-checked before submission. Queued/final plan
snapshots compare equal. Decoded hook vs retained main occurrence has gray-pixel
mean absolute error0.55–1.75/255; matching subtitle PNGs are byte-identical and
hook boundaries reach Dip Black. Both full main occurrences remain in output.
`hook-repair/playback.json` verifies four ordinary editor-history download links,
Chrome metadata/start playback, seek near EOF and ended without media/page errors.
This is a playback smoke check, not a full human watch/listen. Cropped comparisons
were inspected in `hook-repair/real-hooks-contact.png`.

### Audio diagnostic: retain the failure, correct the reference

The old nominal-duration check (within1024 samples of arithmetic duration) failed
on Gemini P2 and Muse P1/P2. Original scripts/logs remain as
`qualify-nominal-aac-check.mjs` and `*-nominal-aac-check.log`. It was not silently
widened to two AAC frames or treated as a successful original test.

An independent source-derived PCM reference reconstructs the selected source
ranges, original30fps video/audio concat timing,48kHz resampling and atempo1.25,
without video composition or AAC encoding. Every decoded MP4 sample count equals
that pre-AAC reference **exactly**; measured EOF waveform correlation is
0.999729–0.999759 over the actual final250ms through EOF, with zero lag
(`audio-reference-final.log`). The extra length already exists before encoding,
so it is not evidence of export tail loss. Final checks require exact reference
sample equality and correlation>0.99. No renderer/audio change was needed.

| Output | Reference = decoded samples | Difference from nominal samples |
| --- | --- | --- |
| Gemini P1 |3714584 |+536 |
| Gemini P2 |4051769 |+1337 |
| Muse P1 |3865571 |+1033 |
| Muse P2 |4051769 |+1337 |

This measures source/tempo preservation; it does not establish word-level semantic
completeness. Maximum arithmetic duration difference is27.854ms (1337/48000).

### Closure checks and remaining limits

- This closure ran strict validation for two provider responses/four hooks, four
  actual packaged exports, frame/caption/transition/snapshot checks, four independent
  PCM references and four download/playback smoke checks. All final checks passed.
- No product code changed; the260/260 unit, lint/typecheck, eight synthetic exports
  and earlier six real exports at05bb071 were reused, not rerun or claimed as new.
  No package rebuild, recovery, cleanup, provider research or full RC matrix.
- Cue-level clipping is resolved. Automatic cue boundaries are not guaranteed
  sentence/word boundaries: Muse explicitly notes omitted lead-ins, while retaining
  the question/unit or numerical comparison. Clean audio alignment and human
  editorial/engagement review are not proved. Gemini's reason mentions1.385m;
  the selected transcript says1.38, so that precision is not independently verified.
  Raw provider text is preserved rather than corrected and presented as AI output.
- Earlier native interruption logs establish approved normal quits, not the
  initiator. Separately demonstrated owned-child orphaning is fixed at05bb071.
  No new unexplained interruption occurred during these four exports.
- Windows and fresh live multi-link batch remain untested in this resume. No new
  renderer, subscription, production changes, C–H or Sports Voiceover work.

## Earlier resumed verification — 2026-10-19 (checkpoint05bb071)

Active branch: `recovery/visual-dev-reconstructed`; base `d1e2cd6`.
Git reconstruction preserved the implementation, not the old local commit
history or a new feature qualification verdict. Historical results below remain
valid only for their stated inputs. Current artifacts:
`.isolation-verification/teaser-resume-20261019/` (local/ignored).

- Current packaged DEV session reload: connected, sharing enabled, no sign-in
  required. This is auth evidence, not by itself inference evidence.
- Preserved real GPT inference: `teaser-render-8h2GE3/provider-outcome.json`, both
  parts AI, model `gpt-6.1-sol`. Preserved ordinary real-video UI snapshot
  `teaser-finish/real-render-recovery-snapshot.json`: main `[6,95]`/`[101,200]`,
  hooks `[46,53]`/`[172,179]` (5.6s each at 1.25x); queued before interruption.
- Preserved Muse roundtrip: user returned original numeric-ID JSON and explicitly
  confirmed video plus prompt attached at `https://muse.ai/`. Hooks `[8,14.25]`
  and `[160,166.25]`; self-reported model `Muse Spark`. Ordinary UI accepted both
  as `external-import`, previewed and queued job `998e3e9a-8496-4538-a0db-55994fa58c74`.
  That export was interrupted. No authenticated Muse analysis API or independent
  proof of audiovisual comprehension is claimed.
- Fresh Gemini and Muse prompts had distinct source/request IDs. User returned
  both original JSONs and explicitly confirmed video plus prompt attached. Both
  passed canonical source/nonce/schema/range import and completed two-part exports.
  The one-hour headless UI waits expired before the responses arrived; acceptance
  was replayed through the app's same parser/normalizer/Smart Cut/attach functions
  with saved contexts, not claimed as a live UI paste. Responses were not edited.
  Exact original-cue review flags clipping in all four external excerpts; one
  bounded hook-only repair request per provider is pending. This remains a
  qualification blocker, not a reason to relabel output or silently fix timestamps.

### Native interruption findings and fix

Scoped macOS logs show both Oct18 interruptions (22:11, PID13633; 22:26,
PID19249) followed `terminate:` → delegate `NSTerminateLater` →
`replyToApplicationShouldTerminate:YES` → approved normal exit, launchd status0.
The initiator is unknown. No evidence establishes a renderer crash, OOM, or
worker failure as the initiator. See `native-termination-evidence.txt`.

Separately, the unmodified worker `run()` was reproduced leaving its detached
child alive after SIGTERM (`orphan-repro.json`); the QA child was then removed.
Worker shutdown now aborts active controllers, closes connections, terminates
only tracked owned children/groups, escalates after2s, and bounds history flush.
It never searches for or kills unrelated processes. This fixes escaped work
on shutdown; it does not explain who requested the app quit. A real subprocess
regression confirms the detached child is reaped. Windows runtime remains untested.

### Current checks

- Final unit suite260/260, no failures/skips (`unit-timing.tap`). Earlier259/259
  (`unit-permitted.tap`) also passed. Initial sandbox
  run258/259 failed only because the port-collision test could not bind; permitted
  rerun passed. Focused lifecycle/import-closure4/4 also passed.
- Lint and `npx tsc --noEmit`: passed. Lint's initial new-test variable naming
  error was fixed before the final successful run.
- `npm run package:mac:dev`: passed, native audit/codesign included; package's new
  lifecycle module is byte-identical to source. Initial sandbox build hit yt-dlp
  semaphore permission denial; permitted rebuild passed without a product fix.
- Updated DEV app launched normally, ports5273/8887, DEV media root retained.
  Old interrupted jobs restored cancelled; no production operations were done.
- Fresh GPT UI selected both parts with real `gpt-6.1-sol` requests, previewed,
  changed visual style without another hook call/video source reset, and queued
  job `7459b3f2-6bf8-4723-82e5-e0daf285cf4a`. Exact-cue review found a real boundary
  bug: typed rounded transcript cues replaced precise source cues during guarding
  (68–75 vs original cue end75.56; 172–179 vs end179.519). That run is **not** a
  coherent-boundary pass. It was intentionally interrupted for a packaged shutdown
  test: its detached FFmpeg8549 was reaped, worker logged SIGTERM, snapshot kept.
  See `packaged-shutdown.json` and `gpt-before-timing-fix/`.
- Fix: edited transcript text still drives semantic input; available original
  caption timing separately drives clipping validation/fallback and is provided
  as bounded `speechBoundaryCues`. Timing is part of cache identity; cached AI is
  revalidated against it. Typed-only sources retain their approximate timing.
  New focused regression preserves edits while rejecting rounded-edge clipping
  and tests timing cache invalidation. Corrected real GPT UI rerun passed.
- That rerun revealed GPT Part2 video2481 vs expected2483 frames at fractional
  cuts, while complete audio was retained. Hook-only final video now pads at most
  three EOF frames and clamps to intended rounded frame count, after fps conversion.
  Audio and non-hook legacy graphs are unchanged. Rerendering the exact immutable
  GPT snapshot without new inference produced2483 frames and passed all checks.
  Before-fix failure remains in `gpt-before-eof-fix/`; no failed check was hidden.
  Caption setup reuses77 actual automatic cues from the same first200s fixture,
  after verifying uploaded media bytes equal the preserved fixture. No fresh
  ASR or independent word-level timing accuracy is claimed.

### Real-video results at this checkpoint

All files are1080×1920 H.264/AAC at30fps. Mux durations include AAC tail padding.
Black is an existing background preset used to bound render cost. Caption fixtures
reuse genuine automatic captions from byte-identical uploaded first200s media;
no caption service was mocked and no new ASR accuracy is claimed.

| Provider / evidence | Main source ranges P1 / P2 | Hook source P1 / P2 | Mux seconds P1 / P2 | Video frames P1 / P2 |
| --- | --- | --- | --- | --- |
| GPT authenticated API, `gpt-6.1-sol` |6–95 /102.32–200 |12.60–20.10 /186.28–192.04 |77.216458 /82.769188 |2316 /2483 |
| Gemini web, self-reported `gemini-2.5-pro` |5–95 /101–200 |11–18 /158–164 |77.600500 /84.013958 |2328 /2520 |
| Muse web, self-reported `Muse Spark` |1–95 /101–200 |59–66 /160–167 |80.800500 /84.813792 |2424 /2544 |

- Final GPT job `27227b21-1ffc-4f9b-b085-d41c1da1c3ed` is the unchanged snapshot
  from actual UI Auto job `0720f990-078d-401b-94ff-d1e3febc3e8b`, reexported with
  the EOF fix and no new inference. Ordinary UI uploaded the real video, loaded
  preserved captions, selected both AI hooks, previewed, customized style without
  another selection/source reset, and submitted export; browser errors=[] .
- Gemini job `aaf98fde-14b0-436e-ad06-8f4607e4dda8`, Muse job
  `288fb7d0-1df1-496d-9571-da9e66a4e113`: canonical import replay, no GPT fallback.
  Both are `external-import`; video upload is user-attested, not independent proof
  of provider AV understanding. No Muse analysis API was invented or called.
- Each hook remains in its part's main occurrence. Decoded scene comparisons
  have mean absolute gray-pixel errors0–5.23/255; repeated caption PNG hashes match.
  Hook boundary reaches Dip Black; exact video frame count and mux duration pass.
  Decoded audio sample count differs by at most one AAC frame (1024 samples),
  with nonzero final audio. No independent listening/word alignment is claimed.
- `playback.json`: six actual editor-history downloads and Chrome playback to EOF
  passed, no browser/media errors; exported dimensions1080×1920. Contact sheet
  `real-hooks-contact.png` shows hook vs retained occurrence (cropped comparison).
- Final source-mode synthetic regression: legacy/None/Flash six MP4 passed at
  `teaser-render-UvOcj8`. New fractional-only two MP4 passed at
  `teaser-render-ilygo2`; assertions include exact frames, audio, cues and snapshots.
  Initial fractional QA setup used a placeholder inputKey and correctly triggered
  reselection; setup was fixed to resolve before snapshot assertion, not weaken it.
- Final DEV package native audit/codesign passed (`package-tail.log`), packaged
  worker byte-matches source. Only DEV was restarted; latest app stays usable.

### Remaining gate (do not declare whole feature qualified)

Original Gemini/Muse outputs are genuine structured selections with same-part
relevance: material/site preparation, measurement/height reveal. They nevertheless
clip known source cues when reviewed against precise timings that were not loaded
in those original UI contexts (e.g. Gemini11s inside10.559–12.599;158s inside
157.68–160.36). A hook-only repair prompt per provider was prepared with original precise cue
times and locked main plans; the user was asked to send them. Await original responses; validate with
`parseExternalHookOnly` then `attachExternalHooks(..., preciseCues)` and rerender
only changed hook snapshots. Do not repair AI JSON or auto-switch providers.
New local files `*-hook-repair-context.json` / `*-hook-repair-prompt.txt` preserve
that context. No second full-plan prompt/video upload is needed in those chats.

Native quit initiator and independent audio/word-boundary review remain unproven.
Windows execution and a fresh live multi-link batch were not tested in this resume.
No C–H, Sports Voiceover, production app/data, push, merge or installation work.

## Historical qualification (before reconstruction)

Base: `ea86de7`, isolated `feature/visual-preset-engine` worktree. In-progress
follow-up; this document supersedes the earlier blanket OAuth blocker. Do not
infer all-provider completion from the ChatGPT evidence.

## Implemented fixes

- macOS secure save root cause: runtime isolation intentionally sets HOME and
  CFFIXED_USER_HOME to DEV/home. A read-only `security default-keychain -d user`
  failed there, but resolved the account's login.keychain-db under its actual
  account HOME. Account `default` was correctly supplied after `-a`, never as a
  keychain path. Only the credential subprocess now uses `os.userInfo().homedir`;
  all other DEV isolation and the separate DEV service remain intact. No system
  default/search-list change, reset, production-token copy or plaintext tokens.
  A read-only preflight prevents save attempts from opening create/reset dialogs.
- Auth polling tracks the specific new OAuth attempt, rather than treating a
  previously connected session as reconnect success. Callback failure/cancel/
  expiry reaches the editor. Expired session status is honest; refresh uses
  bounded requests, deduplication/backoff, validates new token fields and avoids
  saving a refresh after disconnect. Granted scopes come from the token response,
  not caller-controlled callback query parameters. Issued registration survives
  a failed exchange; disconnect removes that DEV registration.
- Gemini/Muse combined prompt asks for main plans plus independent per-part
  teaserSelection in one web roundtrip. Opaque request ID + source ID + current
  provider/transcript/rules reject stale or wrong-source imports. Strict parser
  rejects malformed parts and out-of-range excerpts after existing trim/Smart Cut.
- Accepted web results are `external-import`; provider/model are self-reported,
  never authenticated-API verification. Export preserves them without invoking
  ChatGPT. After manual changes the hook-only prompt retains the exact locked
  main ranges; stale response detection includes content/provider changes during
  async validation. VisualStyle remains authoritative and does not trigger AI.
- Shared source-speech boundary guard rejects a proposed cut through a known
  short timed cue; bounded retries then explicit fallback. Coarse (>10s) captions
  are not word timing. Semantic appeal/action completeness still needs review.
- Typed transcript edits now reach selection even when cached captions exist;
  transcript identity and provider/model invalidate cache, visual style does not.
- Both packagers use `scripts/worker-runtime-files.mjs`. The missing Windows
  SourceContext copy is fixed. Staged-import closure test covers worker/server's
  relative dependencies. Windows runtime has NOT been tested on Windows.

## Real provider evidence

Artifacts are local, ignored, under `.isolation-verification/teaser-finish/`.
No tokens, raw authentication responses or credentials are included here.

| Workflow | Actual evidence | Status |
| --- | --- | --- |
| DEV ChatGPT auth | User confirmed successful interactive sign-in after HOME fix; new credential-store instance read secure session + refresh token; newly built DEV package reloaded connected/sharing session | Passed sign-in/save/reload; refresh/cancel edge tests are local tests |
| ChatGPT hook API | `node scripts/qa-teaser-hooks.mjs --live`, `teaser-render-8h2GE3/provider-outcome.json`: both parts `selection:ai`, model `gpt-6.1-sol`; supplied transcript + timestamped JPEGs | Passed real requests/strict validation; sparse stills, no audio/video input claimed |
| Gemini web | Actual signed-in Chrome conversation `db1815b62da75757`; text-only response copied back by user. Source/request match; hook intervals59.88–66.68 and186.28–192.53 | First response correctly rejected: part IDs were strings `part-1`/`part-2`, not numeric1/2. Not accepted/qualified from that response |
| Muse web | Confirmed by user as https://muse.ai/; observed authenticated chat + file attachment interface, no invented API or disabled bridge | Real selection response and video-analysis capability still pending |

Native Chrome automation repeatedly lost its target window/timed out. No
unexpected file was uploaded: the file chooser target was checked before upload.
The user was asked for full-prompt web roundtrips and original JSON responses;
these must pass validation before claiming web workflow qualification.

## Real-video evidence so far

Existing DEV library sample: Vietnamese construction/house lifting video,
source49a97ade-a270-4274-b32b-d0281dc98617,648.58s/249 automatic caption cues.
An unchanged first200s fixture,480×270, was prepared with77 source cues; a small
bitrate encode preserves timing for browser verification. No unrelated private
video was used. Automatic Vietnamese captions are imperfect; rounding and lack
of word timings limit boundary precision.

Ordinary authenticated UI Auto with this local sample returned independent AI
hooks for both parts; `real-ai-selection-response.json` records exact results.
One measured run: Part1 retained[6,95], hook[90,95] =4.0 output seconds, a complete
sentence about dry/windy dusty conditions, relevant to site preparation but less
compelling than a direct lifting result (model explicitly records this limit).
Part2 retained[101,200], hook[186,192] =4.8 output seconds, surprise that extensive
shoring produced only2.5cm progress, directly previewing the measurement reveal.
These are observed selections, not an engagement-performance claim.

The browser harness initially had selector/wait/inspector-cache errors; those are
QA failures, not passed UI exports. A later ordinary UI export reached the worker
queue, then web+worker DEV stopped while polling (ECONNRESET). Cause is unknown;
do not attribute it to rendering without evidence. Snapshot job97c28a9a-e963-4356-
85aa-02db103f9fb7 was still queued with its effective AI hooks when read from DEV
history. Recovery/render/playback qualification remains pending until recorded.

## Checks

- Focused follow-up31/31 (includes auth state/store, external contracts, hook-only
  locked-range preservation, source/prompt/part rejection, cache and manifests).
- Earlier follow-up full254/254, isolation17/17, TS/lint pass; final full run after
  hook-only additions is pending in `full-final.tap` / `isolation-final.tap`.
- Live synthetic source QA: three jobs/six MP4, legacy, hook-only Dip, explicit
  Flash; scene/audio order, frames/duration and snapshots pass at
  `teaser-render-8h2GE3/result.json`. AI selections required for both parts.
- DEV package built/codesign passed and real session reload passed. A final
  rebuild includes hook-only UI additions; see `package-final.log`.
- No full historical RC matrix, Windows execution or unrelated feature work.

## Remaining before complete verdict

1. Finish real UI export and decoded/audio/playback review; document independent
   hooks, durations, repeated original occurrence, snapshots and restart result.
2. Accept actual Gemini and Muse web results through the current prompt/source
   contexts, export and inspect them. Reject malformed/stale JSON; never repair
   output silently and label it provider-verified. Native video capability needs
   actual video input and evidence; text-only results must say text-only.
3. Record final check counts/package results, commit coherent changes, clean tree.

No production app/data/ports or separate AFF MUSE project was modified. No new
renderer, YouTube stack, subscription, provider SDK or unrelated C–H work.
