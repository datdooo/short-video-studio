# Smart Auto Cut — Architecture & Implementation Status

## Overview

Smart Auto Cut is an intelligent multi-signal footage analysis engine for single-video Auto, Semi-Auto, and multi-link workflows in ShortCut Studio.

## Per-part teaser extension (separate from C–H)

See [per-part-teaser-hooks.md](per-part-teaser-hooks.md). New real automatic plans
can prepend a separately selected same-part excerpt while preserving their main
ranges. Selection/provenance and presentation order are separate; existing
renderer, subtitle/seek mapping and snapshot storage are reused. This is not the
full candidate-generation/fusion engine. The original login blocker is resolved;
GPT two-part inference and externally imported Gemini/Muse hook repairs have their
own historical evidence in `docs/teaser-hooks-qualification.md`. This A–C task made
no live provider requests and does not requalify editorial quality. D–H remain
incomplete; no Sports Voiceover was added.

## Implementation Progress

| Checkpoint | Scope | Status | Notes |
| --- | --- | --- | --- |
| **A** | **SourceContext + metadata/description/chapters foundation** | **COMPLETED** | Normalized schema, yt-dlp metadata extraction, deterministic description timestamp markers, chapter normalization/bounding, source identity cache keys, local-file representation |
| **B** | **Comments + timestamp clustering** | **COMPLETED** | Bounded best-effort yt-dlp comment retrieval (no media redownload), deterministic M:SS/MM:SS/H:MM:SS mention parsing, conservative dedupe, bounded engagement weighting, fixed-window non-drifting clusters |
| **C** | Most Replayed acquisition/normalization | **IMPLEMENTED; fixture verified** | Existing yt-dlp info JSON → typed source-time intervals; optional unavailable/error states; source cache enrichment; user live acceptance pending |
| **D** | Candidate generation + multi-signal score fusion | **UNIMPLEMENTED** | Semantic/visual/audio/heatmap/comment candidate ranking and selection |
| **E** | Vision + audio integration | **UNIMPLEMENTED** | Sparse candidate frame inspection & silence/energy detection |
| **F** | Single-video Auto/Semi-Auto integration | **UNIMPLEMENTED** | UI candidate review and Auto pipeline integration |
| **G** | Multi-link batch integration | **UNIMPLEMENTED** | Per-link isolated state, retry, resume, and bounded concurrency |
| **H** | Qualification | **UNIMPLEMENTED** | Comprehensive real-world validation and signal ablation |

---

## Checkpoint A: SourceContext Architecture (Implemented)

Checkpoint A implements the canonical normalized source-intelligence foundation in `lib/source-context/`.

### 1. Schema & Contracts (`lib/source-context/schema.ts`, `schema.mjs`)
- `SOURCE_CONTEXT_VERSION = 1`
- Canonical `SourceContext` structure:
  ```ts
  interface SourceContext {
    version: 1;
    source: SourceIdentity;
    metadata: SourceMetadata;
    chapters: Chapter[];
    descriptionMarkers: DescriptionMarker[];
    transcript?: unknown;      // Unpopulated (future checkpoint)
    comments?: CommentSignals; // Checkpoint B — see below
    heatmap?: HeatmapSignals;  // Checkpoint C — source-time ms / relative replay interest
    visualSignals?: unknown;   // Unpopulated (Checkpoint E)
    audioSignals?: unknown;    // Unpopulated (Checkpoint E)
    provenance: SourceProvenance;
  }
  ```

### 2. YouTube Metadata Extraction (`lib/source-context/youtube-metadata.mjs`)
- Reuses existing yt-dlp JSON without downloading video or duplicating network calls.
- Extracts:
  - `videoId`: sanitized YouTube video ID
  - `canonicalUrl`: canonical YouTube URL
  - `title`: sanitized string
  - `description`: sanitized string (bounded at 50,000 characters)
  - `uploader` / `channel`: uploader or channel name
  - `channelId`: channel ID
  - `channelUrl`: channel URL
  - `uploadDate`: string (YYYYMMDD)
  - `durationSeconds`: number (duration in seconds)
  - `tags`: array of sanitized strings (up to 50 tags, max 80 chars each)
  - `viewCount`, `likeCount`, `commentCount`: sanitized integers
  - `chapters`: normalized chapters
  - `descriptionMarkers`: deterministic timestamp markers from description
