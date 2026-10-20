# Whisper default: base → small — 2026-10-21

Actual backend in `worker/speech.mjs`: native **whisper.cpp / whisper-cli**.
Local binary resolves to Homebrew1.9.5; old configuration used multilingual
`ggml-base.bin` (147951465 bytes). Existing DEV package did not contain whisper-cli;
bootstrap specified its absent bundled path, leaving the worker's Homebrew fallback.
This is a packaging finding, not proof an earlier ASR invocation ran successfully.

New default: **multilingual `ggml-small.bin`**, one tier above base,487601967 bytes
(~465MiB). `-l auto`, normal transcription; no English-only model or translation flag.
[Official supported models](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md).
[Official model pointer/checksum](https://huggingface.co/ggerganov/whisper.cpp/raw/main/ggml-small.bin):
SHA256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`.

At inspection only base existed in DEV's `media/models`; small was NOT downloaded.
No ASR/model load was run. User downloads once via Auto Subtitle after opening
the updated app; no model is added to Git or bundled in the app. Installation
checks disk, exact byte count and SHA256, atomically renames, and removes partial
files. Failure is explicit; base is never used as a silent replacement.

Cache identity includes backend/model/task/languages/model SHA/cue policy, stored
in `speech-captions-small-v1.json`. It cannot reuse the legacy base/unknown file
as small output. Existing `speech-captions.json`, saved/edited caption tracks,
plans/history/job snapshots and base model remain untouched. New caption requests
use small; existing evidence can still be read without ASR for planning/boundaries,
preserving its actual origin. No automatic old-video reprocessing/migration.

Source timestamp parsing/mapping is unchanged; repeated hooks/cuts and preview1× /
export1.25× reuse existing caption mapping. Whole WAV→ASR work holds the existing
heavy-resource lease;2 CPU threads,1 processor,30min timeout, disk guard and cleanup.
Requests share bounded work with subscriber cancellation. Lease-aware keys avoid
joining a queued ASR operation from inside an already-held render resource lease.
No ASR runs concurrently with another heavy worker lease; ordinary render caps
and priority/cancellation are preserved.

Normal macOS/DEV packaging now bundles whisper-cli and its relocated ggml CPU/Metal
backend libraries, mirroring the existing compatible-runtime approach. MIT license
notices are included. No Homebrew installation is changed; no new subscription,
Python service, model copies in the app, benchmark or live verification.

Runtime loading, small-model speed/accuracy/memory and subtitle sync still require
manual acceptance. A successful build alone is not ASR qualification.

Combined Node22 DEV build succeeded, exit0 (sandbox retry required for local
yt-dlp version check). whisper-cli, dynamic ggml/Metal backends and MIT notices
are present in the app; packaged speech.mjs matches current source by SHA256.
Model small remains NOT downloaded; no ASR/model-load verification or app restart.
