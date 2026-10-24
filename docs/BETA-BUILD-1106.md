# Beta 1106 packaging handoff — 2026-10-25

Version `1.1.0-beta.1`, build `1106`, macOS arm64. Branch `beta/maintenance`,
source parent `3d2d85ac228d14fc3efccc5fa4512c1186dbd945`. The exact local
checkpoint is embedded by the packager in `Contents/Resources/config.json`.

Fixed release: `release/beta/ShortCut Studio Beta.app`; install target:
`/Applications/ShortCut Studio Beta.app`. Retain1105 bundles for rollback;
never stop an app automatically. Keep Beta profile, ports5373/8987 and data roots.

Includes the pending one-button ChatGPT web/Gemini/Muse workflow and automatic
smaller web-video delivery, extension0.3.0, prompt contract full-media-v6, shared
cancelable review cache, source/variant binding and current import guards.
Restored session metadata preserves valid variantKey; legacy prompt/JSON drafts
remain but cannot impersonate a new video variant. Invalid cache metadata stops
being a TypeError. All inherited1105 main/teaser/manual/playback/subtitle/UI,
progress, render/font and FFmpeg changes stay included.

Package comparison must include worker/web-ai-video.mjs, downloader/quality/JS,
shared muse-plan runtime/declaration source version, extension files, fonts,
compiled one-button UI and worker relative import closure. Mandatory frontend
build, native dependency audit and strict deep ad-hoc codesign stay enabled.

Source implementation is not runtime acceptance. No tests, lint/typecheck
separately, AI, browser automation, media download, ASR or render are run.
Website DOM/upload support, AI semantics, smaller-video fidelity/timing and peak
memory still need manual acceptance. Installing the app does not install/reload
the Chromium extension: reload extension0.3.0 and the Studio/AI browser tabs.
Windows installer is not rebuilt. DEV/production, credentials, media, exports,
drafts and backups are unchanged. No push/merge.
