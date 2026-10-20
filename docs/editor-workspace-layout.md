> Latest layout: `fixed-editor-layout.md`. Fixed260px/300px sidebars and narrow
> drawers replace ALL resize handles and persisted panel dimensions below.
> Preview1×, foreground zoom125%, export1.25× unchanged.

> Current design/clock update: `preview-1x-ui.md`. The layout below is reused,
> with the user TSX as primary design, black/orange chrome and Preview1×.

# Compact editor workspace — 2026-10-20

Updated to the user-approved `shortcut-studio-ui-prototype.zip` layout after the
render-resource source fix. Build result is recorded in `prototype-ui-integration.md`.
No UI/playback QA, browser automation, render or provider calls; user acceptance.

`components/editor-workspace.tsx` supplies presentation-only source/preview/
Timeline/inspector/status slots. The existing Home state/handlers remain canonical.
Installed shadcn/Radix wrappers and react-resizable-panels4.12.2 Group/Panel/
Separator/useDefaultLayout API reused; no dependency change or editor engine.

- Left: source preparation/Generate, visible AI instruction and collapsed Advanced/transcript/extra prompt. Right: Giao diện (template/filter/background/overlay/internal transition),
  Chữ (text/font/animation/subtitles/title), Nhạc (one MusicPanel instance).
  Tab contents stay mounted to preserve local drafts/audio ownership. Only one
  mounted row for each underlying visual control. Template still derives match,
  is collapsible, and applies Current background without migrating saved styles.
- Center: existing two-deck preview and ONE Part1/2 selection, with selected part's
  Timeline directly below. Inactive range editor is hidden, stays mounted and
  continues reporting technical draft validity for BOTH-part export guards.
  Teaser source times, Custom request/Apply and shared Hook→Main selector above
  compact main rows; add/delete/lock/AI restore unchanged. Guidance is one short
  source-time note, optional native help/tooltip; actual errors remain visible.
- Source timestamps remain HH:MM:SS:FF30, exact stored numeric endpoints untouched.
  No range/main/subtitle mapping, teaser eligibility, music/style or job snapshot
  migration. Teaser original occurrence remains in main. Active inspector tab is
  optional session-v1 data, missing in older drafts defaults to Giao diện.
- Drag panel separators or collapse/expand left/right with footer buttons. Native
  installed panel API persists separate wide/narrow layouts. Storage adapter
  rejects corrupt/non-finite/oversize layouts without failing the page. Collapsed
  contents remain mounted/inert and unavailable to keyboard focus. At≤1050px,
  same panels stack vertically (no duplicated source/player or decoder). Independent
  scroll, min widths and adjacent equal timecode fields avoid horizontal overflow.
- Bottom status/render footer shows validation, errors, current-job progress/encoder
  fallback and Render/Cancel. Header shows actual local autosave writes. Complete
  worker render history is retained in Kho video alongside MediaLibraryPanel.
  No new animation loop, media request or decoder is introduced by layout/tab/part
  switching. Existing timing/caption/media preparation reacts only to real inputs.

Design-only references consulted:
[OpenCut Classic](https://github.com/OpenCut-app/opencut-classic) (MIT, archived)
for source/preview/timeline/inspector organization;
[LosslessCut](https://github.com/mifi/lossless-cut) (GPL) for visible editable segment
rows/in-out interaction. NO source/assets copied/adapted from either repository;
no GPL code or external runtime added. Existing dependency licenses retained.

Manual checks: resize/collapse/reload on MacBook Air and external display; switch
Part while a timestamp is incomplete, then reload; verify both drafts/locks/Custom
input persist and only selected Timeline is visible. Check tabs/music preview,
Current-background template behavior and mandatory teasers for both parts. Do not
infer runtime success from source review or package build.
