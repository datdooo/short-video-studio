# Smart Auto Cut A/B/C checkpoint — 2026-10-19

Scope: A/B missing source-context wiring + C Most Replayed acquisition/normalization.
Not full Smart Auto Cut. D–H, new scoring/candidates/fusion, vision/audio analysis,
new batch orchestration and Sports Voiceover were not implemented.

Git: clean start `74d138d6406eeefc43c6735600f253742632941a`, branch
`recovery/visual-dev-reconstructed`. A/B commit `316ea60`; C is the immediately
following implementation commit (use `git log -2 --oneline`). Existing reconstruction
and historical hook/Visual Editor QA records are preserved.

## Before / after

| Area | Already present | Completed in this task |
| --- | --- | --- |
| A | SourceContext v1, metadata/title/description/chapters normalization and identity helpers | Capture context from existing downloader info, preserve partial extraction data, save with imported source, return with transcript response, local context fallback, validate on saved-source reload |
| B | <=200 normalization, parent `root`, dedupe/mentions/clusters/provenance, downloader comments method and dedicated per-attempt timeout | Callable explicit hook-analysis enrichment, embedded-comment reuse, 180s total comments budget, isolated failure/cancellation, disk reuse, stricter serialized bounds |
| C | Untyped opaque optional `heatmap`, no acquisition/normalization | Typed normalized source-ms/relative-intensity contract, existing-extraction acquisition, strict serialized boundary, old-cache enrichment and bounded hook input |

See `smart-auto-cut.md` for the full contract, ordering/duplicate/overlap policies,
upstream yt-dlp source links, cache markers, timeout and unavailable semantics.
No new dependencies or copied third-party implementation. Node22/macOS ARM64 and
existing yt-dlp/FFmpeg/Sharp stack are retained; renderer and package manifests
need no runtime design changes.

## Actual consumers

| Signal | Acquisition/storage | Consumer today |
| --- | --- | --- |
| Title | Existing metadata/download/transcript extraction → import/source context | Existing source title; bounded hook source title |
| Description, chapters | Same extraction, context disk cache/source.json | Existing hook-analysis structured description/chapter input |
| Comments | Existing embedded extraction or deferred bounded comments call on explicit hook analysis | Normalized comments retained locally; only derived same-part clusters enter hook input |
| Most Replayed | Same yt-dlp info JSON, with unavailable/error reasons when missing | Up to24 uniformly sampled existing bins intersecting this part's ranges, explicitly relative replay interest |

No claim that a model actually uses each signal or that quality improves. The
main Auto/Semi-Auto content planner remains transcript-driven. External Gemini/Muse
prompt/import workflows are unchanged. Ordinary batch source imports save context,
but there is no new multi-signal batch planner/retry/resume architecture.

## Verification

All commands use `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.

| Check | Result |
| --- | --- |
| Pre-change focused baseline: source-context, downloader, teaser selection | 66/66 passed |
| A/B wiring focused suite including runtime import closure | 73/73 passed |
| Final focused: `node --test lib/source-context*.test.mjs worker/source-context.test.mjs worker/youtube-downloader.test.mjs worker/teaser-selection.test.mjs desktop/worker-runtime-files.test.mjs` | 94/94 passed |
| Full: `node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs` | 287/287 passed; no skips |
| `npx tsc --noEmit` / `npm run lint` | Both passed (exit0) |
| Runtime packaging | Shared macOS/Windows staged import-closure test includes new heatmap/context/shared-operation files; no package build |

Fixture coverage includes synthetic realistic yt-dlp-shaped metadata/comments/
heatmap, absent/malformed/partial responses, non-finite/wrong-unit/out-of-duration
serialized values, deterministic sort/dedupe/overlap handling, relative zero,
scan/output caps, clone-safe round trips, v1/key compatibility, legacy missing C,
cache restart/enrichment and URL aliases, independent source IDs, partial fallback
preservation, probed/extractor duration mismatch, sub-second rounded-key reuse bounds, dedicated timeout, optional
failure, concurrent acquisition and subscriber cancellation. Existing hook tests
still verify main locks/ranges and style-invariant analysis caching.

The initial sandbox full-suite run had one environment failure: the localhost
port-collision test could not listen (`EPERM`). It was rerun outside that sandbox
restriction; no assertion was weakened or skipped.

No live AI calls, YouTube downloads/acceptance campaign, browser automation,
render, RC matrix or package rebuild. No running app/process was stopped, no
production app/data/ports were accessed or modified, no backups were removed.

## User DEV acceptance

1. Quit the existing DEV instance if it owns 5273/8887; leave production alone.
   Start source DEV in this repository:
   ```sh
   PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run personal:dev-isolated
   ```
2. In DEV at `http://127.0.0.1:5273`, choose a YouTube URL and **Chuẩn bị source để
   render**. Inspect `/api/sources/youtube` response: `source.sourceContext`
   contains source-specific metadata/chapters and heatmap status/units/bins.
   Missing Most Replayed is an expected unavailable result. Local upload should
   work with comments/heatmap disabled. No signal acquisition occurs on preview.
3. Run the existing GPT two-part hook-selection workflow when ready to incur a
   provider request. Comments are deferred until this explicit analysis. Inspect
   the source's saved `source.json` under DEV `media/sources/<id>/` for comments
   status/clusters/provenance. Repeat unchanged analysis, change only style, then
   try another URL: verify cache reuse, independent context/plans and retained
   manual ranges/locks. Judge actual hook relevance/editorial quality yourself.

The current `release/dev/ShortCut Studio Dev.app` is intentionally unchanged and
**does need a rebuild** to contain A/B/C. When desired, the user can run Node22
`npm run package:mac:dev`, then open `release/dev/ShortCut Studio Dev.app` in place.
Do not install into `/Applications`. Source DEV already uses these changes.

## Remaining limitations

- Live yt-dlp/YouTube availability, regional/auth differences, elapsed time on real
  comments and editorial quality are user acceptance, not established by fixtures.
- Missing/failed optional signals are cached, not repeatedly polled. A later normal
  extraction can enrich them without duplicate requests. No new explicit refresh
  UI/endpoint was added; fresh remote signal availability is not monitored.
- Existing caption extraction remains separate; this task adds no extra media
  download or A/C metadata extraction when an existing result is available.
- No custom main-part scoring, scene/sentence candidate generation, new audio/vision
  engine, or full Auto/Semi-Auto/multi-link fusion. D–H remain unimplemented.
