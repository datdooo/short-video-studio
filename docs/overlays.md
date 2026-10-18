# Curated static overlay engine (Phase 6)

VisualStyle remains version 1. Missing overlays and None mean exactly
`overlays: []`. The existing text/filter/background application helpers preserve
this array; overlay application replaces only the array. Plans/submissions/jobs
and appended batch submissions own independent copies.

## Schema and registries

A normalized active descriptor is:

```ts
{
  id: string;       // 1–64 ASCII letters/digits/_/-, unique within array
  presetId: "grain" | "vignette" | "soft-glow" | "film-frame" | "rec-hud";
  kind: "image";
  assetId: string;  // exact registered ID, never a path
  opacity: number; // finite 0..1; finite out-of-range values clamp
  blendMode: "normal";
  layer: "scene";
  scaleMode: "canvas";
  enabled: boolean;
}
```

At most 16 descriptors, in bottom-to-top array order. Multiple curated overlays
work internally, including per-overlay opacity and enablement; the compact UI
selects one at a time and exposes its opacity. A new selection restores that
preset's default opacity. Zero opacity/disabled descriptors do no rendering IO.
Normal is the only shipped blend mode. Screen/multiply are not implemented.

| Preset | Asset ID | File in `public/overlays/` | Default opacity |
| --- | --- | --- | ---: |
| none | none | none | none |
| grain | `overlay.grain.v1` | `grain-v1.png` | 0.22 |
| vignette | `overlay.vignette.v1` | `vignette-v1.png` | 0.55 |
| soft-glow | `overlay.soft-glow.v1` | `soft-glow-v1.png` | 0.35 |
| film-frame | `overlay.film-frame.v1` | `film-frame-v1.png` | 0.65 |
| rec-hud | `overlay.rec-hud.v1` | `rec-hud-v1.png` | 0.90 |

`lib/visual-style/overlays.mjs` owns the immutable asset registry and preset
constructors. Getters/application return fresh copies. The normalizer requires
the preset's exact asset ID, kind, blend, layer and scale policy. Unknown IDs,
modes/containers/flags reject; non-number/non-finite opacity falls back to the
preset; unknown keys are dropped. URLs, file paths, SVG, CSS, expressions and
z-index are never interpreted. The earlier Phase 2 reserved `type/position/scale`
objects retain their old normalization for compatibility with staged data, but
still reject at the render boundary. They cannot resolve any asset.

## Original reproducible assets

Run with Node 22:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node scripts/generate-overlay-assets.mjs
```

The generator writes five 1080×1920 RGBA PNGs and `manifest.json` with exact
SHA-256 hashes, byte counts and dimensions. These generated files are committed.
No network, downloaded texture, user SVG or system font is used. Generation is a
source/build operation, never a launch or per-frame operation. Exact reproduction
is tested against the pinned Sharp/libpng implementation and committed manifest.

- Grain: original fixed-seed xorshift texture (`0x51a71c06`), 128×128 repeated
  deterministic field, white/black pixels with alpha 8–79. **Phase 6 grain is
  static; animated grain is future scope.**
- Vignette: black elliptical smoothstep alpha, transparent central region and
  bounded alpha up to 145 toward the corners. No FFmpeg-only vignette filter.
- Soft Glow: restrained warm `[255,224,185]` Gaussian alpha, center near
  `(0.52w,0.36h)`, peak alpha 70 before preset opacity.
- Film Frame: edge-only original dark 14px frame plus thin inner neutral rule;
  fully transparent center. No borrowed film branding/design.
- REC HUD: generic corner strokes, small red dot and original pixel-letter REC
  near the upper-left video zone. No timestamp/date, brand or animation.

## Canonical composition

Background → filtered foreground video → scene overlays in array order → existing
original title/part title/part indicator card → existing title shine → subtitles.
Browser readable text is above scene overlays; player controls are UI-only.

The small difference from the proposed title/subtitle/indicator ordering preserves
an existing invariant: the exporter already combines titles and indicator in a
single PNG, followed by shine and subtitles. That grouping remains intact for
None compatibility. All scene decoration remains beneath every readable text
role. No untrusted layer integer or free placement is accepted.

Video grading happens before background/foreground composition, as in Phase 4/5.
Overlay colors are never passed through the source's grade. Scene decoration
covers the full canvas for source-blur and synthetic backgrounds alike; it is
not attached only to the foreground window. Background and text selections,
font overrides and manual subtitle edits remain independent.

## Browser and export

The browser uses the same committed PNGs through registry-derived local URLs.
A pointer-events-disabled full-canvas scene container uses fixed z-index 5,
below title/indicator z-index 10 and subtitles 20. Each image layer uses native
normal alpha composition, canvas scaling and descriptor opacity. No media element
is replaced, loaded, sought or paused on selection. No AI/source/caption/render
request is triggered. Cards use local actual assets, accessible native buttons,
`aria-pressed`, selected checks and keyboard focus. No remote thumbnail fetches.

`worker/scene-overlays.mjs` resolves only trusted registry filenames below the
packaged `public/overlays` directory and verifies RGBA dimensions. It multiplies
asset alpha by normalized opacity, then composites ordered layers once into a
job-level `scene-overlays.png`. For each part, Sharp puts the existing unchanged
title PNG over that scene in a static `part-N-scene-titles.png`.

FFmpeg loops that static card in the already-established title input, after the
composed video and before shine/subtitles. This is real exported scene rendering;
flattening the static layers needs no extra FFmpeg input/decoder, graph reordering,
per-frame Sharp operation or temporary image sequence. Source grade never touches
the card. Original title/shine/subtitle PNGs are retained independently for QA.
Audio, frames/timing, speed, geometry, encoders and Rec.709 metadata are unchanged.
For None/zero/disabled layers, the original title input and graph are reused
exactly, with no scene files generated.

Both packagers already include shared modules, worker modules and public assets.
There are no source-checkout absolute paths inside the renderer or manifest.
Windows layout is structurally supported; native Windows QA is separate.

The array/opaque asset-ID/layer/kind contract provides extension points for later
trusted placement recipes, custom-asset resolution or animated kinds. Those
extensions require deliberate validation/rendering work; they are not enabled
by accepting a URL, video kind, arbitrary transform or timeline today.

See [phase6-qualification.md](phase6-qualification.md) for objective parity,
performance, compatibility and limitations.
