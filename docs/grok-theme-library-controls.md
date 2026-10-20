# Shared ZIP theme, Kho tabs and control sizes — 2026-10-21

Source checkpoint: branch `recovery/visual-dev-reconstructed`, base HEAD
`27625fe78dc5177f88355a6c98613d6407d02f09`. All inherited dirty engine/source
work retained. This change only edits presentation/component composition.

Reference: user-supplied `KftmhWoYhcxjYz0p-grok-workspace.zip`, its `src/styles.css`,
`batch-view.tsx`, `library-view.tsx` and both screenshots. Screenshots were viewed
as design references only, not screenshots of a running DEV app. Palette/controls
were mapped into existing app styles; no prototype model, mock, handler, timer,
auth, storage, package or font dependency was imported. Original SVG logo retained.

## Implemented source

- Shared exact palette: background #100e0c; surface #171512; panel #211e1a;
  border #322c27; foreground #f4f0ea; muted #c2b8ae; dim #8f867c;
  primary #ff5a36; hover/selected text #ffb199; primary ink #1a0d09;
  success #7dcea0; warning #e7c36a; danger #f0a097.
- Shared normal36px / action40px / compact32px / icon32×32px size variables;
  Button action/timeline variants, legacy small aliases normalized to normal,
  icon aliases32px; 16px button icons, 13px labels, 12px horizontal padding,
  6px gap, 8px input/button radius. Timeline inherits compact sizing, timecode
  columns ~13ch, errors remain beside their inputs. Preset thumbnail cards keep
  their visual samples and natural height. Long labels wrap, no forced ellipsis.
- Editor, Batch and Kho share chrome, borders, badges, progress, semantic status,
  hover/focus/selected/disabled states. Copy labels retain their normal footprint
  while pending/success. Fixed side columns and55/45 center layout unchanged.
- Navigation/title renamed Kho. Exactly four Radix tabs: Danh sách render / Nguồn /
  Part / Thùng rác. Counts come from existing job/media arrays; ellipsis means
  media listing has not loaded. Shared search filters displayed jobs/media only.
  Byte totals remain visible in media tabs. Existing per-file preview retained;
  switching tabs pauses that video, adds no decoder/request/job action.
- Render list receives the same parent-owned jobs/polling and stop/delete callbacks.
  Part uses `library.parts`, not render jobs. Existing storage refresh, move,
  restore, purge, download, selection guards and confirmations remain. Delete-all
  retains its existing scope across finished jobs, independent of the search filter.
  Batch queue/resume/retry/cancel/download code and data contracts are unchanged.
- No plan/schema, API, engine, render-lag fix, transcript/ASR, teaser ranking,
  audio, preview geometry, clocks, snapshots or autosave changes in this UI update.
  Preview1× / foreground zoom125% / export1.25× remain inherited behavior.

## Delivery

Source/diff review only; no tests, lint/typecheck, browser, smoke, render, AI,
YouTube, ASR or listening verification. Combined Node22 `npm run package:mac:dev` succeeded once, exit0.
App: `release/dev/ShortCut Studio Dev.app`. Log:
`/tmp/shortcut-dev-grok-theme-kho-build-20261021.log`.
Bundled native compatibility/signing steps completed as part of packaging; this
is not runtime QA. Existing chunk-size advisory remains (not a build failure).
Only delivery docs were updated afterward.
No app/worker restart, production, personal media, exports, credentials/backups,
commit or push performed. User will manually inspect all three workspaces,
small windows, focus/disabled/loading states, long labels, 4 Kho tabs and existing
job/media actions. Build success does not establish functional QA.
