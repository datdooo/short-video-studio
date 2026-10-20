# TSX design / editor Preview 1× — 2026-10-20

Base HEAD `13f3c90f28afb30a3e6e53c87d40695197914712`, branch
`recovery/visual-dev-reconstructed`, with all inherited dirty work preserved.
Primary design is now user-supplied
`/Users/datdo/Downloads/shortcut_studio_dev_ui_prototype_codex_handoff.tsx`,
superseding the earlier ZIP. Its mock schemas, alternate transition enums, demo
scenarios, fake autosave/progress and simulated source clock were NOT installed.
The user's explicit Preview1× requirement overrides the TSX's Output1.25× labels.

## Source changes

- Existing resizable source / preview + selected Timeline / Inspector layout kept.
  Shared neutral black/charcoal tokens, orange primary/hover/pressed/focus/slider/
  tab states replace blue/purple UI accents. Errors red, success green. No video
  background/filter/text color, template recipe or effect asset is recolored.
- Compact source-time fields, shared Hook→Main selector adjacent to teaser;
  cached alternatives collapsed, source-gap indicators and row Xem use the REAL
  presentation mapping. Main ranges, manual locks, invalid drafts and candidates
  remain per part in the existing draft context. Header New Session confirmation
  uses installed Radix Popover, not prototype demo/reset handlers.
- Existing Batch/Kho video/job polling remain live; rendered MP4 playback retains
  its real encoded duration/speed. No fake relabeling of completed outputs.

## Clock contracts (no EditPlan schema change)

| Layer | Preview | Export / selection policy |
| --- | --- | --- |
| Config | New `lib/preview-config.mjs`: PREVIEW_RATE=1, explicit clock/cache versions | `lib/render-config.mjs` PLAYBACK_RATE=1.25 unchanged |
| Video/controller | `preview-decks` source video1×; `preview-timeline` defaults1×. Cumulative presentation segments include repeated teaser, every retained source range and existing footage padding | Render assembly/resource caps/sequential range seeks unchanged |
| Playhead/seek/duration | Home uses presentationDuration/1; source clock locates the actual segment (never first.start+playhead). Row seek targets the MAIN occurrence after teaser | No divided timestamps stored in plan, no change to finalDurationOf/job/output data |
| Captions/effects | Captions compare presentation cue time at1×. Adapter previewToExportTime maps transition windows/title animation/shine to their existing authored export clock, so the same footage positions and effect phases align | Original transition windows, clip mask, durations and animation presets untouched |
| Teaser/candidates/audition | Durations labeled preview1×, audition video1×. Maximum displayed via existing hookDurationLimits:11.25s preview corresponds to9s export | Validators, same-part policy, 10 rendered EXPORT seconds exclusion (=12.5s preview main), retries and selector unchanged |
| Music/ducking | Worker audio preview uses existing bounded range PCM + source1×, no atempo; shared ducking mapper receives speed1. BGM itself remains normal pitch/speed | Shared helper defaults to PLAYBACK_RATE1.25; existing export call remains unchanged |

Source60→70s stays exactly those SOURCE timestamps; preview10s and export8s.
Transitions still add no duration. Existing source/padding ordering and teaser's
later original occurrence are not changed.

`worker/music-preview.mjs` alone changes preview preparation/cache/response;
`worker/music-audio.mjs` adds an optional clock speed (default export1.25), with
`lib/music/envelope.mjs` accepting it. No edit to worker/server.mjs, range-input,
media-resources, speech analysis, renderer or FFmpeg export. Their inherited
render-lag fixes are byte-for-byte preserved against this turn's starting hashes.
The new config is included in the shared macOS/Windows worker runtime manifest.

Audio cache version now `music-mix-v4-presentation-1x` and key includes rate,
clock version, source fingerprint, complete presentation mapping/settings/VAD.
Client expects rate1 + presentation-1x-v1 response; old worker/mix is rejected
with a clear reopen-after-jobs message, never silently played as1×. Existing
128MiB/64-entry/14-day cache bounds, leases, resource gate, cancellation and
scratch cleanup retained. Style does not enter the key or cause AI re-analysis.
Audio seeks before play; one ownership registry pauses teaser auditions on main
play/seek/workspace/music audition. No new background decoder/loop introduced.

Autosave session-v1 remains bounded/atomic. New optional previewTimebase marker
identifies presentation-1x-v1; old draft playhead (export clock with valid plan)
is converted once on read by1.25, without mutating ranges, timestamps or job
snapshots. Source-only draft positions stay unchanged. Restore remains paused,
with no automatic download/analysis/render/music preparation.

## Delivery / unverified

Source/diff review only. No tests, lint/typecheck, browser automation, smoke,
playback/audition, QA render, provider or YouTube verification. Functional sync,
visual fidelity, smoothness and M2 lag improvement require user acceptance.
Build: one Node22 `npm run package:mac:dev` succeeded (exit0).
App: `release/dev/ShortCut Studio Dev.app`.
Log: `/tmp/shortcut-dev-tsx-preview-1x-build-20261020.log`.
Native packager dependency/signature audits completed; frontend chunk-size warning
is non-fatal. Package includes current source; only delivery docs edited afterward.
No app shutdown/launch or
worker restart; no push/merge. Credentials, media/exports and backups untouched.

Manual acceptance: source60–70s previews10s and exports8s; compare source vs
preview clock through teaser/gaps/padding and seek; listen voice/BGM/ducking at1×,
including both parts, audition exclusivity and paused seeks. Confirm old worker
is rejected for mixes until the updated DEV is opened after jobs finish; reload
legacy/new drafts without extra work; both teasers/invalid inputs still guard
Render. Inspect text/foreground-only effect alignment and real export separately.
