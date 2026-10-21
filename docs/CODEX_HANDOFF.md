# Source delivery checkpoint — UI/framing/optional teaser (2026-10-21)

User authorized normal push of all current project source to origin on
`recovery/visual-dev-reconstructed`. Remote was fetched and matched local base
`87c3135c5ff176028f378c9f1d32833569e6c75c` before this checkpoint. Includes all
preserved normalized framing, local OFL UI font/controls, manual opening override,
per-part teaser enable/disable persistence/mapping and delivery documentation.
`docs/video-cut-logic-audit-20261021.md` is a REVIEW with proposed fixes, not an
implementation of those fixes. Do not report its findings as resolved.
Latest DEV package build remains the successful combined build recorded below;
no test/render/provider/YouTube/build run for this push. Current source tree
scanned for credential patterns without printing values: no findings. No outgoing
commits existed before this checkpoint; its staged blobs are reviewed separately.
Required font asset/license/provenance included; ignored media/music, exports,
credentials, dependencies, QA payloads, caches/apps/builds and recovery bundles
remain local. No app/worker restart, production changes, force push or main merge.
Use final Git refs/delivery response for the new SHA and remote verification;
this document does not assume a push has succeeded before it actually runs.

---

# Active update — manual teaser opening + per-part toggle (2026-10-21)

Same branch/base87c3135; all pending framing/font/UI work retained. Read
`docs/teaser-manual-toggle.md`. User now permits manual opening source timestamps
and adds per-part Bật/Tắt teaser. This supersedes mandatory hooks on both parts:
only enabled parts require valid teasers; explicit off means main-only. Persisted
optional boolean defaults to on for legacy plans. Shared presentation/transition/
caption/music/ducking mapping, preview mix key, readiness, autosave and AI/import
preservation updated. No main edits or queued-job mutation; no renderer rewrite.
Added/updated focused regression assertions, NOT run. No test/render/provider/
YouTube/browser QA. Browser Use still disabled despite user approval; no bypass.
Combined Node22 DEV build succeeded once (exit0), app
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. Read-only packaged-source/font checks match. Only docs changed afterward.
Current web/worker PIDs27107/27106 still use `.build-iLQdbs/previous-build.app`
(lsof confirmed); reopen the new app normally once jobs finish. No restart, job
interruption, commit, push/merge or production/credentials/media/exports/backups
changes.

---

# Active update — detailed UI audit (2026-10-21)

Read `docs/ui-detail-audit.md`. Same branch/base87c3135; ALL pending UI/font/framing
work preserved. Source fixes include select-arrow padding, base control token
conflicts, nested Inspector indentation, timecode/gap alignment, long controls,
Copy header wrap, native details ownership and a non-scrolling Render action area.
No business handler/API/schema/engine changes. User approved viewing/screenshots,
workspace tabs and panel/disclosure toggles ONLY; no Generate/Render/provider/
download/delete/plan changes. CUA still reports Browser Use disabled in Work
settings; user said they will enable it. NO screenshots obtained yet; no visual
QA claim. No unit/render/provider tests. Final combined DEV build succeeded once (exit0),
including manual teaser/toggle changes: `release/dev/ShortCut Studio Dev.app`;
log `/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. No app/worker restart, active-job interruption or new commit/push/merge.

---

# Active update — Grok-like Vietnamese font + UI polish (2026-10-21)

Read `docs/ui-font-spacing-polish.md`. Same87c3135 base; preserve all dirty
height-normalized framing and UI changes. Primary UI font is now local OFL
Plus Jakarta Sans (Vietnamese in official metadata),176288B variable asset with
license/source hashes under public/fonts/ui. It approximates Outfit's geometric
style; not identical Outfit and no live glyph QA. Inter/Noto fallback retained;
video fonts unchanged. Active UI audit fixes action-row indentation, Timeline
action width, text-field padding, long-heading wrap, label association, menu
viewport limits and portaled new-session controls; existing callbacks unchanged.
Google/web references bounded to official font/Radix/WAI docs. No tests/browser/
render/provider/ASR. Combined Node22 DEV build succeeded once, exit0; app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-jakarta-spacing-polish-build-20261021.log`. Bundled font/OFL
and framing source match local files; only docs changed afterward. No app/worker
restart, job mutation or push/merge. Running DEV PIDs25664/25663 still use
`.build-ZulbHx/previous-build.app` (lsof after build); reopen the new app normally
when jobs finish. User performs manual acceptance.

---

# Active update — restore height-normalized framing (2026-10-21)

