# DEV editor changes — 2026-10-20

Branch: `recovery/visual-dev-reconstructed`; clean starting HEAD:
`dfc141641bc2ad9b2d55026a445f02c3816442f0`. Resolve the resulting checkpoint
with `git log -1`; no push/merge. Historical qualification reports remain unchanged.

## Delivery and verification policy

The user's latest instruction explicitly cancels further automated tests, lint/
standalone typecheck, browser/smoke/render matrices and live AI/YouTube verification.
Only implementation, source/diff review and one integrated DEV package build are
requested. No task-created QA process remains running. A successful package build
is NOT functional qualification. Manual acceptance remains pending for all changes.
Package result is recorded below after the build finishes.

## Transitions and playback

Source inspection found a full-canvas preview veil, post-layout Dip/Flash export
filters and a scene-wide Rainbow path. Preview sought the current decoder at each
cut; export used AV concat (whose longest-stream rule can pad video) plus per-range
fps conversion and explicit cloned EOF padding. These are code-level findings;
none is a newly reproduced or measured cause of stutter in this delivery.

- All five existing IDs (None, Dip, Flash, Rainbow, Warm) are available for internal
  cuts and hook→main. One original v3 atlas, shared output-frame windows and phase
  quantization drive preview and export. Dip/Flash use sine-squared easing; leak
  variants have eased light movement and a bright core at the cut, without added
  timeline duration. None supplies no effect. Legacy hook transition inheritance
  remains available; choose explicit Hook→Main None for a direct hook cut.
- Effect processing follows crop/scale/pad, preserves foreground alpha and precedes
  background composition, decorations, titles, part labels and subtitles. Preview
  clips to the same even-size visible source geometry. Alpha padding is excluded.
- The atlas is 864×5130 (four columns, 19 frames each), shared across IDs, with no
  per-pixel UI work. No Adobe assets/code have been copied. Warm remains an original
  approximation; Adobe parity and final appearance are NOT claimed.
- Preview reuses two foreground decoders: one plays and one pre-seeks the next
  retained range. Handoff swaps the canonical video ref used by music. The blurred
  background copies the active decode to a small canvas instead of a third decoder.
  Cancellation, pause/seek, source changes and unmount release pending preparation.
  Actual decoder waits are exposed as buffering; zero stutter is not promised.
- Export assembles shifted retained-frame timestamps with interleave and one
  final-output 30fps conversion, independently concatenates audio, then composes
  the scene. No explicit cloned frame padding, AV-concat silence/video padding,
  crossfade, speed change or cut/range change is introduced. Source speed remains
  1.25×. Subtitle image durations and title animation clocks follow this earlier
  speed conversion; audio/BGM/ducking retain their existing timeline and gain rules.
  Frame continuity, audio tail, preview synchronization and FFmpeg runtime behavior
  require user testing; no MP4 was generated for this delivery.

## Bright Social

Only `backgroundPresetId` changes from `soft-gradient` to the existing `current`
preset on new application. Font/text/filter/overlay/animation and other effective
fields are preserved. Saved effective styles are not migrated. Old Soft Gradient
recipes can derive Custom; manual background changes remain available.

## Per-part Custom Teaser

The existing TeaserEditor now owns one input/proposal/confirmation flow per part.
Applied metadata: `customTeaser: {version:1, mode:'timestamp'|'description', input}`.
The ordinary `part.teaser` remains the effective range and render contract.

- Exact source timestamps (seconds, MM:SS or HH:MM:SS, optional milliseconds) never
  call AI, never snap or silently shorten. Invalid syntax/ranges show a reason.
- One retained same-part main range, no excluded gap/padding, first 10 rendered-main
  seconds excluded, 9 rendered-second maximum (11.25 source seconds at 1.25×),
  existing ≥0.5-second technical floor, known speech-cue boundaries enforced.
  No artificial five-second minimum. Semantic/action completeness still needs
  the user's explicit audition/confirmation; cue boundaries are not proof.
- A description calls the existing connected ChatGPT selector for this part only,
  supplying the strict request, permitted ranges, existing transcript/context and
  bounded evidence. It must select real matching footage or return unavailable;
  no unrelated deterministic fallback is applied to a failed custom search.
  No new provider/endpoint, classification service or subscription is added.
  Actual authenticated inference for this UI is untested in this delivery.
- Prepare shows exact timestamps, reason and source preview at 1.25×. Listen/watch,
  check the completeness confirmation, then “Áp dụng teaser”. Input/proposal changes
  do not change the active plan. “Về Auto”/empty prepared input clears only this
  part's custom override and uses the existing selector (including honest unavailable
  results). Applied custom state survives Generate when main ranges are unchanged;
  changed main requires explicit custom review rather than silent replacement.
- Main ranges/manual locks, content, captions, visual style, music and transitions
  are not replaced by custom application. In-flight stale proposals are cancelled
  or rejected. Cache identity includes the custom request independently of style.
- Existing plan/history/job snapshots carry the custom metadata and ordinary
  independent teaser object. No persisted plan or queued snapshot is migrated.

## Music credit UI

Removed the “Cần credit khi xuất / đăng video” block, credit textarea and Copy
credit button. Source/license/attribution metadata remains in the local catalog
and managed library. No automatic credit insertion into video or caption was
added; music selection, gain, ducking and mix/preview/export code is unchanged
by this UI-only removal. Metadata retention does not alter track licenses.

## Short manual acceptance checklist

1. Close the previous DEV app normally; open the new app in `release/dev` (never
   install into /Applications). Load a moving horizontal source and a vertical/
   small padded source with contrasting background, text/subtitles and overlay.
2. Play each transition at hook→main and several distant internal cuts; seek,
   pause/resume, switch parts/workspaces. Compare None and each effect in preview
   and MP4: only actual foreground pixels change, no extra freeze/black seam;
   source speech, BGM/ducking, subtitles, duration and audio tail remain synchronized.
3. Select Bright Social afresh: Background Current; edit background manually and
   reopen an older plan/job to confirm no migration.
4. Try valid exact timestamps, an opening-overlap, >9s and gap-crossing range in
   each part. Prepare/audition/confirm, then description with real ChatGPT access,
   an unfound request, and Về Auto. Other part/main/locks/style/music stay unchanged.
   Save/restore/queue and edit editor afterward: queued snapshots remain independent.
5. Select/preview music, change gain and ducking, export: no credit UI or automatic
   video/caption credit, normal audio controls retained.

## Build result

PASS: one invocation of `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run
package:mac:dev` completed with exit 0. Frontend/native launcher/runtime packaging,
packager's native compatibility audit and ad-hoc signing completed. App:
`release/dev/ShortCut Studio Dev.app`. Build log:
`/tmp/shortcut-dev-integrated-build-20261020.log` (local, not tracked).

The existing DEV app was not quit/restarted or smoke-tested. No test suite,
standalone lint/typecheck, browser automation, video render, new provider request
or YouTube verification was run after the user's stop-QA instruction. Earlier
historical evidence is not qualification for this change. Updated existing
transition assertions were not executed. No functional/AI/render acceptance
performed. One local effect atlas was regenerated as a required shipped asset;
no source media/exports/credentials/backups were edited. The packager preserves
the previous app in its own DEV staging directory; it has not been deleted.

Open manually after quitting the previous DEV app normally:

```sh
open "/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app"
```
