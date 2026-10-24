# Beta UI / render progress review — 2026-10-24

Checkout `short-video-studio-beta`, branch `beta/maintenance`, HEAD
`0708d250a98a252996b3f2f41ba66d433301547a` (app build 1104).
All preceding uncommitted project-sweep changes are retained. This pass is
source-only; it does not replace or launch an app.

## Research and application

Used web search and primary sources rather than copying a generic UI redesign:

- [W3C progress status technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA25):
  native progress semantics and a separate short status message; avoid announcing
  a per-second elapsed timer as a new live status.
- [Radix Progress implementation on GitHub](https://github.com/radix-ui/primitives/blob/main/packages/react/progress/src/progress.tsx):
  determinate values are bounded; unknown progress is distinct. The app retains
  its native progress and existing worker values, with no dependency added.
- [MDN min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/min-width):
  intrinsic flex/grid minimum widths can cause overflow. Current app progress
  already uses minmax(0,1fr)/max-content, min-width:0 and a nowrap numeric slot;
  those healthy rules are retained.
- [W3C modal dialog keyboard pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
  [MDN inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert),
  [Radix dialog source](https://github.com/radix-ui/primitives/blob/main/packages/react/dialog/src/dialog.tsx):
  the existing pointer-blocking narrow drawer also needs background keyboard
  isolation, a dialog name, bounded Tab movement and focus restoration.

## Findings fixed

| Finding in source | Fix / file |
| --- | --- |
| Prepare-source button includes %, followed by TaskProgress showing the same % | `app/page.tsx`: button names the step only; TaskProgress owns the one numeric label |
| `cancelled + stopping=true` is shown as already stopped; footer hides Cancel and permits Render while cleanup is active | `render-progress.tsx`, `studio-render-status.tsx`: present Đang dừng, keep controls disabled until the existing stopping flag clears |
| Batch/GET-job responses omit the stopping flag used by Editor render-list responses | `worker/server.mjs`: reuse renderSnapshot for these public views only. No job state, queue algorithm or counter changes |
| Batch polling ends at cancelled while worker can still be cleaning up | `app/page.tsx`: continue the existing poll while any job.stopping is true; preserve batch.finished semantics |
| Batch counts a still-stopping cancellation as ended and can display100 prematurely | `batch-progress.tsx`: derive ended/cancelled/stopping from existing state/flag; show success/error/cancel separately; remove duplicated item-ended label |
| Render text invents Part1 before currentPart is known | `render-progress.tsx`: show Chuẩn bị render; retain actual validating/publishing names and total-job percentage |
| Long FFmpeg error is inline in the compact footer | `studio-render-status.tsx`: one short error state plus collapsed Chi tiết containing the full error; scoped CSS preserves line breaks/wrapping |
| Stronger desktop rule max-height76px overrides the existing mobile60px rule | `app/globals.css`: remove only the redundant stronger max-height, keep desktop/mobile grid and sizes |
| Per-second timer lives inside a live status region; numeric estimate lacks explicit programmatic wording | `task-progress.tsx`: linked native progress label/details and estimated value text; live status contains the step label, not every elapsed second |
| Narrow drawer backdrop blocks pointer but Tab can reach background buttons | `editor-workspace.tsx`: temporary background inert, dialog name/semantics, Tab boundary and cleanup focus restoration; mounted source/Inspector drafts remain |

Every progress bar retains one visible numeric slot. Render remains FFmpeg
output-time divided by total planned output duration; it is labelled toàn tác vụ.
Batch is ended items/total, not an average of arbitrary phase percentages. No
new counter, estimated render speed, timer-generated percent or AI request added.
100 remains reserved for completed/persisted output (or all ended Batch items).

## Read and deliberately retained

- Current progress grid/nowrap rules do not show a code-level duplicate percent
  or broad-span collision in render cards. No claim that an unobserved screenshot
  overlap was reproduced; current runtime still needs inspection.
- Inspector equal tab cells, long Select wrapping/available-size bounds, icon
  input padding, Kho search focus bounds, one-scroll library layout and card
  action wrapping already have relevant fixes. No blanket button/CSS rewrite.
- Generic dialog/menu primitives without production callers were not changed.
- Main/teaser logic, model/reasoning, media data, output quality, layout zones,
  button size system and all previous source changes remain.

## Acceptance still required

Only source/research/diff review and `git diff --check`. No tests, lint/typecheck,
browser automation, build, AI, download, ASR or render. App1104 is unchanged.
No source commit, push/merge, credential or user-data mutation.

Manual checks after a deliberate build: Editor/Batch/Kho at narrow and wide
widths; long job/source/provider names; preparing/running/validating/publishing;
completed, error, Cancel and process cleanup; one visible % per bar with correct
scope; footer controls reachable with a long error expanded. For the drawer,
check Tab/Shift+Tab, Escape, nested Select/Popover, breakpoint changes and draft
retention. Nested portal/focus behavior, actual pixel overlap and screen-reader
announcements have not been verified at runtime.
