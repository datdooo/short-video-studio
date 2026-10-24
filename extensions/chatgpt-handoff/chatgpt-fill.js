(() => {
  if (globalThis.__shortCutStudioHandoffV3Installed) return;
  globalThis.__shortCutStudioHandoffV3Installed = true;
  const channel = "shortcut-studio-chatgpt-handoff-v1";
  // Provider-specific DOM entry points; unsupported sites fail closed. No
  // internal API, cookie access or assumption that an attachment was understood.
  const site = location.origin === "https://chatgpt.com" ? {
    provider: "chatgpt-web", name: "ChatGPT", composer: 'textarea#prompt-textarea,#prompt-textarea[contenteditable="true"]',
    user: '[data-message-author-role="user"]', assistant: '[data-message-author-role="assistant"]',
    container: 'form', promptBodies: '[data-user-message-bubble],[data-message-content],.whitespace-pre-wrap',
    send: 'button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"],button[aria-label="Send"],button[aria-label="Gửi"],button[aria-label="Gửi tin nhắn"]',
    route: pathname => pathname === "/" || /^\/c\/[a-zA-Z0-9-]+\/?$/.test(pathname), home: "/"
  } : location.origin === "https://gemini.google.com" ? {
    provider: "gemini", name: "Gemini", composer: 'rich-textarea [contenteditable="true"][role="textbox"],rich-textarea .ql-editor[contenteditable="true"]',
    user: 'user-query', assistant: 'model-response',
    container: 'input-area-v2,input-area,.input-area-container,form', promptBodies: '.query-text,.query-text-line,[data-test-id="query-text"]',
    send: 'button.send-button,button[aria-label="Send message"],button[aria-label="Send"],button[aria-label="Gửi tin nhắn"],button[aria-label="Gửi"]',
    route: pathname => /^\/app(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(pathname), home: "/app"
  } : location.origin === "https://muse.ai" ? {
    // Source selectors: Some1sm/MuseBridge bridge_config.example.json and
    // muse_bridge.py. They are DOM hints, not proof of upload/model capability.
    provider: "muse", name: "Muse", composer: 'textarea[placeholder="Message"]',
    user: '[data-role="user"]', assistant: '[data-role="assistant"],[data-hatch-assistant-message-body="true"]',
    container: 'form', promptBodies: '[data-role="user"],[data-hatch-user-message-body="true"],.whitespace-pre-wrap',
    send: 'button[aria-label="Send"],button[aria-label="Send message"],button[aria-label="Gửi"],button[aria-label="Gửi tin nhắn"]',
    route: pathname => pathname === "/" || /^\/thread\/[a-zA-Z0-9_-]+\/?$/.test(pathname), home: "/"
  } : null;
  if (!site || !site.route(location.pathname)) return;
  const messageSelector = '[data-message-author-role],user-query,model-response,[data-role="user"],[data-role="assistant"],.hatch-chat-groupable-bubble';
  function composerContainer(composer) {
    const form = composer.closest(site.container); if (form || site.provider !== "muse") return form;
    // Muse can have a non-form composer. Only accept its nearest bounded
    // ancestor containing the explicit Send control, never the whole page/log.
    let container = composer.parentElement;
    for (let depth = 0; container && depth < 5; depth++, container = container.parentElement) {
      if (container.matches('main,[role="log"],body') || container.closest(messageSelector)) break;
      const sends = [...container.querySelectorAll(site.send)].filter(visible);
      if (sends.length === 1) return container;
    }
    return null;
  }
  const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
  const MAX_CHUNK_BYTES = 192 * 1024;
  const handled = new Set();
  let currentAuto = null;
  const reply = (code, message, ok = false) => ({ ok, code, message });
  const normalize = (value) => String(value).replace(/\r\n/g, "\n").replace(/\n$/, "");
  const visible = (element) => {
    const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  function streaming() {
    if (site.provider === "muse" && [...document.querySelectorAll('.hatch-chat-groupable-bubble [class*="animate-pulse"],[role="log"] [class*="typing"],[role="log"] [class*="thinking"],[role="log"] [aria-label*="thinking" i]')].some(visible)) return true;
    return [...document.querySelectorAll('button[data-testid="stop-button"],button[data-testid="stop-generating-button"],button.stop-button,button[aria-label]')]
      .some((element) => visible(element) && (element.dataset.testid?.startsWith("stop-") || element.classList.contains("stop-button") || /^(stop|dừng|ngừng)(\s|$)/i.test(element.getAttribute("aria-label") || "")));
  }
  function pageError() {
    const alert = [...document.querySelectorAll('[role="alert"]')].find((element) => visible(element) && !element.closest(messageSelector)
      && /limit|quota|too many|rate|giới hạn|hết lượt|đăng nhập|log in|sign in|something went wrong|lỗi xảy ra|unsupported|not supported|invalid file|file type|file too large|upload failed|không hỗ trợ|không được hỗ trợ|tải lên.*lỗi/i.test(element.textContent || ""));
    return alert ? reply("CHATGPT_PAGE_ERROR", `${site.name} báo giới hạn, đăng nhập hoặc lỗi tải lên. Xem tab đã chọn; chưa tự gửi lại.`) : null;
  }
  function composerText(composer) { return composer instanceof HTMLTextAreaElement ? composer.value : composer.innerText; }
  function findComposer(expectedPrompt) {
    if (streaming()) return { error: reply("CHATGPT_BUSY", `${site.name} đang trả lời. Không gửi thêm lượt mới.`) };
    const error = pageError(); if (error) return { error };
    const candidates = [...document.querySelectorAll(site.composer)]
      .filter((element) => visible(element) && !element.closest(messageSelector));
    if (candidates.length !== 1) return { error: reply("COMPOSER_UNSUPPORTED", `Không xác định được ô soạn thảo ${site.name}. Kiểm tra tab đã chọn.`) };
    const composer = candidates[0];
    if (composer.matches(':disabled,[aria-disabled="true"],[aria-readonly="true"],[readonly]')) return { error: reply("COMPOSER_DISABLED", `Ô soạn thảo ${site.name} chưa sẵn sàng. Kiểm tra tab đã chọn.`) };
    const existing = composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent || "";
    if (expectedPrompt === undefined ? existing.length > 0 : normalize(composerText(composer)) !== normalize(expectedPrompt)) {
      return { error: reply("COMPOSER_HAS_DRAFT", "Ô soạn thảo có nội dung khác. Giữ nguyên bản nháp; chưa bấm Gửi.") };
    }
    return { composer };
  }
  function fillComposer(prompt) {
    const found = findComposer(); if (found.error) return found;
    const composer = found.composer; composer.focus(); let inserted = false;
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) { setter.call(composer, prompt); composer.dispatchEvent(new Event("input", { bubbles: true })); inserted = true; }
    } else if (typeof document.execCommand === "function") {
      const selection = document.getSelection();
      if (selection) {
        const range = document.createRange(); range.selectNodeContents(composer); range.collapse(false);
        selection.removeAllRanges(); selection.addRange(range);
        inserted = document.execCommand("insertText", false, prompt);
      }
    }
    if (!inserted || normalize(composerText(composer)) !== normalize(prompt)) return { error: reply("FILL_UNVERIFIED", "Chưa xác nhận đủ prompt. Giữ nội dung để kiểm tra; chưa bấm Gửi.") };
    return { composer };
  }
  function validMessage(message) {
    return typeof message.operationId === "string" && !handled.has(message.operationId) && typeof message.prompt === "string"
      && message.prompt.length > 0 && message.prompt.length <= 2_000_000 && message.provider === site.provider && site.route(location.pathname)
      && message.expectedUrl === location.href && Number.isFinite(message.expiresAt) && Date.now() <= message.expiresAt;
  }
  function remember(operationId) { handled.add(operationId); if (handled.size > 64) handled.delete(handled.values().next().value); }
  function sendButton(composer) {
    const form = composerContainer(composer); if (!form) return null;
    if (uploadBusy(form)) return null;
    const buttons = [...form.querySelectorAll(site.send)]
      .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true");
    return buttons.length === 1 ? buttons[0] : null;
  }
  function uploadBusy(form) {
    return [...form.querySelectorAll('[role="progressbar"],[aria-busy="true"],[data-state="uploading"],[data-testid*="upload-progress"],[aria-label*="Uploading" i],file-upload-container .spinner,[data-testid*="attachment"] .animate-spin')].some(visible);
  }
  const removeFileSelector = 'button[aria-label*="Remove attachment" i],button[aria-label*="Remove file" i],button[aria-label*="Xóa tệp" i],button[aria-label*="Xóa đính kèm" i],button[data-testid*="remove-file"],button[data-testid*="remove-attachment"]';
  function hasExistingAttachments(form) {
    return [...document.querySelectorAll('input[type="file"]')].some(input => input.files?.length)
      || [...form.querySelectorAll(`${removeFileSelector},[data-file-id],[data-testid="file-chip"],[data-testid^="attachment-"]`)].some(visible);
  }
  const mimeFor = filename => ({ mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo" })[filename.split(".").at(-1).toLowerCase()] || "application/octet-stream";
  function acceptsFile(input, filename, mime) {
    const entries = String(input.accept || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    // Empty accept is unknown, not a promise that ChatGPT supports video. The
    // upload still has to produce an actual ready attachment before sending.
    if (!entries.length) return true;
    const lowerName = filename.toLowerCase();
    return entries.some(value => value === "*/*" || value === mime || value === "video/*" && mime.startsWith("video/") || value.startsWith(".") && lowerName.endsWith(value));
  }
  function fileInput(composer, media) {
    const form = composerContainer(composer);
    if (!form) return { error: reply("UPLOAD_CONTROL_UNSUPPORTED", `Không xác định được vùng tải tệp ${site.name}. Chưa gửi prompt.`) };
    if (hasExistingAttachments(form)) return { error: reply("COMPOSER_HAS_ATTACHMENTS", "Tab đã có tệp đính kèm. Giữ nguyên; dùng ô soạn thảo trống để phân tích.") };
    let inputs = [...form.querySelectorAll('input[type="file"]')];
    if (!inputs.length) inputs = [...document.querySelectorAll('input[type="file"]')].filter(input => !input.closest(messageSelector));
    inputs = inputs.filter(input => !input.disabled && acceptsFile(input, media.filename, mimeFor(media.filename)));
    if (inputs.length !== 1) return { error: reply(inputs.length ? "UPLOAD_CONTROL_AMBIGUOUS" : "VIDEO_UPLOAD_UNSUPPORTED", inputs.length ? "Có nhiều ô tải tệp; chưa tự chọn để tránh gửi nhầm." : "Ô tải tệp hiện tại không nhận video nguồn. Chưa gửi; không tự chuyển sang chỉ text.") };
    return { input: inputs[0], form };
  }
  function filenameNodes(container, filename, excluded) {
    return [...container.querySelectorAll('[title],[aria-label],span,p,[data-test-id="file-name"],.file-name')].filter(element => !excluded?.contains(element)
      && visible(element) && [element.getAttribute("title"), element.getAttribute("aria-label"), element.textContent?.trim()].includes(filename));
  }
  function attachmentCard(form, filename, composer) {
    const cards = new Set();
    for (const node of filenameNodes(form, filename, composer)) {
      let card = node;
      while (card && card !== form && !card.contains(composer)) {
        if (card.matches('[data-file-id],[data-testid*="attachment"],[data-testid*="file-chip"],[data-testid*="file-thumbnail"],file-upload-container,[data-test-id*="file-preview"],.file-preview') || card.querySelector(removeFileSelector)) { cards.add(card); break; }
        card = card.parentElement;
      }
    }
    return cards.size === 1 ? [...cards][0] : null;
  }
  const outermost = nodes => nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
  function userNodes(prompt) {
    const explicit = [...document.querySelectorAll(site.user)];
    if (site.provider !== "muse") return explicit;
    // Only an exact prompt match can identify a role-less Muse user bubble.
    // Never alternate roles by position or take the last bubble as a response.
    const fallback = [...document.querySelectorAll('.hatch-chat-groupable-bubble')].filter(node => !node.matches('[data-role="assistant"],[data-hatch-assistant-message-body="true"]')
      && !node.querySelector('[data-hatch-assistant-message-body="true"],[data-role="assistant"]')
      && [...node.querySelectorAll(site.promptBodies), node].some(body => normalize(body.innerText || body.textContent || "") === normalize(prompt)));
    return outermost([...new Set([...explicit, ...fallback])]);
  }
  const assistantNodes = () => outermost([...document.querySelectorAll(site.assistant)]);
  const follows = (first, second) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  function exactUserPrompt(node, prompt, filename) {
    // File chips can be siblings of the prompt bubble. Match a full text node,
    // never a substring of a turn containing some other prompt or old result.
    const bodies = [...node.querySelectorAll(site.promptBodies), node];
    const textNodes = bodies.filter(body => normalize(body.innerText || body.textContent || "") === normalize(prompt));
    if (!textNodes.length) return false;
    const turn = node.closest('[data-testid^="conversation-turn"]') || node;
    // A filename chip may be outside Muse's text bubble. Its immediate message
    // wrapper is allowed only when it contains this one bubble and no reply.
    const parent = site.provider === "muse" && node.parentElement;
    const envelope = parent && parent.querySelectorAll('.hatch-chat-groupable-bubble').length === 1
      && !parent.querySelector('[data-role="assistant"],[data-hatch-assistant-message-body="true"]') ? parent : turn;
    return textNodes.some(body => filenameNodes(envelope, filename, body).length > 0);
  }
  function finalControls(assistant) {
    const turn = site.provider === "gemini" ? assistant : site.provider === "muse" ? assistant.closest('.hatch-chat-groupable-bubble') || assistant : assistant.closest('[data-testid^="conversation-turn"]') || assistant;
    return [...turn.querySelectorAll('button[data-testid="copy-turn-action-button"],button[aria-label="Copy"],button[aria-label="Copy response"],button[aria-label="Copy response text"],button[aria-label="Sao chép"],button[aria-label="Sao chép câu trả lời"],button')]
      .some(element => visible(element) && !element.closest("pre") && (element.matches('button[data-testid="copy-turn-action-button"],button[aria-label="Copy"],button[aria-label="Copy response"],button[aria-label="Copy response text"],button[aria-label="Sao chép"],button[aria-label="Sao chép câu trả lời"]')
        || site.provider === "gemini" && [...element.querySelectorAll('mat-icon,[data-mat-icon-name]')].some(icon => icon.getAttribute("data-mat-icon-name") === "content_copy" || icon.textContent.trim() === "content_copy")));
  }
  function resultJson(assistant, message) {
    const code = [...assistant.querySelectorAll("pre code")].map((node) => node.textContent.trim()).filter(Boolean);
    if (code.length > 1) return { error: "AMBIGUOUS_JSON" };
    const output = site.provider === "gemini" ? assistant.querySelector(".model-response-text,.markdown") || assistant : site.provider === "muse" ? assistant.querySelector('[data-hatch-assistant-message-body="true"]') || assistant : assistant;
    const candidates = code.length ? code : [(output.innerText || output.textContent || "").trim()];
    const matching = []; let sawJson = false;
    for (const raw of candidates) {
      if (raw.length > 4_000_000) continue;
      try {
        const value = JSON.parse(raw); sawJson = true;
        if (value && !Array.isArray(value) && value.requestId === message.requestId && value.sourceId === message.sourceId && value.analysisKey === message.analysisKey) matching.push(raw);
      } catch { /* Not complete JSON. No substring extraction or repair. */ }
    }
    return matching.length === 1 ? { raw: matching[0] } : { error: matching.length > 1 ? "AMBIGUOUS_JSON" : sawJson ? "RESULT_IDENTITY_INVALID" : "OUTPUT_NOT_JSON" };
  }
  function startAuto(message) {
    if (currentAuto) return reply("HANDOFF_BUSY", "Tab đang có một lượt tự động. Không gửi trùng.");
    const media = message.media;
    if (!validMessage(message) || !media || media.id !== `source-video-${message.sourceId}` || typeof media.filename !== "string"
      || !/^source-[a-f0-9-]+\.[a-z0-9]+$/i.test(media.filename) || !media.filename.startsWith(`source-${message.sourceId}.`) || !Number.isSafeInteger(media.bytes) || media.bytes <= 0
      || typeof media.variantKey !== "string" || !/^[a-f0-9]{64}$/.test(media.variantKey)
      || typeof message.requestId !== "string" || typeof message.analysisKey !== "string" || !message.prompt.includes(message.requestId) || !message.prompt.includes(message.analysisKey)) {
      return reply("AUTO_CONTEXT_INVALID", "Thiếu video hoặc định danh prompt hiện tại. Chưa gửi.");
    }
    if (media.bytes > MAX_VIDEO_BYTES) return reply("VIDEO_TOO_LARGE", "Video vượt giới hạn truyền 512 MiB của extension. Chưa gửi; không tự cắt video.");
    const found = findComposer(); if (found.error) return found.error;
    const upload = fileInput(found.composer, media); if (upload.error) return upload.error;
    remember(message.operationId);
    const filled = fillComposer(message.prompt); if (filled.error) return filled.error;
    const beforeUsers = new Set(userNodes(message.prompt)); const beforeAssistants = new Set(assistantNodes());
    const beforeMuseBubbles = new Set(site.provider === "muse" ? document.querySelectorAll('.hatch-chat-groupable-bubble') : []);
    const port = chrome.runtime.connect({ name: `${channel}:target` });
    const state = { stopped: false, finalizing: false, sent: false, acceptedUrl: message.expectedUrl, changedFromHome: false, user: null, assistant: null, lastText: "", stableSince: 0,
      observer: null, tick: null, scheduled: null, heartbeat: null, timeout: null, ackTimeout: null, videoTimeout: null, resultTimeout: null,
      receiving: false, chunks: [], chunkCount: 0, bytes: 0, file: null, input: upload.input, uploadStarted: false, uploadReady: false, readySince: 0, readyCard: null, port };
    currentAuto = state;
    function post(type, extra = {}) { try { port.postMessage({ channel, type, operationId: message.operationId, ...extra }); } catch { cleanup(); } }
    function releaseVideo() { state.chunks.length = 0; state.file = null; }
    function cleanup() {
      if (state.stopped) return; state.stopped = true;
      state.observer?.disconnect(); clearInterval(state.tick); clearInterval(state.heartbeat); clearTimeout(state.timeout); clearTimeout(state.scheduled); clearTimeout(state.ackTimeout); clearTimeout(state.videoTimeout); clearTimeout(state.resultTimeout);
      releaseVideo();
      if (currentAuto === state) currentAuto = null;
      try { port.disconnect(); } catch { /* Already disconnected. */ }
    }
    function terminal(type, data) {
      if (state.stopped || state.finalizing) return;
      state.finalizing = true; state.observer?.disconnect(); clearInterval(state.tick); clearTimeout(state.scheduled); clearTimeout(state.videoTimeout); clearTimeout(state.resultTimeout); releaseVideo();
      post(type, data); state.ackTimeout = setTimeout(cleanup, 1000);
    }
    function fail(code, text) { terminal("auto-error", { code, message: text }); }
    function currentUrl() {
      if (location.href === state.acceptedUrl) return true;
      const url = new URL(location.href);
      if (state.sent && !state.changedFromHome && new URL(message.expectedUrl).pathname.replace(/\/$/, "") === site.home.replace(/\/$/, "") && url.origin === location.origin && site.route(url.pathname) && url.pathname !== site.home) {
        state.changedFromHome = true; state.acceptedUrl = location.href; return true;
      }
      return false;
    }
    function inspectUpload() {
      if (!currentUrl()) { fail("TAB_CHANGED", "Tab đã đổi trong lúc tải video. Chưa tự gửi lại."); return; }
      const checked = findComposer(message.prompt); if (checked.error) { fail(checked.error.code, checked.error.message); return; }
      if (!state.uploadStarted || state.uploadReady) return;
      const form = composerContainer(checked.composer);
      const card = form && attachmentCard(form, media.filename, checked.composer);
      const ready = card && !uploadBusy(form) && sendButton(checked.composer);
      if (!ready) { state.readySince = 0; state.readyCard = null; return; }
      if (card !== state.readyCard) { state.readyCard = card; state.readySince = Date.now(); return; }
      if (Date.now() - state.readySince < 2000) return;
      state.uploadReady = true; clearTimeout(state.videoTimeout);
      post("attachment-ready", { receipt: { mediaId: media.id, filename: media.filename, bytes: media.bytes, variantKey: media.variantKey, evidence: "composer-upload-ready" } });
      post("send-permission");
    }
    function inspect() {
      if (state.stopped || state.finalizing) return;
      const error = pageError(); if (error) { fail(error.code, error.message); return; }
      if (!state.sent) { inspectUpload(); return; }
      if (!currentUrl()) { fail("TAB_CHANGED", "Cuộc trò chuyện đã thay đổi. Dừng nhận kết quả cũ."); return; }
      const newUsers = userNodes(message.prompt).filter(node => !beforeUsers.has(node));
      if (!state.user) {
        const matches = newUsers.filter(node => exactUserPrompt(node, message.prompt, media.filename));
        if (matches.length > 1) { fail("USER_TURN_AMBIGUOUS", "Có nhiều lượt gửi giống nhau. Không tự chọn kết quả."); return; }
        if (!matches.length) return;
        state.user = matches[0]; post("receiving");
      }
      const unknownMuseTurn = site.provider === "muse" && [...document.querySelectorAll('.hatch-chat-groupable-bubble')].some(node => !beforeMuseBubbles.has(node)
        && node !== state.user && !node.contains(state.user) && !state.user.contains(node) && follows(state.user, node)
        && !node.matches('[data-role="assistant"],[data-hatch-assistant-message-body="true"]') && !node.querySelector('[data-role="assistant"],[data-hatch-assistant-message-body="true"]'));
      if (unknownMuseTurn) { fail("MUSE_TURN_ROLE_UNVERIFIED", "Muse có lượt mới chưa xác định được vai trò. Giữ plan; kiểm tra kết quả trong tab."); return; }
      if (!state.user.isConnected || newUsers.some(node => node !== state.user && follows(state.user, node))) {
        fail("CONVERSATION_CHANGED", "Có tin nhắn hoặc thay đổi hội thoại khác. Giữ plan và kiểm tra bằng tay."); return;
      }
      const next = assistantNodes().filter(node => !beforeAssistants.has(node) && follows(state.user, node)).at(-1);
      if (!next) return;
      const text = next.innerText || next.textContent || "";
      if (state.assistant !== next || text !== state.lastText) { state.assistant = next; state.lastText = text; state.stableSince = Date.now(); return; }
      if (streaming() || !finalControls(next) || Date.now() - state.stableSince < 2500) return;
      const parsed = resultJson(next, message);
      if (parsed.raw) { terminal("auto-json", { raw: parsed.raw }); return; }
      if (Date.now() - state.stableSince < 6000) return;
      if (/^(sorry|i['’]m sorry|i cannot|i can['’]t|xin lỗi|tôi không thể)/i.test(text.trim())) {
        fail("MODEL_REFUSAL", `${site.name} từ chối hoặc chưa thể trả kết quả. Không tự gửi lại.`); return;
      }
      fail(parsed.error, parsed.error === "RESULT_IDENTITY_INVALID" ? "JSON thuộc request/source/context khác. Không áp dụng." : "Câu trả lời đã dừng nhưng chưa có đúng một JSON hợp lệ. Kiểm tra bằng tay.");
    }
    function receiveVideo(data) {
      if (state.sent || state.uploadStarted) { fail("VIDEO_TRANSFER_STATE", "Video được gửi sai giai đoạn. Chưa tự gửi lại."); return; }
      if (data.type === "video-start") {
        if (state.receiving || data.mediaId !== media.id || data.variantKey !== media.variantKey || data.filename !== media.filename || data.bytes !== media.bytes || data.mime !== mimeFor(media.filename)) { fail("VIDEO_IDENTITY_INVALID", "Video truyền không khớp nguồn hiện tại. Chưa gửi."); return; }
        state.receiving = true; post("upload-progress", { message: `Đang chuyển video nguồn sang tab ${site.name}…` }); return;
      }
      if (!state.receiving) { fail("VIDEO_TRANSFER_STATE", "Thiếu bước bắt đầu truyền video. Chưa gửi."); return; }
      if (data.type === "video-chunk") {
        if (data.seq !== state.chunkCount || typeof data.data !== "string" || data.data.length > Math.ceil(MAX_CHUNK_BYTES / 3) * 4) { fail("VIDEO_CHUNK_INVALID", "Thứ tự hoặc kích thước dữ liệu video không hợp lệ. Chưa gửi."); return; }
        let decoded;
        try { const binary = atob(data.data); decoded = Uint8Array.from(binary, char => char.charCodeAt(0)); }
        catch { fail("VIDEO_CHUNK_INVALID", "Không đọc được dữ liệu video. Chưa gửi."); return; }
        if (!decoded.length || decoded.length > MAX_CHUNK_BYTES || state.bytes + decoded.length > media.bytes) { fail("VIDEO_CHUNK_INVALID", "Dung lượng dữ liệu video không khớp nguồn. Chưa gửi."); return; }
        state.chunks.push(decoded); state.bytes += decoded.length; state.chunkCount++;
        post("video-ack", { seq: data.seq }); return;
      }
      if (data.type !== "video-complete" || data.bytes !== media.bytes || data.chunks !== state.chunkCount || state.bytes !== media.bytes) { fail("VIDEO_TRANSFER_INCOMPLETE", "Video truyền chưa đủ. Chưa gửi prompt."); return; }
      try {
        const checked = findComposer(message.prompt); if (checked.error) { fail(checked.error.code, checked.error.message); return; }
        const form = composerContainer(checked.composer);
        if (!form || hasExistingAttachments(form) || !state.input.isConnected || state.input.disabled || !acceptsFile(state.input, media.filename, mimeFor(media.filename))) { fail("UPLOAD_CONTROL_CHANGED", "Ô tải tệp hoặc bản nháp đã đổi. Giữ nguyên; chưa gửi."); return; }
        state.file = new File(state.chunks, media.filename, { type: mimeFor(media.filename), lastModified: 0 }); state.chunks.length = 0;
        if (state.file.size !== media.bytes) throw new Error();
        const transfer = new DataTransfer(); transfer.items.add(state.file); state.input.files = transfer.files;
        state.uploadStarted = true; state.receiving = false;
        state.input.dispatchEvent(new Event("change", { bubbles: true }));
        state.file = null; // The website now owns its FileList/upload; no duplicate retained buffer.
        post("upload-progress", { message: `Đang chờ ${site.name} nhận video…` }); inspect();
      } catch { fail("VIDEO_ATTACH_FAILED", "Không đính kèm được video vào ô tải tệp. Chưa gửi prompt."); }
    }
    port.onMessage.addListener(data => {
      if (data?.channel !== channel || data.operationId !== message.operationId || state.stopped || state.finalizing) return;
      if (data.type === "cancel-auto") { cleanup(); return; }
      if (["video-start", "video-chunk", "video-complete"].includes(data.type)) { receiveVideo(data); return; }
      if (data.type !== "send-permission" || data.allowed !== true || state.sent) return;
      if (!state.uploadReady || !Number.isFinite(data.sendDeadline) || Date.now() > data.sendDeadline || location.href !== message.expectedUrl) { fail("SEND_EXPIRED", "Video, tab hoặc thời hạn đã đổi trước khi gửi."); return; }
      const checked = findComposer(message.prompt); if (checked.error) { fail(checked.error.code, checked.error.message); return; }
      const form = composerContainer(checked.composer);
      const card = form && attachmentCard(form, media.filename, checked.composer);
      const button = card && !uploadBusy(form) && sendButton(checked.composer);
      if (!button || card !== state.readyCard) { fail("SEND_CONTROL_UNSUPPORTED", "Video hoặc nút Gửi chưa sẵn sàng. Giữ prompt; chưa gửi."); return; }
      state.sent = true; releaseVideo();
      state.resultTimeout = setTimeout(() => fail("CHATGPT_TIMEOUT", `Hết 10 phút chờ kết quả ${site.name}. Không tự gửi lại.`), Math.min(600_000, Math.max(1, message.expiresAt - Date.now())));
      try { button.click(); post("sent"); inspect(); } catch { fail("SEND_UNCONFIRMED", "Chưa xác nhận thao tác Gửi. Kiểm tra tab; không tự gửi lại."); }
    });
    port.onDisconnect.addListener(cleanup);
    function scheduleInspect() {
      if (state.stopped || state.finalizing || state.scheduled) return;
      state.scheduled = setTimeout(() => { state.scheduled = null; inspect(); }, 200);
    }
    state.observer = new MutationObserver(scheduleInspect); state.observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    state.tick = setInterval(scheduleInspect, 750);
    state.heartbeat = setInterval(() => post("heartbeat"), 15_000);
    state.timeout = setTimeout(() => fail("HANDOFF_TIMEOUT", "Hết thời gian truyền/chờ web. Không tự gửi lại."), Math.max(1, Math.min(1_200_000, message.expiresAt - Date.now())));
    state.videoTimeout = setTimeout(() => fail("VIDEO_UPLOAD_TIMEOUT", "Hết 10 phút truyền hoặc chờ video. Chưa bấm Gửi."), Math.max(1, Math.min(600_000, message.expiresAt - Date.now())));
    post("video-request");
    return reply("AUTO_STARTED", `Đang truyền video và chuẩn bị một lượt ${site.name} web.`, true);
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.channel !== channel) return false;
    if (message.type === "start-auto") { sendResponse(startAuto(message)); return false; }
    if (message.type !== "fill-composer") return false;
    if (currentAuto || !validMessage(message)) { sendResponse(reply("TAB_CHANGED_OR_BUSY", "Lượt không còn hợp lệ hoặc tab đang bận.")); return false; }
    remember(message.operationId);
    const filled = fillComposer(message.prompt);
    sendResponse(filled.error || reply("PROMPT_FILLED", `Đã điền prompt. Kiểm tra và tự bấm Gửi trong ${site.name}.`, true)); return false;
  });
})();
