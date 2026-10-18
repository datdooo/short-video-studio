# Offline curated fonts

IDs intentionally preserve legacy subtitle values: `auto`, `Noto Sans`,
`Noto Sans JP`, `Noto Sans KR`, `Montserrat`, `Inter`, `Roboto Condensed`, `Oswald`.
The registry in `lib/visual-style/fonts.mjs` is the shared source for browser
font-face declarations, font selectors, subtitle normalization, script-sensitive
fallbacks, and worker font registration. Each API returns independent metadata.

All seven concrete families are bundled TTF files, licensed under OFL 1.1 with
full license texts in `public/*-OFL.txt`. Auto selects among the bundled Noto
families. Noto Sans JP covers Japanese; Noto Sans KR covers Korean. The remaining
families cover Latin, including English/German/French; every stack retains the
script-appropriate JP/KR fallback. There is no system-font dependency for these
scripts and no runtime font download. `sans-serif` is only the final safety net.

Noto and Montserrat files/licenses were already present in this checkout.
This phase adds upright variable Inter 4.001, Roboto Condensed 3.008, and Oswald
4.103 from Google's authoritative open-source font collection, pinned at commit
`1d0e46c7933245c8180fe83e47917961c913bbdb`:

- https://github.com/google/fonts/tree/1d0e46c7933245c8180fe83e47917961c913bbdb/ofl/inter
- https://github.com/google/fonts/tree/1d0e46c7933245c8180fe83e47917961c913bbdb/ofl/robotocondensed
- https://github.com/google/fonts/tree/1d0e46c7933245c8180fe83e47917961c913bbdb/ofl/oswald

`public/font-sources.json` records immutable source URLs, font table versions,
SHA-256 hashes, file sizes, and license paths. Only one upright variable file per
new family was added, about 1.36 MiB total. No italic or redundant static weights.
The UI supports weights 400–900 (Oswald 400–700); requests normalize to the
nearest registered weight. Browser font faces have private `Studio ...` aliases,
while SVG/Sharp uses each file's actual family name. Both use the same registry
and fallback order. The existing Auto ordering and trusted FONT_* environment
overrides are retained.

Both packagers already include the complete public asset directory through the
standalone frontend build, and copy the shared VisualStyle runtime directory.
Font registration fails on a missing asset rather than silently substituting an
unbundled family. Font files are never fetched by the worker.
