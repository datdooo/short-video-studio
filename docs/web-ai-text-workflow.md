# Gemini/Muse: text copy–paste (source implementation, not runtime acceptance)

2026-10-21. Owner explicitly requires TEXT ONLY: no automatic messaging, files,
ZIP, video, base64, local-path references, new image-description model or paid
provider. No provider/YouTube/ASR/test/render/browser QA was run for this change.
Owner's latest instruction: push source, WAIT before packaging.

## Shared implementation

- `lib/teaser-input.mjs:hookInput` extracted unchanged from native selector;
  ChatGPT and external context use the same candidate/range/text input builder.
- `lib/teaser-evidence.mjs:collectTeaserEvidence` is the shared source collector.
  External `fullOnly` returns its complete collected text, without the native
  long-video overview/retrieval transport. Original cues/global cue-N IDs, timing
  provenance, full current transcript, metadata/description/tags, chapters,
  comments/mentions/clusters, relative replay bins/grouped peaks, local numeric
  scene/audio/silence signals and missing/error states are retained.
- `lib/auto-cut/main-content.mjs:modelSelectionInput` + MAIN_INSTRUCTIONS reused;
  HOOK_WINNER_SCHEMA/HOOK_WINNER_INSTRUCTIONS moved to `lib/teaser-prompt.mjs`
  for one current winner per enabled part, alternatives[]. Native code imports
  these exact constants; no lowering native evidence or changed main algorithm.
- `worker/external-editing-context.mjs` combines the shared builders and complete
  evidence once. Includes current main/padding/gaps/manual locks/toggles and user
  requests. A fresh task has no invented final parts: recipes and full source are
  supplied; AI chooses main first, then finds its teaser in that final main.
- `lib/muse-plan.mjs:buildMusePrompt` uses those rules/data and the exact import
  schema, sourceId/requestId/analysisKey, model self-report and source seconds.
  Explains raw unlocked main → existing one-second trim → permitted teaser helper
  policy (first10 export-main seconds excluded, max9 export seconds). Locked main
  already trimmed is exact. candidateId=source-range allows a better new proposal;
  no invented IDs, word timing, visual claims, arbitrary appeal threshold or local
  heuristic winner. Explanations Vietnamese, original quote + Vietnamese meaning;
  subtitle/title/hashtag language policy unchanged.

## Data comparison (implementation; no inference equivalence claim)

| Input / transport | ChatGPT Auto | Gemini Web | Muse Web |
| --- | --- | --- | --- |
| Collected transcript/cues, metadata, chapters, comments/replay and numeric local signals | Existing shared builders; bounded catalog + exact regional retrieval for long input | Complete collected text, same collector | Same text builder as Gemini |
| Main/teaser rules and candidates | Shared native rules/input | Same rules/input; final expanded main JSON adapter | Same as Gemini |
| Source timestamps/IDs/locks | Source seconds and fingerprints | Source/request/revision + exact global cue IDs and locks | Same as Gemini |
| Images | Bounded sparse JPEGs when adapter actually accepts/provides them | NONE; numeric scene change is not vision | NONE |
| Continuous video/audio input | Not supplied by current native adapter | NONE | NONE |
| Delivery | OAuth Responses structured output | User pastes text, returns JSON | User pastes text, returns JSON |

Data missing upstream stays missing. Complete collected text is not a claim that
uncollected comments/transcript/frames are available, or that models read all text
correctly. Native long-video serialization differs; text/vision quality cannot be
called equivalent. Text-only action/visual claims are rejected by import validation;
speech with actual supplied cues remains eligible. No new frame extraction was
added just for external prompts.

## Long prompts, import and freshness

`splitWebAiPrompt` keeps one prompt <=60,000 characters. Larger prompts become
ordered <=24,000-character payload blocks plus an offsets/count/character manifest;
no omitted tail, no file attachment. These are app clipboard bounds, not a promise
about any provider's context limit. AI is told to wait for every block and then
reassemble before selecting or returning JSON. UI selects which block to copy;
no duplicate full prompt/base64 is put in the clipboard. The existing 4MiB draft
storage cap still applies and reports failure instead of silently truncating.

Context revision hashes full evidence, main inputs/ranges/locks/caption provenance,
source fingerprint, current shared rules, provider/request and transport version.
Worker recomputes on import; UI also invalidates on source/transcript/main/request
changes. Late prompt responses cannot bind to a different main revision. Old
prompts need regeneration; saved plans/jobs are not erased or migrated.

UI parses shape/source/request first without mutating plan. Worker then attaches
external hooks using the EXACT prepared cue track and current source context,
validates source/ranges/duration/ending/text evidence, and returns Vietnamese
part/field rejection. It never calls ChatGPT to replace an import. Existing final
binding/fingerprint checks remain. Failure leaves the editor plan unchanged.

## Manual acceptance

1. Choose Gemini/Muse outside Advanced → Tạo prompt → Copy prompt.
2. If blocks appear, copy/paste all in order in ONE web conversation. No attachments.
3. Paste final JSON into the bounded JSON field → Áp dụng 2 part.
4. Confirm missing-vision disclosure, Vietnamese explanation, exact Timeline source
   ranges and cues. Change main/request and confirm old JSON is rejected.
5. No Gemini/Muse/ChatGPT response or UI acceptance has been exercised here.
