Cập nhật 2026-11-04: OAuth đã được thay bằng Codex CLI; xem docs/CODEX-CLI-AUTO-PROMPT.md.

# Beta final local verification — 2026-11-03

Completion follow-up supersedes earlier acceptance and blocked-render records. Original review baseline `8c2d05aa4dff8bec10761077f31e67bc20c1f121`; follow-up starts at `1e506396bfa441d16b8be675e4b55822cc0e7c95`; branch `beta/maintenance`. Source checkpoint `8908ad1`.

| Final check | Result |
| --- | --- |
| Focused coordinator/route/import tests | 10 pass / 0 fail / 0 skip |
| `npm test`, Node 22.23.3 | **378 pass / 0 fail / 0 cancel / 0 skip** |
| `npm run lint` | **0 errors / 0 warnings** |
| `npx --no-install tsc --noEmit` | **0 errors** |
| `npm run build` | **success**, standalone build only |
| `git diff --check` | **success** |
| Beta browser fixtures | five viewports, loaded/empty/loading/error/disclosures, interaction and lifecycle fixtures pass; synthetic only |
| Worker render extraction gate | **pass for the fixed lossless fixture**: actual spawn argv/graph equal, all 48 decoded frame hashes equal; before repeat also equal |
| Structure | page 542 lines; server 475 lines; domain modules with original behavior |
| CI matrix / Windows installer | **not run** |

The former 28 warnings are resolved without lint-rule changes. Same-code ABR repeats have identical argv/graph but different decoded hashes; lossless fixture controls make the extraction check reproducible. CRF0/VBV overrides exist only in the QA child. Normal app render parameters remain unchanged. Named worker function-body comparison: 84 match, 0 missing/different after dependency/export-format scaffolding is removed.

Added regression tests cover queued versus started cancellation, controller ownership, checkpoint preservation, completed-job no-op/duplicate resume rejection, lazy library construction and the composed route dependency map. Existing auth/transition/draft/decoder regressions remain.

Current commands, final logs and full diff are in [the work-order report](work-order-2026-11-03.md) and ignored `.isolation-verification/work-order-finish/`. Screenshots/component evidence were rerun on the final build and remain under sibling `work-order-complete/` fixture directories.

Local checkpoints: `d23a336` warning/callback cleanup; `8908ad1` renderer/worker completion. No installed-app/package update, push, real provider/ASR/source download, user-media operation or CI/installer success claim. All source work from Phases 1–5 is locally complete; real runtime, hardware/template coverage, CI and installer qualification remain external acceptance work.

---

## Historical Phase 1 acceptance record

# Phase 1 local acceptance — 2026-11-03

**Current status: local Phase 1 gates pass.** Tests have no failures, lint has no errors and typecheck has no errors. This supersedes the historical blocker/stop records retained below. CI on macOS/Windows/Linux has **not** been run; this is not three-OS acceptance or runtime/UI qualification.

Branch `beta/maintenance`, unchanged HEAD `8c2d05aa4dff8bec10761077f31e67bc20c1f121`; Node **22.23.3**. All previous Phase 1 work remains present. Beta profile/ports stay 5373/8987. No DEV/production/app/credentials/user media modifications, build, push, merge or commit.

## Final results on the last source state

| Check | Result | Exit |
| --- | --- | ---: |
| Focused Batch/teaser/response/music checks | **31 pass / 0 fail / 0 skip** | 0 |
| Full `npm test` | **358 pass / 0 fail / 0 skip** | 0 |
| `npm run lint` | **0 errors / 50 warnings** | 0 |
| `npx --no-install tsc --noEmit` | **0 errors**, empty log | 0 |
| `git diff --check`, including new files | no whitespace findings | 0 |

The original baseline was 344 tests / 277 pass / 67 fail. The previous continuation was 352/352 with 18 lint errors and 8 type errors. All final checks above ran after the last source/test edits. Documentation/review artifact generation followed without further code edits. Intermediate failures and successful earlier runs remain in the ignored log directory; the final results are not inferred from them.

