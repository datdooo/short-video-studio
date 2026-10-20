# Preview: apply 125% on the displayed video — 2026-10-21

Same branch/base27625fe, all inherited dirty work retained. User reported zoom
still absent after previous deliveries. Source inspection found the visible decks
used pixel width/height derived from `previewWidth /1080`, with translate-only CSS;
there was no explicit image-scale transform on the displayed video. This is a
fragile dependency on measured canvas dimensions, not evidence of a proven browser
CSS override. No runtime reproduction was performed under the user's no-QA rule.

`app/page.tsx` now gives BOTH existing foreground video decks a100%×100% box,
object-fit contain, and explicit centered
`translate(-50%, -50%) scale(FOREGROUND_SCALE)` with FOREGROUND_SCALE1.25.
The contain fit happens before the single transform; no second geometry zoom.
The existing foreground wrapper clips overflow, its bounds/position are unchanged.
Background canvas, titles/subtitles, effects scope and controls are not scaled.
This removes canvas measurement/ResizeObserver from the actual video image sizing.
Metadata/source dimensions still serve transition masking. Shared export spatial
fit→1.25 policy remains unchanged (even-pixel export rounding may differ subpixel).
Preview playback1× and export playback1.25× remain separate and unchanged.

No new decoder, state, source reset, provider call, animation loop or media render.
No tests/lint/typecheck/browser/smoke/render/ASR/provider verification.
Node22 `npm run package:mac:dev` succeeded once, exit0; app:
`release/dev/ShortCut Studio Dev.app`; log:
`/tmp/shortcut-dev-direct-125-preview-build-20261021.log`. Native packaging/signing
completed, not visual QA. Only delivery documentation changed afterward.
App/worker not restarted; existing running servers may still serve their loaded
previous build. Newly packaged app must be reopened normally when no job is running.
Do not treat packaging success as visual acceptance or proof of the prior root cause.
