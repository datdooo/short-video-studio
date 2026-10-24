(() => {
  if (globalThis.__shortCutStudioHandoffV2Installed) return;
  globalThis.__shortCutStudioHandoffV2Installed = true;
  const channel = "shortcut-studio-chatgpt-handoff-v1";
  const handled = new Set();
  let currentAuto = null;
  const reply = (code, message, ok = false) => ({ ok, code, message });
  const normalize = (value) => String(value).replace(/\r\n/g, "\n").replace(/\n$/, "");
  const visible = (element) => {
    const box = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  function streaming() {
    return [...document.querySelectorAll('button[data-testid="stop-button"],button[data-testid="stop-generating-button"],button[aria-label]')]
      .some((element) => visible(element) && (element.dataset.testid?.startsWith("stop-") || /^(stop|dừng|ngừng)(\s|$)/i.test(element.getAttribute("aria-label") || "")));
  }
  function pageError() {
    const alert = [...document.querySelectorAll('[role="alert"]')].find((element) => visible(element) && !element.closest('[data-message-author-role]')
      && /limit|quota|too many|rate|giới hạn|hết lượt|đăng nhập|log in|sign in|something went wrong|lỗi xảy ra/i.test(element.textContent || ""));
    return alert ? reply("CHATGPT_LIMIT_LOGIN_OR_ERROR", "Tab đang báo giới hạn, đăng nhập hoặc lỗi. Xử lý trực tiếp trong ChatGPT; không tự gửi lại.") : null;
  }
  function composerText(composer) { return composer instanceof HTMLTextAreaElement ? composer.value : composer.innerText; }
  function findComposer(expectedPrompt) {
    if (streaming()) return { error: reply("CHATGPT_BUSY", "ChatGPT đang trả lời. Không gửi thêm lượt mới.") };
    const error = pageError(); if (error) return { error };
    const candidates = [...document.querySelectorAll('textarea#prompt-textarea,#prompt-textarea[contenteditable="true"]')]
      .filter((element) => visible(element) && !element.closest('[data-message-author-role]'));
    if (candidates.length !== 1) return { error: reply("COMPOSER_UNSUPPORTED", "Không xác định được ô soạn thảo. Copy prompt bằng tay.") };
    const composer = candidates[0];
    if (composer.matches(':disabled,[aria-disabled="true"],[aria-readonly="true"],[readonly]')) return { error: reply("COMPOSER_DISABLED", "Ô soạn thảo chưa sẵn sàng. Kiểm tra tab ChatGPT.") };
    const existing = composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent || "";
    if (expectedPrompt === undefined ? existing.length > 0 : normalize(composerText(composer)) !== normalize(expectedPrompt)) {
      return { error: reply("COMPOSER_HAS_DRAFT", "Nội dung ô soạn thảo đã có hoặc đã đổi. Extension giữ nguyên, không bấm Gửi.") };
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
    if (!inserted || normalize(composerText(composer)) !== normalize(prompt)) return { error: reply("FILL_UNVERIFIED", "Chưa xác nhận đủ nội dung đã điền. Xem lại ô soạn thảo; extension chưa bấm Gửi.") };
    return { composer };
  }
  function validMessage(message) {
    return typeof message.operationId === "string" && !handled.has(message.operationId) && typeof message.prompt === "string"
      && message.prompt.length > 0 && message.prompt.length <= 2_000_000 && location.origin === "https://chatgpt.com"
      && message.expectedUrl === location.href && Number.isFinite(message.expiresAt) && Date.now() <= message.expiresAt;
  }
  function remember(operationId) { handled.add(operationId); if (handled.size > 64) handled.delete(handled.values().next().value); }
  function sendButton(composer) {
    const form = composer.closest("form"); if (!form) return null;
    if ([...form.querySelectorAll('[role="progressbar"],[aria-busy="true"]')].some(visible)) return null;
    const buttons = [...form.querySelectorAll('button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"],button[aria-label="Send"],button[aria-label="Gửi"],button[aria-label="Gửi tin nhắn"]')]
      .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true");
    return buttons.length === 1 ? buttons[0] : null;
  }
  const userNodes = () => [...document.querySelectorAll('[data-message-author-role="user"]')];
  const assistantNodes = () => [...document.querySelectorAll('[data-message-author-role="assistant"]')];
  const follows = (first, second) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  function exactUserPrompt(node, prompt) {
    const body = node.querySelector('[data-user-message-bubble]') || node;
    return normalize(body.innerText || body.textContent || "") === normalize(prompt);
  }
  function finalControls(assistant) {
    const turn = assistant.closest('[data-testid^="conversation-turn"]') || assistant;
    return [...turn.querySelectorAll('button[data-testid="copy-turn-action-button"],button[aria-label="Copy"],button[aria-label="Copy response"],button[aria-label="Sao chép"],button[aria-label="Sao chép câu trả lời"]')]
      .some((element) => visible(element) && !element.closest("pre"));
  }
  function resultJson(assistant, message) {
    const code = [...assistant.querySelectorAll("pre code")].map((node) => node.textContent.trim()).filter(Boolean);
    if (code.length > 1) return { error: "AMBIGUOUS_JSON" };
    const candidates = code.length ? code : [(assistant.innerText || assistant.textContent || "").trim()];
    const matching = []; let sawJson = false;
    for (const raw of candidates) {
      if (raw.length > 4_000_000) continue;
      try {
        const value = JSON.parse(raw); sawJson = true;
        if (value && !Array.isArray(value) && value.requestId === message.requestId && value.sourceId === message.sourceId && value.analysisKey === message.analysisKey) matching.push(raw);
      } catch { /* Not a complete JSON document. No substring extraction or repair. */ }
    }
    return matching.length === 1 ? { raw: matching[0] } : { error: matching.length > 1 ? "AMBIGUOUS_JSON" : sawJson ? "RESULT_IDENTITY_INVALID" : "OUTPUT_NOT_JSON" };
  }
  function startAuto(message) {
    if (currentAuto) return reply("HANDOFF_BUSY", "Tab đang có một lượt tự động. Không gửi trùng.");
    if (!validMessage(message) || message.attachmentConfirmed !== true || !Number.isFinite(message.sendDeadline)
      || Date.now() > message.sendDeadline || !message.prompt.includes(message.requestId) || !message.prompt.includes(message.analysisKey)) {
      return reply("AUTO_CONTEXT_INVALID", "Thiếu xác nhận video hoặc định danh prompt. Không gửi.");
    }
    remember(message.operationId);
    const filled = fillComposer(message.prompt); if (filled.error) return filled.error;
    const beforeUsers = new Set(userNodes()); const beforeAssistants = new Set(assistantNodes());
    const port = chrome.runtime.connect({ name: `${channel}:target` });
    const state = { stopped: false, finalizing: false, sent: false, acceptedUrl: message.expectedUrl, changedFromHome: false, user: null, assistant: null, lastText: "", stableSince: 0,
      observer: null, tick: null, scheduled: null, heartbeat: null, timeout: null, ackTimeout: null, port };
    currentAuto = state;
    function post(type, extra = {}) { try { port.postMessage({ channel, type, operationId: message.operationId, ...extra }); } catch { cleanup(); } }
    function cleanup() {
      if (state.stopped) return; state.stopped = true;
      state.observer?.disconnect(); clearInterval(state.tick); clearInterval(state.heartbeat); clearTimeout(state.timeout); clearTimeout(state.scheduled); clearTimeout(state.ackTimeout);
      if (currentAuto === state) currentAuto = null;
      try { port.disconnect(); } catch { /* Already disconnected. */ }
    }
    function terminal(type, data) {
      if (state.stopped || state.finalizing) return;
      state.finalizing = true; state.observer?.disconnect(); clearInterval(state.tick); clearTimeout(state.scheduled);
      post(type, data); state.ackTimeout = setTimeout(cleanup, 1000);
    }
    function fail(code, text) { terminal("auto-error", { code, message: text }); }
    function currentUrl() {
      if (location.href === state.acceptedUrl) return true;
      const url = new URL(location.href);
      if (state.sent && !state.changedFromHome && new URL(message.expectedUrl).pathname === "/" && url.origin === "https://chatgpt.com" && /^\/c\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)) {
        state.changedFromHome = true; state.acceptedUrl = location.href; return true;
      }
      return false;
    }
    function inspect() {
      if (state.stopped || state.finalizing || !state.sent) return;
      if (!currentUrl()) { fail("TAB_CHANGED", "Cuộc trò chuyện đã thay đổi. Dừng nhận kết quả cũ."); return; }
      const error = pageError(); if (error) { fail(error.code, error.message); return; }
      const newUsers = userNodes().filter((node) => !beforeUsers.has(node));
      if (!state.user) {
        const matches = newUsers.filter((node) => exactUserPrompt(node, message.prompt));
        if (matches.length > 1) { fail("USER_TURN_AMBIGUOUS", "Có nhiều lượt gửi giống nhau. Không tự chọn kết quả."); return; }
        if (!matches.length) return;
        state.user = matches[0]; post("receiving");
      }
      if (!state.user.isConnected || newUsers.some((node) => node !== state.user && follows(state.user, node))) {
        fail("CONVERSATION_CHANGED", "Có tin nhắn hoặc thay đổi hội thoại khác. Giữ plan và kiểm tra kết quả bằng tay."); return;
      }
      const next = assistantNodes().filter((node) => !beforeAssistants.has(node) && follows(state.user, node)).at(-1);
      if (!next) return;
      const text = next.innerText || next.textContent || "";
      if (state.assistant !== next || text !== state.lastText) { state.assistant = next; state.lastText = text; state.stableSince = Date.now(); return; }
      if (streaming() || !finalControls(next) || Date.now() - state.stableSince < 2500) return;
      const parsed = resultJson(next, message);
      if (parsed.raw) { terminal("auto-json", { raw: parsed.raw }); return; }
      if (Date.now() - state.stableSince < 6000) return;
      if (/^(sorry|i['’]m sorry|i cannot|i can['’]t|xin lỗi|tôi không thể)/i.test(text.trim())) {
        fail("MODEL_REFUSAL", "ChatGPT từ chối hoặc chưa thể trả kết quả. Không tự gửi lại."); return;
      }
      fail(parsed.error, parsed.error === "RESULT_IDENTITY_INVALID" ? "JSON thuộc request/source/context khác. Không áp dụng." : "Câu trả lời đã dừng nhưng chưa có đúng một JSON hợp lệ. Copy và kiểm tra bằng tay.");
    }
    port.onMessage.addListener((data) => {
      if (data?.channel !== channel || data.operationId !== message.operationId || state.stopped) return;
      if (data.type === "cancel-auto") { cleanup(); return; }
      if (data.type !== "send-permission" || data.allowed !== true || state.sent) return;
      if (Date.now() > message.sendDeadline || location.href !== message.expectedUrl) { fail("SEND_EXPIRED", "Tab hoặc thời hạn đã đổi trước khi gửi."); return; }
      const checked = findComposer(message.prompt); if (checked.error) { fail(checked.error.code, checked.error.message); return; }
      const button = sendButton(checked.composer);
      if (!button) { fail("SEND_CONTROL_UNSUPPORTED", "Nút Gửi hoặc upload chưa sẵn sàng. Giữ prompt; tự kiểm tra trong tab."); return; }
      state.sent = true;
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
    state.timeout = setTimeout(() => fail("CHATGPT_TIMEOUT", "Hết thời gian chờ. Không tự gửi lại hoặc áp dụng kết quả."), Math.max(1, Math.min(600_000, message.expiresAt - Date.now())));
    post("send-permission");
    return reply("AUTO_STARTED", "Đang kiểm tra trước khi gửi một lượt trong tab đã chọn.", true);
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.channel !== channel) return false;
    if (message.type === "start-auto") { sendResponse(startAuto(message)); return false; }
    if (message.type !== "fill-composer") return false;
    if (currentAuto || !validMessage(message)) { sendResponse(reply("TAB_CHANGED_OR_BUSY", "Lượt không còn hợp lệ hoặc tab đang bận.")); return false; }
    remember(message.operationId);
    const filled = fillComposer(message.prompt);
    sendResponse(filled.error || reply("PROMPT_FILLED", "Đã điền prompt. Xem lại và tự bấm Gửi trong ChatGPT.", true)); return false;
  });
})();
