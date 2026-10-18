# Curated backgrounds (Phase 5)

Schema version stays 1. Background selection changes only `VisualStyle.background`.
Text, fonts, subtitles, filter, foreground and reserved overlays remain independent.
The full-video preset is still Current. No arbitrary background editor is exposed.

| ID | Mode | Exact appearance |
| --- | --- | --- |
| `current` | `source-blur` | Legacy black base, opacity 0.5 |
| `dark-blur` | `source-blur` | Black base, opacity 0.3 |
| `light-blur` | `source-blur` | Black base, opacity 0.7 |
| `black` | `solid` | `baseColor: "#000000"` |
| `soft-gradient` | `gradient` | Top `#30343b`, bottom `#17191f` |
| `dark-gradient` | `gradient` | Top `#161b24`, bottom `#080a10` |

All three source backgrounds use exactly
`blur: {radius:12, passes:2, workingWidth:270, workingHeight:480}` and
`baseColor: "#000000"`. Current/missing styles retain the original JSON shape,
without a background `presetId`. Dark/Light add their own `presetId`.
Black contains only `presetId`, `mode`, `baseColor`. Gradients contain only
`presetId`, `mode`, `gradient: {type:"linear", angle:180,
stops:[{position:0,color:TOP},{position:1,color:BOTTOM}]}`.

`backgrounds.mjs` owns immutable registry data, copies, normalization, validation,
CSS and gradient raster math. `background-presets.mjs` applies a background to a
fresh normalized style without replacing other sections. Unknown IDs/modes and
malformed containers reject. Unknown keys disappear. Six-digit hex colors
normalize to lowercase; invalid short colors fall back, oversized/non-string
colors reject. Blur/opacity preserve the legacy finite clamping policy:
radius 0–50, passes integer 1–4, working width integer 16–1080, working height
integer 16–1920, opacity 0–1. Non-number/non-finite values fall back. Only two
stops at positions 0 and 1 and a finite 180-degree angle are supported.
**Render validation requires the exact selected recipe**; normalized custom
values remain staged data and reject rather than being silently ignored.
There is no brightness field: opacity over black supplies constrained darkness.
No CSS, SVG, paths, URLs or FFmpeg expressions are serialized.

## Rendering and filter semantics

Source backgrounds share the foreground's graded source and timeline. The
worker retains grade → split → downsample/cover/crop 270×480 → boxblur 12:2 →
upscale 1080×1920 → alpha over black, followed by foreground and text. Current's
graph, source crop, blur, opacity, filter order and geometry remain unchanged.
The existing browser approximation is cover video with CSS blur `40 * scale`
pixels. Only opacity changes for Dark/Light; all three use the same blur class.
No blur slider is exposed.

Black uses FFmpeg's native black color source and no background video processing.
Gradients interpolate encoded sRGB channels linearly at pixel centers. Sharp
writes one deterministic 1080×1920 RGB PNG **per job**, reused by every part and
frame. The browser uses the same safe stops as a native CSS linear gradient.
No image downloads, new runtime dependencies or per-frame image generation.

Synthetic backgrounds bypass Phase 4 video filters. Their foreground still gets
the selected treatment. RGB composition and explicit limited Rec.709 conversion
preserve their colors independently of the filter. New synthetic modes use that
RGB path even with Current video color; the source-Current path is unchanged.
Titles, subtitles and shine are composited afterward using the existing code.
Audio, 1.25× playback, 30 fps, encoding and queue behavior remain unchanged.

The preview keeps both existing video elements mounted when synthetic backgrounds
are selected. The background video becomes transparent behind an unfiltered
static layer; switching back retains source/time synchronization. Preset edits
preserve timeline references, so the existing plan/seek effect does not reset
playback. Render and batch submissions still snapshot independently. Selection
persists through new-plan transitions in editor memory, not browser restarts.

Compact native buttons show the actual gradients, representative blurred colors,
a check mark, `aria-pressed`, and keyboard focus/activation. No source preparation,
AI, caption regeneration or worker render occurs on selection.

## Qualification

See [phase5-qualification.md](phase5-qualification.md). Exact Current compatibility
is assessed separately from native browser/FFmpeg blur approximation and lossy
YUV quantization. Static gradients require especially close measured parity.
