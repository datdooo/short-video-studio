# Custom Time: canonical main-range editing

2026-10-20. Base3708a4d, branch recovery/visual-dev-reconstructed. Source changes
only until the final combined DEV build below; manual acceptance is pending.
No test, QA render, browser automation or provider call was performed.

## Effective data

Custom Time lists each non-padding `part.segments` entry in order, for both parts.
A–B–C with B excluded is two rows A,C; no outer-window range, merged gap, teaser
prefix or implicit reintroduced footage. Existing padding stays separate and is
not an editable main row. All downstream preview, captions, teaser bounds,
BGM/ducking, duration and render consumers use ordinary effective segments.

`lib/main-ranges.mjs` owns parsing/validation/apply/restore. The existing outer
`lib/custom-time.mjs` helper remains for compatibility with old internal callers
and historical tests, but the editor no longer imports it or maintains customTimes
as a competing range state. Raw unfinished strings live only in MainRangesEditor;
they never enter a saved plan/render request. The last valid canonical segments
remain in the player while invalid drafts block analysis/export/batch submission.
Errors are shown inline, including empty ranges, ordering/cross-part overlap,
source bounds and existing >60s rule for non-manual/non-mock plans (padding counts
under the existing rule). Max200 editable main rows/part; no sorting or snapping.

Valid edit/add/delete commits numeric SOURCE seconds exactly as entered (decimal
seconds, MM:SS or HH:MM:SS). Existing endpoints are displayed as unrounded numeric
seconds so editing one row does not round another AI range. At least one valid
main row is required. Manual changes lock the edited main by default; the checkbox
can explicitly unlock it for future analysis. `startTrimApplied:true` and
`smartCutApplied:true` prevent one-second trim/Smart Cut moving the manual input.
Existing AI/Smart Cut output is already final. Legacy editor plans missing the
Smart Cut marker use the currently displayed retained ranges as final; they are
not secretly resnapped only when exporting. Persisted historical/queued jobs are
not migrated or mutated by opening/changing the editor.

`aiMainRanges:{version:1,ranges:[{start,end,label,reason}]}` is a restore checkpoint,
not a render configuration. New genuine AI/external results capture their exact
main segments; unmodified legacy AI editor plans can capture their current effective ranges.
For old locked/customized plans without an existing checkpoint, original AI ranges
cannot be recovered honestly; restore stays disabled rather than inventing them.
Manual/Mock and deterministic fallback do not pretend to provide a new AI backup.
`mainEdited` tracks manual main edits. Locked parts and their original restore
checkpoint survive analysis. The worker validates the optional snapshot/flags;
queue/history retain them through existing plan copies. “Dùng lại bản cắt AI”
restores only that part, validates it against the other current part/source, keeps
padding and does not call AI. Restore can fail explicitly if ranges now conflict.
A newer AI result for an unlocked part replaces its restore checkpoint.

## Teasers

A main edit never generates a replacement teaser. If the exact current excerpt
still passes same-part/first10-rendered-seconds/length/evidence validation, its
bounds stay unchanged and its range binding updates. Otherwise it becomes an
explicit unavailable result with `teaserNeedsReselection:true`; the editor asks for
reselection. Externally imported hooks require a fresh external binding after a
main change. Custom Teaser input metadata remains available for deliberate review.
No queued job snapshot is changed. Explicit selection/Auto/reimport clears the
review flag; export without an eligible teaser retains the main only.

## Presentation cleanup

The editor removes all “Chi tiết bản cắt” cards/cue quotes/labels, its two duration
rows, and Pipeline/provider badge/step list. Player/timeline and other useful
controls remain. Reset demo plan JSX and its RotateCcw import are removed;
Settings2 was used only by the removed Pipeline. mockPlan remains because initial
state and the explicitly selected Mock provider still use it. Existing-plan main
editing is only in Custom Time; the Manual tab's timestamp creation form is shown
only before a plan exists, with a pointer to Custom Time afterward.

Explanation shown exactly:
“Mặc định theo bản cắt AI. Thêm, sửa hoặc xóa từng đoạn để tùy chỉnh; mốc chỉnh tay được dùng nguyên khi xuất.”

## Manual acceptance (user)

- Load an AI plan with exclusions: each retained main range appears separately;
  verify preview/export/caption/music mapping; padding and repeated teaser absent
  from the main row list.
- Edit/add/delete ranges, including blank/invalid/out-of-source/overlap/short-part
  drafts. No invalid draft should be exported or automatically corrected.
- Confirm typed endpoints remain exact through save/restore/new-job export and
  no extra one-second trim/snap occurs. Old queued job content stays independent.
- Lock one part, regenerate deliberately, restore only the other part's latest AI
  ranges. Changing main should retain a still-valid teaser or explicitly ask for
  reselection; never substitute another excerpt invisibly.
- Confirm details/Pipeline/Reset demo are gone and playback/other controls remain.

## Build

PASS: one combined Node22 `npm run package:mac:dev` invocation completed with
exit0. Output: `release/dev/ShortCut Studio Dev.app`. Build log (local, not tracked):
`/tmp/shortcut-dev-main-ranges-gentle-music-build-20261020.log`.
Frontend/native launcher/runtime packaging and packager signing completed. No
app launch, test, standalone lint/typecheck, QA render, browser automation or AI/
YouTube verification followed. Build success is not functional qualification.
User manual acceptance is pending; current app was not interrupted.
