# Audio mix / ducking parser repair — 2026-10-21

Source reviewed only; no mix/render/listening/test/provider/browser run. Owner
asked to push source and defer further packaging.

The user's actual error displayed a long nested VAD ducking expression (windows
near338–346 seconds), because the worker returned only the end of FFmpeg stderr
and the UI clipped its first300 characters. The beginning of stderr is absent;
its exact original FFmpeg rejection wording cannot honestly be recovered.

Confirmed code defect: duckExpression reduced every merged speech window into
four more nested if() calls, then duckSidechainExpression duplicated the entire
chain. FFmpeg's eval parser has a100 recursion budget (upstream n8.0
libavutil/eval.c). A sufficiently speech/pause-rich part therefore exceeds parser
depth; long command arguments are another avoidable risk. This is consistent with
reported text, not a reproduced real-audio diagnosis.

Fixes:
- Balanced binary time lookup: logarithmic depth/evaluation path, same complete
  merged windows, -12dB envelope, pre-roll/attack/hold/recovery constants. st/ld
  evaluates the gain once, rather than repeating the full expression.
- Preview AND common CPU/VideoToolbox single/batch export use a task-owned private
  filter graph script, removed on completion/failure/cancel. Avoids argv-size
  limits. Only small graph text, no added media/render intermediate or decoder.
- Preview1x/export1.25x mappings and source-voice headroom/gain unchanged. No extra
  ducking stage, normalization, threshold-only VAD or model.
- Versioned preview mix identity invalidates old mix reuse; VAD source cache need
  not be regenerated. Existing exports are untouched.
- Audio preview validates main plan without requiring both teaser objects. Its
  actual presentationSegments still excludes invalid/stale teaser exactly like
  the editor. Render readiness and required-teaser gates remain unchanged.
- Dispose obsolete mix handlers/audio when identity changes. Failed media playback
  pauses/unmutes source before setting error, preserving the error status. Add
  explicit Chuẩn bị lại nhạc; no setting reset or automatic unbounded retry.
- Worker reports stage/code/window-count diagnostics, not raw graph/paths in UI.
  No credentials or source payload is logged by the new diagnostic.

Read-only reference (no code copied):
https://github.com/FFmpeg/FFmpeg/blob/n8.0/libavutil/eval.c
https://github.com/FFmpeg/FFmpeg/blob/n8.0/doc/utils.texi
https://github.com/FFmpeg/FFmpeg/blob/n8.0/fftools/ffmpeg_opt.c

Manual acceptance on a later authorized new DEV build: both parts with ducking
ON/OFF, speech/pause-rich range, seek/pause/part switch/retry; listen for actual
music/ducking and export one NEW job. None of those checks was performed here.
