# VisualStyle core (schema version 1)

The core contract below records Phase 2. Phase 3 adds backward-compatible text
fields/rendering; see `text-styles.md`. Phase 4 enables curated video filters and
optional strength without changing schema version or legacy Current defaults;
see [`video-filters.md`](video-filters.md) for the registry, numeric ranges,
environment precedence, application semantics and preview/export mapping.
Phase 5 adds curated backgrounds; see [`backgrounds.md`](backgrounds.md) for
the constrained schema, exact recipes, synthetic/source filter semantics and
preview/export mapping. Phase 6 enables curated static scene overlays through
trusted local PNGs; see [`overlays.md`](overlays.md) for the schema, registry,
composition order and security boundary. Phase 7 composes these existing engines
through [full visual templates](visual-templates.md), without a second renderer or
persisted template configuration. Phase 8 adds an optional bounded title animation selector; see
[text-animations.md](text-animations.md) and its qualification record.
Phase 9 adds the independent bounded `cutTransition` selector; see
[cut-transitions.md](cut-transitions.md) for timing, scene/text separation and compatibility.
Foreground variants remain restricted
to the existing look. Historical Phase 2 restrictions/results below are retained for provenance.

The only preset is `current`. This phase adds a JSON data contract and immutable
job snapshots, with no new editor controls or rendering variants.

Runtime modules use `.mjs` plus `.d.mts` declarations so the browser, standalone
Node 22 worker, and packaged apps load the same implementation without a TypeScript
runtime loader. `lib/visual-style/types.ts` defines the complete TypeScript schema.

| Field | v1 contract |
| --- | --- |
| `version` | Exactly `1`; missing means v1, future/invalid versions reject |
| `presetId` | `current` |
| `originalTitle`, `partTitle`, `partIndicator` | Constrained `TextStyle` described below |
| `subtitle` | Existing `SubtitleStyle`, normalized by `subtitleStyle()` |
| `foreground` | `layout: native-center-crop-pad`, scale, centered position |
| `background` | `mode: source-blur`, base color, opacity, bounded blur/downsample description |
| `filter` | Contrast 0.8–1.3 and saturation 0.8–1.4; defaults 1.04/1.06 |
| `overlays` | At most 16 reserved image descriptors; default `[]`; not renderable yet |

`TextStyle` contains allowlisted font, weight 400–900 in steps of 100, a size
policy, hex fill/outline colors, outline width, alignment, opacity, effect ID and
layout ID. Title roles retain `auto-fit` (min/max size, max lines/width and line
spacing); the indicator retains fixed size 58. Title size policies cannot switch
to fixed sizing. `auto` refers to existing script-aware font selection; the
indicator follows the part-title font in the existing exporter.

The reserved overlay shape is:

```ts
{
  id: string;                      // 1–64 ASCII letters/digits/_/-, no paths
  type: "image";
  assetId: string;                 // opaque identifier; never a URL/file path
  opacity: number;                // 0–1
  blendMode: "normal" | "screen" | "multiply";
  position: { x: number; y: number }; // normalized 0–1
  scale: number;                  // 0.1–4
}
```

There are no asset downloads, overlay rendering, animation schema, CSS/SVG/filter
expressions, or arbitrary paths in the style object. Output dimensions, FPS,
codec, playback rate, source timestamps and timeline rules remain separate.

## Boundaries

- `normalizeVisualStyle(unknown)` is the single style normalization boundary.
  Missing/null input produces the complete current default. It constructs fresh
  allowlisted objects at every level, drops unknown keys, rejects invalid
  containers/versions/enum values and strings over 64 characters, validates six
  digit hex colors (invalid text colors fall back; valid text colors lowercase),
  clamps numbers, and replaces non-finite/non-number input with defaults.
- `getVisualPreset()` normalizes the deeply frozen registry value into a fresh
  copy; mutating a result cannot change defaults or another job.
- `resolvePlanVisualStyle(plan)` reads optional `visualStyle` and legacy
  `subtitles`. An explicitly supplied legacy subtitle field wins during this
  transition, so existing subtitle controls remain authoritative.
- `snapshotPlanVisualStyle(plan)` clones the whole plan/submission, resolves its
  style, and provides an independent legacy `subtitles` alias. Each batch
  submission owns its request snapshot; each prepared item and render job owns
  its own style and timeline objects.
- `serializeVisualStyle` / `deserializeVisualStyle` normalize at both JSON
  boundaries. Deserialization rejects input over 32 KiB.
