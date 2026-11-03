# Beta work order — 2026-11-03

Review baseline: `8c2d05aa4dff8bec10761077f31e67bc20c1f121`. Checkout: `beta/maintenance`.
Follow-up baseline: `1e506396bfa441d16b8be675e4b55822cc0e7c95`. Source completion: `8908ad1`.
Node 22.23.3, Beta frontend 5373 / worker 8987. Work is local; no push, installed-app update, real AI/provider/ASR/source download, user media, credentials, DEV or production access.

## Acceptance by phase

| Scope | Status | Evidence / remaining limit |
| --- | --- | --- |
| A / Phase 1 | Local gates complete | 378 tests pass, 0 fail/cancel/skip; lint 0 errors / 0 warnings; TypeScript 0 errors; build and diff check pass. Three-OS CI remains unrun. |
| B / Phase 2 | Implemented, synthetic browser acceptance | Radix confirmation, save/discard/stay, safe save failure, Sonner, shortcut help, labels/disabled reasons, contrast/type sizing, compact preview and candidate alignment. Five viewport mock captures and component fixtures; no real provider/media workflow claim. |
| C / Phase 3 | Complete locally | Package renamed; 51 dead UI components / 13 dependencies removed after import closure review. Hosting D1/Drizzle retained because opt-in build consumes it. Historical docs archived with index/links. CJK lazy network behavior observed. |
| D / Phase 4 | Complete locally | Format-only checkpoint first; typed worker transport, state/lifecycle/action domain hooks, workspace views. Page 542 lines, no line over 160. Controls retain mounted identity, draft/undo/timecode and cancellation semantics. |
| E / Phase 5 routes/auth/services | Complete locally | 46 ordered routes + HTTP boundary, OAuth module, source/analysis/command/history/response services, JSDoc and checked Origin/plan modules. Package import closure, HTTP guard/response and bootstrap checks pass. |
| E / Phase 5 render extraction / server size | Complete locally | Before/repeat/after lossless controls match all 48 decoded frames; actual argv and graph match. Composition/coordinator extracted; library/batch/tool domains separated. Server is 475 lines. Default ABR hash repeat is not a deterministic gate; app encoder/bitrate policy is unchanged. |

Optional WebVTT was not added: existing CaptionTrack preview remains the single subtitle data source. No persisted format, editorial/model/provider/AI request policy or renderer-engine change was made.

## Checkpoints

- `820b398`: Phase 1 auth regression, baseline tests, type/lifecycle repairs.
- `f5b0ed5`: Phase 2 dialogs, feedback and accessibility.
- `b206751`: Phase 3 import/dependency and historical-document cleanup.
- `6eaa8e8`: format-only app/components checkpoint, 120-column target.
- `ee5c030`: Phase 4 Editor domain separation.
- `c5161f3`: worker route/OAuth/service separation and package/HTTP contract checks; render extraction held back.
- `e95d4d4`: final UI/lifecycle repairs, remaining dead Progress wrapper removal and synthetic acceptance fixtures.
- `d23a336`: remaining lint warning cleanup and stable playback/history callbacks.
- `8908ad1`: renderer extraction, deterministic lossless evidence, library/batch/tool domain split and regression tests.
- A documentation-only completion checkpoint follows; its exact ID is in the review manifest.

## Confirmed changes and boundaries

`worker/batch-pipeline.mjs` handles the actual `provider-auth-unavailable` code. The first item retains its pre-existing source/draft/plan/manual locks/settings/checkpoint, the next ChatGPT item pauses before acquire/analyze, reconnect does not resume, explicit resume reuses the source and submits once. Ordinary failures, cancellation, completed siblings and other providers retain separate behavior.

Transition tests inspect actual atlas black/white pixels, Dip Black multiply versus Flash White screen blend, exact boundary window and ordinary None cuts. AI JSON/CRLF NDJSON decoders check unknown structure, unavailable and stale-but-editable manual data, cancellation and truncated streams without adding a semantic acceptance gate.

`components/confirmation-provider.tsx` owns one Radix confirmation request. Escape cancels and focus returns. Save/discard/stay replacement only proceeds on the selected successful path; save/archive failure keeps the editor. A source/session epoch check after awaited confirmation rejects stale replacement. Toasts follow successful copy/save/queue/trash; restore undo uses the existing per-ID route, not synthetic success.

`lib/api/worker-client.ts` centralizes origin, typed DTOs, raw Response/stream transport, error mapping and AbortSignal. Domain hooks under `components/editor/` own source, plan/history, batch, render, session, playback, ChatGPT and subtitle lifecycles. Event wrappers use layout-committed state readers. The ephemeral history scope clears obsolete undo history without changing persisted draft format. Main-range capture now receives only the fields its implementation consumes; its declaration reflects that structural contract. Source request cleanup removes its own controller from the captured Set, rather than an unrelated later ref value. Hidden-tab health/render polls pause and visibility refresh remains deduplicated.

