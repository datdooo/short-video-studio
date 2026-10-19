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
