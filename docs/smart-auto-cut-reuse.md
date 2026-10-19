# D/E/F/G bounded reuse record — 2026-10-19

No research repository was cloned, installed or executed. No user media or credentials
were sent to external demos. Existing Node22, yt-dlp, Sharp, renderer, speech cues,
provider adapters, FIFO queues and JSON history are the first reuse choice.

| Gap / repository | Revision inspected; license | Decision / actual reuse |
| --- | --- | --- |
| Sentence segmentation: https://github.com/textlint-rule/sentence-splitter | master snapshot inspected 2026-10-19 (not pinned or adopted); declared MIT; README, package and `src/sentence-splitter.ts` read; raw LICENSE fetch unavailable | No copy/install: text AST EN/JA segmentation does not supply media timing. Reuse existing cue punctuation/pause boundaries, extracted into `lib/auto-cut/boundaries.mjs`; use Node22 Intl word segmentation for bounded lexical evidence. |
| Multi-signal selection: https://github.com/mpjatkinson/youtube-shorts-maker | main snapshot 2026-10-19; declared MIT, root grant not independently fetched; README and relevant Python source inspected | No code copied. Keyword/Ollama/energy ranking bundles auto-installing Python, faster-whisper, numpy/librosa/OpenCV and a second render/download stack. Existing verified GPT adapter plus small source-specific deterministic fusion/validation is smaller and preserves two-part/lock rules. Scores remain explicitly heuristic. |
| Scene/silence: https://github.com/FFmpeg/FFmpeg | n7.1 `vf_scdet.c`, `af_silencedetect.c` and official filter docs; file headers LGPL2.1-or-later | Reuse installed/bundled FFmpeg filters through existing subprocess runner, not copied C. Existing FFmpeg packaging notices/build obligations remain unchanged. No Python/GPU/model addition. |
| Queue: https://github.com/sindresorhus/p-queue | v9.0.0 `source/index.ts`, package (Node>=20, eventemitter3/p-timeout); MIT declared; raw license unavailable | No copy/install. In-memory promise concurrency does not persist app sources/plans/render submission ownership. Extend existing bounded FIFO + JSON history, sharing the existing subscriber-aware cancellation helper. No extra backend/Redis/database. |

Custom application policy: bounded source candidates, signal budgets and AI schema,
manual-lock/legacy validation, local FFmpeg-output normalization, atomic source-aware
analysis caching and resumable per-link stage metadata. These are application
contracts, not a vendored generic highlight model. Node22/macOS ARM64 remain the
existing native runtime; new modules enter the shared macOS/Windows relative-import
closure. H real-world editorial acceptance is separate.