Same branch/base87c3135. All newer uncommitted font/dropdown/UI changes retained.
Read `docs/foreground-height-normalized-framing.md`; this supersedes contain-fit
and direct CSS scale guidance below. Geometry now fixes base height1080 then
zoom1.25 once: every16:9 resolution ->2400×1350 centered/cropped inside1080×1350.
Both preview decks use shared geometry percentages without CSS scale; export
filter and transition masks use the same height/aspect/even-pixel rule. No viewport,
text/background positions, clocks, engine scheduling or quality changes.
No tests/browser/render/provider QA. Node22 DEV build succeeded once, exit0;
app `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-height-normalized-framing-build-20261021.log`. Packaged shared
geometry files match source. Only docs changed after build. Current DEV web/worker
PIDs24526/24525 still run from `.build-Z7enLa/previous-build.app` (lsof confirmed);
new framing requires normal quit/reopen when jobs finish. No restart/stop/job mutation.
Manual visual acceptance still required. No commit/push/merge or production changes.

---

# Active update — UI font / dropdown consistency (2026-10-21)

Starting clean at87c3135 on recovery/visual-dev-reconstructed; that checkpoint
was confirmed on origin. Read `docs/ui-typography-disclosures.md`. Actual bundled
Studio Inter name, shared13/12/11/14/20 typography, consistent16px chevrons and
portaled-menu styling. Source-tab inline overrides removed; shared36/40/32 controls
remain. Presentation only; no business handlers/engine/schema/preview geometry or
media changes. NO tests/lint/typecheck/browser/render/provider/ASR. Node22 DEV
package succeeded once, exit0; app `release/dev/ShortCut Studio Dev.app`, log
`/tmp/shortcut-dev-ui-typography-disclosures-build-20261021.log`. Native packaging/
signing only; no runtime QA. Only docs changed afterward; app/worker not restarted. User accepts manually; no new push/merge.

---

# Source delivery checkpoint — 2026-10-21

User authorized normal push of all current source on
`recovery/visual-dev-reconstructed` to
`https://github.com/datdooo/short-video-studio.git` (no merge/force).
Before this checkpoint, local HEAD27625fe matched the fetched remote branch.
This commit groups all preserved pending source: teaser candidate/repair and
speech-boundary refinements, VAD-controlled ducking, Whisper small configuration/
packaging, foreground fit/explicit125% preview zoom, source-panel/logo fixes,
ZIP theme/shared control sizes and four real-data Kho tabs, with delivery docs.
Latest DEV build succeeded: `/tmp/shortcut-dev-direct-125-preview-build-20261021.log`.
No runtime/manual QA was run; user acceptance remains outstanding. Small model
was not downloaded or loaded. Read the active delivery docs below; old QA does
not establish verification of the new checkpoint. No tests/render/AI/build rerun
for push. Current source tree scanned for credential patterns without printing
values; no findings. Only source/docs/runtime declarations are staged; ignored
media/music/exports/data/credentials/build/cache/QA payloads and bundles stay local.
Both portable project skills already tracked. No local data deletion or app restart.
Only available reconstructed history exists; missing original checkpoints were
not recovered. Use `git log -1`, upstream refs and the final delivery message for
this checkpoint SHA and verified push result (not a hard-coded self-referential SHA).

---

# Active update — direct foreground zoom (2026-10-21)

Read `docs/preview-direct-125-zoom.md`. Both visible/standby decks now use explicit
centered scale1.25 on a100% contain-fit video box, rather than measured-pixel sizing.
No extra zoom, viewport/background/text scaling, timing or engine changes. User's
reported missing zoom has NOT been reproduced with runtime QA. All previous dirty
work retained. Node22 DEV package build succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-direct-125-preview-build-20261021.log`. Only docs changed after
build. No tests/browser/render/provider calls or app/worker restart. Reopen the new DEV app normally once jobs finish to load it.

---

# Active update — ZIP theme / Kho / shared sizes (2026-10-21)

Same branch/base HEAD27625fe; inherited dirty implementation preserved. Read
`docs/grok-theme-library-controls.md`. User's ZIP palette supersedes prior warm
colors. Shared normal36/action40/Timeline32/icon32 controls applied to Editor,
Batch and Kho. Kho now has 4 real-data tabs with shared search; original handlers,
polling, job IDs and physical Part files retained. No mock/prototype logic imported.
UI-only changes; previous render/AI/audio/Whisper/geometry work untouched.
Combined Node22 `npm run package:mac:dev` succeeded once, exit0; app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-grok-theme-kho-build-20261021.log`. Native packaging/signing
completed; chunk-size advisory only. Only delivery docs changed afterward.
Source/diff review and build only. NO tests/lint/typecheck,
browser/smoke/render/AI/YouTube/ASR/listening. Do not use older QA/build evidence
below as verification of this source. No restart, commit/push/merge or production/
credentials/media/exports/backups changes. User performs manual acceptance.

---

# Active update — warm controls / fit-based zoom / complete speech (2026-10-21)

