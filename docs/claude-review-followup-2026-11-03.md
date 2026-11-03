# Claude review follow-up — 2026-11-03

Small source fixes only; no build, real AI/ASR/download/render/browser QA or installed app update.

| Finding | Decision / result |
| --- | --- |
| Web JSON rejects copy envelopes and gives generic errors | Shared `lib/web-json.mjs` extracts one unambiguous root, accepts prose/inline or multiline fences, normalizes NBSP/zero-width characters outside strings only, preserves values, reports syntax line/column and likely truncation. Both full-plan and hook-only imports use it. Identity/schema/range checks remain downstream. Curly quote delimiters/trailing commas are rejected with diagnostics; no regex repair, invented values or partial-plan apply. |
| Hashtags accept punctuation/very long/Unicode-equivalent duplicates | External plan import normalizes NFC, permits letters/numbers/underscore with combining marks within words, caps 100 codepoints after #, rejects equivalent duplicates and identifies part/tag. This is an app import bound, not a claimed TikTok platform maximum. Web prompt states the same rule. |
| False claim that user confirmed an attachment | Reworded imported provenance to state that the app cannot verify attachment, website access or complete viewing. Legacy attached flag still binds manifest identity; it is explicitly not attestation. No checkbox or continuous-view receipt added; existing source/request/media/citation guards retained. |
| Large localStorage draft | Confirmed duplicated prompt/transcript fields and 4 MiB cap in code. Corrected misleading advice to shorten source data. Worker-snapshot reference persistence is not implemented here: needs restoration/cache-eviction/migration work, so no data is silently removed or marked saved. No long-video/quota measurement claim. |
| README/GEMINI/prompt blocks | Removed obsolete one-second/minimum-minute/filler claims, corrected language/source identity docs, documented one complete TXT, and replaced stale DEV-only agent instructions with current Beta boundaries. |
| DB/Drizzle/examples | Retained: hosting build still consumes Drizzle output (`build/sites-vite-plugin.ts`). Directory presence/large file count alone is not proof of dead code; no blind deletion or broad reformat/archive. |
| Teasers differing only by milliseconds | Not changed in this small input/UX pass. Auto already has `diverseExcerpts`; changing external alternative rejection/count is a selection-contract change, not a JSON transport repair. No arbitrary timestamp snapping or changed teaser selection introduced. |
| CI and real media comparison | Existing source was already pushed; runner results have not been independently confirmed here. Real-video renders and UI acceptance are left to the user. |

Validation: Node 22 focused `lib/web-json.test.mjs lib/muse-plan.test.mjs lib/teaser-import.test.mjs worker/auto-cut-workflow.test.mjs desktop/worker-runtime-files.test.mjs`: **21 pass, 0 fail/skip**, about 0.66s. Lint 0 errors/warnings, TypeScript 0 errors, diff check clean. Worker packaging manifest includes the new parser; closure test passes. Safe logs: `.isolation-verification/claude-followup/`.

No full-suite claim for this source revision. Existing build 1124 and GitHub revision are unchanged until a separate package/push step. A clean review ZIP is generated with Python zipfile (no AppleDouble/resource forks), includes source and independent .git, and is extraction-checked with Git status. It does not include dependencies, media, app or credentials.
