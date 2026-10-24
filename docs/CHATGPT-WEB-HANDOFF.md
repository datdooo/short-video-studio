# Web AI handoff — one-button source workflow (extension 0.3.0)

Beta source update after build1105. Not yet packaged or exercised against a live
website in this change. One implementation serves ChatGPT web, Gemini and Muse;
ChatGPT Auto's model, text-only input, OAuth and request count are unchanged.

## Normal use

1. Once: load `extensions/chatgpt-handoff` as an unpacked Chromium extension.
   After an extension update, Reload it and reload Studio and the AI pages.
2. Open Beta Studio at `http://127.0.0.1:5373` (or localhost:5373) in the same
   browser/profile as the extension. Sign in to the desired AI site yourself.
3. Prepare the source in Editor and choose ChatGPT Web / Gemini / Muse. Keep an
   empty composer in the existing AI tab. Press **Phân tích bằng …** once.

The button prepares the complete current prompt, locates the matching open tab,
transfers the full source video (or its automatically prepared smaller copy), waits for its visible attachment to
be ready, sends once, reads the matching completed JSON, then runs the existing
importer/worker validation before applying the plan. There is no attachment
checkbox, prompt textarea, separate Send or Apply in the primary workflow.
The managed editing source is never replaced or modified. The separate web copy
may be re-encoded at lower resolution; it is not trimmed or retimed. No private
upload endpoint is called. Text plus that full-duration video go through the site's
own file input and Send button. The web model remains whatever the user selected
in that website, not necessarily ChatGPT Auto's configured Sol low.

Exactly one eligible open tab is selected automatically. If several tabs match,
select the intended tab once from the extension popup. Per-provider bindings are
separate. Exact allowed origins/routes:

- ChatGPT: `https://chatgpt.com/`, `/c/<id>`.
- Gemini: `https://gemini.google.com/app`, `/app/<id>`.
- Muse: `https://muse.ai/`, `/thread/<id>`.

Authentication pages are not automated. Existing text or attachments in the AI
composer are preserved and stop the new operation rather than being overwritten.
The native embedded WebView does not run Chromium extensions; use the browser
Studio page. No extension installation or login is performed automatically.

## UI and import integrity

One status area reports preparation, video transfer, website upload, waiting,
receiving and validation. Transfer percentage is acknowledged bytes/known total,
labelled as transfer to the tab, not upload to the provider or overall inference.
Other steps show elapsed time; no inference percentage is fabricated.

The existing full prompt/JSON controls remain under **Thao tác thủ công** for
recovery; prompt text is further collapsed. A user-entered JSON draft is never
replaced by preparation or automatic output. Automatic output is passed directly
to the importer and retained in collapsed error details when validation fails.

Success means the plan passed `parseMusePlan`, normalization, auto-cut import,
external teaser validation, source/revision/ticket and lock checks, and was
committed. A JSON response by itself is not success. Import errors keep the old
plan. Manual import is an explicit Apply action without a second checkbox; its
attachment declaration is not represented as a verified website receipt.

## Transport, attachment and cancellation

The Studio content script fetches only the constructed existing local route
`http://127.0.0.1:8987/api/sources/<validated-source-id>/manual-video?variant=<prepared-key>` with no
credentials. No arbitrary URL is accepted and worker Origin/CORS is unchanged.
The prepared variant key, Content-Length, MIME, media ID, filename and byte count must
match. Base64 is used only for transient extension messages up to192KiB of binary
per chunk, with one chunk awaiting ACK. It is never placed in the prompt,
clipboard, logs or a giant single message. The target assembles one File for the
website; this still requires memory for the complete video. No peak RAM is
measured. Local safety cap:512MiB, separate from each website/account's limits.
Sources above512MiB are prepared automatically as described below. Only a failed
size/coverage check or unsupported website upload stops the flow; no silent
text-only fallback is sent.

The target respects the file input's accept list, checks for the exact filename
attachment card, no recognized upload/progress/error and a stable enabled Send
control. It records `{mediaId,filename,bytes,variantKey,evidence:'composer-upload-ready'}`.
This is **visible composer evidence**, not a provider-signed receipt, proof of
video decoding, whole-timeline comprehension or model inference quality. An
empty accept list alone is not proof of video support. Unknown DOM or rejection
stops the operation. No claim that all three sites accept video is made.

Before Send, the target requests permission and the current Studio source/input
revision is rechecked. The background rechecks tab/URL/binding and gives a fresh
12second authorization. Exactly one click is permitted. Video preparation/upload
has a10minute bound, response waiting a10minute bound, with20minutes for the
extension exchange. Prior smaller-copy preparation has its own20minute bound.
Cancel aborts local fetch/import and stops monitoring. It cannot undo an already
sent request or pretend to cancel remote inference; the user can stop it in the
AI tab. A website may retain an already attached file or prompt after cancellation;
the extension does not silently delete that browser draft. No auto retry occurs.

## Automatic smaller video delivery — 2026-10-25

For source files at or below512MiB, use the original. Above that threshold:

- YouTube: request the highest fitting lower-resolution rendition under720p,
  480p or360p as appropriate for the source, with a480MiB target and actual-size
  verification. No upscale, whole-source reimport, subtitle/comment fetch or new
  AI call. The prepared MP4 retains the managed source's original audio, encoded
  for delivery at96kbps, and checked relative audio/video timing.
- If remote preparation fails, or for a local source, automatically encode a
  separate full-length H.264/AAC review copy from the managed original. Resolution
  and bitrate are bounded; fallback attempts are finite. No trim, speed change,
  concat, `-shortest` or `-fs` truncation is used. The final export settings and
  editing media path are untouched.
- Validate actual file bytes below512MiB, duration, available video/audio spans,
  audio presence and display aspect. A250ms codec/container tolerance checks
  alignment; it does not rewrite a user's endpoint or establish semantic content
  equality. Same YouTube ID/duration cannot prove the remote video was never
  edited; the manifest states this limitation. Local re-encoding uses the managed
  original by construction.
- Reuse the prepared file from `dataRoot/cache/web-ai-video`, keyed by source
  file identity/hash, duration/timing, source URL and preparation policy. The
  delivery variant key also binds the output hash. Request/import fingerprints,
  extension transfer, receipt and serving URL all refer to this variant. A wrong
  variant is rejected before streaming or applying JSON. Prompt version advances
  to `external-editing-full-media-v6`; old prompts are not silently rebound.
- Concurrent consumers share preparation and source hashing. Cancellation
  reference counts retain source protection through process cleanup; streaming
  is protected too. No permanent source lock survives a worker restart. Use the
  existing bounded media lane/thread policy, not an independent process pool.
- Temporary files belong to a newly created operation directory; only that
  directory and a proven own publication inode may be removed after failure.
  Unknown existing cache entries are preserved. Prepared files are per-file
  bounded but this change does not add a total cache eviction policy. No source,
  media, export, credential, draft or backup cleanup is run by this source change.

The model receives the original/full-resolution distinction, actual dimensions,
source clock and delivery method in the prompt, rather than a false claim that
an untouched original was supplied. Reduced visual detail can reduce what the
website/model can recognize. There is no claim of identical AI quality or quota.
If a full-length valid file cannot be made under the limit, stop clearly and
preserve source/plan; never drop scenes, split data into extra AI requests or ask
AI to pretend it watched unavailable media.

## Correlation and limits

A pre-send baseline identifies old turns. The new user turn must match the whole
prompt and its source filename; only later assistant content can be considered.
Complete JSON must match requestId/sourceId/analysisKey. No substring JSON repair,
invented fields, fallback model, extra AI request or validation bypass is used.
Muse's proactive/async messages are not assumed to be the result: unidentified
turns fail, and a plain task acknowledgement cannot be applied as an edit plan.

DOM completion uses stable text, absence of recognized Stop/thinking state and
recognized response copy controls. These are unofficial DOM heuristics, not API
response.completed. Invalid JSON, refusal, wrong identity, unsupported upload,
unknown controls, navigation, disconnect and timeout preserve the plan and expose
short errors with diagnostic codes in collapsed Details.

No cookies, tokens, Authorization, private AI APIs, logged-in storage exports,
new backend, new dependency, native bridge, debugger or quota-bypass mechanism.
Permissions remain tabs/storage/scripting plus the three exact AI host origins.
Source/request/context guards and unchanged worker validation are authoritative.

## Research and manual acceptance

Read source/approaches from:
- [Web ChatGPT browser bridge](https://github.com/Blaxzter/Web-ChatGPT-API-Chrome-Addon)
- [Turn correlation/parser design](https://github.com/DrA1ex/chatgpt-bridge/blob/main/docs/CHATGPT_DOM_PARSER.md)
- [Attachment-aware queue](https://github.com/kgruiz/chatgpt-queue)
- [Gemini provider selectors](https://github.com/YosefHayim/ai-browser-bridge/blob/main/src/features/providers/gemini/geminiPage.ts)
- [Muse DOM bridge](https://github.com/Some1sm/MuseBridge/blob/main/bridge_config.example.json)
- [Muse visible browser bridge](https://github.com/cherry-nft/codex-muse-bridge)
- [FFmpeg timestamp/frame sync contract](https://github.com/FFmpeg/FFmpeg/blob/master/doc/ffmpeg.texi)
- [Gemini upload documentation](https://support.google.com/gemini/answer/14903178?hl=en)
- [ChatGPT file/context documentation](https://learn.chatgpt.com/docs/use-chatgpt)

The implementation is local; no third-party dependency/source tree, credential
reader or browser-state exporter was installed. Repo examples are implementation
references, not proof that our browser/account supports the same DOM or media.

Manual checks: each provider, one open tab and multiple tabs, actual original
video attachment and one Send, exact JSON automatic apply, invalid JSON/IDs/range,
old result after source/main/input change, double-click, Cancel during each phase,
existing composer text/file and Studio JSON draft, upload rejection/limits,
reload/disconnect/navigation, and original draft/plan remaining after failure.

Only source/docs/diff review in this change. No tests, lint/typecheck, build,
live AI, video upload/download, ASR, render or browser automation. Build1105 in
release/Applications remains unchanged until a separate authorized package step.
