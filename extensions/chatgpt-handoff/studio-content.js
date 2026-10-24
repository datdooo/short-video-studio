(() => {
  const channel = "shortcut-studio-chatgpt-handoff-v1";
  const allowed = new Set(["http://127.0.0.1:5373", "http://localhost:5373"]);
  if (!allowed.has(location.origin) || window.top !== window) return;
  const inFlight = new Set();
  const autoPorts = new Map();
  window.addEventListener("pagehide", () => {
    for (const operationId of inFlight) {
      try { void chrome.runtime.sendMessage({ channel, type: "cancel-request", operationId }).catch(() => undefined); } catch { /* Extension may already be unloaded. */ }
    }
    for (const [operationId, run] of autoPorts) {
      try { run.port.postMessage({ channel, type: "cancel-request", operationId }); } catch { /* Disconnected. */ }
      run.cleanup();
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== channel) return;
    const message = event.data;
    if (message.type === "confirm-auto-send") {
      const run = autoPorts.get(message.operationId);
      if (run) try { run.port.postMessage({ channel, type: "confirm-auto-send", operationId: message.operationId }); }
      catch { run.fail("EXTENSION_DISCONNECTED", "Extension mất kết nối trước khi gửi. Kiểm tra tab; không tự gửi lại."); }
      return;
    }
    if (message.type === "cancel-request") {
      const run = autoPorts.get(message.operationId);
      if (run) { try { run.port.postMessage({ channel, type: "cancel-request", operationId: message.operationId }); } catch { /* Disconnected. */ } run.cleanup(); }
      if (inFlight.has(message.operationId)) void chrome.runtime.sendMessage({ channel, type: "cancel-request", operationId: message.operationId }).catch(() => undefined);
      return;
    }
    if (message.type === "auto-request" && typeof message.operationId === "string" && !inFlight.has(message.operationId) && !autoPorts.has(message.operationId)) {
      let port; let finished = false; let heartbeat; let timeout;
      const publish = (type, extra) => window.postMessage({ channel, type, operationId: message.operationId, ...extra }, location.origin);
      const cleanup = () => { if (finished) return; finished = true; clearInterval(heartbeat); clearTimeout(timeout); autoPorts.delete(message.operationId); try { port?.disconnect(); } catch { /* Disconnected. */ } };
      const fail = (code, text) => { if (finished) return; publish("auto-result", { response: { ok: false, code, message: text } }); cleanup(); };
      try {
        port = chrome.runtime.connect({ name: `${channel}:studio` });
        autoPorts.set(message.operationId, { port, cleanup, fail });
        port.onMessage.addListener((data) => {
          if (finished || data?.channel !== channel || data.operationId !== message.operationId) return;
          if (data.type === "auto-progress") publish("auto-progress", { phase: data.phase, message: data.message });
          if (data.type === "auto-confirm-send") publish("auto-confirm-send", {});
          if (data.type === "auto-result") { publish("auto-result", { response: data.response }); cleanup(); }
        });
        port.onDisconnect.addListener(() => {
          fail("EXTENSION_DISCONNECTED", "Extension mất kết nối. Kiểm tra tab ChatGPT; không tự gửi lại.");
        });
        heartbeat = setInterval(() => { try { port.postMessage({ channel, type: "heartbeat" }); }
          catch { fail("EXTENSION_DISCONNECTED", "Extension mất kết nối. Kiểm tra tab ChatGPT; không tự gửi lại."); } }, 15_000);
        timeout = setTimeout(() => {
          try { port.postMessage({ channel, type: "cancel-request", operationId: message.operationId }); } catch { /* Disconnected. */ }
          publish("auto-result", { response: { ok: false, code: "CHATGPT_TIMEOUT", message: "Hết 10 phút chờ. Kiểm tra tab; không tự gửi lại." } }); cleanup();
        }, 10 * 60_000 + 1500);
        port.postMessage({ channel, type: "auto-request", operationId: message.operationId, requestId: message.requestId,
          sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt, issuedAt: message.issuedAt, attachmentConfirmed: message.attachmentConfirmed === true });
      } catch { publish("auto-result", { response: { ok: false, code: "EXTENSION_UNAVAILABLE", message: "Extension chưa sẵn sàng. Tải lại Studio và chọn tab ChatGPT." } }); cleanup(); }
      return;
    }
    if (message.type !== "fill-request" || typeof message.operationId !== "string" || inFlight.has(message.operationId)) return;
    inFlight.add(message.operationId);
    void chrome.runtime.sendMessage({
      channel, type: "fill-request", operationId: message.operationId, requestId: message.requestId,
      sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt, issuedAt: message.issuedAt,
    }).then((response) => {
      window.postMessage({ channel, type: "fill-result", operationId: message.operationId, response }, location.origin);
    }).catch(() => {
      window.postMessage({ channel, type: "fill-result", operationId: message.operationId, response: {
        ok: false, code: "EXTENSION_UNAVAILABLE", message: "Extension chưa sẵn sàng. Tải lại trang Studio và chọn tab ChatGPT trong extension.",
      } }, location.origin);
    }).finally(() => inFlight.delete(message.operationId));
  });
})();
