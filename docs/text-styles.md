# Curated text styles (Phase 3)

This phase adds eight text presets and an eight-choice offline font registry to
the existing per-video editor. It does not add video filters, overlays, background
variants, transitions, timeline editing, font uploads or new text animations.
The existing Current shine remains the compatibility behavior; new presets are
static text treatments.

## Font registry and assets

`lib/visual-style/fonts.mjs` is canonical for IDs, families, supported scripts,
weights, local files/licenses, browser font-face declarations and script-aware
fallback stacks. IDs retain legacy subtitle font names for saved-plan compatibility.

| ID / display name | Source | Primary scripts |
| --- | --- | --- |
| `auto` / Auto | Selects bundled Noto families | Latin, Japanese, Korean |
| `Noto Sans` | Previously bundled, OFL 1.1 | Latin (EN/DE/FR) |
| `Noto Sans JP` | Previously bundled, OFL 1.1 | Latin, Japanese |
| `Noto Sans KR` | Previously bundled, OFL 1.1 | Latin, Korean |
| `Montserrat` | Previously bundled, OFL 1.1 | Latin |
| `Inter` | Newly bundled variable upright, OFL 1.1 | Latin |
| `Roboto Condensed` | Newly bundled variable upright, OFL 1.1 | Latin |
| `Oswald` | Newly bundled variable upright, OFL 1.1 | Latin |

All concrete choices have bundled files; no installed-system-font assumption is
needed for these scripts. Latin display fonts retain Noto Sans JP/KR fallback,
ordered by the actual text's script. Mixed text keeps both CJK families.
Browser aliases (`Studio ...`) and SVG family names derive from this registry.
Auto preserves the old ordering; trusted worker FONT_* overrides remain available
for Auto. Unsupported font IDs normalize to Auto. Registered weights are 400–900,
or 400–700 for Oswald, with nearest-weight normalization.

New assets came from the authoritative Google Fonts repository pinned at
`1d0e46c7933245c8180fe83e47917961c913bbdb`. Full OFL license texts and SHA-256,
version and source metadata ship beside the fonts in `public/`. See `fonts.md`
and `public/font-sources.json`. Font files are downloaded only during source
preparation; the application contains no font-download path. Both desktop
packagers include the files, licenses, manifest and shared runtime modules.

## Presets

| ID | Appearance |
| --- | --- |
| `current` | Original Auto fonts, white glow/shadows and existing shine |
| `clean` | Inter bold white, soft shadow |
| `shorts-bold` | Roboto Condensed heavy white, dark outline and heavy shadow |
| `yellow-hook` | Oswald yellow, dark outline and heavy shadow |
| `minimal` | Noto Sans white without effects |
| `news` | Montserrat bold, white original title and pale-blue part title |
| `jp-clean` | Noto Sans JP with restrained outline/shadow |
| `kr-clean` | Noto Sans KR with restrained outline/shadow |

The full-video preset registry still has only `current`. Text presets are a
separate registry. `applyTextPreset(style, id)` returns a normalized independent
style, replacing original title, part title, indicator and subtitle appearance.
It preserves foreground, background, filter, overlays, schema version and the
subtitle's enabled/source settings. Applying Current restores original text
appearance. Registries/defaults are frozen and callers receive copies.

`applyFontOverride(style, font)` changes all four text font fields while keeping
colors, outlines, effects, opacity, text preset ID and non-text fields. The UI
retains the preset label plus selected font rather than implementing inheritance.
Effective weights normalize to what the selected family supports.

## Subtitle precedence and persistence

There is one effective style in the edit plan. The former independent subtitle
React state is now derived from it; existing subtitle controls write normalized
values back to that same plan. Applying a preset replaces subtitle appearance;
a later subtitle edit overrides only the edited field. Enabled/source remain
operational settings and survive preset changes. No hidden style layer competes
with manual controls.

Schema v1 gains optional `textPresetId`, and the existing SubtitleStyle gains
optional `fontWeight`, `opacity`, and `effect` fields. Missing fields retain the
exact legacy subtitle representation and render path. There is no history rewrite.
Old plans without a style/text preset still resolve to Current. Legacy top-level
`subtitles` remain accepted at the normalization boundary; newly created plan/job
snapshots keep that compatibility alias synchronized with `visualStyle.subtitle`.

Generating/importing a new plan, choosing a new source, applying manual timestamps
and resetting demo cuts retain the editor's selected text style. This is current
plan state, not a global preference. Each render job and batch submission clones
its style; each batch item receives its own copy. Batch mode uses the currently
selected editor style without adding a batch-style management interface.

