# ChatGPT web handoff — bounded visible-tab prototype

Beta source prototype 0.2.0. This is an unofficial DOM integration, not an OpenAI API route. It has not been exercised in a browser or against a live AI response in this change. The user explicitly chooses one tab and authorizes each automatic send with a Studio button.

## Two modes

- **Chỉ điền prompt** fills an empty recognized composer. The user sends and imports manually.
- **Gửi và nhận JSON từ ChatGPT** requires the user to have attached the correct source video in the selected tab and explicitly confirmed that step in Studio. It fills and clicks one recognized Send control exactly once, waits for the correlated reply, and returns JSON to a review area. It never clicks Apply. Existing plan/schema/range validation remains mandatory.

The extension does not upload files, select or switch models, read cookies/tokens/Authorization, call private ChatGPT endpoints, regenerate, auto-retry, bypass login/CAPTCHA/limits, or collect unrelated assistant history. ChatGPT Auto's OAuth route/model/input remains separate and unchanged. The web model is whatever is actually selected in the tab; it is not represented as Sol low merely because Auto uses that setting.

## Install and use

1. In `chrome://extensions` (or equivalent Chromium browser), enable Developer mode, choose **Load unpacked**, and select `extensions/chatgpt-handoff` in the Beta checkout. Reload the extension and both Studio/ChatGPT pages after updating its source.
2. Open Beta at `http://127.0.0.1:5373` or `http://localhost:5373` in that same browser/profile. The native app's embedded WebView alone cannot receive Chromium content scripts; this prototype requires a Studio browser tab.
3. Open `https://chatgpt.com/` or a normal `/c/...` conversation, sign in yourself, choose your model and attach the correct video manually. Wait for upload processing to finish.
4. Open the extension popup, select that tab, and press **Liên kết tab đã chọn**. Existing ChatGPT composer text is never replaced.
5. Generate the current Studio manual prompt. For auto mode, confirm the video attachment in Studio, then press **Gửi và nhận JSON từ ChatGPT** once. For manual mode choose **Chỉ điền prompt**.
6. Review the returned JSON. The parent may populate an empty JSON draft; it must preserve an existing user-edited JSON draft instead of overwriting it. The component also retains this operation's raw JSON in a collapsed read-only field with **Sao chép JSON nhận được**. Use the existing importer/Apply button to validate and apply deliberately.

The extension cannot prove that an upload reached the provider, that the chosen file is the right video, that the model watched the whole video, or that the web model supports a particular capability. Attachment confirmation is a user assertion. Known visible progress/disabled controls block Send, but absence of such UI is not provider upload confirmation.

## Operation and identity

Channel: `shortcut-studio-chatgpt-handoff-v1`.

- `fill-request` or `auto-request`: `{operationId,requestId,sourceId,analysisKey,prompt,issuedAt,attachmentConfirmed}`.
- `cancel-request`: `{operationId}` on explicit cancel, source/prompt/context change, disabled state or unmount.
- `fill-result` / `auto-result`: `{operationId,response:{ok,code,message,raw?,identity?}}`.
- `auto-progress`: `{operationId,phase,message}`; UI shows the actual phase and elapsed time, never a fabricated percent.
- Before auto Send, the target requests permission; background rechecks tab, asks the current Studio component to confirm the same pending identity, then rechecks the binding and deadline before granting one send. This does not authorize a later resend.

Studio's content script is restricted to the exact two loopback origins on port 5373 and top frame. Background validates extension sender, frame, origin, required identity fields, request age and prompt size. One operation is admitted at a time. Prompt maximum: 2,000,000 characters; result maximum: 4,000,000 characters. Over-limit input is rejected, never truncated.

The selected `{tabId,url,selectedAt}` is stored in `chrome.storage.session`. Tab reload/navigation/closure invalidates it; the one expected home `/` to new `/c/...` URL transition after this operation's Send is permitted. Other conversation changes stop monitoring. Source/context changes invalidate UI callbacks, and importer identity checks remain authoritative.

Auto transport uses extension ports with 15-second heartbeat messages while the operation is active. State is not assumed to survive an extension/service-worker failure: disconnect reports an error and does not resend. Initial connection expires in 13 seconds; Send must be authorized within 12 seconds; readback expires after 10 minutes. A content-script MutationObserver is coalesced, with a bounded fallback check for completion; all timers/observers/ports are released on terminal/cancel/disconnect.

## Reply correlation and completion limits

Before Send, the script snapshots existing user/assistant DOM node identities without reading previous assistant text. After its one click, it requires a newly added user turn whose text matches the exact prompt and therefore includes the request/context IDs. Only a newly added assistant turn after that exact user turn is read. Another user message, missing/replaced target turn, changed conversation or ambiguous match stops or prevents readback.

A result is accepted only after:

- The visible Stop control is absent.
- The correlated assistant exposes recognized final response copy controls.
- Its text is stable for at least 2.5 seconds.
- Exactly one whole JSON document (whole response text or one complete code block) parses without repair and matches `requestId`, `sourceId`, `analysisKey`.

No regex extraction/JSON repair, inferred fields or validation bypass is used. Invalid/non-JSON, mismatched IDs, refusal, known UI limits/login/error, timeout and disconnect produce separate diagnostics. The component and background repeat strict JSON/identity checks. These DOM signs remain conservative heuristics, not an official `response.completed` event; unknown markup can fail closed and require manual copy. They do not prove inference quality or full media coverage.

**Dừng chờ** cancels before Send when the cancellation reaches the target in time, and otherwise stops result monitoring. It does not pretend to cancel an already-sent ChatGPT request; the user may stop that response in the tab. A late cancellation cannot undo an already-clicked Send. No result is automatically applied to the plan.

## Permissions, privacy and limits

Manifest permissions are `tabs`, `storage`, `scripting`; host permission is only `https://chatgpt.com/*`. Studio content scripts match only port 5373. No HTTP callback server, cloud relay, persistent pairing secret, cookie, webRequest, debugger, clipboard-reading or native messaging permission is used. Prompt/result/source data is not logged. `window.postMessage` is a convenience transport within the trusted Studio origin, not protection against already-compromised JavaScript on that same origin.

ChatGPT DOM labels/rich-editor behavior can change. Native text insertion and final controls need real browser acceptance. Auto mode is an unsupported UI integration and is not a promise of extra/free/unlimited quota or provider approval. OpenAI's current terms restrict programmatic extraction; the user should consider those terms when choosing this mode. No hidden backend, account sharing, quota evasion or anti-bot bypass is included.

## Manual acceptance checklist

- Fill-only: empty composer, existing draft, long/newline/non-English prompt, unsupported composer.
- Auto: correct manually attached video confirmed, one explicit send, exact prompt/IDs, one correlated JSON; no Apply until clicked.
- Existing Studio JSON draft preserved; received JSON remains available separately for Copy.
- Streaming/upload progress/limit/refusal/login/error stop correctly; no automatic retry.
- Source/context change before Send, after Send and during readback; old results never applied.
- Double-click, second operation, reload/closed tab, another conversation/user message, extension disconnect, no extension installed, 10-minute timeout and Dừng chờ.
- Normal home-to-conversation URL transition and existing conversation behavior.

No tests, build, AI calls or browser automation were run for this prototype.

References: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns); [OpenAI Terms](https://openai.com/policies/terms-of-use/); [ChatGPT attachment capabilities/limits](https://help.openai.com/en/articles/8400551-chatgpt-image-inputs-faq). Implementation written from scratch; no third-party extension source copied.
