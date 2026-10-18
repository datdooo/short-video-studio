# Full visual templates (Phase 7)

Templates are curated local compositions of the qualified Phase 3–6 engines.
They resolve to the existing version-1 VisualStyle before preview, persistence or
render submission. The worker has no template protocol or template-specific renderer.

## Canonical registry

`lib/visual-style/templates.mjs` is the sole recipe registry, with adjacent TypeScript
declarations. Each recipe contains only:

```ts
{
  id, label, description, category,
  textPresetId, fontId, filterPresetId, backgroundPresetId, overlayPresetId
}
```

IDs reference existing component registries; no styling values or asset paths are
duplicated. Internal recipes and ID arrays are frozen. Get/list APIs return copies.
Tests validate all references, uniqueness, deterministic application and independence.
Unknown/non-string template IDs throw; URLs, JSON, paths and expressions are never
interpreted. There is no import, download or community-template API.

| Template ID | Text preset | Font ID | Filter | Background | Overlay |
| --- | --- | --- | --- | --- | --- |
| `current` | `current` | `auto` | `current` | `current` | `none` |
| `viral-shorts` | `shorts-bold` | `Roboto Condensed` | `vivid` | `dark-blur` | `grain` |
| `clean-tutorial` | `clean` | `Inter` | `clean` | `light-blur` | `none` |
| `farming-jp` | `jp-clean` | `Noto Sans JP` | `nature` | `dark-blur` | `vignette` |
| `korean-tutorial` | `kr-clean` | `Noto Sans KR` | `clean` | `dark-blur` | `none` |
| `news` | `news` | `Montserrat` | `contrast` | `dark-gradient` | `rec-hud` |
| `cinematic-dark` | `minimal` | `Inter` | `muted` | `dark-gradient` | `film-frame` |
| `bright-social` | `yellow-hook` | `Oswald` | `bright` | `soft-gradient` | `soft-glow` |

Font IDs deliberately use the existing registry names. General-purpose fonts retain
the existing bundled Japanese/Korean fallback stacks. Grain is static; the existing
REC HUD is a generic recording motif without a date or timestamp.

## Application and precedence

`applyVisualTemplate(currentStyle, templateId)` normalizes the input, captures
`subtitle.enabled` and `subtitle.source`, then starts the shipped canonical canvas
configuration. It calls the existing text, font, filter, background and overlay
helpers, in that order, and passes the complete result through normalization.
No renderer normalization or drawing logic is duplicated.

The text preset supplies subtitle **appearance**, including its default size,
position, color, font and outline. The template font then overrides the text-role
fonts through the existing font helper. Operational subtitle enabled/source values
always come from the user's normalized input, including disabled subtitles.
Phases 8–9 also preserve independent `titleAnimation` and `cutTransition` choices;
they are outside the recipe. Other
subtitle visual overrides reset to the recipe. The editor synchronizes the existing
`subtitles` compatibility alias with the resulting VisualStyle subtitle object.
Actual cues, provider metadata and timing remain outside this operation.

Every non-Current recipe resets filter strength to the preset default, 1 (100%).
Current restores the exact legacy filter representation: contrast 1.04, saturation
1.06, with no explicit filter preset/intensity fields. Environment precedence stays
with the existing renderer. Current also restores Auto fonts, Current text/background
and an empty overlay array. Existing optional `textPresetId: "current"` metadata has
no rendering effect.

Reselecting any template discards manual appearance changes and restores its full
recipe while retaining subtitle operations. Applying twice is deterministic and
copy-safe. No content, edit segments, Custom Time, Smart Cut, titles/hashtags,
caption content/timing, source, speed, audio, output settings or batch order changes.
Only VisualStyle and its existing subtitle compatibility alias are updated.

## Matching, Custom and editor behavior

`matchVisualTemplate(style)` returns an ID only when the normalized visual
configuration exactly matches a canonical recipe; otherwise it returns `null`.
The UI labels null as **Custom**. Matching ignores `textPresetId` selection metadata
and `subtitle.enabled`/`source`, plus independent `titleAnimation` and `cutTransition`
controls; every remaining normalized field participates,
including subtitle visual overrides, all fonts, filter strength, background and
overlay descriptors. This is exact configuration matching, not perceptual similarity.

Changing Nature to Vivid, JP to Auto, News strength to 70%, overlay opacity or
subtitle color produces Custom. Restoring the exact original values rematches
without selecting the template again. Changing only subtitle enablement/provider
does not change the visual match. Manual changes are never auto-reverted.

The high-level section precedes Customize and all existing lower controls. Eight
native buttons expose names, focus, `aria-pressed` and a checkmark; a labelled status
announces the recipe or Custom. Card samples derive from resolved styles, existing
text/background/filter helpers and bundled overlay PNGs. They use no videos or
remote images; the main preview remains authoritative.

Selection updates plan style only. It preserves timeline/caption object references,
video elements, source URLs, playback and position. The subtitle-settings update
likewise preserves timeline references during appearance changes. Template clicks
do not upload, prepare, transcribe, run AI, seek or render.

## Persistence and snapshots

Effective normalized VisualStyle remains authoritative in the existing edit-plan,
history, queue and batch formats. No selected template ID or second persisted
configuration is added. A template label is derived from effective style. Old plans
need no migration or history rewrite: default effective styles show Current; other
styles show an exact matching recipe or Custom.

Existing render and batch snapshot boundaries clone the complete style. A queued
Viral Shorts job stays Viral Shorts after selecting Farming JP, and both remain
independent of later customization or registry getter mutations. Workers receive
ordinary VisualStyle, requiring no knowledge of template names.

See [phase7-qualification.md](phase7-qualification.md) for measured render, browser,
snapshot and compatibility evidence and remaining platform limits.