Same branch/base HEAD27625fe; ALL inherited uncommitted work preserved. Read
`docs/warm-controls-fit-zoom-speech-endings.md` first. New user styling supersedes
the old Batch/Library palette instruction: warm black/brown/orange#FF5733 controls,
same layout/hit areas/state. Actual foreground uses contain-fit baseline then125%
image zoom, center clip; matching shared export spatial filter, no canvas/text/
background zoom, clocks remain1× preview/1.25× export. Shared speech boundary gates
and v7 prompt/cache require full spoken thought plus short tail; no timestamp
auto-fix, duration-cap truncation or main mutation. Existing plans load; risky old
hooks may need reselection. Cue/phoneme accuracy and semantic quality unverified.
NO tests/lint/typecheck/browser/smoke/render/provider/ASR/listening verification.
Final combined Node22 `npm run package:mac:dev` succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-warm-fit-complete-speech-build-20261021.log`.
Built-in packaging/signature audits completed, not functional QA. Read-only SHA256
matches packaged render-config/teaser-boundaries to current source; only delivery
docs changed afterward. App/worker were NOT restarted and jobs were NOT interrupted.
No push/merge or production/credentials/media/exports/backups modifications.

---

# Active update — editor / teaser / ducking + Whisper small (2026-10-21)

Same branch/base HEAD `27625fe78dc5177f88355a6c98613d6407d02f09`; inherited dirty
logo source preserved. Read `docs/editor-teaser-ducking-refinement.md` and
`docs/whisper-small.md` for exact findings, changes, reuse and manual acceptance.
Source order/title/prompts, original theme reuse, decoded foreground geometry,
independent AI-ranked choice validation + one bounded repair, fair bounded frame
coverage, honest partial completion, VAD-controlled BGM sidechain/status/cache,
and actual Whisper base→small/backend packaging are implemented in source.
Policy9s export/first10s export-main, preview1×/zoom125%/export1.25×, main/manual
locks, caption mapping, snapshots, autosave, sequential range rendering and quality
caps are preserved. Small model NOT downloaded or loaded; old models/captions remain.
No tests/lint/typecheck, runtime/browser/smoke/render/listening/ASR or AI/YouTube
verification. Combined Node22 `npm run package:mac:dev` succeeded, exit0. First
attempt stopped on sandbox-denied yt-dlp version-check semaphore; authorized
retry completed packaging/signing. No YouTube extraction/download request.
App: `release/dev/ShortCut Studio Dev.app`; final log:
`/tmp/shortcut-dev-editor-teaser-whisper-small-build-20261021-retry.log`.
Bundled whisper-cli/ggml backends/MIT notices exist; read-only hashes match packaged
speech/teaser/config modules to source. Only delivery docs changed after build.
This is packaging evidence, NOT functional/ASR/audio/AI qualification.
No app/worker restart or job
interruption, production/credentials/media/exports/backups changes, commit or push.
Do not confuse historical QA below with verification of this new source.

---

# Active update — restore original Header logo (2026-10-21)

Started clean on `recovery/visual-dev-reconstructed` at
`27625fe78dc5177f88355a6c98613d6407d02f09`. Header had replaced the original
brand asset with an `SC` text tile; `public/favicon.svg` itself was intact.
`components/studio-header.tsx` now uses that original red/white SVG, with
32×32 non-shrinking, aspect-preserving CSS in `app/globals.css`. Shared Header
remains outside workspace/panel visibility conditions. Read-only SHA256 comparison
matched the source SVG and the existing standalone/DEV package SVG: no missing
packaged asset was found. No new asset, application state or engine changes.
Source/diff review only; no tests, browser, render or provider calls. This logo
fix is included in the combined build recorded above; appearance remains unverified.

---

# Git delivery checkpoint — 2026-10-21

User authorized normal push of `recovery/visual-dev-reconstructed` to
`https://github.com/datdooo/short-video-studio.git`. Previous base13f3c90 matched
remote at inspection. This source checkpoint groups bounded render/resource work,
fixed260/300px columns +55/45 center, TSX black/orange UI, preview1× with zoom125%,
export1.25× and related docs/runtime manifest. Prior DEV build succeeded; functional
QA/performance/manual acceptance remain unverified. No tests/render/AI/build rerun
for this delivery. Source/index reviewed; secret/path scan found no matches in489
unique blobs before this documentation note. No media/music/credentials/build/cache
or recovery bundles staged. Available reconstructed history only; missing original
local checkpoints are not recovered. Use `git log -1` and remote refs for exact
checkpoint/push state; older sections below describe their original delivery time.

---

# Active update — fixed columns, unchanged speed/zoom (2026-10-20)