- All metadata fields except basic identity are optional and degrade gracefully if missing.

### 3. Description Timestamp & Marker Parsing (`lib/source-context/description-markers.mjs`)
- Deterministic regex parser supporting MM:SS, M:SS, and HH:MM:SS timestamps on lines with brackets, parenthesis, or prefixes (e.g., `01:22 Soil`, `[02:15] Watering`, `Step 1: 00:30 Potting`).
- Detects explicit highlight / payoff markers (`final result`, `before and after`, `reveal`, `outcome`, `highlight`, etc.).
- Categorizes markers into `timestamp`, `numbered`, or `highlight`.
- Enforces duration bounds, chronological sorting, and deduplication.

### 4. Chapter Normalization & Bounds (`lib/source-context/chapters.mjs`)
- Validates ordering and duration bounds:
  - Converts seconds (`start_time`/`end_time`) to integer milliseconds (`startMs`/`endMs`).
  - Clamps start and end times to `durationMs`.
  - Resolves missing end times from successive chapter start times or total video duration.
  - Resolves overlapping chapters by clamping previous chapter `endMs` to the next chapter `startMs`.
  - Filters out-of-bounds chapters.
  - Automatically synthesizes chapters from description markers when official yt-dlp chapters are missing.
  - Malformed or invalid chapters degrade gracefully to empty arrays without crashing.

### 5. Source Identity & Cache Key (`lib/source-context/identity.mjs`)
- `computeSourceCacheKey(sourceOrContext, revision = 1)`:
  - YouTube key: `youtube:<videoId|url>:<durationSeconds>:rev<revision>`
  - Local file key: `local:<id|path>:<durationSeconds>:rev<revision>`
- **Style Invariance**: Changing any visual styling property (font, filter, template, background, overlay, animation, transition) has strictly zero effect on source identity or analysis cache keys.

### 6. Local-File Support & Graceful Fallbacks (`lib/source-context/normalize.mjs`)
- Local files are represented using the identical `SourceContext` contract with `kind: "local"`, requiring no YouTube metadata.
- Deep-cloned, immutable structures ensure no shared mutable state.

### 7. Security Model
- All external strings (`title`, `description`, `tags`, `chapter labels`, `comment text`) are treated as **untrusted data**.
- Control characters (`\x00-\x08\x0B\x0C\x0E-\x1F\x7F`) are stripped.
- Untrusted text is kept structurally isolated in data properties and is never executed as shell commands, scripts, or agent instructions.

---

## Checkpoint B: Comments + Timestamp Clustering (Implemented)

Checkpoint B adds bounded comment retrieval and deterministic comment-timestamp clustering in
`lib/source-context/comments.mjs` and `lib/source-context/comment-clusters.mjs`. `SOURCE_CONTEXT_VERSION`
stays `1`, and source cache identity is unchanged (identity never depends on comments or visual style).

### 1. Comments Contract (`lib/source-context/schema.ts`)
- `comments?: CommentSignals` replaces the previous `comments?: unknown`.
- `CommentSignals`: `status` (`available` | `unavailable` | `disabled`), optional `reason`, bounded `comments`, derived `clusters`, and `provenance`.
- `SourceComment`: `id`, optional `parentId`, `isReply`, optional `author`/`authorId`, bounded `text`, `likeCount`, `replyCount`, `timestampMentions`, `engagementWeight`.
- `CommentCluster`: `centerMs`/`centerFormatted`/`startMs`/`endMs`, `mentionCount`, `commentCount`, `distinctAuthorCount`, bounded `score`, bounded `supportingCommentIds`.

