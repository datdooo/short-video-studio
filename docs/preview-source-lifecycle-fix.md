# Source-switch preview lifecycle — 2026-10-20

Starting source HEAD ca4c3c5, recovery/visual-dev-reconstructed. Static source
inspection confirms the reported ownership defect: React callback refs mutate
`deckVideos.current` slots to null, while the old controller retained that array
and dereferenced it in pause/dispose after unmount. This can throw from effect
cleanup. The available DEV launcher.log contains startup/SHORTCUT_READY only;
no captured browser stack establishes that this was the sole reported crash.
No reproduction/browser/provider call was performed.

- Controller snapshots media nodes and segments. WeakMap ownership prevents old
  controllers touching reclaimed nodes; idempotent disposal invalidates promises,
  cancels timer/listeners and releases only owned decoders without UI callbacks.
- App callbacks/RAF/microtasks/play failures are source/controller scoped. Video
  nodes are keyed by URL; metadata seeking is controller owned (also delayed
  initial metadata). Cleanup never clears a newer controller ref.
- URL/mode/local/batch-source changes synchronously stop old preview/BGM, cancel
  source requests and invalidate old analysis, captions and external prompt state.
  Source preparation settlement cannot clear newer busy/error state. Actual
  selected music, volume/ducking, visual/subtitle settings and queued jobs persist.
- Music pause invalidates pending play; old play rejection/success cannot unmute,
  stop or set errors on a newer mix. Metadata/transcript/caption handlers forward
  disconnect cancellation into existing worker APIs/shared operations.
- Malformed title/transcript responses are checked before state use. YouTube API
  errors remain in the URL field status, not an uncaught page exception.

Delivery distinguishes source review/build from runtime acceptance. User manual
checks: play both parts with BGM, paste another URL repeatedly/in quick succession,
try invalid/unavailable URL, switch local/YouTube/workspace, then prepare/generate
new source. No old audio/status/captions should return; style/music choice should
remain; valid source should still play from its first retained range. Functional
result and current ChatGPT inference remain unverified by request.

Combined DEV build: Node22 `npm run package:mac:dev`, exit0, one build.
App: `release/dev/ShortCut Studio Dev.app`.
Log: `/tmp/shortcut-dev-preview-lifecycle-teaser-build-20261020.log`.
Packaging performs its built-in native dependency/signature audit; no functional
QA, app launch, render or current inference verification was run. The existing
running app/processes were left alone. Open the updated app only after quitting
the old DEV instance normally.
