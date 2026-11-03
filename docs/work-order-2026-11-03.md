# Beta work order — 2026-11-03

Baseline review: `8c2d05aa4dff8bec10761077f31e67bc20c1f121`.
Phase 1 checkpoint: `820b3985ecbeae66dfd930e73b1656db46d21c72`.
Work is local to `beta/maintenance`; installed apps, DEV, production and user data are untouched.

## Phase 1 / 2 evidence so far

- Node 22.23.3, Beta 5373 frontend, worker 8987 intercepted by browser fixtures. No real worker/API/AI/ASR/media requests.
- 359 local tests pass, 0 fail/skip. Focused auth/transition/AI decoder: 29 pass. JSON, chunked NDJSON, unavailable, selected and stale editable drafts are covered without a new semantic gate.
- Lint: 0 errors, 45 warnings (baseline 50). TypeScript: 0 errors. Build succeeds. Native dialogs in app/components replaced by the existing Radix primitives, with a single confirmation provider and cancellation/focus return. Unsaved replacement has Save/discard/stay choices. Save failure returns false and leaves the current editor. An additional ownership check after awaited confirmation prevents stale source/batch replacement.
- Sonner follows actual copy/save/queue/trash success. Trash undo uses the existing per-ID restore route. Visibility/close background saves do not toast.
- Render and web JSON Apply have visible disabled reasons and aria-describedby. Existing disclosure keeps children mounted; button type and accessible-name rules are enabled. Shortcut help honors inputs and IME. Dim hardcoded UI text uses palette tokens; UI micro text is at least 12px. Preview canvas typography is not changed.
- Dark-only design remains deliberate. No light theme or new layout engine.
- WebVTT deferred: current caption overlay already uses CaptionTrack; no second subtitle source was introduced.

### Browser evidence and limits

` .isolation-verification/work-order-complete/` is ignored. `scripts/qa-beta-work-order.mjs` visits Editor/Batch/Kho at 1440×900, 1280×720, 1024×768, 768×1024 and 390×844; source advanced disclosure, narrow drawer Escape/focus return, shortcut dialog and forced-colors/reduced-motion are exercised. Screenshot files and `ui/result.json` are there. Current fixtures show no page errors or root horizontal overflow. These are empty/offline/long-input states, not evidence for every loaded media state.

`scripts/qa-beta-interactions.mjs` bundles the real React controls into an isolated synthetic host. It checks dialog choices/Escape/focus, stale clipboard completion suppression, incomplete timecode and composition retention, and A→B→A download ownership/cancellation. These are component integrations, not complete end-to-end editor playback tests.

Existing `qa-template-ui` / `qa-editor-preview` still reference obsolete ports, production runtime paths and retired UI labels. They must be adapted before they can safely qualify the current Beta. Do not run those scripts against installed apps.

### Exhaustive-deps review

Six warnings removed by making dependency use explicit: stable plan setter callbacks; caption selector takes only the field it consumes; deck restore uses its duration dependency; subtitle language is explicit; legacy teaser draft identity is computed once as a semantic key. Remaining warnings are tracked, not suppressed:

- Initial restore is guarded once by hydration; adding an unstable restore function would cause repeat setup (requires domain hook extraction).
- Source request Sets and audition/load counters are stable ref containers; cleanup intentionally changes the live counter or removes its own controller. Do not copy a numeric counter into cleanup and lose invalidation.
- Timing/teaser memo intentionally keys semantic cut/caption fields to avoid remounting playback for style changes. The whole plan is still referenced in implementations; domain selectors should make this explicit during extraction.
- Cut-history clear function is stable, but property access creates an object warning; destructure in extraction.
- Candidate saved choices update only when IDs/scope differ; guard prevents loops. Preserve ordering and active choices.
- Preview key listener currently reattaches with the newest closure; no stale callback, but a stable layout-updated action ref can avoid repeated listener churn.

CI matrix source has been reviewed; no runner was dispatched. Windows audit uses real runner Node/compiled helper/native npm resources, not an installer qualification. No Windows/macOS/Linux CI pass is claimed.

## Outstanding work

Phase 2 full loaded/loading/error screenshot matrix and playback/source-lease end-to-end fixtures remain to qualify. Phase 3–5 continue after these checkpoints; extraction is not considered done merely by moving a monolith. Render extraction requires the specified synthetic argv/frame hash baseline first.

## Phase 3 dependency review

- Renamed the package to `shortcut-studio`; npm regenerated its lock metadata. Removed 50 unreachable UI components after the static closure audit (literal imports/reexports/dynamic imports/require and repository script references). The audit script is repeatable; original graph is retained in ignored `ui-dependencies.log`.
- Removed 13 packages consumed only by those dead components. Sonner, Radix, Zod and all media/runtime dependencies remain. The obsolete resizable-panel localStorage cleanup strings are migrations, not runtime imports; kept them.
- `db/index.ts`, the D1 example, Drizzle configuration and build plugin remain: the opt-in hosting build still consumes the schema/migrations. No active data or runtime was deleted. `CLAUDE.md` is already only `@AGENTS.md`.
- Earlier build 1102/1104–1106 and historical Phase 3–9 qualification reports moved to `docs/archive`; local Markdown links and repository path references were updated. They are not evidence for this work order.
- CJK font faces already use local URLs and `font-display:swap`. Browser loading is demand-driven; declarations are not preloads. All renderer font files retained. The synthetic visual fixture deliberately types Japanese/Korean; network requests from that state must not be described as a Latin-only cold load. No glyph subsetting applied.
