# Editor saving — manual plus hide/exit checkpoint

Baseline: `beta/maintenance`, build 1123. User's latest decisions supersede the original autosave behavior:

- No timer/debounced save during editing or playback.
- Keep the draft when the browser tab is hidden or closed/reloaded.
- Use the existing header save badge as one button: orange **Lưu** for unsaved edits; muted **Đã lưu** after successful persistence. No separate status row, normal-save banner or toast.

## Implementation

- `app/page.tsx`: remove the 1-second content-change writer, 5-second playback writer, preview-save counter and global click/input saving enablement. Track dirty editing data with shallow references only; no JSON serialization or localStorage writes while typing or on preview ticks. Workspace/part/panel navigation and transient task flags alone do not light the button. Manual seek marks the position dirty; live playback time alone does not, but an explicit/lifecycle save captures the current playhead.
- One Save function is called by the header button or Cmd/Ctrl+S. The keyboard handler ignores repeat/composition events and prevents the browser Save Page shortcut. Save does not run export/business validation: incomplete timecodes and raw Custom Teaser/manual drafts remain in controls.
- The same function handles document `visibilitychange` to hidden, `beforeunload` and `pagehide`. Successful writes remember snapshot identity and playhead, so successive hide/close events for the same state do not write it again. A new empty session is not saved just because it becomes hidden. No delayed or periodic job is created. A later different playhead/state is a new checkpoint.
- Reuse existing `preserveEditorSession` and `writeEditorSession`: a save operation preserves its source/item draft and writes the active resume checkpoint. The size/readback checks remain. These are two existing storage records, not two competing timers. Storage failure retains an error/unsaved state and previous active data. Close/reload uses the native unsaved warning only if pending content remains after the save attempt; normal successful saves produce no popup.
- Restore remains read-only. Startup's saved state does not get dirtied merely by hydration; opening an archived draft marks it pending as the new active resume session. Existing corrupt/blocked raw drafts cannot be unlocked by ordinary input/click or by the lifecycle save. Explicit **Giữ bản gốc** still requires exact preservation/readback before replacement becomes possible; Phiên mới remains an explicit discard action.
- Switching to Batch/Kho keeps the in-memory Editor draft. Opening another batch item/archived draft does not secretly save: if the current content is unsaved or the startup checkpoint has not yet been archived separately, ask before replacing it, with Cancel available to Save first. Saved source/item drafts can be reopened through the existing list. Acknowledging replacement may discard unsaved changes; no unconditional draft wipe is added.
- `components/studio-header.tsx` / `app/globals.css`: one stable-width Save pill with keyboard/accessibility labels and existing orange/charcoal styling; actual errors retain the existing error area. No second save-status span or added success notification.

Worker job/history/output persistence, source leases, authentication and small batch identity/dedup records are unchanged; they are not the Editor autosave loop. MAIN/teaser/model/reasoning/timecode/render logic and all existing changes are preserved.

## Manual acceptance after a separately requested build

1. Edit Main/Teaser/title/raw timecode, including incomplete IME input: the existing save button lights; waiting/preview playback must not write the editor checkpoint periodically.
2. Press Lưu or Cmd/Ctrl+S after composition: successful save dims the same button. Reload restores saved plan, raw input and current playhead. No toast or extra save-status row.
3. Make an edit, hide the browser tab, then close/reload: checkpoint events save the latest available state, and identical successive events do not repeat storage writes. Foreground editing remains manual.
4. Block/fill localStorage or restore malformed raw data: no false Đã lưu, no overwriting blocked raw. Explicit original preservation must succeed before replacement. A close with unsaved data may show the browser's native warning.
5. Open a different batch/archived item while unsaved: Cancel leaves the current draft intact; Save then reopen restores the correct source/item. Changing workspace alone never deletes the in-memory Editor.
6. Phiên mới remains explicitly confirmed; existing source media/jobs/auth and manually archived drafts are retained.

Source/diff review only. No tests, lint/typecheck, browser automation, build, AI, ASR, download or render. No localStorage/user data mutation was performed during implementation, and installed/release apps are unchanged. Runtime latency and browser lifecycle behavior are unmeasured; OS/browser crash/force termination may not dispatch lifecycle events.
