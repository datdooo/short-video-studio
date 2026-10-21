# Manual teaser + per-part enable switch — 2026-10-21

Latest user instructions supersede two older restrictions:

- Explicit source timestamps may select the opening of retained main. The first
  10 export-second exclusion still applies to Auto/Retry/description-based AI,
  deterministic candidates and Gemini/Muse selection/import. Manual selection is
  labeled `manual` / `user`, never AI.
- Each Timeline part now has a Bật/Tắt teaser switch. Optional
  `EditPart.teaserEnabled: boolean` defaults to enabled when absent in old plans.
  An explicitly disabled part previews/exports main (including existing padding)
  without a repeated hook or Hook→Main transition. Ordinary main-cut transitions
  remain. Enabled parts still require valid teasers before render/batch/resume.

Manual source times remain exact; same-part single retained range, no gap/padding,
finite ordered endpoints, source duration, speech-boundary checks and max9 export
seconds remain. No forced5-second minimum. No main/content/lock/style/music edits.

Switching only changes the per-part boolean, pauses playback and aborts that
editor's pending hook request. Saved selection, alternatives, custom input and
incomplete drafts remain. Disabled teaser errors do not block main-only export;
re-enabling restores the draft and validity requirements. Invalid saved excerpts
are not played while being repaired and do not crash the editor.

`presentationSegments` is authoritative for preview/export, caption repetition,
music length and speech/ducking mapping. Hook-transition resolution observes the
same flag. Browser mix cache key includes the flag; worker mix cache already uses
effective presentation segments. Autosave whitelists the boolean. Existing clone/
snapshot/history and queue validation paths carry the effective plan unchanged;
submitted jobs are never edited by a later editor toggle. Auto reanalysis and web
import preserve the user's per-part setting; disabled selections are skipped.

Source review identified the original manual block in `customTimestampPart` and
the shared `hookNeedsReselection`/readiness gate. Both now distinguish manual
selection. No new provider request, schema migration or renderer subsystem.

Regression assertions updated/added for manual opening override, unchanged main,
gap/cap rejection, disabled presentation/caption repetition, restore and mixed
per-part readiness. They were **not run**, as requested. No tests, render, AI,
YouTube, listening or browser inspection executed. One combined Node22 DEV build
succeeded (exit0), app `release/dev/ShortCut Studio Dev.app`, log
`/tmp/shortcut-dev-ui-audit-teaser-toggle-build-20261021.log`. Packaged hook/import/selector/workflow/framing source and font/OFL
hashes match local files. Only delivery docs changed afterward. The build is
not functional QA. App/worker were not restarted or jobs interrupted.

Manual acceptance: in each Part enter opening source times → Apply; toggle off →
main starts directly; toggle on → exact saved hook returns; switch parts/reload →
independent state/drafts remain; an enabled missing/invalid hook still blocks
Render. Check music/subtitle timing after toggling. Build success is not this QA.