## Additional tests requested in this review

- `worker/batch-pipeline.test.mjs`: new test begins with **sourceId, plan/draft, manual lock, settings and checkpoint already present before auth fails**. It snapshots all of them before processing, asserts exact preservation after failure, no render/submission, and that the following ChatGPT item pauses before acquire/analyze. Reconnect alone does nothing; explicit resume loads the saved source, preserves locked parts/raw draft/settings, creates one render, and rejects duplicate resume of that already-submitted item. Existing auth recovery, same-queue completed sibling, cancellation, ordinary error and provider-independence tests remain.
- `worker/teaser-selection.test.mjs`: transition test uses the existing foreground renderer contract: Dip Black selects atlas column2 and multiplicative blend; Flash White selects column3 and screen blend. It verifies center pixels from the actual bundled PNG atlas are black/white respectively, compares with the canonical pixel helper, and checks precise start/end enable expressions and column selection. Hook-only override produces exactly boundary1; ordinary None cuts add no window. No renderer code/filter/sprite change and no rendered footage comparison was made.
- New `lib/ai-progress.test.mjs`: checks JSON and seven-byte-chunk CRLF NDJSON, diagnostics, malformed/primitive payloads, safe error responses, incomplete stream, read cancellation + reader release, nested web context validation, and unchanged preservation of a stale-but-editable manual teaser. Uses installed esbuild for in-memory TypeScript loading, no app package/build or new dependency.
- Existing `lib/music-preview.test.mjs`: focused synthetic playback checks include autoplay rejection, pause/resume/seek, source mix invalidation, stale async completion and dispose restoring source audio. These cover the playback controller, not a real browser Audio element.

## Small lint/type repairs and lifecycle reasoning

| Files | Repair / preserved behavior |
| --- | --- |
| `app/page.tsx` | Narrow Teaser with `status === selected` before selected-only fields; no timestamp or prompt identity changes. Pass explicit decoders at all three AI operation call sites. |
| `lib/ai-progress.ts`, new `lib/ai-response.ts` | Unknown JSON/stream objects are checked before access; explicit structural plan/context decoders replace the unsound generic JSON return. Accepted objects are preserved, not normalized/trimmed. Stale editable teaser data is **not** rejected by adding new semantic gates here; existing source/range/readiness validators remain at their established boundaries. No `any` cast/type assertion was added to hide unknown data. |
| `components/copy-button.tsx`, `teaser-editor.tsx`, `teaser-candidate-review.tsx`, `use-editor-source-lease.ts` | Publish latest text/prepare/source refs in layout effects after commit, rather than mutating them during render. Event handlers keep immediate writes where needed. Existing abort, epoch, ownership, unmount cleanup and IME guards remain. |
| `components/main-ranges-editor.tsx` | The applied-range key used by render is now state instead of a render-read ref. All draft checks, exact rows, restore and handlers remain. |
| `components/editor-workspace.tsx` | Reset drawer on visibility transition using guarded same-component state adjustment; inert DOM changes use attributes with the same cleanup/restore-focus ownership. Panels/drafts stay mounted; no layout redesign. |
| `components/teaser-candidate-review.tsx` | Separate suspended UI reset from layout-effect abort/clock/pause. Outstanding prepare is aborted; generation increments; playback does not restart automatically. |
| `components/manual-video-download.tsx` | Scope task presentation to worker/source identity and clear it on identity changes, including A→B→A. Existing controller cleanup still aborts old work; no delayed reset added. |
| `components/music-panel.tsx` | Remove impossible `.pause` access after clearing the mix ref (old mix was already released). Library loading publishes state from network callbacks; manual/post-import refresh sets loading at the event. Source/worker changes keep loading ownership. Audition scope resets UI state; layout cleanup releases its audio. Detection visibility derives from current settings/source. Existing playback invalidation/unmute/abort/dispose paths remain. |
| `components/media-library-panel.tsx` | Loading displayed only when worker is ready. Storage mutation stays an event callback (`useCallback`) with unchanged confirmation/network/ownership behavior; no render-time clock invocation. |
| `components/ai-operation-status.tsx`, `task-progress.tsx` | Elapsed-time updates happen on the existing one-second interval callback; no immediate effect-state cascade. Cleanup still stops the interval. No fabricated percentage or extra timer was introduced. |

