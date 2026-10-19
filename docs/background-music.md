# Current music/preview update — 2026-10-20

Normal DEV library now holds54 playable compressed tracks (256,196,532 audio bytes)
from official Incompetech downloads, CC BY4.0 with per-track copyable credits.
All54 decoded;0 audition-verified instrumental;54 uncertain;26 planned downloads
failed bounded network attempts. Mood suggestions and arrangement variants are
metadata-based, not acoustic verification. No audio is shipped/committed. Existing
Mixkit entries remain links only; its mass-download restriction was respected.
`lib/music/personal-collection.mjs` and `scripts/install-personal-music.mjs` retain
source/license/credits; script is explicit, DEV-only,2 concurrent,120s per attempt,
3 attempts/430s per track. Failed partials are resume data, capped512MiB by refusing
new acquisition (not eviction). SIGINT/TERM cancels active work, preserves partials.

Managed library is now128 tracks/1GiB, max64MiB/600s each, no automatic deletion.
MP3/M4A/AAC/OGG/Opus retain exact imported compressed bytes after full decode;
WAV/FLAC retain the existing prepared crossfade loop. Original compressed tracks
loop at their natural ends (no newly baked seam crossfade). Existing FLAC assets
and snapshots stay readable; changed/missing hashes fail safely.

Search/mood filtering covers installed files; source links cannot appear installed.
Status distinguishes waiting for a plan, preparing, ready, playing, blocked/error.
Music selection made BEFORE Generate persists through both parts/regenerate.
No mix is requested against the pre-generation demo plan. One playback controller
owns the full source/part/segment/hook/gain identity; stale async completions cannot
mute new source. Browser play must succeed before source is muted. Pause/workspace
changes stop the mix; autoplay failure restores voice and requires an explicit retry,
not a per-frame request loop. Volume/ducking changes affect only audio preparation.

New foreground-only `vr-light-leak-v2` replaces the default only for new hook policies;
legacy rainbow remains explicit/saved behavior. See `docs/warm-cloud-light-leak.md`.
Ducking gain/envelope and existing VAD remain unchanged. Qualification/limitations:
`docs/adaptive-teaser-qualification.md`. Earlier sections below are historical.

---

# DEV background music, speech ducking and hook light leak

Scope: optional managed local music, speech-aware music-only attenuation, and a
separate hook-boundary visual selector. Existing renderer/encoding, VisualStyle,
Smart Auto Cut, independent main ranges, captions and job FIFO are reused.
Implementation began clean at `179edf2` on `recovery/visual-dev-reconstructed`.

## Plan and asset contracts

`EditPlan.music`: `{version:1, enabled, volume, ducking, assetId?, overrides?}`.
Legacy missing settings resolve to OFF,15%,ducking ON. `overrides` keys1/2 can
choose another asset or null for no music; absent key inherits the shared track.
`musicSpeech` is an optional validated, source-bound `webrtc-vad-v1` envelope:
source fingerprint/cache key, source-second intervals, status and limitations.
`hookTransition` is optional: rainbow-light-leak / dip-black / flash-white / none.
No second VisualStyle, timeline, mixer UI or provider state is introduced.

Track IDs are SHA256 of imported bytes, never file paths/URLs from plans. Managed
`<DEV media>/music/<hash>.flac` is a lossless prepared loop, shared by jobs/parts.
Metadata keeps original hash, normalized hash, actual duration/loop duration,
title/artist, import time and source/license association. Resolution rejects
symlinks, missing/corrupt assets and changed hashes, with an actionable error.
No automatic deletion of the music library exists, so queued/history references
are not evicted. All job/item snapshots are independent structured clones.

Import accepts MP3/WAV/M4A/AAC/FLAC/OGG/Opus; FFprobe validates audio0.5–600s,
no video except cover art, <=64MiB. Protocol/demuxer allowlists prohibit network
playlists. Collection cap32 tracks/512MiB is enforced before preparation; no user
track is deleted to make room. Import has a120s budget and512MiB free-space guard;
own temporary upload/FLAC/metadata files are removed on failure/cancellation.

## Gain, continuity and preview

Slider is linear amplitude: `volume/100`;0% is zero added music,100% unity prepared
track gain. No loudness normalization is applied. A <=50ms tail/head crossfade
makes a period of `duration-seam`; playback starts after the consumed head seam.
Music loops at normal pitch/speed across the output timeline, restarts per part,
and has <=150ms fade-in/out clamped to one quarter of very short output duration.
Source audio is first cut/concatenated and sped1.25× by the existing graph; only
then is music added. `amerge` + per-channel arithmetic retains source gain and
limits only the added music to sample headroom (0.98). No amix normalization or
whole-source limiter. Already clipped source is not magically repaired. Disabled
music uses the unchanged previous audio filter path. No FHD/encoder/AAC defaults
are lowered. Music is longer than the finite original stream before merging,
so it cannot truncate its tail.

