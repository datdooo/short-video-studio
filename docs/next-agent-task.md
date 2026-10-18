# User pause — DEV cleanup, 2026-10-18

Feature development is paused. Read `docs/dev-workspace-cleanup.md` first.
The DEV files remain, but their `.git` pointer targets metadata in the manually
deleted parent checkout. Branch/HEAD/status are currently unverifiable. Do not
initialize Git, prune, discard files or resume feature work automatically.
Available source and older package code were preserved before disposable cleanup;
recover/verify the missing Git store separately before ordinary Git work.

# Previous feature task (paused)

Per-part teaser follow-up is in progress after `ea86de7`. Read
`docs/teaser-hooks-qualification.md` for current evidence and pending items.
DEV Keychain HOME resolution is repaired; user signed in successfully and
`scripts/qa-teaser-hooks.mjs --live` passes for both parts with `gpt-6.1-sol`.
Web imports now have combined plan+hooks, source/prompt validation and hook-only
refresh for manually locked ranges. Never call an external import API-verified.
Keep all existing work and do not start unrelated C–H or Sports Voiceover.

## Prior RC checkpoint

Codex return RC verification is complete for the macOS DEV Visual Editor.
The app is **READY FOR USER ACCEPTANCE**, with limitations recorded below.
Do not automatically begin a new feature from this RC task.

Rebuild at the returned state exposed a missing packaged SourceContext dependency
(fixed). A real packaged UI→worker harness now qualifies native/CPU export,
Custom/rematch, playback and recovery. Current results/limitations are in
`docs/final-visual-editor-qualification.md`, "Codex return audit". No RC checklist
work remains in this task; user acceptance and any new feature request are next.
Smart Auto Cut Checkpoint A (SourceContext + metadata/description/chapters) is **COMPLETED**.
Smart Auto Cut Checkpoint B (comments + timestamp clustering) is **COMPLETED** (see `docs/smart-auto-cut.md` and `lib/source-context/`).
These are foundation modules, not integrated multi-signal planning. Inherited B
fixes were preserved in `37ac963`; C–H remain unimplemented. No Sports Voiceover.

Branch: `feature/visual-preset-engine`.

# Smart Auto Cut Roadmap

| Checkpoint | Scope | Status |
| --- | --- | --- |
| A | SourceContext + metadata/description/chapters | **COMPLETED** |
| B | Comments + timestamp clustering | **COMPLETED** |
| **C** | **Heatmap normalization** | **NEXT FEATURE CHECKPOINT AFTER RC, when requested** |
| D | Candidate generation + score fusion | UNIMPLEMENTED |
| E | Vision + audio integration | UNIMPLEMENTED |
| F | Single-video Auto/Semi-Auto integration | UNIMPLEMENTED |
| G | Multi-link batch integration | UNIMPLEMENTED |
| H | Qualification | UNIMPLEMENTED |

Use `.agents/skills/smart-auto-cut/SKILL.md` for the approved design.
Work one coherent checkpoint at a time. Focused tests first. Do not touch production ports or app.

# Checkpoint B Notes For The Next Agent

- `comments?: CommentSignals` is now a concrete contract (status/reason, bounded comments, derived clusters, provenance). `transcript`, `heatmap`, `visualSignals`, `audioSignals` remain `unknown` by design.
- Comment retrieval lives in `worker/youtube-downloader.mjs` (`comments(url, signal)`), reuses the existing yt-dlp plumbing and never redownloads media. `buildYouTubeCommentArgs` is a pure, network-free builder.
- `collectCommentSignals(load, options)` is the best-effort entry point: any retrieval failure degrades to `status: "unavailable"` and never fails the pipeline.
- `normalizeSourceContext` now preserves already-present optional signals; keep that behavior when implementing later checkpoints.
- Known limitations: comment retrieval is untested against a real YouTube response (unit tests only, no network); cluster scoring is a bounded heuristic that later qualification (Checkpoint H) should validate; the yt-dlp `max_comments` extractor argument is bounded by `MAX_COMMENTS` but per-thread reply limits are left to yt-dlp defaults.

