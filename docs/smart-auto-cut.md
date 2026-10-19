# Smart Auto Cut — Architecture & Implementation Status

## Overview

Smart Auto Cut is an intelligent multi-signal footage analysis engine for single-video Auto, Semi-Auto, and multi-link workflows in ShortCut Studio.

## Per-part teaser extension (separate from C–H)

See [per-part-teaser-hooks.md](per-part-teaser-hooks.md). New real automatic plans
can prepend a separately selected same-part excerpt while preserving their main
ranges. Selection/provenance and presentation order are separate; existing
renderer, subtitle/seek mapping and snapshot storage are reused. This is not the
full candidate-generation/fusion engine. **Live AI qualification is blocked** by
the missing DEV ChatGPT session/login failure; deterministic fallbacks are
explicitly labeled and do not satisfy AI verification. Gemini/Muse remain web/
copy-paste main-plan workflows, not verified hook-analysis APIs. C–H below remain
incomplete; no Sports Voiceover was added.

## Implementation Progress

| Checkpoint | Scope | Status | Notes |
| --- | --- | --- | --- |
| **A** | **SourceContext + metadata/description/chapters foundation** | **COMPLETED** | Normalized schema, yt-dlp metadata extraction, deterministic description timestamp markers, chapter normalization/bounding, source identity cache keys, local-file representation |
| **B** | **Comments + timestamp clustering** | **COMPLETED** | Bounded best-effort yt-dlp comment retrieval (no media redownload), deterministic M:SS/MM:SS/H:MM:SS mention parsing, conservative dedupe, bounded engagement weighting, fixed-window non-drifting clusters |
| **C** | Heatmap normalization | **UNIMPLEMENTED** | Most Replayed engagement curve normalization (0–1 relative scores) |
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
    heatmap?: unknown;         // Unpopulated (Checkpoint C)
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
- Re-normalizing a `SourceContext` no longer silently drops `transcript`, `comments`, `heatmap`, `visualSignals` or `audioSignals`; present optional fields are deep-cloned and preserved.
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
