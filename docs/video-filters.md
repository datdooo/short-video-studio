# Curated video filters (Phase 4)

Video color treatments compose independently with Phase 3 text presets/fonts.
The full-video preset registry still contains only Current. No overlay, background
variant, texture, grain, transition, animation, mask, LUT, HSL, curve, keyframe or
blend-mode system is added. Bright and Muted replace the suggested Warm/Cool
labels: this phase does not implement or imply temperature/tint adjustment.

## Data and normalization

Schema version stays 1. `VisualStyle.filter` retains its exact legacy shape for
Current and missing/old plans:

```json
{ "contrast": 1.04, "saturation": 1.06 }
```

Selecting Current restores that object. A new selection stores numeric recipe
values and strength, for example:

```json
{
  "presetId": "vivid",
  "brightness": 0.005,
  "contrast": 1.08,
  "saturation": 1.16,
  "intensity": 1
}
```

`normalizeFilter` is used by `normalizeVisualStyle` and the render adapters.
It accepts plain JSON objects, drops unknown keys and rejects unknown preset IDs.
Non-number/non-finite values fall back deterministically to the selected recipe.
Brightness clamps to −0.08…0.08, contrast to 0.8…1.3, saturation to 0.8…1.4, and
intensity to 0…1. No CSS/FFmpeg expression, path, temperature or tint is stored.
Changed legacy Current contrast/saturation remain rejected at render validation;
Explicit Current brightness/strength must retain their fixed legacy values.
Objects without a preset ID retain the historical behavior of ignoring fields
other than contrast/saturation, so old inputs do not acquire a new treatment. Non-text
sections other than filter remain restricted to the existing render appearance.

`filters.mjs` owns the immutable registry, normalization and renderer math;
`filter-presets.mjs` composes it with the existing VisualStyle normalizer without
a circular dependency. Registry getters return independent copies.

## Recipes and intensity

| ID | Label | Brightness | Contrast | Saturation |
| --- | --- | ---: | ---: | ---: |
| current | Current | 0 | 1.04 | 1.06 |
| clean | Clean | 0.005 | 1.02 | 1.02 |
| vivid | Vivid | 0.005 | 1.08 | 1.16 |
| nature | Nature | 0.010 | 1.04 | 1.12 |
| soft | Soft | 0.015 | 0.94 | 0.94 |
| contrast | Contrast | 0 | 1.14 | 1.02 |
| bright | Bright | 0.035 | 0.98 | 1.03 |
| muted | Muted | 0.005 | 1.02 | 0.86 |

Brightness is an additive offset in normalized encoded RGB, not a temperature or
exposure control. Nature changes general saturation; it does not selectively
adjust greens. These modest original recipes are not proprietary LUTs.

For new presets, intensity `t` interpolates from neutral encoded RGB:

- `b = recipe.brightness * t`
- `c = 1 + (recipe.contrast - 1) * t`
- `s = 1 + (recipe.saturation - 1) * t`

0% contributes no color adjustment; 100% applies the full selected recipe.
Selecting another preset resets strength to 100%. Current stays at its legacy
appearance and its slider is disabled; 0% of another preset is intentionally
neutral rather than Current's 1.04/1.06 grade. Normal video conversion/encoding
still occurs, so neutral is not a promise of decoded pixel identity to the input.

## Preview and export mapping

For new presets the shared affine RGB matrix uses luminance weights
`L = [0.2126, 0.7152, 0.0722]`. Its 3×3 color terms are:

`M[row,column] = c * ((row === column ? s : 0) + (1 - s) * L[column])`

Every color row has offset `(1 - c) / 2 + b`; alpha remains unchanged. Coefficients
round to eight decimal places, and each renderer clamps output channels normally.
The matrix acts on encoded RGB; this is not linear-light or HDR color grading.

Browser: `VideoFilterDefinition` supplies a local SVG `feColorMatrix` with explicit
`color-interpolation-filters="sRGB"`; `browserFilterStyle` references it only on
source video elements. No per-frame JavaScript/canvas processing is used. The
cards use four local color swatches, not extra video decoders or remote images.

FFmpeg: the validated matrix becomes fixed `colorchannelmixer` numeric options on
RGBA video. Opaque alpha supplies the affine offset. New recipes stay RGB through
the existing compositor, with `overlay`'s RGB output format selected, then convert
explicitly to limited-range Rec.709 YUV for output. This avoids avoidable YUV
round trips/implicit matrix conversions found during parity QA. Filter expressions
are generated from safe numbers, never concatenated from serialized strings.

The grade applies before the source splits into foreground and background. Both
source-derived images receive the same treatment; existing blur, black backing,
50% background opacity and foreground geometry remain. Text/shine/subtitle PNGs
are composed afterward and receive no color treatment. Their geometry and source
PNGs do not change when a filter is selected. Encoding/conversion can cause small
final text-pixel rounding differences between render paths.

Current keeps the exact historical FFmpeg `eq=contrast=...:saturation=...` graph
and CSS `contrast(...) saturate(...)` approximation, including existing background
blur/darkening, output format, playback rate, audio and Rec.709 metadata.

## Environment precedence and state

Current: `FFMPEG_CONTRAST`/`FFMPEG_SATURATION` override the legacy defaults using
the previous Number conversion, non-finite fallback and clamp ranges. Worker
health continues to report those values; Current preview consumes them.

New explicit presets: normalized stored recipe values and intensity are
authoritative; machine environment overrides do not affect them. UI swatches use
the nominal recipe; Current's swatch uses nominal legacy defaults.

`applyFilterPreset` and `applyFilterIntensity` change only `VisualStyle.filter`.
They preserve text preset IDs, fonts, title/subtitle appearance and non-text
sections. Text/font changes preserve the filter. The selected filter travels
through current-plan transitions, render submissions and existing job/batch
snapshots. This is editor-memory persistence, not a new global preference or
history migration. Existing immutable snapshot functions are reused.

Selection updates the existing video's CSS without changing its source/key,
preparing media, running AI/captions, submitting a render or reloading the video.
Native buttons expose `aria-pressed`, a check mark and keyboard activation.

## Qualification

Use Node 22 and DEV-only entry points. New checks:

```sh
node --test lib/filters.test.mjs worker/batch-queue.test.mjs
node scripts/qa-video-filters.mjs
node scripts/qa-video-filters.mjs --packaged
QA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qa-video-filter-ui.mjs --renders .isolation-verification/filter-source-EXAMPLE/result.json
```

The worker check uses isolated synthetic color patches/audio, private HOME/data,
bundled-only fontconfig, blocked worker fetch and port 8887 (or explicitly allowed
QA port 8897). It renders all eight presets, two intensity endpoints/intermediates,
and environment-override controls; checks geometry, duration, audio, Rec.709,
independent jobs, unchanged title/subtitle/shine PNGs and objective RGB statistics.

Browser QA uses the actual editor and native video rendering with mocked worker
mutations. A copied static synthetic clip is looped without re-encoding to six
seconds for valid manual cuts. Only the QA viewport/preview column is enlarged for
1080 px capture. Neutral video decode differences are measured separately before
checking each filter's actual matrix contribution and brightness/contrast/chroma
direction. Raw errors remain reported; decoding/encoding/color management are
not represented as exact parity. No subjective quality is inferred from tests.

See [phase4-qualification.md](phase4-qualification.md) for final results, artifacts,
limits and package evidence. Phase 5 is not authorized by these documents.
