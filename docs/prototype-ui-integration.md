> Superseded design/clock: the newer user TSX is primary. Read
> `preview-1x-ui.md` for black/orange chrome, preview1× / export1.25× and current
> delivery. The ZIP integration/build record below is historical.

# Approved prototype integration — 2026-10-20

Base: `recovery/visual-dev-reconstructed`, HEAD
`13f3c90f28afb30a3e6e53c87d40695197914712`, with pre-existing unfinished render/UI
changes. No reset, source overlay, commit, push, dependency installation or upgrade.
Reference: user-provided `/Users/datdo/Downloads/shortcut-studio-ui-prototype.zip`;
README and relevant components inspected without executing the prototype. Its
palette, compact chrome and source/preview/Timeline/Inspector layout guide the
implementation. No prototype mock fixtures, EditPlan types, Vite entry, manifests,
lockfile or wholesale App copied. No external editor code/assets introduced.

## Real bindings

| Surface | Existing owner / behavior |
| --- | --- |
| Header | Home workspace, worker health, configured ChatGPT session/provider; actual versioned local-draft writes and New Session. Login status is not proof of inference. |
| Source | Existing managed download/import, prepareSource, analyze/manual/web prompt/import and abort/error handlers. AI instruction visible; Advanced holds existing transcript/provider/manual/external controls. |
| Preview | Existing two-deck controller, measured 9:16 geometry, source/audio/BGM/ducking, seek/output clock. ONE activePartIndex controls preview, Timeline and part text. |
| Timeline | Both MainRangesEditor/TeaserEditor instances retained; only active part visible. Existing source-timecode helpers preserve untouched numeric precision. Invalid drafts/candidates/busy teaser prevent submission; technical errors inline. Apply installs candidate through existing handler; no audition checkbox. |
| Inspector | Existing visualControls split once across Appearance/Text plus one mounted MusicPanel. Template remains derived, collapsible, Current-background-on-selection semantics unchanged. Shared style/music/hookTransition scope retained. |
| Footer | Existing RenderJob progress, cancellation, outputs and startRender readiness (both teasers + effective timing + technical drafts). No simulated completion or progress. |
| Batch / Kho video | Complete existing batch controls, resume/review/import/cancel/download and media library retained. EditorRenderList moved into Kho video; callbacks/polling unchanged. |

`editor-workspace.tsx` uses installed react-resizable-panels4.12.2 Group/Panel/
Separator/useDefaultLayout, shadcn/Radix wrappers; no dependency changes. Side
panels collapse/resize and persist separate narrow/wide layouts; nested vertical
split gives preview and Timeline independent height/scroll. At≤1050px the SAME
mounted panels stack, with no second player or background decoration decoder.
Inspector contents remain mounted; inactive part drafts stay in existing
EditorDraftContext. Native help/details reduce visible instructions. Optional
teaser audition video exists only while explicitly open, active and not exporting.

Workspace changes pause existing video/BGM. Reload restores existing session and
UI drafts; only optional inspectorTab/sourceAdvancedOpen are added to session-v1,
never EditPlan or job payloads. Late teaser requests remain tied to original
part/source/main signature with cancellation; switching part does not retarget
results. No new extraction/AI/render on restore. Header Saved means a successful
localStorage write, not a timer simulation; unavailable/quota failures remain errors.

## Scope / delivery

All 66 `worker/*.mjs` files match their hashes captured before UI integration,
including the pre-existing render-resource changes. No worker/FFmpeg/engine/
selection algorithm edit in this UI integration. The combined package will include
that preserved dirty source; its performance/lag fix remains unmeasured. Existing
media, exports, credentials, backup and production paths untouched.

Build: one final combined `PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev`
succeeded, exit0 (2026-10-20). Native compilation/packager dependency and signature
checks completed as part of packaging. Non-fatal frontend chunk-size warning remains.
App: `release/dev/ShortCut Studio Dev.app`. Log:
`/tmp/shortcut-dev-prototype-ui-build-20261020.log`.
Package includes current implementation plus preserved render changes; only delivery
documentation was edited after success. No functional verification of the app.
No tests/lint/typecheck, browser automation, smoke, playback/render, provider or
YouTube verification. Build is packaging, not functional/editorial/performance QA.
No app shutdown, launch or worker restart requested/performed.

Manual acceptance (user): resize/collapse; switch part with incomplete timecode,
custom request and candidates; reload and confirm paused position/drafts/job
reconnection without new work; verify actual music/ducking and single controls;
repair both teasers/invalid rows before render; cancel/download from real jobs;
use Batch/Kho video as before. Visual fidelity/responsiveness and inherited render
lag fix still require user evaluation; do not infer them from a successful build.
