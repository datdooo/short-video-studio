# Editor cut Undo/Redo — source Beta, 2026-11-02

Baseline: `beta/maintenance` at `e351d95d25267ab1d2606df3bdffefcb304adf7f`.

## Scope

- Timeline Undo/Redo buttons and keyboard shortcuts: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y.
- Records valid Main range edits/deletion, completed new ranges, restore AI Main, applied manual/candidate Teaser, Teaser enable/disable, and applying Manual cut over an existing plan.
- Main edits within one focused timecode field form one command. Blur/focus or a different cut action starts another command. An incomplete new row remains an input draft until valid.
- Inputs/contenteditable retain native text undo, including IME. Dialogs and menus do not trigger global cut shortcuts.
- Pending/invalid timing drafts and in-flight AI/Teaser Apply block cut history navigation, preserving their input. Correct/apply the draft first; text editing can use native Undo.

## Integration and safeguards

- `components/use-cut-history.ts`: pure plan reducer, cut-only snapshots, source-plan provenance and analysis metadata needed by cut validation; maximum 40 commands and a 4 MiB serialized UTF-16 size estimate. Oversized history entries are discarded rather than retained without a bound.
- `app/page.tsx`: wires existing cut handlers; navigation stops playback and clears only applied timing projections for affected parts. Does not call AI or change range values. An async Apply started before history travel is rejected.
- `components/main-ranges-editor.tsx`: focused-field grouping. `components/teaser-editor.tsx`: reports Apply as draft activity so history cannot race validation.
- Undo preserves current title/hashtags, appearance, captions, music, render settings and Custom Teaser input text. Cut provenance/evidence is restored together with the exact stored source timestamps; existing preview/export validators still apply.
- Source/reset/restore and changed source duration/transcript/cues/request/provider clear history. Auto/import or another plan replacement that changes cuts also clears history. Appearance/music/tab/part changes preserve it.
- First Manual cut creates a baseline, rather than an Undo entry returning to the mock placeholder. Later Manual cut applications record cut changes; titles remain outside cut history.
- Redo is discarded after another valid cut. History is memory-only, excluded from autosave; the current resulting plan continues through existing autosave. Reload restores the plan, not the Undo stack.

## Manual acceptance

1. Change Main endpoints, delete a row, complete a new row: Undo/Redo restores exact cuts and corresponding Teaser context; typing within one field is grouped.
2. Apply manual Teaser timestamps (including outside Main and longer than AI limits), apply a different candidate, toggle Teaser: Undo/Redo independently across both parts.
3. Change style/title/music between cut actions: Undo only cuts. Preview pauses; returning to the other part/workspace does not auto-play.
4. Native Cmd/Ctrl+Z in timecode/text/IME input affects that input. Incomplete rows/pending candidates remain intact and block global history buttons until resolved.
5. Undo then change a cut: Redo clears. Switch source, restore a draft or import a different plan: old history cannot be applied to it.
6. Undo while an async Teaser Apply is awaiting validation: late results cannot overwrite the restored cut.

Source/diff review completed. Build 1120 packages this checkpoint into the fixed release app, then copies the verified bundle to Applications with build 1119 retained for rollback. The package config records the exact checkpoint commit; the build receipt in release records verification and install outcome. Build-required compilation/type checks, native audit and codesign remain enabled. No separate tests/lint/typecheck, AI, browser automation, download, ASR or render are run. Runtime acceptance is pending.
