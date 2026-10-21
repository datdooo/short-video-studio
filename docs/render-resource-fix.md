# Bounded rendering / M2 balanced profile — 2026-10-20

2026-10-21 follow-up: `source-probe-render-performance.md` separates bounded
metadata probes from the heavy lane, protects export-owned validation and removes
redundant blend/subtitle work. The original FFmpeg/Whisper/VAD/export limits and
finite range assembly below remain. No new runtime performance qualification.

LATEST user override2026-10-21: `editor-during-render.md` supersedes the global
pause/exclusive lease behavior: editor playback remains active;1 export and1
serial editor media task may coexist. VT target12M/max14M/buf24M, CPUABR12M by
default replace historical16M/CRF17 below. Range assembly/thread bounds preserved.

Status: source/diff/syntax review only; no render, tests, benchmark, browser or
AI/YouTube requests. User reported whole-system lag on Render. This change must
not be called performance-qualified until the user measures real playback/export.

## Findings versus hypotheses

Verified in13f3c90: `renderPart` fed multiple video/audio trim branches from ONE
input, then `interleave`d video timestamps into presentation order and concatenated
audio branches. A late teaser before early main creates opposite input/output
ordering: downstream can demand the late source while earlier branches accumulate
frames. Source gaps/range count can amplify buffering. Export queue was serial
only with itself; VAD/local analysis/audio-preview had separate queues. Export
had no decoder/filter/CPU encoder caps; UI could continue preview/BGM preparation.

Read-only process/resource inspection found no active DEV/FFmpeg process at the
time of diagnosis. The Mac has8GiB RAM. DEV launcher log (428bytes) contained no
OOM/FFmpeg failure line. No prior peak RSS/CPU/stack trace was available. Actual
OOM, swap pressure, a specific decoder crash and the measured lag cause remain
unproven. Do not present architectural findings as a captured crash diagnosis.

## Implementation

- `worker/range-input.mjs`: finite FFconcat packet timeline with explicit inpoint,
  outpoint and duration for every PRESENTATION segment (teaser, then unchanged
  main/padding). Demuxer opens/seeks each segment sequentially, including backward
  seek from a late teaser to early main. A single video decoder/filter path uses
  `-copyts`, `-segment_time_metadata 1`, `select=concatdec_select` to reject keyframe
  preroll; global fps30/end-frame budget and1.25× clock remain. This is NOT changing
  the old filter's interleave spelling to concat. There is no simultaneous decoded
  video branch per range, no full-video transcode/intermediate and no gap-sized
  frame queue. Codec reference frames and per-input buffers still consume memory;
  no fixed peak-RSS guarantee is claimed.
- Audio uses independent accurate input seeks, resample48k stereo and sample trim
  into float32 PCM (no lossy intermediate, no voice gain adjustment). A64KiB stream
  copy joins chunks sequentially on disk, then one global atempo1.25 and existing
  music/ducking mix. This avoids inaccurate AAC packet-level inpoint clipping and
  a second audio fan-out/concat graph. Short/malformed audio fails visibly rather
  than silently padding/changing main duration. One sample rounding per range is
  unavoidable; A/V boundary/tail acceptance remains unmeasured.
- Temporary PCM384kB/s of retained source time, plus at most one range chunk;
  reserve256MiB+joined bytes+largest chunk before work. Only one part at a time;
  always remove task-owned `.range-input-*` and chunks on success/failure/cancel.
  Never remove sources, existing outputs, plans, credentials or backups. An abrupt
  OS kill can leave a scratch folder; no automatic broad deletion added.
- `worker/media-resources.mjs`: one heavy lease for FFmpeg/ffprobe/Whisper and VAD
  CPU work, shared across export, audio preview, analysis/import tool commands.
  Export has priority and cancels disposable active/queued audio-preview work.
  Preflight shared VAD/captions happens OUTSIDE the final export lease (but heavy
  commands are still serialized) to avoid waiting on a shared analysis promise
  queued behind that same export. Export FIFO includes preparation; submitted jobs
  retain independent snapshots. No parallel second export is launched.
- Balanced defaults:2 threads per input decoder,8-packet input queues,
  filter/filter-complex1, output video2/audio1, x264 threads2/lookahead-thread1;
  Whisper2, Sharp concurrency2/cache32MiB. Worker-owned commands use OS nice10
  best effort. No priority changes to unrelated/user processes. VideoToolbox is
  preferred on supported macOS; on failure the SAME bounded pipeline retries CPU
  and exposes encoder/fallback notice per job. No claim that capability probing
  proves hardware encoding will succeed for every source.
- Pending and queued/running editor submissions deduplicate by stable source/plan
  fingerprint; existing batch submission IDs retained. Cancel signals only the
  job's owned child group; TERM then KILL after3s, gate held until child close.
  Source-bound analysis cancellation now passes through silence detection too.
  Shared work with other subscribers may finish for those subscribers.
- UI pauses both decks, batch preview, teaser audition and BGM on export; stops
  background/music/deck RAF polling and blocks new audio mix preparation. Worker
  also rejects new preview requests during queued/running exports. Completion does
  not resume video/BGM or mix preparation: explicit Play is required.

Quality unchanged:1080×1920,30fps,1.25×,VT16M(default20M max/32M buffer) or CPU
CRF17/medium, AAC192k, Rec.709, clean output metadata/chapter policy. Foreground
transition stage, title/subtitle/decorations and music envelope code are retained.
No fallback to old unbounded graph, frame freezing or source/main edits.

Official implementation references (consulted, no copied third-party code):
[FFmpeg concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat),
[select/concatdec_select](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect).

## User manual acceptance (not run by agent)

Use a late teaser and separated main ranges; watch Activity Monitor memory/CPU/
swap during preparation/export. Confirm Mac remains usable, source playback and
BGM pause, duplicate clicks do not add jobs, cancel releases owned processes,
CPU fallback is labelled. Check real MP4 frame joins/duration/audio tail/ducking,
foreground transition scope and metadata. No benchmark or smoothness verdict yet.
