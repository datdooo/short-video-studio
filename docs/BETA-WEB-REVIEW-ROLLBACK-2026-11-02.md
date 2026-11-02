# Remove mandatory web viewing declaration — 2026-11-02

User's latest decision: AI does not have to declare it watched the whole video. The actual failure was `WEB_MEDIA_REVIEW_INCOMPLETE` for a sampled declaration and missing review checkpoints. That gate was added in build 1121; it was not a source/range/citation error.

## Changes

- Remove the mediaReview schema, checkpoints, listening/continuous-viewing declaration requirement and frontend/worker validation gate. Remove its unused implementation/declarations and package manifest entry.
- Restore the original manual TXT/video → JSON workflow for ChatGPT/Gemini/Muse. Keep only a concise effort instruction: reuse context, inspect difficult footage more carefully, prioritize quality; no viewing receipt is required. Do not claim the website actually watched everything.
- New TXT exports use v21 without mediaReview. Parser accepts JSON both without that field and with the obsolete v20 field, discarding that field entirely. Other extra fields are still rejected; actual plan/source/request/analysis/range/citation validations remain intact.
- `app/page.tsx` accepts v19/v20/v21 TXT sessions. `worker/external-prompt-snapshot.mjs` accepts a prior rules fingerprint only when it exactly equals the same current main/teaser rules and limits with the known old version string. Source/request/transcript/requirements/main/captions and saved analysisKey must still match; a source or genuine editorial change never receives a new binding silently.
- Old JSON therefore need not be regenerated solely because of this declaration rollback, provided its original source/context snapshot remains valid. Cache eviction, a changed source/request/transcript/manual edit or invalid business data can still correctly block import.
- Preserve Undo/Redo, manual freedoms, MAIN/teaser selection rules, subtitles, FFmpeg, provider/model/reasoning, video download choices and all prior unrelated changes. No credentials/media/drafts/history are edited by this source change.

## Static review and manual acceptance

Source/diff reviewed; no AI/probe, video download, ASR, render, browser automation, tests or standalone lint/typecheck run.

After updating the app: retry the existing JSON with its sampled mediaReview or without that root field; neither must be blocked by review declarations. Confirm original identity/range errors still reject invalid JSON without replacing the current plan. Download a new TXT if desired: its output schema must omit mediaReview and checkpoints. Check old v19/v20 context reuse only when all actual source/editorial fingerprints match.

Runtime acceptance and content quality are unverified. Build/install result is recorded separately in release when packaged.

## Package 1122

User authorized build/update. Package 1122 includes this reviewed rollback, v19/v20 TXT compatibility and the previous Undo/Redo changes. The build requires a local clean checkpoint; exact commit is recorded in app config. Preserve all package/native-audit/codesign guards and build 1121 for rollback. Fixed targets: `release/beta/ShortCut Studio Beta.app` and `/Applications/ShortCut Studio Beta.app`. Profile beta, ports 5373/8987 and existing Beta data/credential namespaces stay unchanged. Record actual verification/install outcome in `release/beta/macos-build-1122-receipt.json`; no push/merge. No tests, standalone lint/typecheck, AI/probe, download, ASR, browser automation or render. Runtime/manual acceptance remains pending.
