# Beta editorial / teaser reselection — 2026-10-24

Scope: Beta maintenance only, based on `f5f5d5a99cac30008f67095a365c94b90f5e1042`, branch `beta/maintenance`. DEV is untouched. Target macOS version `1.1.0-beta.1`, build **1103**, fixed app `release/beta/ShortCut Studio Beta.app`. Packaging records its exact source commit in Resources/config.json. Windows remains build 1101 and is not rebuilt.

## Confirmed source findings and changes

- MAIN: `lib/main-instructions.mjs` now shares `editorial-main-v4-two-entry-points` across ChatGPT and Gemini/Muse. Choose coherent source entries A/B without balancing length; retain valuable progression A→B and B→meaningful ending, removing only the permitted filler. Assess joins and justify omitted subranges, inter-part gap and tail using real evidence. Exact legacy factory defaults migrate at request preparation; user drafts are not rewritten. Custom instructions remain intact.
- `lib/auto-cut/main-content.mjs::modelSelectionInput`: legacy recipe balance/coverage scores and repeated signal descriptions no longer steer the AI input. Every already-generated recipe location remains, ordered by source time; full source evidence and the ability to choose arbitrary valid exact ranges remain. Local recipe generation itself is unchanged. `selectionToPlan` already preserves AI ranges rather than enclosing their gaps; no new merger or padding was added.
- `worker/main-content.mjs`: one request, then validation; a rejected answer no longer triggers an automatic repair request. Failures preserve the current plan. Cache keys include new policy/instructions and explicit-only retry policy.
- Teaser reselection: the old request did not tell AI which excerpts were already listed. Repeating the same winning range could deduplicate to the initial card. The explicit route already bypassed the winner cache and cleared the request's target teaser; there is no evidence that it simply returned a cached winner. Raw output from the reported run was not available for comparison.
- `components/teaser-editor.tsx`, `components/teaser-candidate-review.tsx`: send up to 26 exact prior ranges from the active part/current scoped catalog; validate persisted catalog entries before using them. Save a successful new proposal directly into the catalog even when the review panel is hidden. Previously catalog persistence depended on that panel being mounted. Keep the current/proposed candidate on failure. Reuse the same ID, validation and 24-card retention logic in both paths; Apply is still required to change the effective teaser.
- `worker/server.mjs`, `worker/teaser-selection.mjs`: validate prior source bounds, include prior choices in context/cache identity, bypass saved discovery on explicit reselection, reject an exactly repeated range as `HOOK_REPEAT_SELECTION`. Do not pretend a repeat is a new candidate. Explicit single-part reselection has one request; no automatic repair. Normal large-input discovery/finalization stages remain, with no hidden repair after a rejected response. A distinct supported candidate is not guaranteed; the model may report unavailable. Cosmetic overlaps are discouraged by instructions, not eliminated using an arbitrary local overlap threshold.
- `lib/teaser-prompt.mjs`: one winner/empty alternatives, complete speech/idea, cue identity, source clock, factual relevance and replay preference; removed contradictory multi-alternative and visual-observation instructions. Existing duration/range/source/citation validators remain. Prompt version is `same-part-hook-v12-text-reselection`.
- `lib/teaser-evidence.mjs`, `lib/video-ai-input.mjs`: replay context cues carry their original global cue IDs for canonical references. Use canonical wrapping only when its character size plus instructions is smaller and round-trip data comparison succeeds. No source transcript/comments/replay truncation added; characters and round-trip equality do not prove token savings or model comprehension.
- `lib/muse-plan.mjs`, `worker/external-editing-context.mjs`: same shared MAIN criteria and exact-default de-duplication. Removed instruction to return a model-name field that the strict importer rejects. Single complete text prompt and existing import identities remain.
- `app/page.tsx`: synchronous guards for batch resume/cancel/delete and render cancel/delete prevent rapid duplicate mutations; cancel/delete responses only replace the matching active batch, not a newer one. Resume has an explicit pending button state.
- `components/copy-button.tsx`: a stale clipboard completion cannot mark newly changed text copied. `components/media-library-panel.tsx`: loading clears when worker readiness is lost; no refresh error state update after unmount. `components/task-progress.tsx`: invalid start dates no longer produce NaN elapsed time. No fake progress added.

## Preserved contracts / review limits

Sol `gpt-6.1-sol` / `low`, ChatGPT text-only, OAuth omission of service_tier/max_output_tokens, separate manual source-wide teaser rights, exact timecodes, max 9 seconds export, 1× preview / 1.25× export, subtitle language, draft/restore protections and FFmpeg graph transmission remain. Old model names retained in generic catalog/error handling are not new default/fallback selection. Existing source evidence/citation/technical validation is not disabled.

Reviewed selection→request→validation→proposal/catalog→Apply, MAIN shared policy/cache/normalization, batch/job mutation handlers, clipboard/library/progress and package manifest. This is not proof of a complete project-wide UI/runtime audit. Existing playback, audio, subtitle, persistence and rendering behavior requires manual acceptance; no claim that every bug has been found.

Source checks: diff inspection and `git diff --check` only before build. No AI, ASR, video download, test suite, separate lint/typecheck, browser automation or render trial. The user later authorized one build/package; mandatory compilation, import/static package comparison, native audit and codesign remain required. Build outcome is recorded separately after completion.

## Packaging safety

The user requested release-only packaging while `/Applications/ShortCut Studio Beta.app` finishes a render. Packaging checks the actual output bundle (including resolved path) is not running; it does not require unrelated installed Beta ports to be idle because it does not launch a server. `desktop/bootstrap.mjs` still checks port availability before launch. No process is killed or installed app overwritten. Previous release bundle is retained by the packager after the new app passes signing/audit.

## Manual acceptance

1. Generate MAIN: inspect A/B, all joins, inter-part omissions and the source tail. Unequal lengths are valid; confirm omitted content really meets the criteria. Re-analyzing must preserve protected manual edits and valid current teasers.
2. Both parts: select again, see a new candidate appended/focused, preview then Apply. Existing choices remain selectable. Repeat with review panel hidden, switch part and reopen. If AI repeats exactly, see a short repeat error and retain current plan/proposal.
3. Switch source/edit main/cancel during generation: stale output must not apply. A failure must not trigger automatic extra paid requests. Inspect actual request and usage diagnostics.
4. Enter manual teaser outside MAIN: preserve exact source range and apply/restore; check technical limits still reject invalid times. AI rules must remain separate.
5. Rapid batch resume/cancel/delete and render cancel/delete: only one mutation per pending action, recover after failure. Copy text then change it during clipboard completion; no success for the changed text. Disconnect/reconnect worker while Kho loads.
6. App build success does not verify semantic quality, actual token/quota reduction, playback smoothness, rendering or Windows installation.

## Reference material

- [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization) and [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): remove redundant work/input and keep shared prefixes stable; no unverified OAuth cache parameters or quota claims added.
- [React useEffect](https://react.dev/reference/react/useEffect): stale asynchronous completion/cleanup considerations.
- [MomentSearch](https://github.com/traversaal-ai/momentsearch): inspected as a related retrieval design; no visual retrieval framework, model or new dependency imported.
