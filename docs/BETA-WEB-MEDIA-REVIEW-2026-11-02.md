# Manual web media review — source only, 2026-11-02

**Superseded by user decision:** the mandatory viewing declaration and its import gate have been removed. See [BETA-WEB-REVIEW-ROLLBACK-2026-11-02.md](BETA-WEB-REVIEW-ROLLBACK-2026-11-02.md). The report below describes the historical build 1121, not the current source contract.

Baseline: `beta/maintenance`, `42e221fab483d02242b17088c637b40a82be6fa9` (installed/release build 1120). This change is not packaged yet.

## Finding

The previous TXT asked the web model to read the full attachment, but its response schema had no media-access/coverage declaration. Import validated source/request/context, cuts and teaser citations, without distinguishing sparse-frame inspection from a claimed continuous full-source review. The user's screenshot explicitly reports only selected frames and no complete continuous video/audio review; that is evidence about that web reply, not a measured trace of the website's decoder.

## Change

- `lib/web-media-review.mjs` and its declaration: one shared manual-only review plan/schema/validator. No decoding, model call, third-party dependency or heavy local processing.
- `lib/muse-plan.mjs`: manual ChatGPT/Gemini/Muse TXT v20 requests a full continuous source-video pass, complete text context once, then detailed reinspection of chosen teaser ranges, main boundaries/joins and uncertain exclusions. Difficult footage may receive additional passes without a frame/time/quota ceiling; standard footage should reuse its initial review. Detailed speech cuts require reported listening, rather than treating transcript punctuation as measured audio completion. No changes to existing main/teaser ranking, durations, source clock or Auto prompts.
- Checkpoint partitions cover source start through end. The compact report has at most 12 checkpoint notes (about 90 seconds per partition until that reporting cap). This bounds *report verbosity*, not viewing time, frames, source coverage, depth or candidate search. All source data remain present; no video/text is cropped or summarized away.
- `mediaReview`: AI-declared inspected video/audio ranges, missing spans, continuous vs sampled/unknown method, sampling interval only if known, adaptive depth with brief reason, model/mode only if known, checkpoint observations and one focus check per returned active teaser. No private reasoning transcript or lengthy per-frame report is requested.
- `parseMusePlan` validates the report before returning an import candidate. `app/page.tsx` sends the same report with the effective plan/selections. `worker/auto-cut-workflow.mjs` revalidates it on the server after source/context/lock checks and before attaching teaser evidence. Wrong source, malformed report, missing coverage, sparse-only declarations, mismatched choice ranges or missing reported listening for speech cut endings stop import and preserve the existing plan/JSON draft. No repair/retry/provider call is added.
- Disabled/custom manual teasers keep their existing treatment. Existing caption/range/gap/duration/citation checks and timestamp precision remain; this review report does not replace them. Overlapping inspected audio/video intervals can contribute to coverage without changing any actual cut.
- Short UI error plus collapsed diagnostics; success explicitly calls review **AI self-reported, not independently verified**. The original report remains in the pasted JSON/draft. No extra field is added to the render plan and no collected analysis limitation is dropped.
- `scripts/worker-runtime-files.mjs` includes the new module for macOS and Windows packaging. Prompt version/cache identity advances to v20; a new TXT is needed after updating the app. Existing plans/drafts remain untouched; follow-up JSON retains source/request/analysis IDs and updates its report to match revised teaser choices.

## Hard limits

This is a requested review procedure plus consistency checks on an **AI self-report**, not a mechanism to force or independently verify website frame sampling, decode, audio access, reasoning or full continuous inspection. A model could falsely declare a full review. Checkpoint notes can also be fabricated; passing this validator does not prove visual truth, semantic quality or child detection. The app never renames a sampled/unknown report to continuous. A website without continuous-video access may never satisfy the strict contract; increasing prompts or quota cannot establish a missing capability. No extension, browser control, paid API fallback, model switch or automatic retry has been added.

Reading all text and video once before focused review is intended to avoid redundant work. Difficult clips prioritize quality. Actual speed, quota usage and adherence are unmeasured; no percentage saving or complete visual coverage is claimed.

Official OpenAI documentation consulted: [Use ChatGPT](https://learn.chatgpt.com/docs/use-chatgpt), especially reviewing important results and explicitly stating inaccessible sources; [Image inputs](https://learn.chatgpt.com/docs/image-inputs). These pages do not establish a Studio-controllable frame-sampling or reasoning contract for manual web attachments. No inference about Gemini/Muse account capabilities is made.

## Manual acceptance after a separately authorized build

1. Generate new TXT for each web provider: same v20 review procedure/schema, one text file plus the existing full video download; no extra image export or AI request.
2. Paste a sampled/partial/unknown receipt, omitted checkpoint, wrong source/duration or stale IDs: short actionable error, details retained, existing plan/draft unaffected.
3. Paste a consistently declared full review and matching focus checks: existing business validation must still run. The notice must say self-reported, never provider-confirmed/verified watch.
4. Revised JSON in the same conversation keeps its IDs but updates each changed teaser's focus range. Disabled/custom manual teasers are not subjected to new AI gates. Both parts stay independent.
5. For a difficult clip, inspect the model's actual review/tool work and output; a `deep` label alone is not proof. Audio-transcript-only declarations must not pass as listened speech-end checks.

Before packaging: only source/diff review performed; no tests, lint/typecheck, build, AI/probe, ASR, download, browser automation or render. DEV, credentials and user media are unchanged.

## Authorized package 1121

User requested a build into the fixed release and Applications paths. A local checkpoint includes these reviewed source changes, declarations, runtime manifest, version and this document; no push/merge. Package 1121 retains compilation/native-audit/codesign guards. The package config records the exact source commit. `release/beta/macos-build-1121-receipt.json` records the package/module checks, rollback paths and actual Applications update outcome. Previous build 1120 is retained for rollback. No standalone tests/lint/typecheck, AI/probe, ASR, download, browser automation or render are authorized/run. Runtime behavior, speed, quota and actual web media review remain unverified.
