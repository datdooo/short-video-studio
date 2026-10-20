# Current adaptive/editorial selection — 2026-10-20

New selections use `same-part-hook-v3-editorial` / `adaptive-editorial-v3`.
Prefer5–9 rendered seconds; hard9 including any boundary adjustment; a complete
shorter unit >=0.5s is allowed. Limits derive from playback speed (1.25× means
max11.25 source seconds). First10 rendered main seconds remain excluded across
retained gaps. Main/locks/original occurrence and queued snapshots are preserved.

`teaser-candidates.mjs` supplies up to12 diverse speech/visual-review/relative-replay
proposals plus bounded early/middle/late context. No fixed genre or keyword winner.
Replay peaks actually propose windows; model compares context/completeness first.
Correlated comment/replay evidence is corroboration, never two additive quality votes.
Selected metadata records `heatmapEvidence.available/supportsSelection/peakTimes`.

One analysis compares proposals and returns concise evidence/complete-ending claims
and up to2 diverse alternatives. Up to9 candidate-local stills cover3 proposals;
stills never prove continuous action. Shared web/GPT schema and cue/range checks
reject unsupported evidence, opening overlap and >9s choices. Cache/prompt identity
is versioned; styling/music does not invalidate analysis. Legacy stored hooks retain
old validators/hash/transition behavior until explicit reselection. The UI permits
cached alternatives or labeled manual range adjustment without changing main.
Fallback is explicitly editorial-unverified; several competing speech candidates
require semantic selection, otherwise unavailable rather than earliest/longest.

See `docs/adaptive-teaser-qualification.md` for actual tests and auth blocker.
New real inference/editorial quality is NOT established by historical provider QA.
Everything below records the earlier contract and evidence.

---

# Current hook additions — 2026-10-19

New `selectionPolicy:later-main-v1` excludes the first10 rendered seconds of main
content (retained non-padding presentation time /1.25, not source gap distance).
AI/fallback/web input/import use the same permitted intervals; no coherent later
cue means unavailable and main stays unchanged. Old opening hooks remain loadable,
are flagged for explicit reselection, and queued snapshots are never rewritten.
New teaser creation defaults to Rainbow Light Leak; legacy policies retain inherited
Dip/Flash until explicitly changed. See `background-music.md` and
`music-qualification.md`. Historical qualifications below are retained, not a fresh
live-provider verification of these changes.

---

# Per-part teaser hooks

Current DEV: `recovery/visual-dev-reconstructed`, reconstruction base `d1e2cd6`.
Historical implementation began at `6ffd2d4`; that local Git history is unavailable.
Current follow-up implementation and evidence: `docs/teaser-hooks-qualification.md`.
The original blocked qualification below is historical. DEV Keychain saving is
fixed and ChatGPT live two-part requests pass. Repaired Gemini/Muse web imports
now pass the documented canonical validation/render checks. See their separate
web-workflow evidence; their status is never inferred from GPT success.

## Reuse decision (bounded research, 2026-10-18)

