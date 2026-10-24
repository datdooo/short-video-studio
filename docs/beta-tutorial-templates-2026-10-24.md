# Tutorial typography variants — Beta 1104

Added four Visual Templates in the same layout and restrained appearance as
Korean Tutorial. They use the same Clean video filter, Current source-blur
background, white 700-weight text, one-pixel outline, soft shadow and no scene
decoration. Title animation and cut transition remain independent controls; no
existing plan is changed automatically.

| Visual Template | Text preset | Bundled font | Purpose |
| --- | --- | --- | --- |
| Japanese Tutorial | existing JP Clean | Noto Sans JP | Kana/kanji with the existing measured title fitter |
| English Tutorial | EN Clean | Inter | Clear Latin typography |
| French Tutorial | FR Clean | Noto Sans | Accents and French letters |
| German Tutorial | DE Clean | Roboto Condensed | Umlauts/ß and a narrower face for long compound words |

The new EN/FR/DE presets also appear independently under Text style. Existing
JP Clean and KR Clean are preserved, as are Farming JP and all other templates.
Their visual signatures are distinct, so template selection does not resolve a
new language variant to an unrelated existing card. Preview cards use language
samples instead of displaying Korean for every regional template.

No new font/dependency/download. Fonts and licenses are already bundled and the
same registry/normalizer supplies preview, export, saved plans and Batch. This
selects appearance only: source/subtitle/title language, text content, line-fit
limits, AI, timing, main and teaser are unchanged. It does not translate text.

No browser or render acceptance has run. Manually inspect Japanese without
spaces, French accented titles and German long words in preview and output;
check restore, template selection, text-only preset selection and font overrides.
Build/native audit cannot establish typography quality or fastest-template rank.