UI controls retain charcoal/orange dark-only styling. Common control strings are in `lib/ui-strings.ts`; preset/provider names and source text stay unchanged. Action labels include Vietnamese copy/undo/redo/Inspector controls, and blocked TXT/video/Apply/render controls expose a short visible reason with aria-describedby. Body text target is 12px; render-canvas typography is unchanged. Contrast calculation for muted #8f867c on #100e0c is 5.3836:1. Narrow candidate timecodes no longer break character-by-character; compact preview uses the start of its scrollable area instead of clipping content above its origin. No new resize handles or main-panel relocation.

## Worker extraction evidence

- `worker/routes/{health,auth,music,storage,batch,render,sources}.mjs` contains the original branch bodies. `router.mjs` sorts original priorities; handled undefined/streaming responses stop dispatch. `http-handler.mjs` keeps Host/Origin, OAuth GET Host guard, OPTIONS and JSON/raw-upload policy before dispatch, plus existing status/error body behavior.
- `worker/chatgpt-auth.mjs` owns attempts, refresh coordination/JWK state and the existing credential store. The optional constructor dependency is only for a fake store in tests; production defaults to the same store/namespace. Tests verify redaction, no store reads on unavailable login, actual current credential identity and single-use attempts. No real token/network operation ran.
- `worker/{source-service,analysis-service,command-runner,http-responses,queue-history,library-service,batch-service,runtime-tools}.mjs` splits bounded domains instead of relocating the whole monolith. Shared services are read at operation entry, allowing existing initialization order without eager TDZ access. Private caches/maps stay worker-owned.
- A compiled comparison of **84 original named function bodies** against checkpoint `ee5c030` matches after excluding injected dependency destructures, export declaration modifiers and formatting. This is code-preservation evidence, not runtime equivalence.
- Runtime import closure stages both packagers' manifest and walks actual AST import/export/dynamic/require expressions. A new regression distinguishes JSDoc type imports from runtime imports; the previous regex misclassified `import(...).EditPlan` in a comment. No runtime dependency was omitted or guard removed. The final closure audit also found the last unused UI Progress wrapper; it was removed (51 UI files total), while Radix remains for live controls.
- `worker/request-origin.mjs` and `worker/plan-validation.mjs` use @ts-check/JSDoc and are explicit roots of the normal TypeScript check. Existing EditPlan/Caption types are reused. Render-config receives incremental parameter JSDoc; it is not claimed fully checkJs-migrated. Existing source/range/manual/teaser guards remain authoritative.

### Render safety gate — resolved with a reproducible lossless control

The earlier failed captures remain as historical evidence. The follow-up repeats the preserved `1e50639:worker/server.mjs` before extraction. Two runs of that identical source with default ABR produce the same actual spawn argv/filter graph and different decoded hashes. Thus hash mismatch in that mode alone cannot identify a refactor regression. The lower-level encoder/thread cause of ABR variation is not claimed established.

The harness now uses **lossless libx264 CRF 0 with VBV disabled only inside the isolated fixture**, keeping the same full filter graph and both source ranges. These settings are not sent to normal app renders. It first captured a before baseline and repeated it before extracting render. Both have identical 48-frame decoded SHA-256 records. After extraction and again on the final source, all 48 records, executable/actual child.spawnargs and filter graph match. Only owned output root and mkdtemp suffixes are normalized. Title/shine assets and fixture source are unchanged. `scripts/qa-render-refactor.mjs compare` asserts the evidence and matching fixture identities; `render/comparison.json` records it.

`worker/render/composition.mjs` contains the original graph/image/subtitle/renderPart functions. `worker/render/coordinator.mjs` owns the existing serial queue/submission/resume/cancel logic. There is no new renderer, filter, transition, speed, bitrate or encoder policy. Synthetic tests cover queued cancellation releasing only its own controller immediately, started cancellation retaining stopping until process cleanup, preserving plan/source/completed output, terminal no-op and duplicate-resume guards.

`worker/library-service.mjs` holds existing library ownership/mutation callbacks. The data root is explicit and late services are read only inside callbacks. Bootstrap caught and corrected two initialization-order errors during extraction: eager prepareBatch use and eager read of not-yet-created speech services. A regression verifies library construction does not touch late dependencies. `worker/batch-service.mjs`, `runtime-tools.mjs` and `routes/index.mjs` leave server.mjs at 475 lines without relocating the whole monolith.

The harness's pre-extraction replay also exposed a duplicate writeFile import in its generated old-worker copy. It now uses a distinct QA alias; no production import guard was bypassed. `after --bootstrap-only` passes without listener, credential store, network, history restore or render. Full runtime/package qualification remains separate.

## Final commands and evidence

All commands run in this checkout with `/opt/homebrew/opt/node@22/bin` first on PATH:

