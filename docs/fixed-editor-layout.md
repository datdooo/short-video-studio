# Fixed editor columns — 2026-10-20

Continues existing dirty source on `recovery/visual-dev-reconstructed`, HEAD
`13f3c90f28afb30a3e6e53c87d40695197914712`. UI layout only; no state/plan/worker/
render/playback/zoom changes. Previous source and render-lag fixes preserved.

- Source260px, Inspector300px (border-box); center minmax(0,1fr) receives the rest.
  Collapsing either side sets its grid width0 and gives center that space.
- Removed resize handles, drag cursors, react-resizable-panels hooks and persisted
  sizing from this workspace, including the old preview/Timeline split. Dependency
  and reusable resizable wrapper remain installed; nothing unrelated is removed.
  Only the six exact previously owned prototype layout keys are retired on mount;
  no editor session, draft, source/media or job storage is cleared. Collapse/drawer
  state is local UI state, no saved dimensions or source/plan metadata.
- Center uses55% Preview /45% Timeline within available height (both minmax0); long Timeline
  scrolls inside its own row. Side panels independently scroll; footer is outside
  the content grid. No1550px stacked workspace or horizontal resizing.
- At≤1050px center uses full width. Existing toggle buttons open one non-modal
  source/Inspector drawer at a time, bounded to viewport width and the content
  area's height (never covering Render footer). Close button/backdrop/Escape and
  focus return; nested Select/Popover consumes Escape first. Desktop collapse
  preferences are independent of drawer open state. Workspace switch closes drawer.
  Center creates a stacking context below drawers so video overlays cannot float
  over drawer controls.
- Source, preview, Timeline and MusicPanel stay mounted in the SAME DOM positions;
  no portals/reparenting, duplicated controls/player, decoder, animation or media
  request is introduced by toggling/resizing. Hidden panels are inert/aria-hidden.

Clarified clocks/zoom (UNCHANGED from previous implementation):
`lib/preview-config.mjs` PREVIEW_RATE=1; `lib/render-config.mjs` PLAYBACK_RATE=1.25
(export) and FOREGROUND_SCALE=1.25 (visual zoom) are separate constants.
Home computes foreground dimensions once using FOREGROUND_SCALE, then only maps
canvas pixels to the displayed9:16 box using previewScale. That display-unit
conversion is not another125% zoom or a UI scale. Only foreground source video is
zoomed125%; layout chrome/title/subtitles do not receive that zoom. Worker export
retains source speed1.25× and visual zoom125%. Crop/effect clipping unchanged.

Review: source/diff only, no tests, browser, smoke, render or AI/YouTube calls.
First fixed-column Node22 `npm run package:mac:dev` build succeeded (exit0), log
`/tmp/shortcut-dev-fixed-columns-build-20261020.log`. It completed before the
user's55/45 ratio update arrived and is superseded by the final ratio build.
Final55/45 Node22 DEV build succeeded, exit0:
`/tmp/shortcut-dev-fixed-55-45-build-20261020.log`.
Current app: `release/dev/ShortCut Studio Dev.app`; includes fixed260/300px columns,
55/45 center and unchanged Preview1×/zoom125%/export1.25×. Only documentation
edited after build. Native packager audits/signing completed; no functional QA.
No running app/worker closed or restarted.
No commit/push/merge; user manually accepts layout, scroll, drawers and playback.