- `assertRenderableVisualStyle` permits the current appearance plus existing
  subtitle options. It rejects staged changes to title, foreground, background,
  filter and overlay fields. They are explicitly future data contracts, never
  silently ignored instructions. A later renderer phase must deliberately add
  support before accepting them for export.

The preview resolves the same model to read its subtitle styling and timing.
Frontend editor/batch submissions carry normalized snapshots. `normalizePlan`
adds a style for newly created plans; worker validation accepts missing styles,
checks versions and enforces render support. At render creation the worker clones
a normalized snapshot. History is not eagerly rewritten or migrated. Existing
stored jobs are resolved in memory only when needed.

## Subtitle compatibility

There is one subtitle model and one subtitle normalizer. The existing fields
`enabled`, `source`, `font`, `size`, `color`, `outlineColor`, `outline`, and
`position` are unchanged. The font allowlist is shared with title style validation.
The existing UI default is frozen and reused in the current VisualStyle:
YouTube, size 48, white fill, #111111 outline at width 3, bottom, disabled.

An explicitly empty legacy subtitle object retains its old normalization:
auto source and outline 0. Partial legacy styles retain their numeric-string
coercion and existing fallbacks. Malformed/non-finite numeric input is made safe
without changing valid finite settings. A missing entire style resolves to the
current preset; absent subtitles remain disabled, so old jobs render as before.

## Values intentionally retained in their existing renderers

This phase does not rewrite title fitting/placement, script-aware font stacks,
CSS/SVG glow and shadow effects, the existing title shine, subtitle drawing and
position formulas, native foreground crop/padding, or FFmpeg composition.
`TITLE_LAYOUT`, core output/timeline constants, and `fontStackFor` remain the
implementation source for those algorithms.

The model's blur radius 12, two passes and working size 270×480 describe the
exporter's current source blur. The preview's existing CSS blur approximation
remains unchanged. The indicator's weight 800 records the current exporter;
the preview's inherited weight 700 is preserved, not silently corrected here.
Layout/effect IDs reserve the common semantic contracts for later adapters.

Only contrast/saturation default reads now come from the canonical default in
preview and worker. `FFMPEG_CONTRAST` / `FFMPEG_SATURATION` still use the same
coercion, clamp ranges and precedence; worker health still reports effective
values and preview still uses them. No temperature/tint/grain/etc. fields are
claimed to work. Future background variants can extend the mode union when
render support is implemented.

Both macOS and Windows packagers copy the shared runtime module directory so
worker imports work without changing application identity, data selection,
ports, or output paths.

## Regression commands

Use Node 22 for each command:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run test:isolation
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx tsc --noEmit
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node scripts/qa-visual-style.mjs --baseline ba82f951fbade4289597fbb3163c6f13cad7ff8c
PATH="/opt/homebrew/opt/node@22/bin:$PATH" QA_RUNTIME_BIN="/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin" node scripts/qa-editor-renders.mjs
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev
```

The before/after regression archives tracked source from the Phase 1 checkpoint
under ignored DEV QA storage. It creates a synthetic test pattern and sine audio,
uses a fresh mock HOME/data root for every worker, disables legacy lookup, and
uses only worker port 8887. It compares missing-style, explicit-current-style,
and subtitle-enabled exports against the baseline, including decoded video frame
hashes and generated title/subtitle PNGs. CPU libx264 is selected for a repeatable
comparison; this is not a claim about every encoder. Temporary artifacts are
preserved for inspection. The existing editor QA uses port 8788 and independent
synthetic/temp fixtures; its runtime override avoids the installed production app.

Verified before/after outputs: 1080×1920, 30 fps, 2.4 seconds per part (3 seconds
of source at 1.25x); all compared decoded frames and title/subtitle PNGs identical.
Environment overrides and invalid-value fallbacks also passed. Existing editor
render QA passed duration, title clipping, subtitle burn-in timing/placement,
queue/cancel, restore/persistence and export filename checks.

A browser comparison of Phase 1 and Phase 2 preview geometry/computed typography
matched exactly, with no production-port requests or browser errors. Screenshot
pixels differed by at most 1/255 per channel (mean absolute error 0.0016/255),
so screenshot pixel identity is not claimed.

Final checks also passed: all 131 automated tests (including 15 isolation tests),
lint, TypeScript, the DEV package build/native audit/signature verification,
packaged-module imports, and the packaged browser smoke test. No new visible
controls were added. Test workers and web servers were stopped after verification.
