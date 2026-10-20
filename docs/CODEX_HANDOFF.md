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