Preview keeps the existing video element and uses worker-rendered audio via the
same mix helper as export; it mutes only the video's browser audio while the
prepared mixed preview plays. Output-time clock/seek controls that native audio.
Pause/source/part changes/unmount stop or reposition it; audition is separate and
exclusive. New preview preparation is debounced180ms; volume/track changes replace
only the audio preview, never reload video or rerun VAD/AI. Until a first mix is
ready, original source audio stays audible. Preview preparation errors are visible.

Why rendered audio: an actual Chromium smoke exposed a Web Audio context reporting
running while its clock stayed at0.0107s. The initial graph was removed rather than
shipping it as working. Worker-generated AAC192k preview avoids that demonstrated
stall and shares exact source interval/envelope/headroom logic with export.
`lib/music/envelope.mjs` remains the canonical gain/time mapping, not a second mix.
Native decoding/clock and AAC rounding can still differ by a frame/sample block.

Preview cache is128MiB/14days/64 files; per-browser30min leases and in-flight writes
protect current previews. A full protected cache refuses preparation, preserves
manual/source playback, and never deletes source/music/history. Preview commands
are serial, bounded90s and256MiB free-space preflight plus estimated AAC bytes.
Own partial M4As are removed on cancellation/error. No video intermediate is made;
only source audio is decoded. API accepts source/part/asset IDs, no arbitrary path.

## Actual local speech detection

Existing Whisper is optional142MB and silence/RMS do not establish speech. Reuse
WebRTC's actual GMM VAD via pinned `@ozymandiasthegreat/vad@2.0.7`:53,014 unpacked
bytes, zero dependencies, WASM, no architecture-specific addon/model download or
cloud call. README/package/lib/vad.js/lib/index.js and installed LICENSE/AUTHORS/
PATENTS were inspected. Package declares MIT, but the shipped engine LICENSE is
BSD3-Clause (WebRTC/Daniel Pirch); retain its actual notices/patent grant in package.

16k mono PCM,30ms frames, mode3; a zero-crossing guard rejects broadband-noise
frames, not a loudness threshold. Brief isolated events are discarded and <=200ms
speech gaps bridged. Initial raw WebRTC wrongly marked the loud white-noise fixture;
the guard corrects that fixture but may miss unvoiced consonants. This is an
estimate, not calibrated speech accuracy, speaker identification or diarization.
Music, complex noise and synthetic audio can still fool it.

Full-source detection is bounded to <=30min,90s wall time, roughly57.6MB transient
PCM at the maximum duration and small streaming memory. Optional detection failure
or longer sources return unavailable with a visible limitation and keep manual
gain. No generic subtitles/silence/RMS are labeled verified speech. Cached by source
fingerprint + detector/guard revision, duration and audio presence, never style,
volume or track. Cache24MiB/14days/512 files/2MiB per entry; active/resumable keys
are protected, with caching skipped if protected data fills the budget.

Speech intersects each retained presentation segment, including duplicated hook
and padding, then divides by1.25. The resulting output-time envelope starts100ms
early, attacks over50ms, holds300ms after speech and recovers over600ms. Neighboring
windows merge to avoid between-word pumping. Attenuation is12dB relative to slider
(`10^(-12/20)`), never above slider. Actual source voice gain is unchanged.
Volume/track/style changes cause no VAD/AI/source planning request.

## Hook transition and anti-immediate-repetition policy

New teaser creation defaults to original procedural Rainbow Light Leak:0.6s,
soft overlapping RGB bloom lobes and gradual sinusoidal entry/exit. Existing
boundary resolver clamps both sides for short neighbors. FFmpeg evaluates a
180×320 wash, upscales bilinearly and screen-blends in RGB beneath titles/subtitles.
Canvas uses the same bloom constants/pixel function and screen blend. This is an
original flat9:16 approximation, not an Adobe asset or pixel-identical Adobe effect.
No overlapping/removing footage, timestamps or audio fades are involved.

Ordinary internal-cut presets remain unchanged. Legacy missing `hookTransition`
retains historical inherited Dip Black/Flash behavior. Explicit None removes only
the hook boundary effect. Changing the selector is a deliberate plan update;
queued jobs retain their own snapshots.

