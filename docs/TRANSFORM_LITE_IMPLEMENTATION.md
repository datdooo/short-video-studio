# Historical report — Transform Lite removed (2026-10-14)

Transform Lite has been removed at the user's request. Its UI, preparation endpoint,
additional AI request, smart-pruning/card/focus/rewrite processing, renderer branches
and feature modules no longer ship. The report below is historical only. Independent
foreground scale 1.25, playback rate 1.25, existing sentence-boundary Smart Cut,
Custom Time, subtitles, title effects and render history are retained. Minimal legacy
plan import compatibility restores original cuts rather than reactivating transforms.

## Existing workflow inspected

The existing React/vinext editor calls the local Node media worker. YouTube metadata,
source downloads and transcripts use `worker/youtube-downloader.mjs` (yt-dlp,
YouTube.js, browser/manual cookies and bounded fallback). Timed YouTube captions or
local Whisper speech data remain on the source clock. Edit plans use the existing
`parts[].segments` schema; the first-second trim, sentence/silence Smart Cut and
manual Custom Time edits are retained. The editor previews the selected segments.
Immutable render jobs are queued independently of source preparation. FFmpeg
trims/concatenates video and audio, composes the portrait layout, overlays Sharp
title/subtitle PNGs, applies final speed, and exports MP4. Existing download names,
history, cancellation and Trash are unchanged.

## Independent settings and ownership

`lib/render-config.mjs` is shared by preview and export:

- `FOREGROUND_SCALE = 1.25`: only native foreground pixels are enlarged. For a
  1920×1080 source the base foreground becomes 2400×1350, centered and cropped into
  a 1080×1350 area at canvas y=285. Smaller/non-16:9 sources retain aspect ratio;
  padding is allowed when their enlarged native image does not cover this area.
- `PLAYBACK_RATE = 1.25`: preview media playback and final FFmpeg `setpts` /
  `atempo` use this separate constant. Native audio pitch is preserved by the
  browser and FFmpeg atempo.
- Canvas remains 1080×1920. Text and part-index coordinates/font sizes do not
  inherit foreground scale.

`worker/server.mjs:renderPart` retains the existing background chain: cover/crop
270×480, boxblur=12:2, upscale to 1080×1920, alpha=0.5 over black. Preview retains
the existing CSS blur approximation and the same opacity/color-grade settings;
CSS blur and FFmpeg boxblur are not pixel-identical algorithms.

## Files added for this upgrade

- `lib/render-config.mjs`, `lib/render-config.d.mts`
- `lib/transform-lite.mjs`, `lib/transform-lite.d.mts`
- `lib/transform-lite.test.mjs`
- `worker/transform-lite-advice.mjs`
- `scripts/qa-transform-lite.mjs`, `scripts/qa-transform-preview.mjs`
- This report.

## Files modified for this upgrade

- `app/page.tsx`: settings, preparation, holds/focus/cards, edited preview and
  render-fallback synchronization; batch settings use the same options.
- `components/editor-render-list.tsx`: show the per-job fallback warning.
- `lib/edit-plan.ts`, `lib/custom-time.mjs`, `worker/smart-cut.mjs`: shared speed
  constants and optional segment fields; existing custom cuts remain authoritative.
- `lib/preview-timeline.mjs`, `lib/preview-timeline.d.mts`: hold-aware seek mapping.
- `lib/subtitles.mjs`: skip inserted silent holds while advancing subtitle offsets.
- `lib/render-spec.ts`: foreground helper shared with the real renderer.
- `worker/plan-validation.mjs`: validate hold source, duration, type and focus scale.
- `worker/server.mjs`: preparation/cache endpoint, rendering of silent source-frame
  holds, card overlays, timed foreground focus and guarded export fallback.
- `scripts/package-macos.mjs`: include new shared runtime modules.

This list excludes pre-existing uncommitted changes from earlier user requests.

## Transform processing

Transform Lite defaults OFF; its four sub-options default ON. The original timeline
is retained when OFF. When enabled, `lib/transform-lite.mjs` builds a processing
plan using the same segment array, not another timeline system. Conservative local
rules use transcript boundaries and verified silence; uncertain content is kept.
Cuts are limited to 12% of each part and retain the existing minimum-footage rule.
Summary cards require complete sentences and a following gap, 4–10-word grounded
text, and at least 15 seconds between candidates. Local text shortening removes
only neutral leading fillers. Optional ChatGPT advice reuses the existing provider
connection, with a 30-second timeout, exact-quote/source grounding and confidence
checks. Other providers retain their existing import workflow and use these local
conservative transformations; no new Gemini/Muse API or login mechanism was added.
Real external AI services/quota were not exercised during verification.

Focus uses occasional center zoom (1.05–1.15), not random motion. Explicit grounded
freeze advice can insert a one-second pause. Summary frames are extracted from the
source immediately before the speech boundary. No external imagery or detection
bypass transformations are implemented.

Example segment array (source-clock ranges, pre-speed hold duration):

```json
[
  { "type": "source", "start": 0, "end": 14.2 },
  { "type": "summary_card", "start": 14.1666667, "end": 14.1666667,
    "holdDuration": 1.875, "text": "The engine remains in good condition" },
  { "type": "source", "start": 14.2, "end": 31.5,
    "focus": { "scale": 1.08 } }
]
```

Final duration = (retained source durations + hold durations) / 1.25. Thus the
1.875-second processing hold is 1.5 seconds in the exported video. Holds contain
silence; later speech and subtitles move together. Source timestamps are never
rewritten to output timestamps. Manual changes invalidate/rebuild the prepared
plan; the +1-second start trim is not reapplied at preview/export.

