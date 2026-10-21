# UI typography and disclosure consistency — 2026-10-21

Branch `recovery/visual-dev-reconstructed`, starting clean at
`87c3135c5ff176028f378c9f1d32833569e6c75c` (confirmed pushed to origin).

Source audit covered active Editor, Batch and Kho surfaces and their shared
controls/portaled menus. No engine, data, schema, event handler, API, media or
credential changes. Existing layout, drafts, snapshots, 1× preview /125% image /
1.25× export remain intact. Previous render resource changes are preserved.

## Findings and source changes

- UI requested `Inter`, while existing bundled @font-face names are `Studio Inter`
  and `Studio Noto Sans`. The previous name could fall back to system fonts.
  Shared UI stack now uses the actual local names; no font download/dependency.
- Typography tokens: body/control13px, supporting text12px, compact status/badge11px,
  section14px, workspace heading20px. Remove scattered9–10px hints in active
  chrome; consistent line-height/weights. Source timecodes/transcript retain
  monospace. Font preview options/artwork retain their deliberate font samples;
  selected font control uses UI font without changing the video's selected font.
- Native selects previously had OS-specific arrows, Radix selects16px Lucide
  chevrons at reduced opacity, and details mixed native markers with Lucide.
  Shared16px chevron path (2px stroke) now covers native selects and disclosures;
  Radix uses the same Lucide shape, size and color. Disclosures rotate with
  `details[open]`; Radix with its real open state. Duplicate decorative chevrons
  are hidden. Labels reserve arrow space and can wrap; Customize values no longer
  force truncation. Native OS option popups still follow platform limitations.
- Shared popup font/item size/selected/disabled/focus styles apply outside the
  workspace DOM too. Existing control heights36/action40/Timeline32/icon32 and
 8px corner radius remain; removed source-tab inline32px/12px overrides so same
  level tabs follow shared sizing. No extra state, remount or dropdown replacement.

## Delivery

Source/diff review only. No tests, lint/typecheck, browser/smoke, renders, ASR,
listening or provider calls. Node22 `npm run package:mac:dev` succeeded once, exit0.
App: `release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-ui-typography-disclosures-build-20261021.log`. Native packaging/
signing completed; chunk-size advisory only, no runtime QA. Only delivery docs
changed after build. User performs manual
acceptance (Vietnamese diacritics, long labels, small windows, selects/details,
keyboard/focus, all3 workspaces). Packaging is not visual/functional verification.
No app/worker restart, push or merge; no production/user data/backups touched.