New selected hooks carry `selectionPolicy:later-main-v1`. `permittedHookRanges`
excludes the first10 rendered seconds of MAIN content only, accumulating retained
non-padding ranges and dividing by1.25. Large deleted source gaps do not count.
A selected excerpt fits wholly within one resulting interval. AI input and both
web prompts provide permitted ranges; import and selection validate them again.
Deterministic fallback requires a complete later timed sentence cue, otherwise
returns an explicit unavailable reason and leaves main intact. Models can return
null start/end with a reason for unavailable hooks. Main/manual locks are never
shifted to hide repetition.

Old selected hooks remain valid/loadable; `hookNeedsReselection` flags opening
repetition in UI and an explicit reselect button refreshes hooks only. Ordinary
export does not silently replace existing saved hooks, and no queued snapshot is
rewritten. Historical hook QA remains evidence for the old policy, not a live
provider requalification of the new distance policy.

## Curated catalog and rights

Official listing: https://mixkit.co/free-stock-music/?page=1
License: https://mixkit.co/license/modal/musicFree/ ; terms: https://mixkit.co/terms/
Checked2026-10-19. Official listing confirms the eight title/artist/duration records
in `lib/music/catalog.mjs`. All are **links awaiting local import, NOT auditioned
or verified instrumental**; no music is downloaded, bundled or committed here.
A source/catalog association chosen during import is user-declared, not an
independent acoustic match. Users must audition/remove vocal material and verify
rights for their use. No copyright/Content-ID immunity claim.

No documented direct app-download integration was established. The UI opens the
official page and supports individual manual download→local import. Do not scrape,
bypass controls or redistribute a stock collection as app assets. Local unrelated
files retain explicit unknown/user-supplied license information.

## Narrow reuse record

| Source/revision | License and use |
| --- | --- |
| https://github.com/OzymandiasTheGreat/libfvad-wasm ; npm2.0.7 pinned with integrity | Actual WASM dependency reused without source edits; manifest MIT vs actual engine BSD3 notice/patent files preserved. Standalone Node22/macOS ARM64 tested. |
| https://github.com/dpirch/libfvad ; upstream master inspection | BSD3 engine origin/reference; no C copied or new build toolchain. |
| https://ffmpeg.org/ffmpeg-filters.html ; existing FFmpeg9.0.2 | Existing acrossfade, aeval/amerge, geq/blend reused. No C copied; existing FFmpeg packaging obligations unchanged. |
| https://github.com/transitive-bullshit/ffmpeg-gl-transition ; master inspected2026-10-19 | README declares MIT; root LICENSE unavailable; directly relevant C uses GL/EGL/GLFW and a custom FFmpeg build. Not copied/adopted. |

Custom code is limited to app settings/assets, source-time VAD/cache adapter,
output-time envelope/mix glue and original shared procedural wash. No research
clones, Python/GPU service or heavyweight framework added.

## Focused qualification (2026-10-19)

- Final full suite:327/327, TypeScript and lint passed (see music qualification
  report for final package results).13 focused music/distance/asset/cache contracts.
- Actual small local TTS speech→3s pause→speech, silence, loud1kHz tone and loud
  white noise: final speech intervals present, all three non-speech fixtures0s
  detected. Existing natural Vietnamese `real-building-200s.mp4` also detected;
 9s of detected speech overlaps the known158–167s spoken measurement segment.
  This is bounded evidence, not a benchmark/sensitivity guarantee.
- Duck/normal added-music RMS ratio0.25118863 (~−12dB), pause ratio1.0. Mute equals
  original reference exactly; actual mix equals original plus bounded added music
  within2.98e−8 float amplitude. Music-only/no-source-audio and tail checks pass.
- Source UI: import, playback/pause, audition exclusion, no volume-triggered
  VAD/AI request, immutable40% queued snapshot after editor changed to5%, two FHD
  exports with CJK titles and scene-only rainbow.606 frames each, audio/container
  durations20.221771 /20.214083s. Preview/export share finalized mixing helpers.
- New-hook low-fps fractional timing is clamped at each segment before AV concat:
  the2fps fixture previously exposed0.2s extra audio padding. New later-main policy
  now stays within one output frame of the intended20.2s, without changing ranges
  or606-frame output. Legacy policy retains its old graph.
- Historical failures/screenshots/reports stay under `.isolation-verification/music`.
  Latest audio/UI reports are explicitly synthetic/TTS versus natural-source evidence;
  no AI-provider/YouTube campaign, music taste or Mixkit audition is claimed.
