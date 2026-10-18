# Per-part teaser follow-up qualification

Base: `ea86de7`, isolated `feature/visual-preset-engine` worktree. In-progress
follow-up; this document supersedes the earlier blanket OAuth blocker. Do not
infer all-provider completion from the ChatGPT evidence.

## Implemented fixes

- macOS secure save root cause: runtime isolation intentionally sets HOME and
  CFFIXED_USER_HOME to DEV/home. A read-only `security default-keychain -d user`
  failed there, but resolved the account's login.keychain-db under its actual
  account HOME. Account `default` was correctly supplied after `-a`, never as a
  keychain path. Only the credential subprocess now uses `os.userInfo().homedir`;
  all other DEV isolation and the separate DEV service remain intact. No system
  default/search-list change, reset, production-token copy or plaintext tokens.
  A read-only preflight prevents save attempts from opening create/reset dialogs.
- Auth polling tracks the specific new OAuth attempt, rather than treating a
  previously connected session as reconnect success. Callback failure/cancel/
  expiry reaches the editor. Expired session status is honest; refresh uses
  bounded requests, deduplication/backoff, validates new token fields and avoids
  saving a refresh after disconnect. Granted scopes come from the token response,
  not caller-controlled callback query parameters. Issued registration survives
  a failed exchange; disconnect removes that DEV registration.
- Gemini/Muse combined prompt asks for main plans plus independent per-part
  teaserSelection in one web roundtrip. Opaque request ID + source ID + current
  provider/transcript/rules reject stale or wrong-source imports. Strict parser
  rejects malformed parts and out-of-range excerpts after existing trim/Smart Cut.
- Accepted web results are `external-import`; provider/model are self-reported,
  never authenticated-API verification. Export preserves them without invoking
  ChatGPT. After manual changes the hook-only prompt retains the exact locked
  main ranges; stale response detection includes content/provider changes during
  async validation. VisualStyle remains authoritative and does not trigger AI.
- Shared source-speech boundary guard rejects a proposed cut through a known
  short timed cue; bounded retries then explicit fallback. Coarse (>10s) captions
  are not word timing. Semantic appeal/action completeness still needs review.
- Typed transcript edits now reach selection even when cached captions exist;
  transcript identity and provider/model invalidate cache, visual style does not.
- Both packagers use `scripts/worker-runtime-files.mjs`. The missing Windows
  SourceContext copy is fixed. Staged-import closure test covers worker/server's
  relative dependencies. Windows runtime has NOT been tested on Windows.

## Real provider evidence

Artifacts are local, ignored, under `.isolation-verification/teaser-finish/`.
No tokens, raw authentication responses or credentials are included here.

| Workflow | Actual evidence | Status |
| --- | --- | --- |
| DEV ChatGPT auth | User confirmed successful interactive sign-in after HOME fix; new credential-store instance read secure session + refresh token; newly built DEV package reloaded connected/sharing session | Passed sign-in/save/reload; refresh/cancel edge tests are local tests |
| ChatGPT hook API | `node scripts/qa-teaser-hooks.mjs --live`, `teaser-render-8h2GE3/provider-outcome.json`: both parts `selection:ai`, model `gpt-6.1-sol`; supplied transcript + timestamped JPEGs | Passed real requests/strict validation; sparse stills, no audio/video input claimed |
| Gemini web | Actual signed-in Chrome conversation `db1815b62da75757`; text-only response copied back by user. Source/request match; hook intervals59.88–66.68 and186.28–192.53 | First response correctly rejected: part IDs were strings `part-1`/`part-2`, not numeric1/2. Not accepted/qualified from that response |
| Muse web | Confirmed by user as https://muse.ai/; observed authenticated chat + file attachment interface, no invented API or disabled bridge | Real selection response and video-analysis capability still pending |

Native Chrome automation repeatedly lost its target window/timed out. No
unexpected file was uploaded: the file chooser target was checked before upload.
The user was asked for full-prompt web roundtrips and original JSON responses;
these must pass validation before claiming web workflow qualification.

## Real-video evidence so far

Existing DEV library sample: Vietnamese construction/house lifting video,
source49a97ade-a270-4274-b32b-d0281dc98617,648.58s/249 automatic caption cues.
An unchanged first200s fixture,480×270, was prepared with77 source cues; a small
bitrate encode preserves timing for browser verification. No unrelated private
video was used. Automatic Vietnamese captions are imperfect; rounding and lack
of word timings limit boundary precision.

Ordinary authenticated UI Auto with this local sample returned independent AI
hooks for both parts; `real-ai-selection-response.json` records exact results.
One measured run: Part1 retained[6,95], hook[90,95] =4.0 output seconds, a complete
sentence about dry/windy dusty conditions, relevant to site preparation but less
compelling than a direct lifting result (model explicitly records this limit).
Part2 retained[101,200], hook[186,192] =4.8 output seconds, surprise that extensive
shoring produced only2.5cm progress, directly previewing the measurement reveal.
These are observed selections, not an engagement-performance claim.

The browser harness initially had selector/wait/inspector-cache errors; those are
QA failures, not passed UI exports. A later ordinary UI export reached the worker
queue, then web+worker DEV stopped while polling (ECONNRESET). Cause is unknown;
do not attribute it to rendering without evidence. Snapshot job97c28a9a-e963-4356-
85aa-02db103f9fb7 was still queued with its effective AI hooks when read from DEV
history. Recovery/render/playback qualification remains pending until recorded.

## Checks

- Focused follow-up31/31 (includes auth state/store, external contracts, hook-only
  locked-range preservation, source/prompt/part rejection, cache and manifests).
- Earlier follow-up full254/254, isolation17/17, TS/lint pass; final full run after
  hook-only additions is pending in `full-final.tap` / `isolation-final.tap`.
- Live synthetic source QA: three jobs/six MP4, legacy, hook-only Dip, explicit
  Flash; scene/audio order, frames/duration and snapshots pass at
  `teaser-render-8h2GE3/result.json`. AI selections required for both parts.
- DEV package built/codesign passed and real session reload passed. A final
  rebuild includes hook-only UI additions; see `package-final.log`.
- No full historical RC matrix, Windows execution or unrelated feature work.

## Remaining before complete verdict

1. Finish real UI export and decoded/audio/playback review; document independent
   hooks, durations, repeated original occurrence, snapshots and restart result.
2. Accept actual Gemini and Muse web results through the current prompt/source
   contexts, export and inspect them. Reject malformed/stale JSON; never repair
   output silently and label it provider-verified. Native video capability needs
   actual video input and evidence; text-only results must say text-only.
3. Record final check counts/package results, commit coherent changes, clean tree.

No production app/data/ports or separate AFF MUSE project was modified. No new
renderer, YouTube stack, subscription, provider SDK or unrelated C–H work.