```sh
node --test desktop/worker-runtime-files.test.mjs worker/render-coordinator.test.mjs worker/routes.test.mjs
npm test
npm run lint
npx --no-install tsc --noEmit
npm run build
git diff --check
QA_BETA_MOCK=1 QA_PLAYWRIGHT_MODULE=/private/tmp/marketing-slide-tools/node_modules/playwright/index.mjs node scripts/qa-template-ui.mjs
QA_BETA_MOCK=1 QA_PLAYWRIGHT_MODULE=/private/tmp/marketing-slide-tools/node_modules/playwright/index.mjs node scripts/qa-editor-preview.mjs
node scripts/qa-beta-interactions.mjs
node scripts/qa-beta-lifecycle.mjs
node scripts/qa-render-refactor.mjs after --bootstrap-only
node scripts/qa-render-refactor.mjs before --label=repeat-default
node scripts/qa-render-refactor.mjs before --label=repeat-default2
node scripts/qa-render-refactor.mjs before --lossless
node scripts/qa-render-refactor.mjs before --lossless --label=repeat
node scripts/qa-render-refactor.mjs after --lossless
node scripts/qa-render-refactor.mjs compare
node scripts/audit-ui-dependencies.mjs
```

Final logs and review artifacts are ignored under `.isolation-verification/work-order-finish/`:

- `tests-final.log`: **378 pass / 0 fail / 0 cancel / 0 skip**. Focused domain tests: **10 pass**. Original baseline was 344 tests / 277 pass / 67 fail; Phase 1 checkpoint was 358 pass.
- `lint-final.log`: **0 errors / 0 warnings**; `tsc-final.log` empty success; `build-final.log` standalone build success; `diff-check-final.log` empty success.
- UI capture directory `../work-order-complete/ui/`: Editor/Batch/Kho empty states at all five viewports, source advanced disclosure, Kho loading/error at each viewport, narrow focus/drawer, shortcut, forced-colors/reduced-motion. Results include no page error/root horizontal overflow. Representative 390px Editor/Inspector/forced-colors and 1440px Batch captures were also inspected visually; screenshot generation is not a pixel-level audit of every control. Latin-only cold load requests no JP/KR font; typing CJK loads those local faces.
- Loaded capture directory `../work-order-complete/loaded-ui/`: 15 loaded workspace captures plus 15 Inspector appearance/text/music disclosure captures at 1440×900, 1280×720, 1024×768, 768×1024, 390×844. Long Vietnamese/CJK, complete/validating/error jobs. Tests exercise exact main undo/redo, manual teaser outside own main, incomplete timecode across workspace, source lease, save failure blocking batch replacement, then successful manual save retaining unfinished input.
- Interaction fixture directory `../work-order-complete/interactions/`: real React controls in a bundled synthetic host; confirmation choices/Escape/focus, stale clipboard completion suppression, IME/partial timecode and A→B→A download cancellation.
- Lifecycle fixture directory `../work-order-complete/lifecycle/`: real MusicPanel and source-lease hook with controlled audio promises and HTTP interception; suspend/unmount releases pending audition, source A→B keeps one owner with unique revisions, final release wins even if messages arrive out of order. The mock uses the actual worker lease reducer.
- `worker-body-comparison.json`, `worker-bootstrap.log`, `render/comparison.json`, `ui-dependencies.log`: additional static/synthetic evidence.
- `review.patch`, `review-files.json`, `git-status.txt`: complete baseline-to-final diff including new source files, SHA/size and final Git status. Logs/media/build/cache are excluded from Git.

The old qa-template-ui/editor-preview production paths/assertions are retained behind an explicit legacy guard. Only the current `QA_BETA_MOCK=1` fixtures ran; passing these does not claim the legacy full media workflow passed.

## Warning review and limits

All 28 former warnings are resolved without changing lint configuration or disabling rules. History/preview actions now have explicit useCallback dependencies, shared playback stop is stable, source timing memo no longer lists an unused duration dependency, and library/audition generation increments use stable operation helpers. Candidate catalog synchronization includes the saved choices dependency and keeps its existing context/ID guard. Unused imports/locals and obsolete unread teaser acknowledgement state are removed. Metadata omission still removes the same fields without altering canonical source evidence; import still ignores obsolete mediaReview. The logo uses unoptimized eager Next Image with the original SVG URL, dimensions, accessible label and CSS class. No image optimization endpoint or remote fetch was introduced.

Three-OS GitHub Actions is source-reviewed, **not run**. Windows PE audit is configured for real runner Node, compiled helper and native npm modules; it is not a full installer audit. No installer/package/codesign/installed app was built or updated in this work order. Real provider, ASR, downloads, hardware render and editorial quality remain unverified. Synthetic screenshots/assertions cannot establish smoothness or production correctness on all machines.

## Short manual review

1. Open an existing draft, edit a partial timecode, change workspace/part, Save and reload; verify exact draft/locks/undo.
2. Open a Batch item with unsaved changes: cancel/discard/save; simulate full browser storage and verify the old editor remains.
3. Start preview/music/teaser, switch source/part/workspace during preparation; verify no late autoplay and source audio restored.
4. Check all workspace drawers, keyboard focus/IME and narrow progress/error/disabled controls.
5. Verify a short real render and then cancellation/resume on the app build. Lossless fixture equivalence is not acceptance of all encoders/templates or main/teaser editorial quality.
