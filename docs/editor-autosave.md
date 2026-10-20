# Editor autosave / restore — 2026-10-20

Source implementation; manual acceptance pending. No test, runtime QA, render,
browser automation or provider/YouTube verification was performed for this change.

- `lib/editor-session.ts`: localStorage `shortcut-dev-editor-session-v1`, envelope
  `{version:1,savedAt,data}`. One atomic value; max4MiB measured conservatively as
  UTF-16 JSON bytes. Quota/denied/oversize writes keep the previous draft and report
  the failure. Unknown schemas/corrupt JSON are left untouched, never crash startup.
  Structurally invalid plans are withheld; valid source/text/editor portions still
  load, with auto-overwrite disabled until a deliberate edit. Optional invalid
  appearance/music/analysis/captions do not discard the whole plan. No timestamp
  normalization of main/teaser segments; invalid hooks remain repairable.
- `app/page.tsx`: 1s debounce on editing, flush on pagehide/beforeunload/hidden;
  seek/pause debounce and5s playhead checkpoint during playback. Serialization
  is not performed every animation frame. One origin-local draft (Chrome and native
  DEV browser stores are independent). No credentials, account/session response,
  media bytes, blob URLs or full worker job/history payloads are included.
- Persists root form fields/transcript; effective plan including ranges/locks/style/
  subtitles/teasers/music/ducking/transitions; external import text/context; active
  part/workspace/source/edit tabs and paused preview position. Child input drafts
  (including incomplete timecodes, description text and unapplied candidates) live
  separately in `components/editor-draft-context.tsx`, scoped to source/part and
  canonical content identity. They never become effective plan just by restoring.
  Main draft errors recompute through the existing range validator/export guard.
- Managed sources reopen through GET `/api/sources/:id`. Missing/offline source
  retains its ID and editor draft, displays reconnect/preparation guidance. Local
  files not yet imported need explicit file reselection; no old blob URL is reused.
  Reselecting the same named local file preserves the draft; preparation/import
  remains explicit. User must choose the correct file. Files are never duplicated
  into localStorage or re-imported solely because of reload.
- Restore does not POST transcript/metadata extraction, subtitles, AI, download,
  render, batch resume or music analysis/mix preparation. BGM preparation waits
  for explicit Play/music changes; source gain remains normal before mix readiness.
  Existing submitted render job and batch IDs reconnect using read-only polling.
  Batch automatic output download is suppressed for a restored session; existing
  manual download links remain. Worker histories continue independently.
- Browser-owned pending work restores as interrupted, never as running. Existing
  action buttons provide explicit retry. Unknown submission outcome directs the
  user to worker history before retry (reload cannot recover an unacknowledged ID).
  Notices survive another reload until retry/source change/new session.
- “Phiên mới” removes only the session key and legacy tracked batch ID, aborts the
  current page's source/analysis work, pauses/releases preview and clears editor
  form/plan/drafts/tracking. It does not cancel worker jobs, delete history/media,
  remove music, exports or credentials. Pending batch responses cannot resurrect
  the discarded editor. Existing worker histories remain available.

## Manual acceptance

1. Prepare source, edit both parts, leave an invalid/partial Timeline input and
   Custom Teaser text. Change style/subtitles/music, switch part/workspace, seek.
   Wait1s, reload: notice, all inputs and exact saved ranges return; preview paused.
2. Reload while AI/download is pending: interrupted notice and explicit retry;
   no automatic repeat. Reload with existing render/batch: status reconnects without
   new render/resume. Inspect history before retrying unacknowledged submissions.
3. Reload an imported local source; also try unimported local file and unavailable
   source/worker. Retain edits while reconnecting or selecting the correct file.
4. Press Play to prepare/rejoin BGM; pause/seek/switch part. Check voice/ducking.
5. “Phiên mới”, then reload: old editor draft absent, worker histories/library kept.
   Storage denial/quota/corrupt draft should report failure without blanking app.

Build result/app location is recorded in `docs/CODEX_HANDOFF.md`. Build success is
not functional verification; user performs manual acceptance.