### 2. Bounded Retrieval (`worker/youtube-downloader.mjs`)
- New `comments(url, signal)` downloader method reuses the existing yt-dlp execution, cookie and
  timeout plumbing; it never redownloads media (`--skip-download --write-comments --dump-single-json`).
- Comment attempts are yt-dlp only; the YouTube.js engine is not used for comments.
- `buildYouTubeCommentArgs({ maxComments })` is a pure, network-free argument builder bounded to
  `MAX_COMMENTS = 200`.
- Retrieval is optional/best-effort. `collectCommentSignals(load, options)` wraps any load failure into
  a normalized `unavailable` signal (`reason: "comment-retrieval-failed"`) and never fails the pipeline.

### 3. Mention Parsing (`lib/source-context/comments.mjs`)
- Deterministic `M:SS`, `MM:SS` and `H:MM:SS` parsing, reusing the Checkpoint A `parseTimestampToMs`/`formatTimestamp` helpers unchanged.
- Rejects invalid forms (`99:99`, `12:75`, `60:00`), timestamps glued to longer digit runs, out-of-duration timestamps, and obvious clock forms directly followed by AM/PM (`3:30 pm`, `10:15 a.m.`).
- Caps mentions at `MAX_TIMESTAMP_MENTIONS_PER_COMMENT = 3`, text at `1,000` chars, and mention context at `80` chars.
- Comment text is sanitized untrusted data: control characters stripped, never executed, never sent to an LLM.

### 4. Normalization, Dedupe and Bounds
- `normalizeComments(raw, { durationMs, enabled, maxComments, extractedAt })` accepts a raw array or a yt-dlp info object (`{ comments: [...] }`); malformed/null input degrades to `unavailable` and never throws.
- At most `MAX_COMMENTS = 200` useful comments are normalized from a bounded scan window.
- Conservative dedupe only: exact case/whitespace-normalized duplicate text. No fuzzy prefix/shingle matching.
- Same-author spam bounding caps one author at `MAX_COMMENTS_PER_AUTHOR = 3` comments; drop counts are recorded in provenance.
- Replies are retained with `parentId`, but are discounted (`REPLY_WEIGHT_FACTOR = 0.5`) so reply expansion cannot disproportionately raise cluster scores.

### 5. Engagement Weighting
- `computeEngagementWeight({ likeCount, replyCount })` is deterministic, bounded to `[0, 1]`, log-compressed and count-capped (`MAX_ENGAGEMENT_COUNT = 10,000,000`), so extreme counts cannot dominate.

### 6. Clustering (`lib/source-context/comment-clusters.mjs`)
- Fixed documented window `COMMENT_CLUSTER_WINDOW_MS = 30,000` anchored on each cluster's earliest mention, so clusters cannot transitively chain-merge or drift.
- Clusters are ordered by bounded score (mentions/effective mentions, distinct authors, bounded weight), then center time; capped at `MAX_CLUSTERS = 50` with at most `MAX_SUPPORTING_COMMENT_IDS = 20` supporting comment IDs.
- Output carries center/start/end timestamps, mention/comment/distinct-author counts, a bounded score and supporting comment IDs for Checkpoint D.

### 7. Optional-Field Preservation (`lib/source-context/normalize.mjs`)
- Re-normalizing a `SourceContext` preserves optional signals as fresh copies; comments and heatmap are validated at the serialized boundary. Older contexts missing heatmap remain distinguishable from acquired absence.
- YouTube contexts normalize `info.comments` when present and otherwise report an `unavailable` comment signal; local sources report `disabled` and keep working with no YouTube metadata.
- Checkpoint A description-timestamp parsing was reused, not refactored.

## A/B wiring checkpoint — 2026-10-19