Read `docs/fixed-editor-layout.md` first. Source260px / Inspector300px, flexible
center; no resize handles or persisted panel dimensions. Narrow≤1050px uses
in-place drawers; footer stays outside overlay; mounted editor state preserved.
Preview RATE1, foreground VISUAL SCALE1.25, export RATE1.25 remain separate and
unchanged. No render/worker/plan edits in this layout turn. Same branch/base
HEAD13f3c90 with all dirty work preserved. Center now55% Preview /45% Timeline; source zoom125% unaffected. Source/diff
review only; no tests/QA/render/provider. Fixed-column build succeeded once before
incoming55/45 adjustment; final ratio build then succeeded, exit0. Current app:
`release/dev/ShortCut Studio Dev.app`; final log:
`/tmp/shortcut-dev-fixed-55-45-build-20261020.log`. Only delivery docs edited after
build; native packaging audits completed, no runtime QA. Prior fixed-column log:
`/tmp/shortcut-dev-fixed-columns-build-20261020.log` (superseded).
No app/worker shutdown or restart, no commit/push/merge.

---

# Active update — TSX black/orange UI + Preview1× (2026-10-20)

Same branch/base HEAD13f3c90, inherited dirty source preserved. New primary design:
`shortcut_studio_dev_ui_prototype_codex_handoff.tsx` from user Downloads, replacing
ZIP design. Read `docs/preview-1x-ui.md` first. Preview video/audition/playhead/
durations/music+ducking now1×, source timecodes unchanged; export/policy1.25×
unchanged. Existing effect clock adapter aligns phases to the same footage.
UI token theme black/charcoal/orange; existing real callbacks, drafts and jobs.
Only worker/music-preview.mjs and optional speed argument in music-audio changed
for preview. server/range-input/media-resources and render-lag fix unchanged from
turn start. Cache and draft clock versions prevent old1.25× mixes/playheads being
silently reused under new labels. New runtime config added to package manifest.
NO tests/QA/render/provider/YouTube. One combined Node22 `npm run package:mac:dev`
build succeeded, exit0. App: `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-tsx-preview-1x-build-20261020.log`. Current implementation is
packaged; only delivery docs edited afterward. No app/worker restart, commit,
push or merge. Old build records below are historical.

---

# Active update — approved prototype UI integration (2026-10-20)