| Repository / source inspected | License / actual implementation | Decision |
| --- | --- | --- |
| [DELINSHABU/ShortsEditor](https://github.com/DELINSHABU/ShortsEditor), README, package.json, `lib/gemini-service.ts`, analyze route | README claims MIT, but no root LICENSE or GitHub license grant was established. Next15 app + Google Generative AI SDK, fluent-ffmpeg, downloader/UI dependencies. One download-analysis path explicitly simulates results. Direct analysis exists but is not a same-part teaser library. Last push inspected:2025-09-06. | No code copied/dependency added: license unclear, overlapping app stack and simulated path unsuitable. |
| [chadbar/autoclip](https://github.com/chadbar/autoclip), README, pyproject.toml, analyzer.py, models.py | No license file/declared license established. Actual Gemini file upload + JSON-schema timestamp selection and Pydantic parsing. Python>=3.10, google-genai, faster-whisper, Pydantic, Typer. Last push inspected:2026-03-26. | No code copied/dependency added: unclear license, Python/Whisper stack unnecessary for this Node22/macOSARM64 worker. |

No third-party install scripts, demos, clones or credentials were used. Reused
project code: ChatGPT account credential/refresh/model/Responses adapter; FFmpeg
trim/concat/title/transition pipeline; subtitle repetition; preview seek mapping;
shared transcript parser; VisualStyle job snapshots; DEV isolation. Small custom
gaps: teaser contract/validation, bounded selection/cache orchestration and wiring.
No external source was adapted, so there are no new attribution obligations.

Tracked change map: `lib/teaser-hooks.mjs`/`.d.mts` and test (contract/presentation);
`worker/teaser-selection.mjs` and test (provider/cache); `worker/server.mjs` and
`plan-validation.mjs` (API/render/snapshots); `lib/edit-plan.ts`, `custom-time.mjs`,
`subtitles.mjs`/`.d.mts` (model, duration, shared parser, repetition);
`lib/visual-style/cut-transitions.mjs`/`.d.mts`, `worker/cut-transition.mjs`,
`components/cut-transition-panel.tsx` (same transition engine, per-boundary preset);
`app/page.tsx` (selection, preview/provenance); `scripts/qa-teaser-hooks.mjs`,
macOS/Windows package scripts (dependency copy); this document, architecture map,
Smart Auto Cut status, handoff and next-task docs. No runtime dependency added.

Official protocol checks:
[OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses),
[Gemini video input](https://ai.google.dev/gemini-api/docs/video-understanding),
[Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
Documented API capabilities do not establish access/capabilities of this user's
configured account/model. [Muse docs](https://muse.ai/docs) returned401 during
inspection; no analysis endpoint or generation-only classification was invented.

## Original provider status (historical; superseded by follow-up qualification)

| Provider | Actual project integration | Verification |
| --- | --- | --- |
| GPT/ChatGPT | Existing DEV OAuth/Keychain/direct Responses integration. Hook adapter uses that account's model catalog, JSON schema, text + at most six timestamped JPEGs per part. No API key or new subscription. | No configured DEV session; no successful remote text/image request. Real two-part AI selection remains blocked. |
| Gemini | Current `/api/gemini/*` intentionally rejects API use; UI opens Gemini web and imports JSON. Old Antigravity bridge remains disabled in the server. | No working analysis adapter claimed. Official native audio/video capabilities were researched, not tested on a configured model. |
| Muse | Existing `https://muse.ai/` web/copy-paste workflow and strict plan JSON parser; no configured authenticated analysis API. | No successful request and no analysis API claimed. Not assumed equivalent to GPT/Gemini. |

New GPT automatic plans pass through the source-specific teaser endpoint after
existing normalization/smart-boundary cleanup. Gemini/Muse combined imports now
attach their validated external selections without calling GPT; hook-only refresh
preserves locked main content. Export rejects stale external inputs and never
silently substitutes another provider or heuristic for an external import.
New batch-generated plans request the same selector before queue snapshotting.
Legacy saved plans, Manual cut and the offline Mock planner do not silently gain
hooks. Explicit opt-in API selection is supported for deterministic QA fixtures.

The selector requests each part independently with its allowed main ranges, title/
part context, available timed captions/transcript, optional existing chapters/
description/comment clusters, and bounded frames when a provider is available.
Edited UI transcript is passed as data; the existing shared timestamp parser is
reused. No new comments/heatmap retrieval, ASR download, video-analysis service,
provider, Sports Voiceover or main-content ranking pipeline is introduced.

System instructions delimit external text/images as untrusted data. Structured
output contains source start/end, appeal, relation to this part, evidence times
and limitations. There is no confidence probability. Frames are sparse stills;
motion/audio/video comprehension is never inferred from them. Audio/video payloads
are not sent through an unverified API capability.

The model is selected from the existing account catalog. A rejected image/schema
request gets at most one text-only retry with an explicit limitation. Other bad
JSON/ranges/timeouts get at most two attempts per part; auth/model failures stop
early. Rate-limit retry honors Retry-After only within a5s bound, otherwise falls
back. Each request has a90s timeout and a1200-output-token cap; endpoint deadline
240s, sequential parts, at most four inference requests. Client disconnect aborts.
Remote errors are reduced to non-secret reason codes; no credentials/raw payloads
are printed. No unavailable provider is silently replaced by a new paid service.

## Contract and compatibility

Main `part.segments`, chronology, padding and manual locks remain authoritative.
The old `part.hook` headline remains a string and is not the video excerpt.
New `plan.teaserPolicy: "per-part-v1"` marks opt-in/new automatic selection.
`part.teaser` is separate data:

```ts
{ version:1, status:"selected", start:number, end:number,
  selection:"ai"|"fallback"|"external-import", reason:string, relation:string,
  evidenceTimes:number[], limitations:string[], provider:string, model:string,
  promptVersion:string, inputKey:string, rangeKey:string,
  transition:"inherit-or-dip-black" }
// Or {version:1,status:"unavailable",reason:string,rangeKey:string}
```

Target: **5 rendered seconds =6.25 source seconds at existing1.25× playback**.
Allow4–6 rendered seconds for a complete sentence/action; shorter contiguous ranges
may shorten the hook. Minimum usable excerpt0.5s. Tiny entry ranges unable to
support a frame-safe transition produce explicit unavailable status. A hook must
fit wholly inside one non-padding range of that same part. No bridging excluded
gaps or footage from the other part. Unknown fields, non-finite/string timestamps,
oversized provenance, stale range keys, unsupported policies or bad evidence
timestamps are rejected at the worker boundary and normalizer.

Fallback is deterministic: earliest longest retained contiguous range, optionally
a complete caption sentence within the duration bounds. It states semantic appeal
is **unverified**, records its reason, and is visibly labeled Fallback in UI. It
does not qualify AI selection. Empty/too-short parts are explicitly unavailable.

`presentationSegments(part)` derives `[teaser, ...mainSegments]`. Main content,
including the hook's original occurrence and any existing padding, stays intact.
Duration includes the repeated excerpt. Preview, source/output seek and subtitle
mapping use the same presentation order. Legacy plans without teaser data use the
original segment array and graph. Original main-duration acceptance rules remain.

Hook→main uses the existing scene-only transition renderer: inherit explicit Dip
Black/Flash White; ordinary None gives a **hook-only Dip Black**, keeping ordinary
cuts None. The existing centered/clamped dip overlays retained frames, adding no
extra timeline duration. It does not fade audio/text. Title entrance runs once at
part start. Hooks use the existing finite-stream EOF handling to preserve audio
tail/frame count; old non-hook options are unchanged.

Custom Time changes only main ranges, invalidates stale selection and supplies an
explicit provisional fallback for preview. Before export the selector refreshes
against the exact locked ranges. The UI accepts the returned plan only if source/
main-content request identity is still current. Queued plans carry independent
full hook/range/provenance snapshots; rendering a valid submitted selection does
not silently replace it. Job history/delete/recovery uses existing plan storage.

Cache: SHA256 of immutable source media (memoized by source ID/size/mtime), source/
part context, main ranges, bounded analysis text/signals, provider/model, frame
sampling policy and prompt version. VisualStyle is excluded. Cache hits bypass
frames/inference; AI results persist, fallbacks have60s TTL. At most256 disk entries;
private mode0600; read/write failure cannot fabricate AI or discard valid output.
Known original caption timing is preserved separately from edited/rounded typed
transcript input: edits drive semantic analysis, original cues guard clipping.
Bounded `speechBoundaryCues` reach the selector; their timing participates in cache
identity and cached AI is revalidated. This does not establish word-level timing
or action coherence. Without original cues, typed timing remains approximate.

Changing analysis inputs invalidates the corresponding part only. Style handlers
do not call selection. Regenerating with unchanged inputs reuses cache.

## Original qualification (historical; keep results, do not repeat automatically)

Recorded local artifacts (ignored): `.isolation-verification/teaser-hooks/`.
Full unit suite:243/243, no skips/failures (`final-tests.tap`). Isolation:15/15.
`npx tsc --noEmit --incremental false` and `npm run lint` exit0
(`final-tsc.log`, `final-lint.log`). DEV package rebuild under Node22 passes
(`package-final.log`); deep/strict codesign passes. Packaged bootstrap, web5273,
worker8887, private data root, current-only storage and new runtime-file hashes
pass at `teaser-package-yaZS3l/result.json`. This is startup/dependency smoke,
not another full RC matrix or a claim of real AI functionality.
Small real render: `teaser-render-6doxyk/result.json`, three jobs/six MP4s;
legacy, hooks+None (hook-only Dip), hooks+Flash, title Fade In, fixed cues.
Each part uses distinguishable scenes and source audio frequencies. Checks cover
decoded scene order, repeated main occurrence, PCM pitch/tail (within one AAC
frame), burned subtitle repetition, exact output frames/duration and independent
snapshots. Offline fallback examples are P1 source8–14.25 and P2 source24–30.25;
main ranges remain P1[0,2]+[8,16], P2[16,18]+[24,32]. Hook outputs13s vs legacy8s.

Browser source test (`teaser-browser-1Fqr7r/result.json`) uses a mocked **main planner/session only**, real source/
smart-cut/hook endpoints and explicitly missing QA credentials. It checks both
part previews, repeated-source seek and no style-triggered hook requests/video
reset. This is UI/fallback evidence, **not** real AI-provider evidence.

After DEV ChatGPT sign-in is repaired, run the bounded real verification:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node scripts/qa-teaser-hooks.mjs --live
```

It uses the actual DEV Keychain service with isolated fixture data, requires AI
for **both** parts, records provider/model/validated selection/limitations without
raw private payloads, then checks excerpts against the actual local video and
subsequent content. Any fallback fails live qualification. No successful live
request has been run at this checkpoint. Do not claim GPT/Gemini/Muse works until
that succeeds. Full Smart Auto Cut C–H and main-candidate fusion remain incomplete.

## 2026-10-20 — part-arc / curiosity selection (source-only revision)

Auto uses the existing authenticated ChatGPT adapter, not a provider ensemble.
It reads bounded whole-part context, metadata/chapters/comments/relative replay,
available cached local scene/audio proxies and same-part candidates in one
selection request. No new classification call. The model must compare immediate
1–2s attraction, specific unusual detail/result, the truthful question later main
answers, relevance and complete meaning; punctuation/duration aren't rankings.
The existing schema returns the winner and at most two distinct alternatives,
with concrete comparative reasons, observations and ending evidence.

Candidate changes: retain multi-sentence boundary options, always propose visual
windows even with abundant speech, reserve slots for replay and available context/
local proxy proposals, and keep <=12 diverse candidates. All candidates request
four local timestamped stills (<=48, <=512×288, shared45s extraction budget), rather
than three candidates only. No full transcode. Scratch JPEGs are removed in
finally; partial extraction reports actual coverage. Stills cannot prove motion,
audio or an action's completion. Local activity is a location hint, not quality.
Unavailable cached local signals are not fabricated or newly analyzed here.

Code validates local speech/end cues and actual visual support as well as existing
same-part, no-gap, first10 rendered main seconds, <=9 rendered seconds and boundary
constraints. It never edits returned AI timestamps. At most two attempts; existing
provider retry/backoff remains. Auth/quota/timeout/insufficient evidence produces
“Chưa chọn được teaser bằng ChatGPT”; no automatic heuristic winner. The editor
retains main and offers Retry, Custom Teaser and explicit no-teaser export consent.
Gemini/Muse remain explicit imports, checked before the generic reuse shortcut.

Prompt/cache version `same-part-hook-v4-part-arc` replaces v3 for NEW analysis.
Saved v3 adaptive teasers still validate and queued snapshots aren't migrated.
Source/content/ranges/cues/supporting inputs/provider/model/prompt determine cache;
style does not. Source/runtime auth/inference and editorial quality of this revision
have NOT been verified: user explicitly disallowed tests, calls, render and browser
QA. No claim of better real-video choices or working current inference is made.

## 2026-10-20 — Vietnamese editorial explanations / inline Timeline

New prompt version `same-part-hook-v5-vietnamese`; v3/v4 adaptive saved teasers
remain valid, with no range/evidence migration. Shared explanation-language rules
are included in ChatGPT teaser/main and external GPT/Gemini/Muse plan prompts.
Reason, relation, ending, alternative reasons, retain/exclude decisions, limitations
and unavailable caveats must be Vietnamese in the SAME request. Source quotes,
transcript, subtitles, title/hashtags and language codes retain source language;
quotes inside explanations require a Vietnamese interpretation. No translation call.
Main analysis cache keys also include the explanation-policy version. Display
uses a lightweight Vietnamese-text guard: untranslated legacy/internal notes show
an honest Vietnamese “not yet available in Vietnamese” notice; raw historical
explanations remain untouched in the plan. This is not automatic translation or
proof of language quality. Current provider compliance remains unverified.

Inline Custom Teaser accepts a description or source timecode in each Part's
Timeline, no separate section. Explicit source edits/results populate a valid candidate in the one teaser
row; Apply installs it immediately, optional audition never gates the button; unfinished invalid drafts don't enter the plan. “Tạo/chọn lại teaser” uses
ChatGPT only for a description/empty Auto request, never for timestamp input.
No confirmation checkbox, extra timestamp pair or new preview/rendering pipeline.
Hook→Main keeps its existing common value and foreground-only scope.

## Latest export gate — both teasers required

Supersedes earlier no-teaser consent/export fallback descriptions. New render
and batch/resume paths require a technically valid selected teaser in BOTH parts;
there is no main-only option or render-triggered AI/heuristic fill. Incomplete
plans can be loaded/previewed/edited; each Timeline shows the blocking issue.
Explicit selection retries stay bounded. Old history, original occurrences,
queued snapshot content and existing exports remain intact.
