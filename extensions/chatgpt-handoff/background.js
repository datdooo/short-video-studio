const CHANNEL = "shortcut-studio-chatgpt-handoff-v1";
const BINDING_KEY = "selected-chatgpt-tab";
const STUDIO_ORIGINS = new Set(["http://127.0.0.1:5373", "http://localhost:5373"]);
const MAX_PROMPT_CHARS = 2_000_000;
const MAX_AGE_MS = 12_000;
const active = new Map();
const automated = new Map();
const AUTO_TIMEOUT_MS = 10 * 60_000;

function result(code, message, ok = false) { return { ok, code, message }; }
function isChatGptUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://chatgpt.com" && (url.pathname === "/" || /^\/c\/[a-zA-Z0-9-]+\/?$/.test(url.pathname));
  } catch { return false; }
}
function isStudioSender(sender) {
  try { return sender.id === chrome.runtime.id && sender.frameId === 0 && STUDIO_ORIGINS.has(new URL(sender.url).origin); }
  catch { return false; }
}
function validId(value) { return typeof value === "string" && value.length > 0 && value.length <= 256; }
function validFill(message) {
  return validId(message.operationId) && validId(message.requestId) && validId(message.sourceId) && validId(message.analysisKey)
    && typeof message.prompt === "string" && message.prompt.length > 0 && message.prompt.length <= MAX_PROMPT_CHARS
    && Number.isFinite(message.issuedAt) && Date.now() - message.issuedAt >= -1000 && Date.now() - message.issuedAt <= MAX_AGE_MS;
}
async function readBinding() { return (await chrome.storage.session.get(BINDING_KEY))[BINDING_KEY]; }
async function bindingStillMatches(binding) {
  const selected = await readBinding();
  if (!selected || selected.tabId !== binding.tabId || selected.url !== binding.url || selected.selectedAt !== binding.selectedAt) return false;
  try {
    const tab = await chrome.tabs.get(binding.tabId);
    return tab.status === "complete" && tab.url === binding.url && isChatGptUrl(tab.url);
  } catch { return false; }
}
async function fill(message, sender) {
  if (!validFill(message)) return result("INVALID_REQUEST", "Prompt hoặc định danh không hợp lệ. Tạo lại prompt rồi thử thao tác này.");
  if (active.size || automated.size) return result("HANDOFF_BUSY", "Đang xử lý một prompt khác. Chờ thao tác hiện tại kết thúc.");
  const operation = { cancelled: false, senderTabId: sender.tab.id, issuedAt: message.issuedAt };
  active.set(message.operationId, operation);
  try {
    const binding = await readBinding();
    if (!binding) return result("TAB_NOT_SELECTED", "Mở extension và chọn tab ChatGPT trước.");
    operation.tabId = binding.tabId;
    if (!await bindingStillMatches(binding)) return result("TAB_CHANGED", "Tab ChatGPT đã đổi hoặc tải lại. Chọn lại tab trong extension.");
    if (operation.cancelled || Date.now() - operation.issuedAt > MAX_AGE_MS) return result("HANDOFF_CANCELLED", "Prompt đã thay đổi. Bấm điền lại với prompt hiện tại.");
    await chrome.scripting.executeScript({ target: { tabId: binding.tabId }, files: ["chatgpt-fill.js"] });
    if (operation.cancelled || Date.now() - operation.issuedAt > MAX_AGE_MS || !await bindingStillMatches(binding)) {
      return result("HANDOFF_CANCELLED", "Ngữ cảnh đã thay đổi. Chọn lại tab và prompt hiện tại.");
    }
    const response = await chrome.tabs.sendMessage(binding.tabId, {
      channel: CHANNEL, type: "fill-composer", operationId: message.operationId,
      expectedUrl: binding.url, prompt: message.prompt, expiresAt: message.issuedAt + MAX_AGE_MS,
    }, { frameId: 0 });
    if (operation.cancelled || !await bindingStillMatches(binding)) return result("HANDOFF_CANCELLED", "Liên kết hoặc phiên Studio đã đổi. Kiểm tra ô soạn thảo ở tab cũ trước khi gửi tiếp.");
    if (!response || typeof response.ok !== "boolean" || typeof response.code !== "string") return result("FILL_UNVERIFIED", "Chưa xác nhận được ô soạn thảo. Kiểm tra tab ChatGPT; không tự gửi lại.");
    return response;
  } catch {
    return result("HANDOFF_UNAVAILABLE", "Không điền được prompt. Kiểm tra tab hoặc copy bằng tay; không có tin nhắn nào được extension tự gửi.");
  } finally { if (active.get(message.operationId) === operation) active.delete(message.operationId); }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.channel !== CHANNEL || sender.id !== chrome.runtime.id) return false;
  if (message.type === "fill-request" || message.type === "cancel-request") {
    if (!isStudioSender(sender)) return false;
    if (message.type === "cancel-request") {
      const operation = active.get(message.operationId);
      if (operation?.senderTabId === sender.tab?.id) operation.cancelled = true;
      sendResponse({ ok: true }); return false;
    }
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      const operation = active.get(message.operationId); if (operation) operation.cancelled = true;
      active.delete(message.operationId);
      sendResponse(result("HANDOFF_TIMEOUT", "Hết thời gian chờ. Kiểm tra tab ChatGPT trước khi bấm lại."));
    }, MAX_AGE_MS);
    void fill(message, sender).then((response) => {
      if (finished) return;
      finished = true; clearTimeout(timer); sendResponse(response);
    });
    return true;
  }
  const popupUrl = chrome.runtime.getURL("popup.html");
  if (sender.url !== popupUrl || sender.tab) return false;
  if (message.type === "select-tab") {
    void (async () => {
      if (!Number.isInteger(message.tabId)) return result("INVALID_TAB", "Tab không hợp lệ.");
      const tab = await chrome.tabs.get(message.tabId);
      if (tab.status !== "complete" || !isChatGptUrl(tab.url)) return result("TAB_NOT_READY", "Mở cuộc trò chuyện ChatGPT bình thường và chờ tải xong.");
      for (const operation of active.values()) operation.cancelled = true;
      for (const operation of [...automated.values()]) finishAuto(operation, result("TAB_REBOUND", "Đã đổi liên kết tab. Dừng nhận lượt cũ; kiểm tra ChatGPT trước khi gửi tiếp."));
      await chrome.storage.session.set({ [BINDING_KEY]: { tabId: tab.id, url: tab.url, selectedAt: Date.now() } });
      return result("TAB_SELECTED", "Đã chọn tab. Chỉ gửi khi bạn bấm lệnh gửi trong Studio.", true);
    })().then(sendResponse).catch(() => sendResponse(result("TAB_UNAVAILABLE", "Không chọn được tab ChatGPT.")));
    return true;
  }
  if (message.type === "forget-tab") {
    for (const operation of active.values()) operation.cancelled = true;
    for (const operation of [...automated.values()]) finishAuto(operation, result("HANDOFF_CANCELLED", "Đã ngắt liên kết. Không tự gửi thêm hoặc áp dụng kết quả."));
    void chrome.storage.session.remove(BINDING_KEY).then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse(result("UNLINK_FAILED", "Không lưu được trạng thái ngắt liên kết. Các lượt đang chờ đã dừng; mở lại extension để thử ngắt."))); return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const operation of active.values()) if (operation.senderTabId === tabId || operation.tabId === tabId) operation.cancelled = true;
  for (const operation of [...automated.values()]) if (operation.tabId === tabId || operation.senderTabId === tabId) finishAuto(operation, result("TAB_CLOSED", "Tab liên kết đã đóng. Kết quả chưa được áp dụng."));
  void readBinding().then((binding) => { if (binding?.tabId === tabId) return chrome.storage.session.remove(BINDING_KEY); });
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url && change.status !== "loading") return;
  void readBinding().then((binding) => {
    if (binding?.tabId === tabId) {
      const operation = [...automated.values()].find((item) => item.tabId === tabId);
      if (operation && change.url && operation.allowNewConversation && isChatGptUrl(change.url) && new URL(change.url).pathname.startsWith("/c/")
        && ["send-authorized", "sent", "receiving"].includes(operation.phase)) {
        operation.allowNewConversation = false; operation.expectedUrl = change.url;
        return chrome.storage.session.set({ [BINDING_KEY]: { ...binding, url: change.url } });
      }
      if (operation) finishAuto(operation, result("TAB_CHANGED", "Tab hoặc cuộc trò chuyện đã thay đổi. Dừng nhận kết quả cũ."));
      for (const operation of active.values()) operation.cancelled = true;
      return chrome.storage.session.remove(BINDING_KEY);
    }
  });
});

