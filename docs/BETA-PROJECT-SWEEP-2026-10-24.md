# Beta project sweep — source fixes, 2026-10-24

Checkout: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`.
Branch `beta/maintenance`, base HEAD
`0708d250a98a252996b3f2f41ba66d433301547a` (packaged Beta 1104).
This sweep is uncommitted source work; installed/release apps have not changed.

## Confirmed findings and fixes

| Area / file and function | Evidence in the preceding source | Source change |
| --- | --- | --- |
| HTTP media — `worker/server.mjs::serveMediaPath` | Bare `readStream.pipe(response)` has no owned error/abort cleanup; the route catch can try JSON after media headers | Await pipeline, which closes the file stream on disconnect/error; guard destroyed/ended/headers-sent responses; asynchronous stat |
| HTTP range/audio — `worker/media-http.mjs::mediaByteRange`, server MIME table | Range regex accepted a matching prefix, rejected valid suffix ranges, did not require safe integer offsets; managed MP3/AAC/OGG/Opus/WAV lacked audio MIME | Strict single range parsing, suffix support and bounded offsets; consistent 416 Content-Range; correct audio MIME. HEAD remains body-free |
| HTTP input — `server::readJson` / request callback | Malformed JSON and primitive bodies become generic 500 errors; URL parsing sits outside the route catch | Bounded object JSON with 400/413, no raw payload in parse errors; drain oversize input without destroying response first; catch malformed URL and avoid double response |
| Health — `app/page.tsx::checkWorker` | setInterval can start a second fetch before the first returns; unchanged data still creates a new root state value | One pending poll, bounded wait, cleanup abort and unchanged-state deduplication |
| Sign-in UI — `page::connectChatGPT/disconnectChatGPT/readChatGPTSession` | No synchronous mutex; initial session read can arrive after Disconnect; popup failure can strand a newly added mutex if outside try | Mutual exclusion, revision-bound state, bounded fetches/unmount cancellation; popup open inside try/finally; correct disabled/disconnecting UI. OAuth contract/store untouched |
| Subtitles — `page::loadSubtitles/chooseSubtitleSource/chooseSubtitleLanguage` | In-flight captions remain current when language is changed; reselecting the current provider clears cues | Invalidate/abort old preparation on source/language selection; auto key includes language; retain current/edited cues when changing language, require explicit regeneration; same provider is a no-op |
| Batch — `worker/batch-pipeline.mjs::createBatchProcessor` | Missing cancellation checks after load/repair/history await allow late assignment/submission | Pass signal to load and check cancellation at these boundaries, including before submission. Valid plans/source remain |
| Music publication — `worker/music-library.mjs::import` | Parallel imports can both pass quota before either publishes, then overwrite the same ID | Serialize quota/publication, recheck duplicate/quota at publication, no-replacement hard links; rollback only audio inode proven to belong to this operation (nonzero inode). Existing assets remain |
| Library — `worker/media-library.mjs::list` | Repeated Parts of one source reread source metadata/history | Memoize metadata promises for one scan only, shared by original/Part/trash rows. Subsequent scans and mutations read fresh data |
| Music UI — `components/music-panel.tsx` | Abort can leave ducking detecting true; old audition survives identity changes; initial library read can overwrite post-import list; missing mood misses local filter | Reset detecting, stop/invalidate audition on source/part/asset/workspace changes; shared refresh controller/revision and response-shape check; correct fallback mood; memoize audio key/settings/filter/sort across playhead ticks |
| Manual web bridge — `components/chatgpt-web-handoff.tsx`, extension background/content/popup | Port throw can silently clean up without terminal status; rebind accepts old operation; pagehide leaves fill alive; transient disabled clears received JSON | Terminal disconnect/error, cancel on rebind/pagehide/tab close, recheck binding, honor unlink failure, synchronous disabled guard and retain received JSON until prompt/context changes. No resend/auto Apply |
| Analysis cache — `worker/analysis-cache.mjs::using/prune` | A cancelled shared task can still clean up while a new task of the same key starts; Set.delete from one task removes protection for both | Per-key active reference count; only last completion removes prune protection. No cache identity, AI input or algorithm change |

Music conflict behavior is deliberate: a corrupt/orphan managed asset at the
same ID is retained and reported as `MUSIC_ASSET_CONFLICT`; re-import does not
silently overwrite it. Hard-link publication and unusual filesystem failures
need runtime acceptance, especially on Windows. No existing file was inspected,
imported, deleted or repaired by this source change.

## Reviewed and retained

Read the relevant Editor/Timeline/main-range/teaser/candidate/playback/draft,
music/progress/library/extension paths and worker render/cancel/resume,
publication/scratch, source ownership, history persistence, resource lanes and
analysis/cache orchestration. Existing teaser Apply identity/epoch checks,
manual-main/draft guards, source leases, coalesced history writes, render output
validation and resource lanes showed no additional proven defect in this review.
This is not a claim that every line or runtime state is defect-free.

No main/teaser editorial algorithm, model/reasoning, output schema, timecode,
duration cap, bitrate, blur, transition, zoom, captions engine or renderer quality
setting changed. Auto remains Sol low and text-only; no AI request/retry added.
Previous templates/manual workflow/render optimizations remain. No dependency,
framework, model or dashboard added. New worker module is included by existing
packagers' full worker-directory copy; package closure must be checked at the
next authorized build.

## Verification and limits

Read source/diff and ran `git diff --check` only. No tests, separate lint/typecheck,
build/package, browser automation, AI, ASR, download or render. No runtime,
speedup, quality or QA-pass claim. DEV/production, app bundles, user drafts,
media/music/exports, backups and credentials were untouched. No commit/push/merge.

## Short manual acceptance checklist

1. Play/seek source and music; cancel/close media requests and change workspace.
   Check no worker crash or stuck file request; test normal/open-ended/suffix
   ranges and audio MIME if inspecting Network.
2. Slow/offline worker, rapid Connect/Disconnect, blocked/throwing popup, reload
   while waiting: no duplicate attempt or stale connected status; controls recover.
3. Start captions then change language; prior result must not replace current
   cues. Selecting the same subtitle provider preserves edited text. Regenerate
   only when explicitly requested; verify source language remains correct.
4. Cancel Batch during load/teaser completion/history save: no late submission;
   existing main/source and completed outputs remain.
5. Import duplicate music concurrently and near quota; one valid asset, no
   overwrite or budget overrun. Inspect safe failure on an existing broken ID.
6. Ducking on/off while pending; audition then change part/track/source/tab;
   local mood filter, import/refresh overlap and preview mix still behave correctly.
7. Change extension binding, close/reload Studio or disconnect extension while
   waiting; no automatic resend/Apply. Import failure keeps received JSON copyable.
8. Refresh a library with many Parts and cancel/restart analysis of the same
   source; no stale rows or lost active cache protection. Do not infer performance
   improvement from source changes alone.
