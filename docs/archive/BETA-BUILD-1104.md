# Beta 1104 build handoff — 2026-10-24

Source base: `4fd5e4e402e6445b837e0522a169beaf16c82ac4`, branch
`beta/maintenance`. The exact source checkpoint is written by the packager to
`Contents/Resources/config.json` (`commit`); it is not inferred from a filename.

Target: `release/beta/ShortCut Studio Beta.app`, version `1.1.0-beta.1`, build
`1104`, macOS Apple Silicon. The fixed release bundle is updated only after
frontend compilation, native relocation/audit and strict deep codesign succeed.
Packager retains its previous app as `.build-*/previous-build.app`. No app is
launched, no installed `/Applications` bundle is replaced and no process is killed.

Includes:
- Full manual Gemini/Muse/ChatGPT web text-plus-video workflow and experimental
  Chromium send/readback bridge; extension and instructions are also shipped in
  `Contents/Resources/extensions/chatgpt-handoff` and `Contents/Resources/docs`.
  User installs the extension and attaches source video; no automatic Apply.
- Render: static PNG decoded-frame loop, redundant transparent shine omitted
  for nonanimated/no-shine titles, bounded two-thread final filter graph.
  Existing bitrate, geometry, blur, captions, transition and audio settings stay.
- Japanese, English, French and German Tutorial, plus EN/FR/DE text presets.
- All inherited main/teaser/manual/draft/playback/subtitle/progress/FFmpeg fixes.
  ChatGPT Auto stays Sol low and text-only; OAuth sends neither service_tier nor
  max_output_tokens. No change to current user plan or draft is run during build.

Profile Beta, web 5373, worker 8987, existing support/data/Keychain namespace Beta
are retained. DEV/production, user media/music/exports/drafts and credentials are
not copied into the app or modified. Windows installer remains the older build.

Build/static verification is separate from acceptance: compare packaged worker,
shared visual libraries, font assets, extension files and transitive relative
imports to this checkpoint. No AI, ASR, video download, render, test suite or
browser automation. No measured speedup, visual equality, extension/AI operation
or runtime QA is claimed. See the render/template/extension documents for manual
acceptance and remaining limits.