function sendPort(port, message) { try { port.postMessage(message); return true; } catch { return false; } }
function finishAuto(operation, response) {
  if (operation.finished) return;
  operation.finished = true; clearTimeout(operation.timer); clearInterval(operation.heartbeat); automated.delete(operation.operationId);
  if (operation.targetPort) sendPort(operation.targetPort, { channel: CHANNEL, type: "cancel-auto", operationId: operation.operationId });
  sendPort(operation.studioPort, { channel: CHANNEL, type: "auto-result", operationId: operation.operationId, response });
}
function autoProgress(operation, phase, message) {
  if (operation.finished) return;
  operation.phase = phase;
  if (!sendPort(operation.studioPort, { channel: CHANNEL, type: "auto-progress", operationId: operation.operationId, phase, message })) {
    finishAuto(operation, result("STUDIO_DISCONNECTED", "Studio đã mất kết nối. Không tự gửi thêm."));
  }
}
async function beginAuto(message, sender, port) {
  if (!validFill(message) || message.attachmentConfirmed !== true) {
    sendPort(port, { channel: CHANNEL, type: "auto-result", operationId: message.operationId, response: result("ATTACHMENT_NOT_CONFIRMED", "Xác nhận đã đính kèm đúng video trong tab ChatGPT trước.") }); return;
  }
  if (active.size || automated.size) {
    sendPort(port, { channel: CHANNEL, type: "auto-result", operationId: message.operationId, response: result("HANDOFF_BUSY", "Đang có một lượt khác. Không gửi trùng.") }); return;
  }
  const operation = { operationId: message.operationId, requestId: message.requestId, sourceId: message.sourceId, analysisKey: message.analysisKey,
    senderTabId: sender.tab.id, studioPort: port, targetPort: null, tabId: null, expectedUrl: null,
    phase: "preparing", finished: false, allowNewConversation: false, sendDeadline: Date.now() + MAX_AGE_MS, timer: null, heartbeat: null };
  automated.set(message.operationId, operation);
  operation.timer = setTimeout(() => finishAuto(operation, result("CHATGPT_TIMEOUT", "Hết 10 phút chờ. Kiểm tra tab ChatGPT; không tự gửi lại.")), AUTO_TIMEOUT_MS);
  operation.heartbeat = setInterval(() => {
    if (!sendPort(operation.studioPort, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId })) {
      finishAuto(operation, result("STUDIO_DISCONNECTED", "Studio đã mất kết nối. Không tự gửi lại.")); return;
    }
    if (operation.targetPort) sendPort(operation.targetPort, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId });
  }, 15_000);
  try {
    const binding = await readBinding();
    if (!binding || !await bindingStillMatches(binding)) { finishAuto(operation, result("TAB_NOT_SELECTED", "Chọn lại tab ChatGPT đã tải xong trong extension.")); return; }
    if (operation.finished) return;
    operation.tabId = binding.tabId; operation.expectedUrl = binding.url;
    operation.allowNewConversation = new URL(binding.url).pathname === "/";
    autoProgress(operation, "preparing", "Đang kiểm tra tab và ô soạn thảo…");
    await chrome.scripting.executeScript({ target: { tabId: binding.tabId }, files: ["chatgpt-fill.js"] });
    if (operation.finished) return;
    if (!await bindingStillMatches(binding) || Date.now() > operation.sendDeadline) { finishAuto(operation, result("TAB_CHANGED", "Tab đã đổi hoặc quá thời hạn trước khi gửi. Không tự gửi lại.")); return; }
    const started = await chrome.tabs.sendMessage(binding.tabId, { channel: CHANNEL, type: "start-auto", operationId: message.operationId,
      requestId: message.requestId, sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt,
      expectedUrl: binding.url, sendDeadline: operation.sendDeadline, expiresAt: Date.now() + AUTO_TIMEOUT_MS, attachmentConfirmed: true }, { frameId: 0 });
    if (!started?.ok) finishAuto(operation, started && typeof started.code === "string" ? started : result("AUTO_START_UNVERIFIED", "Chưa xác nhận được lượt web. Kiểm tra ô soạn thảo trước khi bấm lại."));
  } catch { finishAuto(operation, result("AUTO_UNAVAILABLE", "Không bắt đầu được lượt web. Kiểm tra tab trước khi gửi lại.")); }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === `${CHANNEL}:studio`) {
    if (!isStudioSender(port.sender)) { port.disconnect(); return; }
    port.onMessage.addListener((message) => {
      if (!message || message.channel !== CHANNEL) return;
      if (message.type === "heartbeat") { sendPort(port, { channel: CHANNEL, type: "heartbeat" }); return; }
      if (message.type === "auto-request") { void beginAuto(message, port.sender, port); return; }
      if (message.type === "confirm-auto-send") {
        const operation = automated.get(message.operationId);
        if (!operation || operation.studioPort !== port || operation.finished || operation.phase !== "awaiting-studio-confirm") return;
        operation.phase = "checking-confirmation";
        void (async () => {
          const binding = await readBinding();
          if (operation.finished || Date.now() > operation.sendDeadline || !binding || binding.tabId !== operation.tabId
            || binding.url !== operation.expectedUrl || !await bindingStillMatches(binding)) {
            finishAuto(operation, result("SEND_CANCELLED", "Tab hoặc context không còn hợp lệ trước khi gửi.")); return;
          }
          autoProgress(operation, "send-authorized", "Đang gửi đúng một lượt trong tab đã chọn…");
          sendPort(operation.targetPort, { channel: CHANNEL, type: "send-permission", operationId: operation.operationId, allowed: true });
        })().catch(() => finishAuto(operation, result("SEND_CONTEXT_UNAVAILABLE", "Không xác minh được context trước khi gửi. Không tự gửi lại.")));
        return;
      }
      if (message.type === "cancel-request") {
        const operation = automated.get(message.operationId);
        if (operation?.studioPort === port) finishAuto(operation, result("HANDOFF_CANCELLED", "Đã dừng chờ. Nếu đã gửi, ChatGPT vẫn có thể tiếp tục trong tab; chưa áp dụng kết quả."));
      }
    });
    port.onDisconnect.addListener(() => {
      for (const operation of [...automated.values()]) if (operation.studioPort === port) finishAuto(operation, result("STUDIO_DISCONNECTED", "Studio đã mất kết nối. Không nhận kết quả cũ."));
    });
    return;
  }
  if (port.name !== `${CHANNEL}:target` || port.sender?.id !== chrome.runtime.id || port.sender.frameId !== 0
    || !isChatGptUrl(port.sender.url) || !port.sender.tab) { port.disconnect(); return; }
  let boundOperation = null;
  port.onMessage.addListener((message) => {
    if (!message || message.channel !== CHANNEL) return;
    const operation = automated.get(message.operationId);
    if (!operation || operation.finished || operation.tabId !== port.sender.tab.id || (operation.targetPort && operation.targetPort !== port)) return;
    operation.targetPort = port; boundOperation = operation;
    if (message.type === "heartbeat") { sendPort(port, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId }); return; }
    if (message.type === "send-permission") {
      if (operation.phase !== "preparing" || Date.now() > operation.sendDeadline) { finishAuto(operation, result("SEND_EXPIRED", "Lượt gửi đã hết hiệu lực. Kiểm tra ô soạn thảo.")); return; }
      void (async () => {
        const binding = await readBinding();
        if (operation.finished || !binding || binding.tabId !== operation.tabId || binding.url !== operation.expectedUrl
          || !await bindingStillMatches(binding) || Date.now() > operation.sendDeadline) {
          finishAuto(operation, result("SEND_CANCELLED", "Ngữ cảnh hoặc tab đã đổi trước khi gửi.")); return;
        }
        operation.phase = "awaiting-studio-confirm";
        sendPort(operation.studioPort, { channel: CHANNEL, type: "auto-confirm-send", operationId: operation.operationId });
      })().catch(() => finishAuto(operation, result("SEND_CONTEXT_UNAVAILABLE", "Không xác minh được tab trước khi gửi. Không tự gửi lại.")));
      return;
    }
    if (message.type === "sent") { autoProgress(operation, "sent", "Đã bấm Gửi một lần. Đang chờ ChatGPT web…"); return; }
    if (message.type === "receiving") { autoProgress(operation, "receiving", "Đang nhận câu trả lời cho đúng prompt…"); return; }
    if (message.type === "auto-error") {
      finishAuto(operation, result(String(message.code || "CHATGPT_WEB_ERROR").slice(0,80), String(message.message || "Lượt web bị dừng. Kiểm tra tab.").slice(0,400))); return;
    }
    if (message.type === "auto-json") {
      try {
        if (!["sent", "receiving"].includes(operation.phase)) throw new Error();
        if (typeof message.raw !== "string" || message.raw.length > 4_000_000) throw new Error();
        const value = JSON.parse(message.raw);
        if (!value || value.requestId !== operation.requestId || value.sourceId !== operation.sourceId || value.analysisKey !== operation.analysisKey) throw new Error();
        finishAuto(operation, { ...result("JSON_RECEIVED", "Đã nhận JSON đúng định danh. Kiểm tra rồi bấm Áp dụng trong Studio.", true), raw: message.raw,
          identity: { requestId: operation.requestId, sourceId: operation.sourceId, analysisKey: operation.analysisKey } });
      } catch { finishAuto(operation, result("RESULT_IDENTITY_INVALID", "JSON chưa khớp request/source/context. Giữ nguyên plan; kiểm tra và copy JSON bằng tay.")); }
    }
  });
  port.onDisconnect.addListener(() => {
    if (boundOperation && !boundOperation.finished) finishAuto(boundOperation, result("CHATGPT_DISCONNECTED", "Tab/extension đã mất kết nối. Không tự gửi lại; kiểm tra cuộc trò chuyện."));
  });
});