Previously A/B supplied normalization helpers and an independently callable downloader;
source imports did not populate `sourceContext`. Imports now retain bounded context
from existing metadata/download/transcript info, and local uploads receive local
context. Explicit hook analysis enriches comments once (<=200, dedicated 180s total
budget), persists context, and supplies existing description/chapter/comment-cluster
inputs. Preview/render/source reload perform no signal acquisition. Disk cache is
source/duration/revision-specific, cloned and rebound to each imported source ID.
Subscriber-aware cancellation and optional failure isolation are retained. No main
planner/fusion or new batch orchestration was added. Fixture focused checks: 73/73;
live YouTube acceptance is intentionally deferred to the user.

## Checkpoint C: Most Replayed (2026-10-19)

`lib/source-context/heatmap.mjs` implements `HeatmapSignals`: status/reason,
`timeline: "source"`, `timeUnit: "ms"`, `intensitySemantics:
"relative-replay-interest"`, bounded `{startMs,endMs,intensity}[]` and provenance.
The upstream extractor contract is documented by
[yt-dlp InfoExtractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/common.py)
and implemented by
[YouTube `_extract_heatmap`](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).
Reuse is through the existing installed yt-dlp, with no vendored code, new package,
API, scraper, Python service or GPU stack.

- Raw `start_time`/`end_time` seconds become integer source milliseconds. Duration
  must be finite, positive and safely representable. Reject negative starts,
  empty/reversed intervals, numeric strings, non-finite/out-of-range intensity;
  discard intervals starting beyond duration; clip ends to duration.
- Keep yt-dlp's original `[0,1]` relative values (zero is valid). No min/max
  rescaling, interpolation, inferred scores, retention estimates or viewer counts.
- Scan at most 4,000 entries, retain at most 2,000 bins. Sort start/end ascending,
  intensity descending. Exact interval duplicates keep the strongest value;
  later overlapping intervals are dropped. Gaps stay gaps. Provenance records
  dropped/clipped/duplicate/overlap counts and whether input/output was bounded.
- Absent/null, empty, malformed, unknown duration, unsupported local source,
  unsupported fallback provider, extraction failure and timeout are explicit
  reasons. Missing heatmap is normal; unavailable/disabled signals have no bins.
- Serialized heatmap requires exact units/semantics, finite bounded ordered
  non-overlapping bins, status consistency and bounded string provenance. Invalid
  data becomes `invalid-serialized`; unknown extras are stripped. Valid data
  round-trips as independent copies. Local sources stay disabled.

### Source flow, consumers and cache

`worker/youtube-downloader.mjs` retains bounded normalized context from successful
metadata/download/transcript/comments extraction for five minutes (max128 video
IDs). The metadata response remains its existing small shape; transcript responses
also carry context. Import saves context from those existing extractions; it does
not run another extraction for A/C. Existing subtitle retrieval is unchanged.

`worker/source-context.mjs` owns explicit enrichment and a normalized disk cache
under DEV `media/cache/source-context/`. Keys still use the existing
`computeSourceCacheKey` (source/video + rounded duration + rev1), hashed for filenames.
`SOURCE_CONTEXT_VERSION` remains1. VisualStyle is excluded. Copies are rebound to
individual source IDs; other source identities cannot reuse them. Atomic writes
contain only normalized context, not raw signed format URLs/cookies/media.

Acquisition markers in provenance distinguish attempted absence/failure from an
old v1 cache missing C. Missing C enriches through existing cached extraction or
one bounded metadata operation; A/B are retained, without re-fetching comments.
Later ordinary extraction can enrich a cached failure without an extra call;
partial fallback data cannot erase a previously valid replay signal. Fresh bins
are bounded again against probed media duration. Missing/failed signals are reused,
not polled repeatedly. There is no new refresh dashboard/endpoint.

Source reload validates context but performs no network calls. Import populates A/C;
B is deliberately deferred to explicit existing hook selection, with <=200 comments
and a separate **180s total** signal budget. Metadata enrichment has a **60s total**
budget. Embedded comments avoid another fetch. User cancellation propagates;
optional timeouts/failures become unavailable and preserve other evidence.
Concurrent consumers share work; cancelling one does not cancel the others.

