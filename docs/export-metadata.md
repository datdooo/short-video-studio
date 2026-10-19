# Rendered MP4 metadata policy — 2026-10-20

Base: `9ae42dd4544cc7c4d0550ffc0165a2eca9db5c43`, branch
`recovery/visual-dev-reconstructed`. DEV only. User explicitly waived tests,
QA renders, browser and live AI/YouTube checks; MP4 behavior is NOT verified on
an actual output in this delivery. This is not a claim of untraceability.

## Command boundary

`worker/server.mjs` → `renderPart.buildArgs` is the common encoder path for editor
single exports, batch exports, VideoToolbox and libx264/CPU fallback. After every
input and the filter graph, before the sole output filename:

```
-map [vout] -map [aout]
-map_metadata -1 -map_metadata:s -1 -map_chapters -1 -sn -dn
```

`worker/export-metadata.mjs` owns the immutable output options. This disables
implicit global and per-stream metadata mapping from all inputs, including music
and image inputs, plus chapter mapping. No source streams are mapped directly:
no attachment, attached picture/thumbnail, subtitle or data stream is selected.
Titles/descriptions/comments/authors/artists/copyright/URLs/IDs/dates/GPS/custom
source tags are not explicitly copied or added. No transcript, prompt, source ID,
local path, credit or policy marker is embedded by the app. Visible title/subtitle
pixels are unchanged. Codecs, 30fps, 1080×1920 geometry, Rec.709 color flags,
1.25× timing, AAC192k, BGM/ducking and faststart/write_colr options are unchanged.
Technical tags newly produced by encoder/muxer may remain (e.g. encoder or MP4
brands); those are not proof of inherited source metadata.

Source download/remux and cached audio preview are not MP4 render-export paths;
source files and source.json are intentionally preserved. This is output hygiene,
not source/library/history erasure or forensic anonymization.

## Old exports and resumability

New job records and completed output records carry the internal history-only
`metadataPolicy: rendered-av-no-source-metadata-v1` marker. It records the command
policy used, not a runtime metadata inspection. No marker is written to an MP4.
Old jobs without it cannot be resumed/re-submitted under the same ID as new-policy
jobs. They remain downloadable in history without a new clean-output claim.
Create a NEW export job (for batch, submit a new batch/item from the retained plan)
to obtain a file produced by the new command policy.

Resume reuses only completed output records bearing this policy and passing the
existing own-job filename/size/geometry/duration checks. An unrecorded/legacy/
corrupt or partial existing MP4 causes an explicit new-job error rather than
adoption, overwrite or deletion. A current job with recorded completed parts and
no colliding unfinished file can still resume. No data migration or automatic
cleanup of source/media/exports/history/credentials/backups is performed.

## Delivery

Code and diff review only; existing resume assertions updated but NOT executed.
DEV package build completed with exit 0 using Node22:
`npm run package:mac:dev`. The app is
`release/dev/ShortCut Studio Dev.app`; local build log:
`/tmp/shortcut-dev-metadata-build-20261020.log` (not tracked).
This rebuild was required by the metadata code change, not by publication.
No real MP4 metadata check was performed. Manual
acceptance: create a NEW job in the updated DEV app; inspect its format/stream
tags, chapters and stream inventory with a trusted metadata inspector, check
visible text/audio/Rec.709/playback, and confirm an old job/file is retained.
