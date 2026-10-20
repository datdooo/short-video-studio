# Timeline — source timecodes (2026-10-20 update)

Supersedes the display/edit UI described historically below. Starting HEAD
69db1cb236b7e2310828661f0c0ec639cce73893, same DEV reconstruction branch.

Timeline groups EACH part as Teaser first, then ordinary main segments, main-only
Add/Delete, lock and AI restore. Custom Teaser description/timestamp/Auto and cached alternatives are directly
under the teaser row, with “Tạo/chọn lại teaser”. Valid pair edits and button results create a candidate in that same row.
“Áp dụng teaser” is enabled as soon as technical validation passes. Listening/
viewing is optional, with no confirmation checkbox or watched-state gate. No duplicate timestamp pair or Custom Teaser section elsewhere; optional candidate
audition uses exact source positions and is released on replacement/unmount. No second teaser
timestamp editor. AI/main padding remains separate. Teaser still duplicates its
original occurrence; it never removes/reorders main footage.

`lib/source-timecode.mjs` shares strict non-drop30fps SOURCE `HH:MM:SS:FF`
parse/format/validation (MM/SS00–59, FF00–29). Speed is never part of parsing or
seeking. E.g.00:01:00:00–00:01:10:00 means source60–70 seconds, rendered8 seconds
at1.25×. Rendered duration is labeled separately. Audition seeks the exact numeric
source start and plays at existing1.25×.

Display projects sub-frame AI endpoints onto the30fps grid. UI-only `exactStart`/
`exactEnd` retain original doubles on each untouched boundary. Editing one boundary
clears only that boundary's precision token; no other endpoint is quantized. These
tokens/draft strings never enter plan segments or job snapshots. Main restore also
preserves original numeric boundaries. Legacy numeric plan/history/custom-input
metadata remains accepted; loading doesn't migrate cuts. New manual timecodes are
used exactly, without one-second offset, Smart Cut or output-time conversion.

Incomplete/invalid input remains draft and reports locally. Main invalid drafts
retain the prior canonical preview and block submission as before. Incomplete/invalid teaser drafts retain the saved teaser. Valid explicit
timecode edits use the existing manual-range validation and enable Apply. Applying updates the same Timeline row.
Description input uses the existing ChatGPT selector on a deliberate button click;
if unavailable, it reports the issue without substituting another excerpt. Legacy
custom-input strings still load; untouched projected text retains its original
precision, while newly entered timestamps must use HH:MM:SS:FF. Same-part/no-gap/first10 rendered main seconds/max9 rendered seconds/speech
boundary rules reuse existing helpers. Main edits explicitly flag an invalidated
teaser for reselection, never generate another. All consumers still use numeric
`part.segments` and `part.teaser`; no new rendering or persistence system.

## Required-teaser export policy (latest requirement)

Both parts MUST have selected, technically valid teasers before new export.
`teaserReadiness` / `requireBothTeasers` is shared by UI and worker. It checks
selected state, main-change review flag, exact main binding, same retained range,
first10 rendered main seconds, source duration, <=9 rendered seconds and known
speech boundaries. No main-only consent/checkbox or automatic fill at render time.
Timeline names each blocking part and keeps its AI/custom controls. The render
button and edited-batch submission are disabled/guarded. API input, post-trim/
Smart Cut plan, queued execution, idempotent submission, batch preparation,
approved batch-plan submission and resume all enforce `validateRenderPlan`.
Missing hooks put batch items into review-required instead of exporting silently.
Resume of a saved incomplete plan rejects and requires editor repair; initial
source acquisition/analysis can still run bounded selection before render.

Generic `validatePlan` still allows missing hooks for old plan loading, editing,
analysis and preview; no history/source/output file is deleted/migrated. Existing
render snapshots are never filled or rewritten. Completed files stay accessible;
incomplete old jobs cannot render/resume until explicitly repaired in a new plan.
Source and source captions govern server checks; UI uses its current caption track.

Visual Template remains in the same result column, now native keyboard-accessible
`details` collapsed initially with derived template label/Custom and chevron.
Toggle never calls application handlers; selecting a card keeps it open. All
existing Background Current recipes and customization stay unchanged.

Worker runtime manifest includes the new shared timecode module. Only source/diff
review and the combined DEV package build are authorized. No tests, render, browser,
provider calls or runtime acceptance; user manual checks remain pending.

Hook→Main selector is moved inside Timeline next to the first teaser (shared for
both parts), with a separate label/note distinguishing ordinary internal cuts.
Existing select had long option labels, only a generic fixed-height input class,
no explicit min/max width, padding or select typography; it lived far from the
teaser. New block layout has min-width0/max-width100%, explicit font/line-height/
padding, shorter labels and no clipping wrapper. Values/handler and foreground
render scope are unchanged. Narrow-window appearance remains user acceptance.

Manual checklist: inspect split AI ranges; edit one boundary and verify untouched
sub-frame endpoints; type partial/FF30/overlap/oversize teaser; restore one part;
enter60–70-source-second teaser and see8s rendered; manually preview/save/export a
NEW job manually; confirm old queued jobs and the main occurrence remain intact.

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
review flag; old main-only output records remain readable; new export now requires two eligible teasers (see latest policy).

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