## Fallback

Preparation failures preserve original parts/captions and show:
`Transform Lite could not process some sections. Original timeline was preserved.`
If rendering the transformed plan fails, the worker validates and retries the
original snapshot once, using the same reserved filenames. Cancellation does not
trigger a retry. The current editor preview follows that fallback only if the job
still belongs to the same source and unchanged editor input. Job history also
shows the warning. Foreground 1.25 and playback 1.25 remain active in fallback.

## Verification

- Unit/regression tests: 94/94 passing.
- ESLint: passing; TypeScript `tsc --noEmit`: passing.
- Normal build and standalone personal/macOS 26 package build: passing.
- Native macOS 26 runtime dependency audit and ad-hoc code-signature verification:
  passing (not an Apple notarized distribution).
- Real FFmpeg QA: own 1920×1080 fixture → 1080×1920; Transform OFF and ON; expected
  durations, audio present, silent holds, still frames, foreground upper edge y285,
  subtitle exclusion during holds and post-hold offsets verified. A 480×480 source
  without audio/captions successfully exports both parts through Transform fallback.
- Browser QA: native foreground scale/focus, 1.25 playback, seek inside a summary,
  held source frame, resume, manual Custom Time rebuild, toggle OFF and no browser
  runtime errors verified. Screenshot inspected.
- AI timeout/parser/foreign-source failures and unsafe advice covered by tests.
- Production workers do not print Transform development stats.

Preview and export share the processing plan, cut/hold mapping, scale, playback
rate, focus windows, card text and subtitle timing. Browser CSS blur, PNG rendering,
compressed frames and frame-boundary rounding are not asserted pixel-identical.

## Delivered build

The verified build is installed at `/Applications/ShortCut Studio.app` and was
reopened successfully: local web returned HTTP 200 and worker health reported
`playbackRate: 1.25`, `foregroundScale: 1.25`, Apple VideoToolbox and Rec.709.
Packaged worker/shared modules were compared byte-for-byte with development source.
The ZIP is in `release/macos-26/ShortCut-Studio-macOS26-AppleSilicon.zip`.
The previous installed app is recoverable in
`~/Library/Application Support/ShortCut Studio/app-backups/`.
User media/history were not moved or deleted.

## Title safe-zone correction (2026-10-14)

The previous title positions were retained from the 1080-pixel-high foreground,
so they overlapped the new 1350-pixel-high foreground. Title zones now come from
`TITLE_LAYOUT`: original title at y80–261, part title at y1659–1780, with 24 pixels
between each title zone and the foreground. Both titles use the same fitted font
size (32–70), weight 700 and line spacing; if either title is long, both shrink
together. Three lines maximum, with ellipsis only when the minimum size cannot
fit. Title effects are clipped out of the foreground. The preview part index is
pinned to y1804 to match export and avoid colliding with the lower title.
Browser QA includes mixed Japanese/Korean long titles, equal font sizes,
foreground separation and part-index separation. Four rendered title PNGs were
checked to have zero alpha pixels in the foreground region. Existing editor
render/cancel/history/subtitle regression checks, 94 unit tests, lint, typecheck
and the macOS 26 package build passed.

## Subtitle, padding and highlight update

Foreground padding now carries alpha=0 (RGBA), and the preview foreground wrapper
is transparent. Smaller native sources show the existing blur instead of black
bands; 1280×720, 480×480 and 1920×1080 foreground alpha were verified with FFmpeg.

Auto Subtitle offers explicit YouTube or Whisper selection. Explicit Whisper
ignores YouTube tracks and old base-model caches. The full multilingual large-v3
model (3,095,033,483 bytes, SHA256
`64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2`)
was downloaded, verified and exercised on local synthesized speech, including
cached retrieval and regeneration. Models stay outside the app bundle. Per-source
large-v3 caches retain the same strict source/timeline validation.

Preview supports left/right arrow keys and buttons, ±5 output seconds. Keys in
text fields keep their normal editing behavior. Existing cut/hold seek mapping is
reused. Both titles have a subtle five-second left-to-right cyan-white highlight,
masked to title glyphs with the old glow/shadows unchanged. Export uses a narrow
160-pixel cropped highlight overlay; the animation clock is converted through the
1.25 playback rate. Browser sweep direction and exported frame changes verified.

Bottom subtitles sit near the visible foreground's lower edge, capped at baseline
y1476 with 420 pixels reserved at the canvas bottom plus text descent allowance.
This is an app policy, not a universally guaranteed TikTok safe-zone measurement.
[TikTok's guidance](https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads?lang=en-GB)
states that safe zones vary with format, caption length and additional elements;
expanded descriptions can still obscure content. Preview and export share the
position helper. 95 tests, lint, typecheck, browser QA, actual speech recognition,
editor render regression checks and macOS 26 packaging passed.

## Lightweight model and compact details (latest user preference)

Whisper was reverted to the multilingual base model (147,951,465 bytes, SHA256
`60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`).
The previously downloaded large-v3 model file was explicitly removed at the user's
request, freeing 3,095,033,483 bytes. Base verification, real speech recognition,
cache reuse/regeneration and explicit YouTube/Whisper selection passed. New code
does not download large-v3 or consult its caches. Earlier sections document
historical verification, not the currently selected model.

Segment cards, source/final duration and pipeline are grouped under one default-
collapsed “Chi tiết bản cắt” disclosure. Expanded segments form a compact scrollable
list, limited to 256px height. Render actions remain outside the disclosure.
The installed Applications app and macOS 26 ZIP were rebuilt with these changes.