Branch `recovery/visual-dev-reconstructed`, base HEAD
`13f3c90f28afb30a3e6e53c87d40695197914712`; inherited dirty render-resource/UI work
preserved. Read `docs/prototype-ui-integration.md` and
`docs/editor-workspace-layout.md` for current UI; `docs/render-resource-fix.md`
for the separately inherited UNMEASURED render fix. All66 worker modules match
pre-UI hashes; this UI turn does not edit worker/engine/FFmpeg/selection algorithms.
Header/workspace, real source/Generate, existing preview, active-part Timeline,
Inspector tabs and actual render status are wired without prototype mocks/types.
No tests, browser/smoke/render or provider/YouTube calls; user tests manually.
One combined Node22 `npm run package:mac:dev` succeeded, exit0. Current app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-prototype-ui-build-20261020.log`. It contains current implementation
including preserved render changes; only delivery docs updated afterward. Native
packager audits/signing completed, no app/worker restart, runtime QA or commit/push.
Keep historical build/QA records below distinct from this unverified new source.

---

# Active update — editor autosave / restore (2026-10-20)

Started clean at `9da73bed886f340f5e346e476f89b3ffa6a147f8` on
`recovery/visual-dev-reconstructed`. Current scope: `docs/editor-autosave.md`.
Versioned/bounded local editor draft, separate partial Timeline/teaser fields,
managed-source read-only restore, paused playhead, read-only job/batch reconnect,
interrupted browser-task notices, explicit “Phiên mới”. Passive restore guards
prevent automatic extraction/AI/render/subtitle/music preparation. Existing
source/plan/media/credentials and qualified previous implementations preserved.
No push, production changes or backups. NO tests/lint/typecheck, runtime QA,
render, browser automation or live AI/YouTube calls; user accepts manually.
Combined DEV build succeeded once: Node22 `npm run package:mac:dev`, exit0.
App: `release/dev/ShortCut Studio Dev.app`; build includes the current source
(only delivery docs updated afterward). Log:
`/tmp/shortcut-dev-autosave-build-20261020.log`. Native build/signature audits
completed as part of packaging; no launch or functional verification. Existing
running app was untouched. User first checks reload with partial inputs, paused
playhead, job/batch reconnect, missing/local source and “Phiên mới”.
No push. Use `git log -1` for the final commit SHA.

---

# Active update — consolidated source-timecode Timeline (2026-10-20)

Started clean on `recovery/visual-dev-reconstructed` at
`69db1cb236b7e2310828661f0c0ec639cce73893`; previous lifecycle/ChatGPT work preserved.
Read the new top section of `docs/custom-main-ranges.md`. Changes: per-part Teaser
before Main in one Timeline, shared source HH:MM:SS:FF30fps inputs, untouched AI
precision retained, Custom Teaser description/timestamp button inline, lock/restore colocated; Apply enabled for valid candidates; optional audition, no confirmation checkbox. Hook→Main selector moved near the first teaser,
shared two-part value preserved, constrained narrow-window layout. Vietnamese
explanation rules in existing ChatGPT/main/external requests; legacy notes retained
in plans with honest Vietnamese fallback display, no translation calls. No plan schema,
renderer, source/caption/BGM timing or queued-snapshot migration. New runtime file
`lib/source-timecode.mjs` and `lib/explanation-language.mjs` added to shared packager manifest. NO tests, QA/render,
browser or live AI/YouTube; user accepts manually. No push/production/backups.
Latest policy: BOTH parts must have valid teasers; main-only consent removed.
Shared readiness guards cover UI render/save, API before/after normalization,
queued execution, batch submit and resume; legacy plan loading still permissive.
No automatic fill at export. Visual Template stays in place, collapsed native
accordion, derived label/Custom; Background Current recipes untouched.
An initial combined build finished before these last user requirements could be
stopped. Final review also localized remaining batch fallback warnings; completed
intermediate packages are superseded by the final combined build recorded below.
No running app or unrelated process was stopped (build processes had finished).

Final delivery build: Node22 `npm run package:mac:dev`, exit0.
App: `release/dev/ShortCut Studio Dev.app`.
Log: `/tmp/shortcut-dev-timeline-final-build-20261020.log`.
Three package invocations completed during this turn: the first was superseded
by incoming mandatory-teaser/template requirements; final review also localized
batch warnings/memoized readiness, requiring the last build. Intermediate logs:
`/tmp/shortcut-dev-timeline-timecode-vi-build-20261020.log` and
`/tmp/shortcut-dev-timeline-required-teasers-build-20261020.log`.
Only the final app is current. Existing running DEV app was not stopped/launched.
No tests, lint/typecheck, browser automation, render, provider/YouTube calls or
manual playback/audition performed. Built-in packager native/signature audits
completed; runtime/AI compliance/layout acceptance is still unverified.

Manual acceptance: source60–70s displays00:01:00:00–00:01:10:00 and8s at1.25×;
invalid/partial/FF30 stays draft; untouched AI endpoints stay exact; Apply works
without audition/checkbox; both parts missing/invalid hooks block export/batch/
resume; repair each through Timeline; toggle template without changing style,
select a template and customize while it stays open; narrow-window Hook→Main
control and optional source audition; new AI explanations Vietnamese while source
quotes/title/subtitles/hashtags remain original. No old outputs/history deleted.

---

# Active update — preview source ownership + ChatGPT teaser revision (2026-10-20)

Started clean at ca4c3c5bd4bb534a6defdcecc1f3c17a466daef9 on
`recovery/visual-dev-reconstructed`. Read `docs/preview-source-lifecycle-fix.md`
and the latest section of `docs/per-part-teaser-hooks.md`. Source fixes cover
mutable preview-ref ownership, stale callbacks/requests/BGM on source change,
and part-arc/curiosity candidate/evidence selection with ChatGPT default and no
silent heuristic winner. Earlier H/I/J/F changes remain intact. No tests, browser,
render, live AI/YouTube or music audition permitted/performed. Combined Node22 `npm run package:mac:dev` succeeded once, exit0. App:
`release/dev/ShortCut Studio Dev.app`. Build log:
`/tmp/shortcut-dev-preview-lifecycle-teaser-build-20261020.log`. This includes the
current implementation below; only delivery documentation changed afterward.
No launch/listening/runtime qualification. No push authorized. User first checks
source-switch crash and ChatGPT Retry/Custom/no-teaser behavior. Use `git log -1`
for the final checkpoint SHA; no unrelated work or old QA was repeated.

---

# Active checkpoint — canonical Custom Time and gentle music (2026-10-20)

Branch `recovery/visual-dev-reconstructed`, clean starting HEAD
`3708a4d4c830e010ba6e7ab527515a7e5c91b2a9`. Actual final HEAD: `git log -1`.
Read `docs/custom-main-ranges.md` and `docs/gentle-music-expansion.md` for this scope.
H/I/J source is implemented: canonical per-part main segment rows, exact manual
range application, AI restore checkpoints, lock handling, explicit invalid-teaser
review, removal of cut-details/Pipeline and Reset demo. F source/import is added;
actual acquisition:32 new MP3 assets (86 total),28 gentle/general-use,
212.76MiB library growth and212.71MiB downloaded,0 errors,0 auditions. No audio
is versioned/bundled. Combined DEV build status is recorded in the scope docs. Earlier A–G/QA evidence is not new functional proof.

User performs manual acceptance. NO tests, QA render/browser automation or live
AI/YouTube campaigns. Only source/diff review, authorized real music acquisition
and one final combined DEV package build. No push, new bundle, production,
credentials, backups or prior source/media/export deletion. Existing app left running.
Combined DEV build succeeded once (Node22 `npm run package:mac:dev`, exit0).
App: `release/dev/ShortCut Studio Dev.app`; same final source below plus docs.
Local log: `/tmp/shortcut-dev-main-ranges-gentle-music-build-20261020.log`.
No app launch, listening or functional QA. Next action: user manual acceptance;
do not restart implementation or automatic QA. Pending audit concerns in the
historical handoff remain unresolved/out of scope.

---

# Codex handoff — 2026-10-20 (Asia/Saigon)

## Verified Git / safety

- Repository: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`
- Branch: `recovery/visual-dev-reconstructed`
- Local implementation HEAD before this documentation checkpoint:
  `19be62910a26835a16702b63a60c94e061d6024b`.
  After handoff commit, use `git rev-parse HEAD`; implementation is unchanged.