## Preview/export integration

`effects.mjs` defines named immutable layers (color, alpha, em offset and blur).
CSS shadow conversion and SVG Gaussian conversion use the same data. Shared
`text-render.mjs` supplies fill, outline, weight, opacity, escaping and font
resolution adapters. No arbitrary CSS/SVG/filter strings are accepted in style
input. Title zones, indicator position, subtitle positions, output dimensions,
speed and video composition stay unchanged.

Final qualification exposed underestimated widths for long runs of W/m/@ in
the legacy heuristic. `title-fit.mjs` adds a measured-width guard for new presets
and explicit font/weight/outline choices. Lines that already fit retain their
existing wrapping. Overflowing titles reflow within the existing 32–70 size,
three-line and title-zone height limits, ellipsizing at the minimum size when
necessary. Original/part titles retain a common size. The guard reserves 16 px
within the 900 px width for preview borders and small-scale rounding. Browser
measurement waits for local fonts and uses the actual preview size; worker
measurement uses bundled Pango/Sharp. Stale asynchronous preview results are
discarded. The shine mask follows the resulting font size and baseline.

Current with its original Auto typography retains the exact legacy fitting path,
including its historical behavior for adversarial long/wide strings. Explicit
font overrides of Current use the guard. Browser and SVG measurements can differ
at rounding boundaries; identical line breaks or raster pixels across all inputs
are not promised.

The Current preset keeps documented legacy approximations rather than changing
its appearance: the old ambient SVG shadow offset, subtitle compatibility shadow,
and unchanged indicator preview font/weight versus export. New preset effects
use shared layer data in both renderers. Existing shine is enabled only by the
existing Current effect identifier. No new animation is introduced.

Worker validation now allows implemented text properties, but still rejects
custom layout/size/alignment rules and changes to non-text rendering sections.
Curated presets leave the fitting policies/layout identifiers intact.

## QA

Every Node/npm command is run with:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

Commands:

```sh
npm run test:isolation
node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
npm run lint
npx tsc --noEmit
node scripts/qa-visual-style.mjs --baseline 6755f7f79dd78b6d700d39ab44781789bb85da49
node scripts/qa-text-presets.mjs
npm run package:mac:dev
node scripts/qa-text-presets.mjs --packaged
node scripts/qa-title-fitting.mjs
node scripts/qa-title-fitting.mjs --packaged
QA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qa-text-style-ui.mjs --stress
QA_RUNTIME_BIN=/path/to/isolated/node22-ffmpeg-runtime node scripts/qa-editor-renders.mjs
```

The existing editor QA runtime can be the DEV bundle's runtime. During this phase
it used private symlinks to installed Node 22 and Homebrew FFmpeg/ffprobe, so
packaging could proceed independently without touching the production bundle.

`qa-text-presets` uses only temporary synthetic test-pattern/sine fixtures on
worker port 8887, a mock HOME, isolated fontconfig with bundled fonts only, and a
worker fetch preloader that disables network access. It checks cmap coverage for
Latin accents, JP, KR and mixed text, verifies actual font file/license hashes,
compares a font-only override's rendered glyphs, checks job snapshots, output
geometry/duration and safe title/subtitle bounds, and creates an eight-card
contact sheet from real exported frames. JP/KR source titles are set only in the
temporary fixture metadata, avoiding the unrelated upload filename sanitizer.

Browser QA uses only synthetic media and mocked worker endpoints. It verifies
preset/font interaction, later manual subtitle overrides, plan transitions,
keyboard selection, locally loaded font faces, request snapshot content and
queued-job independence. Production-port and remote requests fail the test.
Run the same script against the packaged DEV web server to cover built assets.
The optional `--stress` flag adds 40 browser cases covering both title roles,
five wide/long inputs and all eight font choices. `qa-title-fitting` evaluates
the actual local source/packaged worker overlay definitions without starting a
server: 115 cases across Clean, Shorts Bold and explicit-font Current, including
heavy weights and shine. It checks rendered frame edges, foreground exclusion,
minimum size, line and height limits with fontconfig restricted to bundled fonts.

The strongest Current regression compares decoded frames and generated
PNG titles/subtitles against archived Phase 2 source using a deterministic CPU
encoder. Passing that check does not claim pixel identity across every encoder.

Final Phase 3 results, artifact paths and qualification limits are recorded in
[`phase3-qualification.md`](phase3-qualification.md).
