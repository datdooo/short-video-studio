# Editor / teaser / ducking refinement — 2026-10-21

Branch `recovery/visual-dev-reconstructed`, base `27625fe`. Inherited uncommitted
logo restoration preserved. Source review only: no tests/lint/typecheck, browser,
render, listening, ASR or provider/YouTube requests. User accepts manually.

## Source and appearance

- Source → ready state → one original-title field → always-visible supplemental
  prompt → Phân tích/Stop → Advanced. The existing `instruction` lives inside
  Advanced; state/autosave and request payloads are unchanged.
- Editor uses the original Batch/Library tokens and input/button styles, removing
  the later global palette override. Batch/Library implementation is untouched.
  Fixed260/300px columns,55/45 center and independent scroll remain.
- Original `public/favicon.svg` restored in the shared Header at32px, no replacement
  icon. The packaged asset already existed; Header had replaced it with `SC`.

## Zoom findings

The foreground already had a1.25 scaling formula. Identified weaknesses: probed
dimensions overrode decoded video dimensions, border-box width drove the canvas
ratio, and video sizing depended on implicit CSS constraints. Native dimensions
for the current URL now win; shared `foregroundGeometry` supplies the same even-size
scale/crop bounds for preview video and transition mask. Content width excludes
borders; explicit dimensions prevent fit/max-size overrides. No added CSS scale,
export foreground-filter change, clock change or source timestamp migration.
Preview1× / foreground125% / export1.25× remain independent. A specific real-source
zoom failure was NOT reproduced; rotated/anamorphic sources still need acceptance.

## Teaser findings and repair

Previously, validation of any optional alternative could discard a valid winner;
repair lacked rejection details; Generate reported success despite missing hooks.
Each AI-ranked choice is now independently validated against schema, actual evidence,
speech boundaries, source/main bounds and duration. A valid alternative can replace
a rejected winner only in AI-provided order, with a recorded limitation. Invalid or
duplicate alternatives are omitted. If no choice passes, one repair (two total calls
maximum per part) receives rejection codes/ranges and exact permitted intervals.
No timestamp auto-repair, heuristic winner, provider switch or main reanalysis.

Candidate generation no longer requires terminal punctuation to expose an interesting
cue span. These remain unverified proposals, never semantic scores. Existing replay,
metadata/comment/local and temporal proposals participate with overlap suppression.
Bounded48-frame acquisition is round-robin: starts/ends across candidates before
additional opening/midpoint frames. One decode failure no longer drops all later
frames;45s budget/cancellation/temp cleanup remain. Sparse frames do not prove motion.
GPT compares the strongest true shocking/unusual detail at the opening, with whole-part
context and truthful payoff; genre, early position, punctuation and replay are not
winners by themselves. Vietnamese explanations; no invented numbers/scale/danger.

Prompt/cache version `same-part-hook-v6-impact-evidence` prevents silent old-policy
reuse. v5/v4/v3 saved selections remain readable. Cache only reuses successful AI
selections; explicit Retry bypasses it. Shared cancellation is subscriber-owned.
Optional preparation/part failure preserves main/locks and other successful parts.
UI reports partial completion with per-part warnings; both valid hooks still required
for export. Hard9 export seconds / first10 export-main seconds exclusion unchanged.

## Ducking findings and implementation

Existing WebRTC VAD + noise guard is preserved. Existing gain path had no voice
normalization compensation, so the reported weak effect's audible cause is unproven.
Native source stays audible while a mix is missing/preparing/blocked; status now
distinguishes that from playing a full mix and track-only audition, and reports
whether current-part VAD windows actually produce ducking.

Reuse mapped VAD windows and envelope:100ms pre-roll,50ms attenuation,300ms hold,
600ms recovery, merged short gaps. A synthetic mono control track drives only the
added BGM through `sidechaincompress`; it never measures source loudness. Hard knee,
ratio2, threshold=(-12dB amplitude)^2, makeup1; inverse-envelope control targets the
same approximate−12dB gain. Compressor attack/release.01ms avoid a second slow
envelope; no simultaneous envelope volume multiplication. Source audio gain,
manual slider/fades/headroom handling stay unchanged; unavailable/no VAD windows
use manual gain. Shared helper maps preview1× and export1.25× separately.
Mix cache/response version `music-mix-v5-vad-sidechain-1x` rejects older workers/mixes.
DSP behavior, pumping, audible gain and both-part playback remain unverified.

## Bounded references / reuse

| Source | Use / license |
| --- | --- |
| [YouTube Shorts deep dive](https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/) | Consulted editorial opening/curiosity guidance; no copied text/code/assets. |
| [Agentino BGM](https://github.com/agentino-os/agentino-skill-video-bgmusic), skill.yaml1.0.0 | README/implementation/MIT license inspected. Sidechain idea consulted only; no copied code, Python/framework or dependency. Its raw-amplitude detector/default mix normalization are unsuitable here. |
| [FFmpeg sidechaincompress](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress) | Official parameter semantics; minimal original VAD-control glue. Ratio is not itself a fixed dB reduction. |

Existing MIT overlap adaptation/license under `third_party/teaser-reuse` remains.
Render-lag sequential range input, resource caps, encoder quality, clean export
metadata, existing plans/jobs/media/credentials/production/backups are preserved.

## Delivery

Combined Node22 DEV package build succeeded (exit0), including the inherited logo.
Initial sandbox attempt failed at yt-dlp's local version check (semaphore denied);
authorized retry succeeded. Final log:
`/tmp/shortcut-dev-editor-teaser-whisper-small-build-20261021-retry.log`.
App: `release/dev/ShortCut Studio Dev.app`. No automatic app/worker restart or job interruption.
Manual checks: source order/draft persistence;125% crop through part/template/window
changes; partial AI failure/Retry/Custom and main locks; both-part mix versus source
fallback and speech/pause ducking; old-plan subtitle preservation; small-model opt-in.