Only the existing hook-analysis consumer is extended: source title plus bounded
untrusted description, chapters, derived same-part comment clusters, and at most24
uniformly sampled replay bins intersecting that part's allowed ranges. The AI input
labels replay interest as relative source-time evidence. This proves delivery,
not that the model follows it or improves editorial quality. Actual supporting
input participates in the existing hook cache; style does not. Raw comments never
enter the model. Manual main ranges, locks and independent part plans are unchanged.

The main Auto/Semi-Auto planner remains transcript-driven. External Gemini/Muse
copy/paste prompts do not receive these new signals. Batch source imports inherit
ordinary saved context, but no new batch planner/orchestration was implemented.
D–H remain unimplemented. See `smart-auto-cut-abc-qualification.md` for checks and
user acceptance steps; the existing built DEV app needs rebuilding to include A–C.

## D checkpoint (backend; ordinary UI wiring follows in F)

`lib/auto-cut/main-content.mjs` and `worker/main-content.mjs` generate at most48
chronological two-entry recipes from actual cue/scene/chapter boundaries. Windows
preserve continuity through source end; AI can exclude only validated boundary
ranges with reasons. Existing >60s/1.25x/one-second-trim constraints and explicit
real-footage short-source padding remain. Known cue interiors are not split;
missing boundaries are documented, never claimed word aligned.

Contributions: structural coverage<=.25, balance<=.20, lexical transcript relevance
<=.20, chapter entry<=.10, shared engagement max(comments,replay)<=.15, visual<=.05,
audio<=.05. Missing evidence contributes zero. These are heuristic budgets, not
probabilities. Existing GPT structured adapter ranks supplied recipes; malformed
output gets at most one repair attempt, auth/rate/model failures stop retries,
and deterministic fallback is explicit. No new provider API is claimed.

The worker `/api/sources/:id/auto-cut` consumer supports context preparation and
main selection; F connects ordinary Auto/Semi UI and existing per-part hooks.
Manual Custom Time changes mark only edited parts locked; selection cannot alter
their segments. Shared cue-boundary extraction retains legacy Smart Cut behavior.
New analysis cache is atomic, 24MiB/14days/512 files, <=2MiB per entry; active and
referenced resume keys are protected, and writes are skipped if protection fills
the budget. No user media/exports/plans/credentials or other cache directories
are deleted. See `smart-auto-cut-reuse.md`; H is not qualified by fixtures.

## E checkpoint — bounded local FFmpeg evidence

`worker/local-signals.mjs` reuses FFmpeg `scdet`/MAFD and `silencedetect`/`astats`.
It analyzes at most180 source seconds (full short source or three60s windows),
2fps/160px video, mono16k audio metadata; one analyzer operation is active at once,
with a60s total subprocess budget and cancellation. No analysis video/audio
intermediate is written. Silence and RMS/luma changes are numeric proxies only;
no action, emotion, speech transcription or semantic-event recognition is claimed.
Sparse semantic images reuse the existing bounded six-JPEG provider adapter;
images rejected/unavailable are retried text-only and explicitly recorded.

The `ffmpeg-local-v1` contract uses explicit source seconds, media fingerprint,
sampled ranges, bounded finite boundaries/activity/silences and availability
reasons. Consumers validate fingerprint/time units/duration; missing/partial data
is optional and coverage is disclosed. Cache uses the same24MiB/14day protected
policy. SourceContext stores visual/audio evidence; main preparation actually
consumes it for boundary candidates and bounded contributions. ASR remains the
existing speech service (no model download or duplicate recognizer).

Focused D/E/package-closure checks include an actual4s/64px scene+silence FFmpeg
fixture (<100KB, removed after test), optional timeout, cancellation and cache reuse.
Ordinary UI wiring and final delivery are F/G, not established by helpers alone.