No eslint rule/config was disabled or downgraded. No new eslint-disable, @ts-ignore, `any` assertion, timeout or microtask was introduced to escape a lint diagnostic. Existing timers unrelated to these repairs were retained.

## Warnings retained and classified

50 warnings remain, unchanged count from the prior baseline:

- **30 `@typescript-eslint/no-unused-vars`**: unused imports/parameters/locals; cleanup is outside this narrow repair.
- **19 `react-hooks/exhaustive-deps`**: dependency/ref-cleanup advisories; not hidden and not automatically changed because callback ownership and playback dependencies require contextual review.
- **1 `@next/next/no-img-element`**: existing image rendering advisory.

Exact file/line messages: `lint-final.log`. A zero-error lint exit does not mean these warnings were resolved or all hooks were runtime verified.

## Commands actually run

Working directory: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`.

```sh
/opt/homebrew/opt/node@22/bin/node --test worker/batch-pipeline.test.mjs worker/teaser-selection.test.mjs lib/ai-progress.test.mjs lib/music-preview.test.mjs
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx --no-install tsc --noEmit
git diff --check
```

Each command exits0 on the final source. Earlier focused lint/typecheck passes were run during repair and are retained under `lint-1/2/3.log`, `tsc-2/3.log`, `media-lint.log`. The installed Next `use-client` guide was read before UI edits. No external research/provider call was needed.

Ignored logs and review material: `.isolation-verification/phase1-ui/`:

- `focused-final.log`, `full-final.log`, `lint-final.log`, `typecheck-final.log`, `diff-check-final.log`.
- `review.patch`: complete HEAD-to-current diff including **all new/untracked source/config/report files**, not just tracked `git diff` output.
- `review-files.json`: exact file list, patch SHA256 and size; `git-status.txt`: final working tree status.

Historical logs from previous continuation remain under `.isolation-verification/phase1-completion/`; no evidence was deleted.

## Limits and manual acceptance

- No browser/DOM mount harness was run. jsdom/react-test-renderer/happy-dom are not installed; none was installed just for this repair. No claim of UI runtime pass.
- Still manually verify: switch source/part during preview preparation; leave workspace/unmount with music or teaser audition playing; copy while text changes; IME/timecode draft + Apply/restore; A→B→A while a manual video download is active; narrow drawer Escape/focus/inert cleanup; source lease refresh after source change. Expected: no stale async application/autoplay, draft retained, controls recover.
- No AI/ASR/video download or real media rendering. The full suite still includes its pre-existing four-second 64×64 synthetic FFmpeg smoke in temporary storage. Atlas inspection is a file/pixel check, not an output video render.
- No build or installed-app update. No GitHub Actions run; matrix source is retained but macOS/Linux/Windows runner results remain unknown. Windows resources audit/full installer qualification limits in the historical continuation still apply.
- No Phase 2–5 implementation or broad refactor. This concludes the requested **local** Phase 1 error gates only; do not label three-OS CI or video editorial quality accepted.

---

## Historical continuation and baseline evidence

# Phase 1 continuation — 2026-11-03

Current status: **unit suite green; Phase 1 acceptance blocked by existing lint/type errors.** No Phase 2–5 work or app update. The historical stop/report record below is preserved, not the current status. User explicitly authorized the Batch auth repair on this continuation.

## Final local results

Node **22.23.3**, Beta checkout/branch `beta/maintenance`, HEAD still `8c2d05aa4dff8bec10761077f31e67bc20c1f121`. All previously uncommitted Phase 1 changes preserved. Nothing committed/pushed/reset/merged; DEV/production/apps/user data/credentials unchanged.

| Check | Result | Exit |
| --- | --- | ---: |
| Original baseline | 344 tests: 277 pass / 67 fail / 0 skip | 1 |
| Prior checkpoint | 349 tests: 329 pass / 20 fail / 0 skip | 1 |
| Final focused modules | **63 pass / 0 fail / 0 skip** | 0 |
| Final complete `npm test` | **352 pass / 0 fail / 0 skip** | 0 |
| Final lint | **18 errors / 50 warnings**, acceptance blocker | 1 |
| Final typecheck | **8 errors**, acceptance blocker | 1 |
| `git diff --check` | clean | 0 |
| CI YAML parse with installed js-yaml | valid YAML, three OS matrix entries | 0 |
| GitHub runner macOS / Windows / Linux | **not run**, no push/dispatch | — |
| Go/Windows PE audit locally | not run: Go not on PATH and host is macOS | — |

Final source checks ran after the last test/source edits. Only this report and the review artifact were written afterwards. Earlier focused runs exposed fixture mistakes (including an intermediate syntax error); they are retained in logs and are not counted as green evidence. An initial optional YAML parse command failed because package `yaml` is absent; the final parse used the already installed `js-yaml`, without installing a dependency.

## Changes in this continuation

- `worker/batch-pipeline.mjs`: recognize exactly `provider-auth-unavailable` for ChatGPT, mark current item error/auth-required and set existing auth pause flag. Later ChatGPT items stop before acquire/analyze; other providers and cancellation retain existing paths. Clear only stale auth-required metadata when an explicitly resumed item starts. No plan replacement, fallback, retry, model/provider change or new request.
- `worker/batch-pipeline.test.mjs`: retain original regression; add recovery + explicit resume using saved source, exact saved draft/locks/settings, paused sibling, completed sibling in the same queue, submission uniqueness, provider independence and cancellation during analysis. Old synthetic render plans now explicitly opt out of teasers instead of accidentally missing them. Existing ordinary-error/restart/ambiguous-submission tests are retained.
- `worker/teaser-selection.test.mjs`: mocked paired provider envelope and valid SHA256 fingerprints; supply source cues for speech claims, zero frame preparation, no automatic retry/fallback, source/model/transcript/timing cache checks, measured word boundaries and preserved transition contracts. Replaced obsolete color-string assertion with the current foreground graph-array contract; renderer untouched. All 14 tests retained and passing.
- `worker/auto-cut-workflow.test.mjs`: retained-segment main output, current five-argument workflow adapter versus selector options contract, paired text-only selection, proper cue/source identity, media descriptor/attachment receipt and raw hookSelections for manual import. Explicit auth error instead of invented fallback. Assert exact main segments and external provenance after import. No real media access.
- `lib/source-context.test.mjs`: deterministic fake Date via test clock; compare the entire context including root/comments/heatmap provenance. No timestamp fields deleted or lucky reruns used for the determinism claim.
- `worker/command-lifecycle.test.mjs`: the existing Windows-only POSIX skip now has an explicit reason. No skip occurred locally. Existing `worker/local-signals.test.mjs` skips only ENOENT for absent FFmpeg, not an installed executable that fails.
- `.github/workflows/phase1.yml`: macOS/Windows/Linux Node 22 matrix, npm ci, lint, typecheck and tests. Independent checks remain scheduled even if another check fails. No continue-on-error, lint suppression or weakened typecheck.
- `scripts/audit-windows-runtime.go`: refuse an empty PE resource set instead of printing an empty successful report.
- Existing `package.json` test glob and `worker/request-origin.test.mjs` preserved and passing, including Host validation on OAuth GET.

## Triage completed for the remaining unit failures

All remaining old unit failures were traced to fixture contracts: per-part response mock versus paired envelope, non-hash fingerprint, missing cues while claiming visual/speech evidence, obsolete retry/image/fallback expectations, old workflow function signature, missing web import fields and plans lacking teaser/explicit opt-out. Production selector/prompt/model/validation logic was not changed to accommodate tests. Batch auth was a real integration regression and was repaired narrowly as authorized. The timestamp failure was fixture-clock drift; full provenance is now checked under a controlled clock. No remaining unit failures were skipped.

## Independent blockers, not silently repaired

These files match HEAD byte-for-byte; proof is in `unchanged-blocker-files.json` under the ignored log directory. Fixing UI effect/ref behavior would go beyond this authorized Batch-auth repair and into separately reviewable UI logic. Guards were not disabled.

Type errors:

- `app/page.tsx:132–133` (5): access selected-only fields on unavailable `Teaser` union member.
- `components/music-panel.tsx:61` (1): `.pause` on inferred `never`.
- `lib/ai-progress.ts:26` (2): unvalidated `unknown` response accessed/returned as typed data.

Lint errors (18 total): `components/ai-operation-status.tsx` (1), `copy-button.tsx` (1), `editor-workspace.tsx` (3), `main-ranges-editor.tsx` (1), `manual-video-download.tsx` (1), `media-library-panel.tsx` (2), `music-panel.tsx` (4), `task-progress.tsx` (1), `teaser-candidate-review.tsx` (2), `teaser-editor.tsx` (1), `use-editor-source-lease.ts` (1). Rules flag render-time refs/impurity, effect state updates and mutation. Full messages/locations remain in `lint-final.log`. They are static-check findings, not new runtime observations.

## Windows audit boundary

Workflow stages **real** runner-installed Windows x64 Node, the compiled production DPAPI helper and installed native npm `.node` modules into an operation-owned resources tree and runs `audit-windows-runtime.go` on it; checks output has at least two PE entries. It never executes the credential helper. This is neither mock binary generation nor an empty-directory audit.

This CI audit covers that runtime subset only. It does **not** qualify a full packaged installer: FFmpeg/Whisper/launcher/resources from the installer are not rebuilt in this Phase 1 workflow. Existing cross-packager currently supports macOS/Linux hosts, not native Windows execution. Full packaged-Windows runtime/installer audit and actual Windows startup remain unverified; no runner has executed this new workflow. No assertion of CI green or Windows installer qualification is made.

## Exact final commands and evidence

Working directory: Beta checkout. Local ignored evidence directory: `.isolation-verification/phase1-completion/`.

```sh
/opt/homebrew/opt/node@22/bin/node --test worker/batch-pipeline.test.mjs worker/auto-cut-workflow.test.mjs worker/teaser-selection.test.mjs lib/source-context.test.mjs worker/request-origin.test.mjs
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run lint
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx --no-install tsc --noEmit
git diff --check
```

Logs: `focused-final.log`, `full-final.log`, `lint-final.log`, `typecheck-final.log`, `ci-static-final.log`. Local full tests include the existing four-second 64×64 synthetic FFmpeg extraction smoke in temporary storage; no real source/render/ASR/provider/browser workflow was exercised. No real Keychain credentials were read/written.

Review artifact: `.isolation-verification/phase1-completion/review.patch` contains the entire diff from HEAD, **including all new/untracked source/config/report files**, generated without staging/altering the Git index. `review-files.json` records paths, status and SHA256 of that patch. No credentials/media/cache/dependencies are included. No app build/update, CI dispatch, commit or push was performed.

Next acceptance gate: resolve the listed existing lint/type errors in an explicitly reviewed scope, then rerun lint/typecheck/full suite; actual CI results require a separate authorized publication/run. Do not start Phase 2–5 or label Phase 1 fully accepted while these checks fail.

---

## Historical checkpoint (before authorized continuation)

# Beta work order — test baseline, 2026-11-03

Status: **Phase 1 incomplete; stopped on a confirmed behavioral regression as required by work order §1.1.** Phases 2–5 have not started. No runtime/product code was changed in this checkpoint. Do not describe this work as a completed project audit, green suite or runtime qualification.

## Scope and starting point

- User confirmed this work belongs in the **Beta** checkout, not the separate DEV checkout. The work order's DEV 5273/8887 instructions are stale for this scope.
- Checkout: `short-video-studio-beta`; branch `beta/maintenance`.
- Starting HEAD: `8c2d05aa4dff8bec10761077f31e67bc20c1f121`; starting tree clean.
- Beta profile/ports remain `beta`, 5373/8987. No app/data-root/credential changes. DEV and production were not modified.
- Node used: `/opt/homebrew/opt/node@22/bin/node`, **v22.23.3**. System Node 26 was not used to execute the tests.
- Tests use synthetic inputs, mocked provider/Keychain calls and operation-owned temporary directories. No AI, ASR, YouTube/network acquisition or real user media was used. The existing local-signals test generated/analyzed a four-second 64×64 synthetic FFmpeg fixture in OS temp storage; this is not an editor/export render or quality comparison.

## Observed counts

| Run | Tests | Pass | Fail | Skip | Exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before any edits | 344 | 277 | 67 | 0 | 1 |
| Intermediate complete suite | 348 | 321 | 27 | 0 | 1 |
| Focused check of updated fixture modules | 133 | 133 | 0 | 0 | 0 |
| New isolated Batch auth regression | 1 | 0 | 1 | 0 | 1 |
| Final `npm test` observation | 349 | 329 | 20 | 0 | 1 |

Counts differ from the ZIP review's 335/265/70; the actual checkout is authoritative. The final 20 failures comprise 18 previously failing tests still awaiting fixture triage/update, one new failing Batch regression test, and one intermittently failing clock-dependent fixture described below. Do not obtain a green claim by omitting these modules or rerunning until lucky.

Evidence logs are checkout-local, ignored, under `.isolation-verification/work-order-2026-11-03/`:
`before.tap`, `after-fixtures.tap`, `updated-fixtures.tap`, `batch-auth-regression.tap`, `after.tap`. They contain synthetic test diagnostics, not production sessions.

## Confirmed regression: Batch does not pause after the current main auth error

1. `worker/main-content.mjs::select` now rejects missing/expired auth with `code: provider-auth-unavailable` (lines 65–66), preserving the existing plan instead of returning an invented fallback.
2. `worker/batch-pipeline.mjs::prepare` tests `authBlocked` before acquiring each item (line 12), but only sets it in the old `analysis.method === deterministic-fallback` branch (line 34).
3. Its `catch` (line 59 onward) handles cancellation and `TEASER_REQUIRED`, but does not classify the current thrown auth error. The next ChatGPT item therefore acquires a source and calls `analyze` again; both items become errors instead of the later one pausing.
4. New non-skipped test: `worker/batch-pipeline.test.mjs`, **current main auth errors pause later ChatGPT items without acquiring or analyzing them**. Two synthetic items, mocked acquisition/analyze, render forbidden. Expected one analyze invocation; actual **two**. This does **not** demonstrate two remote inference calls or quota consumption: no provider was contacted.

Smallest proposed repair, **not implemented because §1.1 says stop/report**: recognize the established typed auth error in the Batch catch, set the existing `authBlocked` flag and auth-required state metadata, preserve item checkpoints/drafts, then let the existing pre-item pause branch handle later ChatGPT items. Do not add retries, a new fallback plan, provider requests or model changes. Extend the regression assertions to verify explicit resume/reconnect behavior before proceeding.

## Fixture drift corrected

These tests were compared with current implementation and newer Beta contracts, rather than restoring obsolete product behavior:

| Cluster | Files changed | Reason for fixture correction |
| --- | --- | --- |
| Beta isolation | `desktop/runtime-config.test.mjs`, `desktop/windows-config.test.mjs`, `worker/chatgpt-store.test.mjs` | Beta-only identity, fixed ports, namespace and rejection of DEV/production targets. Keychain is mocked, not skipped. |
| Source/part identity and subtitles | `lib/animations.test.mjs`, `lib/cut-transitions.test.mjs`, `lib/visual-style.test.mjs`, `worker/plan-validation.test.mjs` | Provide real-shaped synthetic source IDs/part IDs and source-bound caption track. Subtitle default includes `language:auto`. |
| Main contract | `lib/auto-cut.test.mjs`, `worker/main-content.test.mjs`, `lib/edit-plan.test.mjs`, `lib/custom-time.test.mjs` | Current AI returns retained segments, not recipeId/exclusions; no implicit one-second trim, forced minimum duration or silent retry/fallback. Existing legacy-only helpers remain unchanged. |
| Prompt/import | `lib/auto-cut-request.test.mjs`, `lib/muse-plan.test.mjs`, `lib/teaser-import.test.mjs` | Current prompt version/context required; actual attachments replace URL browsing; explicit synthetic externalVideo is required for continuous-video claims; preserved locked padding is separate from newly invented padding. |
| Manual teaser and speech evidence | `lib/hook-distance.test.mjs`, `lib/teaser-adaptive.test.mjs`, `lib/teaser-editorial.test.mjs` | Manual source-wide ranges/duration remain free; AI bounds remain checked. Cue grouping is not word alignment or semantic completion; measured-word split checks remain. |
| Preview clocks/music | `lib/preview-timeline.test.mjs`, `lib/teaser-hooks.test.mjs`, `worker/music.test.mjs` | Preview is 1×, export 1.25×. Music mock reads the real graph argument file instead of expecting the obsolete atempo/inline representation. No graph changed. |
| Registries and deletion/reuse | `lib/templates.test.mjs`, `lib/text-presets.test.mjs`, `lib/render-delete.test.mjs`, `worker/source-reuse.test.mjs` | Twelve templates/eleven text presets; completed sibling jobs are independent of an active job; source reuse fixture now includes a stored source media entry so it reaches lock/identity validation rather than download preflight. |
| Speech cache | `worker/speech.test.mjs` | Legacy base cache is read-only compatibility evidence; current cache is small/multilingual/transcribe with ASR identity. No model download/run or old-cache relabeling. |

Shared synthetic helpers are in `lib/teaser-test-fixture.mjs`: `makeSource`, a correctly shaped SHA-256 fingerprint and a retained-segments main response fixture. These are test support only, not runtime builders.

`package.json` now exposes the exact requested `npm test` glob and retains `test:isolation`.

New `worker/request-origin.test.mjs` has five tests: exact local Host/port, exact Origin, cross-site no-Origin/Referer behavior, OAuth GET exception (Host is still guarded), and non-API GET/HEAD behavior. No server policy was changed or loosened.

## Remaining triage

| Category | Tests/files | Evidence / next action |
| --- | --- | --- |
| Real regression, confirmed | New Batch auth test | Stop condition above; test remains failing and unskipped. |
| Fixture drift, pending full update | 11 in `worker/teaser-selection.test.mjs` | Old mocks return per-part unwrapped output, use non-SHA256 fingerprints, expect frame extraction, automatic retries/fallback and old English notice strings. Current selector has a paired response envelope, text-only preparation and explicit failures. Each assertion still needs individual review; not blanket-skipped. |
| Fixture drift/integration triage, pending | 3 in `worker/auto-cut-workflow.test.mjs` | Old recipe decisions/fallback; web import lacks current media descriptor/snapshot/attachment fields. Need current-shaped synthetic fixtures without real filesystem media/provider access. No claim that all are proven fixture-only until that work is complete. |
| Fixture drift/integration triage, pending | 4 original tests in `worker/batch-pipeline.test.mjs` | Synthetic plans lack required teaser selections or explicit opt-out, so they stop at review-required before queue assertions. Preserve the new real auth regression while updating these fixtures. |
| Clock-dependent fixture drift, observed | `lib/source-context.test.mjs:357` | Test clears root/comments `extractedAt` but not heatmap provenance. Final run crossed a millisecond and failed on heatmap timestamps `03:20:49.939Z` vs `.940Z`. Input content was identical. Not skipped or retried into a success claim; use a deterministic fixture clock/provenance in the next step. |
| Environment-dependent, corrected only where observed in source | `worker/local-signals.test.mjs` | Replaced hardcoded Homebrew path with `FFMPEG_PATH`/PATH. Skip only on missing executable (ENOENT), with an explicit reason; present-but-failing FFmpeg still fails. No skip occurred on this Mac. |

No actual Keychain/Whisper binary access is necessary for the corresponding unit fixtures. Unsupported `development` in a Beta-only checkout is product-contract drift, **not** a reason to skip isolation tests. Native Windows/Linux behavior, process signals and permissions have not been executed on those OSes.

## Commands actually run

From the Beta checkout:

```sh
/opt/homebrew/opt/node@22/bin/node --version
/opt/homebrew/opt/node@22/bin/node --test --test-reporter=tap lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
/opt/homebrew/opt/node@22/bin/node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
/opt/homebrew/opt/node@22/bin/node --test --test-name-pattern='current main auth errors' worker/batch-pipeline.test.mjs
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test
git diff --check
/opt/homebrew/opt/node@22/bin/node --test lib/teaser-import.test.mjs
```

Two additional focused commands were run (logs `fixture-check.tap` and `updated-fixtures.tap`). The former had 59 tests, 55 pass/4 fail before correcting the affected fixtures. The latter selected the 28 updated modules and had 133/133 pass; it did not include the still-stale worker teaser/workflow/Batch modules.

Final diff review caught and removed an accidental extra argument in a test assertion introduced while updating its attachment fixture. The last import-only check (`import-review.tap`) passed all three tests; `git diff --check` also passed. The last complete-suite observation remains the 349/329/20 run above; it was not rerun to conceal the clock-dependent failure.

Exact successful focused selection:

```sh
/opt/homebrew/opt/node@22/bin/node --test lib/animations.test.mjs lib/cut-transitions.test.mjs lib/visual-style.test.mjs lib/teaser-hooks.test.mjs lib/auto-cut-request.test.mjs lib/teaser-import.test.mjs lib/hook-distance.test.mjs lib/teaser-adaptive.test.mjs lib/teaser-editorial.test.mjs lib/auto-cut.test.mjs lib/custom-time.test.mjs lib/edit-plan.test.mjs lib/muse-plan.test.mjs lib/templates.test.mjs lib/text-presets.test.mjs lib/render-delete.test.mjs lib/preview-timeline.test.mjs worker/music.test.mjs worker/speech.test.mjs worker/main-content.test.mjs worker/plan-validation.test.mjs worker/source-reuse.test.mjs worker/local-signals.test.mjs worker/request-origin.test.mjs desktop/*.test.mjs worker/chatgpt-store.test.mjs
```

## Not done

- No lint, typecheck, build/package, UI/browser QA, real render, AI/provider call, ASR, source download or app update.
- No CI workflow yet: Phase 1's real regression and remaining fixtures must be resolved first. The verified remote is GitHub (`datdooo/short-video-studio`). The Windows audit accepts a real resources directory; do not point it at an empty directory and call that installer qualification.
- No Phase 2 UI change, dependency removal, formatting pass, page/server refactor or persisted migration.
- No commit/push/merge/reset. HEAD remains the starting SHA; test/config/report changes are left visible in the working tree for review.
- Existing Beta/DEV apps, settings, credentials, media, exports, history and backups remain untouched. No new runtime or production data is created.