- Origin: `https://github.com/datdooo/short-video-studio.git`
- Upstream: `origin/recovery/visual-dev-reconstructed`.
- **Remote read directly with git ls-remote during handoff:**
  `d0eae09bc97d6fdc7a399ee64e63ad1abf147cac`.
  `124a635`, `19be629` and this handoff are NOT pushed. No push during handoff.
- Initial `git status --short` and diff were empty. No inherited or unfinished
  source edits exist at handoff; only this document is being added/committed.
- Work ONLY here. Node22: `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- DEV ports 5273/8887; app/data identity ShortCut Studio Dev. Do not touch
  production 5173/8787, `/Applications/ShortCut Studio.app`, other projects,
  credentials/Keychains, media/exports, recovery bundles or backups.
- Do not repeat Git recovery: original missing local history remains unavailable.
  No reset/clean/checkout overwrite/stash/force-push/merge or automatic deletion.

## Binding execution policy

**User does manual acceptance. NO tests, QA, render, browser automation, live AI/
YouTube calls or provider campaigns.** Finish scoped source, review diff, then build
DEV ONCE after combining the outstanding changes; fix build errors if any. Do not
build merely for handoff or push. No new bundle/large backup. Do not claim new
functional qualification from old reports or successful packaging.

## Commits made in this conversation

| Commit | Purpose | Publication |
| --- | --- | --- |
| `9ae42dd` | Foreground transition atlas/compositing, two-deck preview, per-part Custom Teaser, Bright Social Current, credit UI removal | Pushed |
| `d0eae09` | Output metadata/chapter suppression, legacy-output/resume safeguards | Pushed; verified remote SHA |
| `124a635` | All eight template background IDs → Current; other fields unchanged | Local only |
| `19be629` | Remove entire selected-track information card under Music Panel | Local only |

No source changes/downloaded audio were made after `19be629`. Music expansion and
Custom Time requests below were only inspected/researched when quota stop arrived.

## Latest app: built versus verified

- `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app`
- Latest build: Node22 `npm run package:mac:dev`, exit 0, source subsequently
  committed as `19be629` (only handoff documentation changed after that build).
- Local log: `/tmp/shortcut-dev-remove-music-card-build-20261020.log`.
- Lightweight byte comparisons during handoff matched packaged versus current
  `worker/server.mjs`, `worker/export-metadata.mjs`, `lib/visual-style/templates.mjs`.
  Frontend provenance follows the recorded build; full bundle equivalence was not
  independently inspected. No new app launch/smoke/playback/export was performed.
- App includes B/C/E/G and A implementation below; **does not include F/H/I/J**.
- Existing app/processes were left alone; no QA/download/import process remains
  running from this work. Public listing HTML fetches completed. No music downloaded.

## Requirements ledger — source evidence is NOT acceptance

| ID | Source/build state | Evidence / remaining work |
| --- | --- | --- |
| A transitions | Source changed, built; smoothness/MP4 scope NOT verified | `components/cut-transition-panel.tsx`, `lib/visual-style/foreground-transitions.mjs`, `lib/preview-decks.mjs`, `components/preview-background.tsx`, `worker/cut-transition.mjs`, `worker/server.mjs:renderPart`. All existing effects below decorations/text and before background composition; shared atlas/clock, alpha mask, two preseeked decoders, independent audio concat. Runtime frame/AV continuity and VR appearance remain user acceptance; no Adobe parity claim. |
| B Current backgrounds | Source complete, built; manual acceptance pending | `lib/visual-style/templates.mjs`: all eight recipes use `current`; application handler unchanged. Old effective styles are not migrated and can derive Custom. Manual background control retained. |
| C Custom Teaser | Source implemented, built; new UI/inference unverified | `components/teaser-editor.tsx`, `lib/custom-teaser.mjs`, `worker/teaser-selection.mjs`, `app/page.tsx:resolveCustomTeaser`. Exact timestamp no AI; description uses existing ChatGPT selector with strict match/unavailable; explicit audition/confirm; same-part/no gaps/first10s exclusion/9s max, >=0.5s technical floor, no forced5s. No current provider call was performed. |
| D BGM preview | Lifecycle implementation present/built; both-part audible workflow NOT established | `components/music-panel.tsx`, `lib/music/preview-playback.mjs`, `worker/music-preview.mjs`. Preparation/play/error, autoplay recovery, mix identity/invalidation and canonical active deck ref implemented. Prior reports are not proof for new deck changes. |
| E music card | Source complete, built; no fresh UI acceptance | `components/music-panel.tsx`: entire trailing selected-track card removed at19be629; credit textarea/copy already removed. Selectors/import/audition/volume/ducking untouched; metadata retained internally. |
| F +30–50 gentle tracks | **UNIMPLEMENTED: 0 new audio downloads/imports** | Existing DEV library has54 assets; see research and next steps below. No new group/order implemented. |
| G export metadata | Source implemented, built; actual MP4 NOT inspected | `worker/export-metadata.mjs`, server common `renderPart.buildArgs`: output `-map_metadata -1 -map_metadata:s -1 -map_chapters -1 -sn -dn`, only [vout]/[aout], technical encoding/color/faststart preserved. `render-resume.mjs` and server require new history-only policy marker; unknown/legacy files cannot be adopted/overwritten, require NEW job. Old downloads/history remain untouched. No untraceability claim. |
| H multi-range Custom Time | **UNIMPLEMENTED** | Current UI still collapses each part to outer start/end via `partTimes`, with separate `customTimes` override. Must replace with actual main segments; details below. |
| I remove details/Pipeline | **UNIMPLEMENTED** | `app/page.tsx` still contains details block, cards, both duration rows and Pipeline/mock; remove presentation only. |
| J remove Reset demo | **UNIMPLEMENTED** | Button still at end of editor aside. Remove JSX and now-unused RotateCcw; Settings2 becomes unused after I. Keep mockPlan used by initial state/Mock provider. |
| K source push | Verified through d0eae09 only | Prior review:462 tracked files +2 outgoing commits, common secret-pattern scan and forbidden paths found no candidates; no media/build/dependencies uploaded. Later local commits NOT re-published. Before any future authorized push, recheck outgoing history/tree and remote ancestry; no force. |

## First next coding task: H + I + J (keep scope)

Read only targeted files first:

1. `app/page.tsx`: `timing`/`previewPlan` around400; `customTimes`/setters; Custom
   Time around1903; Custom Teaser onChange around1970; details block around2038;
   Reset demo near2108. `startRender`, `chooseTeasers`, `replacePlan`, `analyze`,
   `applyWebAiResult`, batch edit/load/save are related snapshot boundaries.
2. `lib/custom-time.mjs` + `.d.mts`, `worker/part-start.mjs`, `worker/smart-cut.mjs`,
   `lib/edit-plan.ts`, `worker/plan-validation.mjs`, `lib/auto-cut/locks.mjs`,
   `worker/auto-cut-workflow.mjs`, `lib/auto-cut/main-content.mjs`.
3. Current Custom Time is only outer-window trimming and can extend edges; it is
   unsuitable as the new multi-range editor. Do not bridge removed gaps. Rendered
   list must be canonical `part.segments` main entries, excluding teaser and padding.
   Invalid/blank UI drafts must not enter effective segments; show row errors and
   block submission while retaining last valid preview. Do not silently sort/snap.
4. Add/remove/edit each part's ranges using exact typed source times; set existing
   startTrimApplied/smartCutApplied appropriately so worker does not trim1s/snap
   manual edits again. Preserve source bounds/order/non-overlap and existing
   duration rules, padding behavior, manual locks and independent queued snapshots.
5. Retain the latest real AI/Smart Cut ranges as a per-part restore checkpoint
   (design NOT implemented). Restore only that part on “Dùng lại bản cắt AI”.
   Keep lock checkbox. Every downstream consumer uses the same effective segments:
   preview/export/captions/teaser eligibility/music/ducking.
6. Current `applyPartTimes` can choose fallbackTeaser after a main change. New
   behavior must instead explicitly flag invalid teaser for reselection, never
   silently choose a replacement. Ensure validation/reselection routes remain usable.
7. Remove whole details/Pipeline block and Reset demo JSX. Keep player/timeline,
   other reset mechanisms and internal analysis data. Explanation must be exactly:
   “Mặc định theo bản cắt AI. Thêm, sửa hoặc xóa từng đoạn để tùy chỉnh; mốc chỉnh tay được dùng nguyên khi xuất.”

## F music acquisition — research already done, no audio installed

- DEV library (read-only measurement):
  `~/Library/Application Support/ShortCut Studio Dev/media/music`:
  **54 assets,256293583 bytes (~244.42 MiB)** including metadata. Existing moods
  include acoustic/vlog, relaxed/lo-fi, action, suspense etc. Last measured free disk74GiB.
- Reuse `worker/music-library.mjs:createMusicLibrary().import` (SHA256 duplicate
  detection, compressed retention, normal import probe/decode,128 tracks/1GiB cap).
  `scripts/install-personal-music.mjs` demonstrates DEV-only import but its older
  Incompetech80-track acquisition/resume strategy is NOT suitable to rerun blindly.
- New user goal:30–50 **actual new files**, <=~300MiB new downloads; >=70% gentle/
  general-purpose, no known vocals/rap/voice samples; preserve current tracks and
  selection. Un-auditioned stays `auditioned:false,instrumentalVerified:false`.
  Metadata genre screening is not listening evidence. No Content ID guarantee.
- Put “Nhẹ nhàng / Đa dụng” first in UI group ordering without replacing selection.
  `components/music-panel.tsx` derives group order from asset list; sorting group
  labels locally or library list can do it. Preserve search/audition/audio handlers.
- Official sources inspected:
  - FreePD.com is CLOSED; do not use unverified mirrors as official sources.
  - Mixkit permits commercial social video use/no credit but its terms prohibit
    scripts/bots mass downloads. **No Mixkit audio downloaded**. Do not bulk scrape.
    https://mixkit.co/terms/ ; https://mixkit.co/license/modal/musicFree/
  - Promising **composer-direct** source: Liborio Conti,
    https://www.no-copyright-music.com/relaxing/ and /corporate/ .
    License https://www.no-copyright-music.com/wp-content/uploads/2023/03/LiborioContiLicense.pdf
    expressly allows commercial/monetized video and no required attribution;
    prohibits music redistribution/Content ID ownership claims. Keep audio local,
    never Git or bundled. Do not repeat the site's absolute no-claims marketing.
  - Official relaxing page HTML already saved at
    `/tmp/shortcut-liborio-relaxing.html`;72 MP3 URL entries observed, NOT72 approved
    tracks. Parse playlist `<li data-audiopath=... data-trackTitle=... data-artist=...
    data-trackTime=...>`; playlists also include bilateral/432Hz/long tracks, so
    curate suitable normal short gentle tracks, do not import all. Library max600s.
    Example observed URLs use composer `/wp-content/uploads/2021/09/*.mp3`.
  - `/tmp/shortcut-mixkit-calm.html` is public listing HTML only, not audio.
- Next: choose bounded subset from legitimate source; save source/license/date/hash
  internally, stream/import sequentially with total byte budget/cancellation,
  remove only task-owned intermediate downloads after successful import. Imports
  write outside repository to DEV data, requiring tool escalation under sandbox.
  User authorizes actual download/import, not tests/QA/render/browser campaigns.
  Record actual successful new count and byte delta; no false audition claims.

## Open audit concerns — not fixed here

- Origin: server guards `/api/chatgpt/` only; general CORS reflects origin or '*'.
  Broader local API write protection is incomplete (`server.mjs` ~283/~1657).
- Visual teaser evidence is bounded to selected candidates;
  `candidateFrameTimes` in `lib/teaser-candidates.mjs` and selector's frame call.
  Do not claim every candidate/action had video understanding.
- Gemini/Muse freshness: client `chooseTeasers` can return early for syntactically
  valid hooks before external freshness validation; customTeaser branch in
  `externalHooksCurrent` intentionally skips external key check. Some queue paths
  guard freshness; complete coverage is unproven. Audit both editor and batch.
- Shared pending teaser promise (`worker/teaser-selection.mjs`) is keyed by input,
  but request cancellation is not independently owned by each subscriber.
- Compressed music imports retain file and set durationLoop=duration; unlike FLAC
  conversion they do not run seamlessMusicFilter. Seamless loop joins unproven.

These are pending findings, NOT newly authorized broad feature work. Preserve and
report them; do not silently claim resolved or expand into provider campaigns.

## Resume/build instructions

Read this file, verify Git/status and latest user steering, then finish H/I/J and F
from current implementation. Do not rerun old RC/recovery/research wholesale.
Only after combining source changes and reviewing diff:
`PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev`.
Build failure: fix and retry. User performs all real/manual acceptance. Keep running
DEV app untouched unless instructed; close it normally before opening newer app.
