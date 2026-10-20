# Warm controls / fit zoom / complete speech — 2026-10-21

Continues the uncommitted editor/teaser/ducking/Whisper work from HEAD27625fe on
`recovery/visual-dev-reconstructed`. No source reset, push, tests/lint/typecheck,
browser/smoke/render, listening, ASR or AI/YouTube verification. User accepts manually.

## Styling supersedes the earlier Batch/Library palette directive

No reference image arrived in the latest styling message; implementation follows
the explicit color/control specification, not an invented image comparison.
`app/globals.css` uses warm black#100e0c, brown charcoal#211c18, orange-red#FF5733,
ivory#f5eee6 and warm gray#b8aa9c. Primary controls have flat orange/black styling;
secondary controls are dark with brown-gray borders. Selected controls use orange
inset borders/text over a muted orange background. Control radius11px/card14px,
status pills, orange native/Radix ranges/thumbs, mild color/focus/disabled states.
No new border widths, sizing/padding/position, callbacks, state or remounts. Removed
pressed-button translation and UI connection-dot glow. Semantic errors/success
remain red/green. Media/template sample images, rendered text and effects are not
recolored. Fixed columns,55/45 center and existing hit areas are unchanged.

## Foreground zoom: actual geometry correction

Prior code multiplied raw source width/height by1.25; that is resolution-dependent,
not125% of a fit baseline. It already had correct center translation and a clipped
foreground wrapper; neither resizing the viewport nor another label fixes the basis.

`lib/render-config.mjs:foregroundGeometry` now computes a **contain fit inside the
existing1080×1350 foreground**, multiplies the fitted image by1.25 once, then uses
center crop/transparent padding. Both actual video decks in `app/page.tsx` receive
those scaled dimensions times the preview canvas ratio, with object-fit contain,
no max-size cap and the existing translate(-50%,-50%). No second scale transform.
Metadata/deck ownership guards remain; part/seek/play/template do not reset zoom.
The9:16 canvas, foreground viewport, background canvas, text, subtitles and controls
are not magnified. `ForegroundTransition` uses the same visible-image clip geometry.

Minimal export spatial fix is in the shared `foregroundFilter`: the same contain
fit→1.25 scale→center pad/crop, with source display aspect/SAR normalized. This is
necessary for fresh export framing to agree with preview; no server render assembly,
source ranges, clocks, encoder quality, audio or transition timing changes. Compatibility
layout IDs remain unchanged; saved source timestamps/jobs are not rewritten. Existing
MP4 files are not altered and are not evidence of the corrected framing.
Preview playback1×, visual zoom1.25× and export playback1.25× remain independent.
Actual rotated/anamorphic framing has NOT been visually/render verified.

## Teaser endings: shared conservative technical gates

`lib/teaser-boundaries.mjs` now rejects cuts inside known timed speech with20ms
tolerance (previous350ms could admit clipped words), requires at least80ms source
tail after the last included timed cue, excludes next-speech overlap, checks
unfinished punctuation/continuing cues and common number→unit splits. It never
changes supplied endpoints. Same function covers Auto/Retry choices and cache,
manual Timeline/Custom ranges, Gemini/Muse import and existing export readiness.
Legacy plans still load; old clipped hooks may require explicit reselection before
export. Manual timestamps stay draft with a warning/error, never silently snapped.

Bounded sentence-ending proposals include actual source cue text/times, next speech
and existing measured silence when available. Internal prompts receive local silence
signals already extracted by the existing analyzer; no extra analysis is added here.
External hook-only prompts receive the same endpoint proposals. Proposals suggest
120ms tail only inside one permitted retained interval and before the next cue;
the AI must still decide complete meaning and exact range. They are not auto-applied.

Prompt/cache `same-part-hook-v7-complete-speech` requires the strongest true shock
AND the entire spoken sentence/idea, including number/unit/completing clause. Identify
the sentence end before finalizing range; if completion+tail exceeds9 export seconds,
choose a later understandable start retaining the fact or another complete candidate.
No truncation at9s, special speed, artificial sentence splice or bridging removed gaps.
Prior v6/v5/v4/v3 saved selection versions remain readable. Existing independent
AI-ranked alternatives and one bounded repair still apply; main/locks remain intact.

Limitations: current caption API exposes cue timing, not phoneme/word-alignment proof.
Punctuation, cue gaps and measured silence do not by themselves prove semantic
completion; that remains the provider's evidence-based judgment and user acceptance.
Coarse/missing timestamps cannot guarantee no clipped syllable; manual UI makes this
explicit, and AI speech/mixed choices lacking usable timing are rejected. No new
model/cloud/ASR request or false claim of listened-to/verified clean endings.

## Build

Final combined Node22 `npm run package:mac:dev` succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-warm-fit-complete-speech-build-20261021.log`.
Packaged render-config/teaser-boundaries match source by SHA256. Only delivery docs
changed after build. Built-in packaging/signature audits are not functional QA.
No app/worker restart or job interruption. Old QA remains historical.
