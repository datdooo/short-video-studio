const CHANNEL = "shortcut-studio-chatgpt-handoff-v1";
const BINDING_KEY = "selected-web-ai-tabs";
const LEGACY_BINDING_KEY = "selected-chatgpt-tab";
const STUDIO_ORIGINS = new Set(["http://127.0.0.1:5373", "http://localhost:5373"]);
const MAX_PROMPT_CHARS = 2_000_000;
const MAX_AGE_MS = 12_000;
const active = new Map();
const automated = new Map();
const AUTO_TIMEOUT_MS = 20 * 60_000;
const VIDEO_TIMEOUT_MS = 10 * 60_000;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const VIDEO_CHUNK_BYTES = 192 * 1024;

function result(code, message, ok = false) { return { ok, code, message }; }
function providerForUrl(value) {
  try {const url=new URL(value);
    if(url.origin==="https://chatgpt.com"&&(url.pathname==="/"||/^\/c\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)))return "chatgpt-web";
    if(url.origin==="https://gemini.google.com"&&/^\/app(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(url.pathname))return "gemini";
    if(url.origin==="https://muse.ai"&&(url.pathname==="/"||/^\/thread\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)))return "muse";
  }catch{/* No arbitrary external origins. */}
  return null;
}
function isWebAiUrl(value,provider){const actual=providerForUrl(value);return Boolean(actual&&(!provider||actual===provider));}
function selectedProvider(message){return message.provider===undefined?'chatgpt-web':['chatgpt-web','gemini','muse'].includes(message.provider)?message.provider:null;}
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
function validMedia(media,sourceId) {
  return /^[a-f0-9-]{16,64}$/i.test(sourceId) && media && media.id === `source-video-${sourceId}`
    &&typeof media.variantKey==='string'&&/^[a-f0-9]{64}$/i.test(media.variantKey)
    && typeof media.filename === "string" && new RegExp(`^source-${sourceId}\\.(mp4|m4v|mov|webm|mkv|avi)$`, "i").test(media.filename)
    && Number.isSafeInteger(media.bytes) && media.bytes > 0 && media.bytes <= MAX_VIDEO_BYTES
    && Number.isFinite(media.duration) && media.duration > 0;
}
function validReceipt(receipt,media) {
  return receipt && receipt.mediaId === media.id && receipt.filename === media.filename && receipt.variantKey === media.variantKey
    && receipt.bytes === media.bytes && receipt.evidence === "composer-upload-ready";
}
function chunkBytes(data) {
  if (typeof data !== "string" || !data.length || data.length > VIDEO_CHUNK_BYTES * 4 / 3
    || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return 0;
  return data.length * 3 / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
}
async function readBindings() {
  const stored=await chrome.storage.session.get([BINDING_KEY,LEGACY_BINDING_KEY]);
  const current=stored[BINDING_KEY]&&typeof stored[BINDING_KEY]==='object'?stored[BINDING_KEY]:{};
  const bindings={...current};
  if(!bindings['chatgpt-web']&&stored[LEGACY_BINDING_KEY])bindings['chatgpt-web']={...stored[LEGACY_BINDING_KEY],provider:'chatgpt-web'};
  return bindings;
}
async function writeBinding(provider,binding){const bindings=await readBindings();if(binding)bindings[provider]=binding;else delete bindings[provider];await chrome.storage.session.set({[BINDING_KEY]:bindings});if(provider==='chatgpt-web')await chrome.storage.session.remove(LEGACY_BINDING_KEY);}
async function readBinding(provider='chatgpt-web') {
  const bindings=await readBindings();
  if(bindings[provider])return {...bindings[provider],provider};
  const pattern=provider==='chatgpt-web'?'https://chatgpt.com/*':provider==='gemini'?'https://gemini.google.com/*':provider==='muse'?'https://muse.ai/*':null;
  if(!pattern)return null;
  const tabs=(await chrome.tabs.query({url:pattern})).filter(tab=>tab.status==='complete'&&isWebAiUrl(tab.url,provider));
  if(tabs.length!==1)return null;
  const binding={tabId:tabs[0].id,url:tabs[0].url,selectedAt:Date.now(),provider};await writeBinding(provider,binding);return binding;
}
async function bindingStillMatches(binding) {
  const selected = (await readBindings())[binding.provider];
  if (!selected || selected.tabId !== binding.tabId || selected.url !== binding.url || selected.selectedAt !== binding.selectedAt) return false;
  try {
    const tab = await chrome.tabs.get(binding.tabId);
    return tab.status === "complete" && tab.url === binding.url && isWebAiUrl(tab.url,binding.provider);
  } catch { return false; }
}
async function fill(message, sender) {
  if (!selectedProvider(message)||!validFill(message)) return result("INVALID_REQUEST", "Prompt hoặc định danh không hợp lệ. Tạo lại prompt rồi thử thao tác này.");
  if (active.size || automated.size) return result("HANDOFF_BUSY", "Đang xử lý một prompt khác. Chờ thao tác hiện tại kết thúc.");
  const operation = { cancelled: false, senderTabId: sender.tab.id, issuedAt: message.issuedAt };
  active.set(message.operationId, operation);
  try {
    const binding = await readBinding(selectedProvider(message));
    if (!binding) return result("TAB_NOT_SELECTED", "Mở đúng trang AI và chọn tab trong extension.");
    operation.tabId = binding.tabId;
    if (!await bindingStillMatches(binding)) return result("TAB_CHANGED", "Tab AI đã đổi hoặc tải lại. Chọn lại tab trong extension.");
    if (operation.cancelled || Date.now() - operation.issuedAt > MAX_AGE_MS) return result("HANDOFF_CANCELLED", "Prompt đã thay đổi. Bấm điền lại với prompt hiện tại.");
    await chrome.scripting.executeScript({ target: { tabId: binding.tabId }, files: ["chatgpt-fill.js"] });
    if (operation.cancelled || Date.now() - operation.issuedAt > MAX_AGE_MS || !await bindingStillMatches(binding)) {
      return result("HANDOFF_CANCELLED", "Ngữ cảnh đã thay đổi. Chọn lại tab và prompt hiện tại.");
    }
    const response = await chrome.tabs.sendMessage(binding.tabId, {
      channel: CHANNEL, type: "fill-composer", operationId: message.operationId,
      expectedUrl: binding.url, prompt: message.prompt,provider:binding.provider, expiresAt: message.issuedAt + MAX_AGE_MS,
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
      const provider=selectedProvider(message);
      if (!provider||tab.status !== "complete" || !isWebAiUrl(tab.url,provider)) return result("TAB_NOT_READY", "Mở đúng trang AI đã chọn và chờ tải xong.");
      for (const operation of active.values()) operation.cancelled = true;
      for (const operation of [...automated.values()]) finishAuto(operation, result("TAB_REBOUND", "Đã đổi liên kết tab. Dừng nhận lượt cũ; kiểm tra ChatGPT trước khi gửi tiếp."));
      await writeBinding(provider,{ tabId: tab.id, url: tab.url, selectedAt: Date.now(),provider });
      return result("TAB_SELECTED", "Đã chọn tab. Chỉ gửi khi bạn bấm lệnh gửi trong Studio.", true);
    })().then(sendResponse).catch(() => sendResponse(result("TAB_UNAVAILABLE", "Không chọn được tab ChatGPT.")));
    return true;
  }
  if (message.type === "forget-tab") {
    if(message.provider!==undefined&&!selectedProvider(message)){sendResponse(result("INVALID_PROVIDER","Nhà cung cấp không hợp lệ."));return false;}
    for (const operation of active.values()) operation.cancelled = true;
    for (const operation of [...automated.values()]) finishAuto(operation, result("HANDOFF_CANCELLED", "Đã ngắt liên kết. Không tự gửi thêm hoặc áp dụng kết quả."));
    void (message.provider?writeBinding(selectedProvider(message),null):chrome.storage.session.remove([BINDING_KEY,LEGACY_BINDING_KEY])).then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse(result("UNLINK_FAILED", "Không lưu được trạng thái ngắt liên kết. Các lượt đang chờ đã dừng; mở lại extension để thử ngắt."))); return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const operation of active.values()) if (operation.senderTabId === tabId || operation.tabId === tabId) operation.cancelled = true;
  for (const operation of [...automated.values()]) if (operation.tabId === tabId || operation.senderTabId === tabId) finishAuto(operation, result("TAB_CLOSED", "Tab liên kết đã đóng. Kết quả chưa được áp dụng."));
  void readBindings().then(async bindings=>{for(const [provider,binding] of Object.entries(bindings))if(binding?.tabId===tabId)await writeBinding(provider,null);}).catch(()=>undefined);
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url && change.status !== "loading") return;
  void readBindings().then(async bindings=>{
    for(const [provider,binding] of Object.entries(bindings)){
      if(binding?.tabId!==tabId)continue;
      const operation=[...automated.values()].find(item=>item.tabId===tabId&&item.provider===provider);
      const conversation=change.url&&isWebAiUrl(change.url,provider)&&(provider==='gemini'?!['/app','/app/'].includes(new URL(change.url).pathname):provider==='muse'?new URL(change.url).pathname.startsWith('/thread/'):new URL(change.url).pathname.startsWith('/c/'));
      if(operation&&conversation&&operation.allowNewConversation&&["send-authorized","sent","receiving"].includes(operation.phase)){
        operation.allowNewConversation=false;operation.expectedUrl=change.url;await writeBinding(provider,{...binding,url:change.url});continue;
      }
      if(operation)finishAuto(operation,result('TAB_CHANGED','Tab hoặc cuộc trò chuyện đã thay đổi. Dừng nhận kết quả cũ.'));
      for(const pending of active.values())if(pending.tabId===tabId)pending.cancelled=true;
      await writeBinding(provider,null);
    }
  }).catch(()=>{for(const operation of [...automated.values()])if(operation.tabId===tabId)finishAuto(operation,result('BINDING_UNAVAILABLE','Không xác minh được liên kết tab; dừng lượt cũ.'));});
});

function sendPort(port, message) { try { port.postMessage(message); return true; } catch { return false; } }
function finishAuto(operation, response) {
  if (operation.finished) return;
  operation.finished = true; clearTimeout(operation.timer); clearTimeout(operation.videoTimer); clearInterval(operation.heartbeat); automated.delete(operation.operationId);
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
function relayTarget(operation,message) {
  if (!operation.targetPort || !sendPort(operation.targetPort,{channel:CHANNEL,operationId:operation.operationId,...message})) {
    finishAuto(operation,result("CHATGPT_DISCONNECTED","Tab AI mất kết nối. Không tự gửi lại.")); return false;
  }
  return true;
}
function receiveVideo(operation,message) {
  if(operation.phase!=="downloading"||!operation.videoRequested||operation.videoComplete) {
    finishAuto(operation,result("VIDEO_TRANSFER_ORDER","Thứ tự truyền video không hợp lệ. Chưa gửi phân tích."));return;
  }
  if(message.type==="video-start") {
    if(operation.videoStarted||message.bytes!==operation.media.bytes||message.filename!==operation.media.filename||message.mediaId!==operation.media.id||message.variantKey!==operation.media.variantKey
      ||typeof message.mime!=="string"||!(/^(video\/[a-z0-9.+-]+|application\/octet-stream)$/i.test(message.mime))) {
      finishAuto(operation,result("VIDEO_METADATA_MISMATCH","Video đọc được không khớp nguồn hiện tại. Chưa gửi phân tích."));return;
    }
    operation.videoStarted=true;
    relayTarget(operation,{type:"video-start",bytes:message.bytes,filename:message.filename,mediaId:message.mediaId,variantKey:message.variantKey,mime:message.mime});return;
  }
  if(message.type==="video-chunk") {
    const bytes=chunkBytes(message.data);
    if(!operation.videoStarted||operation.awaitingAck!==null||message.seq!==operation.nextSeq||!bytes||operation.videoBytes+bytes>operation.media.bytes) {
      finishAuto(operation,result("VIDEO_CHUNK_INVALID","Dữ liệu video thiếu hoặc sai thứ tự. Chưa gửi phân tích."));return;
    }
    operation.awaitingAck=message.seq;operation.videoBytes+=bytes;operation.nextSeq++;
    relayTarget(operation,{type:"video-chunk",seq:message.seq,data:message.data});return;
  }
  if(message.type==="video-complete") {
    if(!operation.videoStarted||operation.awaitingAck!==null||message.chunks!==operation.nextSeq||message.bytes!==operation.videoBytes||message.bytes!==operation.media.bytes) {
      finishAuto(operation,result("VIDEO_INCOMPLETE","Video chưa được truyền đủ. Chưa gửi phân tích."));return;
    }
    operation.videoComplete=true;autoProgress(operation,"uploading","Đang đính kèm video trong tab AI…");
    relayTarget(operation,{type:"video-complete",chunks:message.chunks,bytes:message.bytes});
  }
}
async function beginAuto(message, sender, port) {
  const provider=selectedProvider(message);
  if (!provider||!validFill(message) || !validMedia(message.media,message.sourceId)) {
    const code=message.media?.bytes>MAX_VIDEO_BYTES?"VIDEO_TOO_LARGE":"VIDEO_MANIFEST_INVALID";
    sendPort(port, { channel: CHANNEL, type: "auto-result", operationId: message.operationId, response: result(code,code==="VIDEO_TOO_LARGE"?"Video vượt 512 MiB của luồng web. Chưa gửi; không tự chuyển sang chỉ text.":"Thiếu dữ liệu video nguồn hợp lệ. Chuẩn bị lại nguồn trước.") }); return;
  }
  if (active.size || automated.size) {
    sendPort(port, { channel: CHANNEL, type: "auto-result", operationId: message.operationId, response: result("HANDOFF_BUSY", "Đang có một lượt khác. Không gửi trùng.") }); return;
  }
  const operation = { provider,operationId: message.operationId, requestId: message.requestId, sourceId: message.sourceId, analysisKey: message.analysisKey,media:{...message.media},
    senderTabId: sender.tab.id, studioPort: port, targetPort: null, tabId: null, expectedUrl: null,
    phase: "preparing", finished: false, allowNewConversation: false, sendDeadline: null, timer: null,videoTimer:null,heartbeat:null,
    videoRequested:false,videoStarted:false,videoComplete:false,nextSeq:0,videoBytes:0,awaitingAck:null,lastProgressAt:0,attachmentReceipt:null };
  automated.set(message.operationId, operation);
  operation.timer = setTimeout(() => finishAuto(operation, result("CHATGPT_TIMEOUT", "Hết thời gian chờ web. Kiểm tra tab ChatGPT; không tự gửi lại.")), AUTO_TIMEOUT_MS);
  operation.videoTimer=setTimeout(()=>finishAuto(operation,result("VIDEO_UPLOAD_TIMEOUT","Hết 10 phút chuẩn bị/đính kèm video. Chưa tự gửi lại.")),VIDEO_TIMEOUT_MS);
  operation.heartbeat = setInterval(() => {
    if (!sendPort(operation.studioPort, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId })) {
      finishAuto(operation, result("STUDIO_DISCONNECTED", "Studio đã mất kết nối. Không tự gửi lại.")); return;
    }
    if (operation.targetPort) sendPort(operation.targetPort, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId });
  }, 15_000);
  try {
    const binding = await readBinding(operation.provider);
    if (!binding || !await bindingStillMatches(binding)) { finishAuto(operation, result("TAB_NOT_SELECTED", "Mở đúng trang AI đã chọn; nếu có nhiều tab, chọn một tab trong extension.")); return; }
    if (operation.finished) return;
    operation.tabId = binding.tabId; operation.expectedUrl = binding.url;
    operation.allowNewConversation = ["/","/app","/app/"].includes(new URL(binding.url).pathname);
    autoProgress(operation, "preparing", "Đang kiểm tra tab và ô soạn thảo…");
    await chrome.scripting.executeScript({ target: { tabId: binding.tabId }, files: ["chatgpt-fill.js"] });
    if (operation.finished) return;
    if (!await bindingStillMatches(binding)) { finishAuto(operation, result("TAB_CHANGED", "Tab đã đổi trước khi gửi. Không tự gửi lại.")); return; }
    const started = await chrome.tabs.sendMessage(binding.tabId, { channel: CHANNEL, type: "start-auto", operationId: message.operationId,
      requestId: message.requestId, sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt,media:operation.media,provider:operation.provider,
      expectedUrl: binding.url, expiresAt: Date.now() + AUTO_TIMEOUT_MS }, { frameId: 0 });
    if (!started?.ok) finishAuto(operation, started && typeof started.code === "string" ? started : result("AUTO_START_UNVERIFIED", "Chưa xác nhận được lượt web. Kiểm tra ô soạn thảo trước khi bấm lại."));
  } catch { finishAuto(operation, result("AUTO_UNAVAILABLE", "Không bắt đầu được lượt web. Kiểm tra tab trước khi gửi lại.")); }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === `${CHANNEL}:studio`) {
    if (!isStudioSender(port.sender)) { port.disconnect(); return; }
    port.onMessage.addListener((message) => {
      if (!message || message.channel !== CHANNEL) return;
      if (message.type === "heartbeat") { sendPort(port, { channel: CHANNEL, type: "heartbeat",operationId:message.operationId }); return; }
      if (message.type === "auto-request") { void beginAuto(message, port.sender, port); return; }
      const operation=automated.get(message.operationId);
      if(!operation||operation.studioPort!==port||operation.finished)return;
      if(["video-start","video-chunk","video-complete"].includes(message.type)){receiveVideo(operation,message);return;}
      if(message.type==="video-error") {
        finishAuto(operation,result(String(message.code||"VIDEO_TRANSFER_FAILED").slice(0,80),String(message.message||"Không đọc được video nguồn. Chưa gửi phân tích.").slice(0,400)));return;
      }
      if (message.type === "confirm-auto-send") {
        if(operation.phase!=="awaiting-studio-confirm"||!validReceipt(operation.attachmentReceipt,operation.media))return;
        operation.phase = "checking-confirmation";
        void (async () => {
          const binding = await readBinding(operation.provider);
          if (operation.finished || Date.now() > operation.sendDeadline || !binding || binding.tabId !== operation.tabId
            || binding.url !== operation.expectedUrl || !await bindingStillMatches(binding)) {
            finishAuto(operation, result("SEND_CANCELLED", "Tab hoặc context không còn hợp lệ trước khi gửi.")); return;
          }
          autoProgress(operation, "send-authorized", "Đang gửi đúng một lượt trong tab đã chọn…");
          relayTarget(operation, {type: "send-permission",allowed: true,sendDeadline:operation.sendDeadline});
        })().catch(() => finishAuto(operation, result("SEND_CONTEXT_UNAVAILABLE", "Không xác minh được context trước khi gửi. Không tự gửi lại.")));
        return;
      }
      if (message.type === "cancel-request") finishAuto(operation, result("HANDOFF_CANCELLED", "Đã dừng chờ. Nếu đã gửi, ChatGPT vẫn có thể tiếp tục trong tab; chưa áp dụng kết quả."));
    });
    port.onDisconnect.addListener(() => {
      for (const operation of [...automated.values()]) if (operation.studioPort === port) finishAuto(operation, result("STUDIO_DISCONNECTED", "Studio đã mất kết nối. Không nhận kết quả cũ."));
    });
    return;
  }
  if (port.name !== `${CHANNEL}:target` || port.sender?.id !== chrome.runtime.id || port.sender.frameId !== 0
    || !isWebAiUrl(port.sender.url) || !port.sender.tab) { port.disconnect(); return; }
  let boundOperation = null;
  port.onMessage.addListener((message) => {
    if (!message || message.channel !== CHANNEL) return;
    const operation = automated.get(message.operationId);
    if (!operation || operation.finished || operation.tabId !== port.sender.tab.id || !isWebAiUrl(port.sender.url,operation.provider) || (operation.targetPort && operation.targetPort !== port)) return;
    operation.targetPort = port; boundOperation = operation;
    if (message.type === "heartbeat") { sendPort(port, { channel: CHANNEL, type: "heartbeat", operationId: operation.operationId }); return; }
    if(message.type==="video-request") {
      if(operation.phase!=="preparing"||operation.videoRequested){finishAuto(operation,result("VIDEO_REQUEST_DUPLICATE","Lượt truyền video không còn hợp lệ. Không gửi trùng."));return;}
      operation.videoRequested=true;autoProgress(operation,"downloading","Đang chuyển video nguồn sang tab AI…");
      if(!sendPort(operation.studioPort,{channel:CHANNEL,type:"video-request",operationId:operation.operationId,media:operation.media}))finishAuto(operation,result("STUDIO_DISCONNECTED","Studio mất kết nối trước khi đọc video."));return;
    }
    if(message.type==="video-ack") {
      if(operation.phase!=="downloading"||operation.awaitingAck!==message.seq){finishAuto(operation,result("VIDEO_ACK_INVALID","Xác nhận truyền video không khớp. Chưa gửi phân tích."));return;}
      operation.awaitingAck=null;
      if(!sendPort(operation.studioPort,{channel:CHANNEL,type:"video-ack",operationId:operation.operationId,seq:message.seq})){finishAuto(operation,result("STUDIO_DISCONNECTED","Studio mất kết nối khi truyền video."));return;}
      if(Date.now()-operation.lastProgressAt>250||operation.videoBytes===operation.media.bytes){operation.lastProgressAt=Date.now();autoProgress(operation,"downloading",`Chuyển video sang tab · ${Math.floor(operation.videoBytes*100/operation.media.bytes)}%`);}return;
    }
    if(message.type==="upload-progress") {
      if(operation.phase==="uploading"&&typeof message.message==="string")autoProgress(operation,"uploading",message.message.slice(0,200));return;
    }
    if(message.type==="attachment-ready") {
      if(operation.phase!=="uploading"||!operation.videoComplete||!validReceipt(message.receipt,operation.media)){
        finishAuto(operation,result("ATTACHMENT_RECEIPT_INVALID","Chưa xác nhận được đúng video trong ô soạn thảo. Không gửi phân tích."));return;
      }
      operation.attachmentReceipt={mediaId:message.receipt.mediaId,filename:message.receipt.filename,bytes:message.receipt.bytes,variantKey:message.receipt.variantKey,evidence:"composer-upload-ready"};
      clearTimeout(operation.videoTimer);operation.videoTimer=null;
      autoProgress(operation,"attachment-ready","Video đã sẵn sàng trong ô soạn thảo; kiểm tra ngữ cảnh…");
      sendPort(operation.studioPort,{channel:CHANNEL,type:"attachment-ready",operationId:operation.operationId,receipt:operation.attachmentReceipt});return;
    }
    if (message.type === "send-permission") {
      if (operation.phase !== "attachment-ready" || !validReceipt(operation.attachmentReceipt,operation.media)) { finishAuto(operation, result("SEND_WITHOUT_ATTACHMENT", "Video chưa sẵn sàng. Không gửi phân tích.")); return; }
      operation.sendDeadline=Date.now()+MAX_AGE_MS;
      void (async () => {
        const binding = await readBinding(operation.provider);
        if (operation.finished || !binding || binding.tabId !== operation.tabId || binding.url !== operation.expectedUrl
          || !await bindingStillMatches(binding) || Date.now() > operation.sendDeadline) {
          finishAuto(operation, result("SEND_CANCELLED", "Ngữ cảnh hoặc tab đã đổi trước khi gửi.")); return;
        }
        operation.phase = "awaiting-studio-confirm";
        sendPort(operation.studioPort, { channel: CHANNEL, type: "auto-confirm-send", operationId: operation.operationId,receipt:operation.attachmentReceipt });
      })().catch(() => finishAuto(operation, result("SEND_CONTEXT_UNAVAILABLE", "Không xác minh được tab trước khi gửi. Không tự gửi lại.")));
      return;
    }
    if (message.type === "sent") {
      if(operation.phase!=="send-authorized"){finishAuto(operation,result("SEND_UNAUTHORIZED","Lượt gửi chưa được xác nhận. Không nhận kết quả."));return;}
      clearTimeout(operation.timer);operation.timer=setTimeout(()=>finishAuto(operation,result("CHATGPT_TIMEOUT","Hết 10 phút chờ AI web. Không tự gửi lại.")),10*60_000);
      autoProgress(operation, "sent", "Đã gửi một lần. Đang chờ AI web…"); return;
    }
    if (message.type === "receiving") { if(["sent","receiving"].includes(operation.phase))autoProgress(operation, "receiving", "Đang nhận kết quả cho đúng prompt…"); return; }
    if (message.type === "auto-error") {
      finishAuto(operation, result(String(message.code || "CHATGPT_WEB_ERROR").slice(0,80), String(message.message || "Lượt web bị dừng. Kiểm tra tab.").slice(0,400))); return;
    }
    if (message.type === "auto-json") {
      try {
        if (!["sent", "receiving"].includes(operation.phase)||!validReceipt(operation.attachmentReceipt,operation.media)) throw new Error();
        if (typeof message.raw !== "string" || message.raw.length > 4_000_000) throw new Error();
        const value = JSON.parse(message.raw);
        if (!value || value.requestId !== operation.requestId || value.sourceId !== operation.sourceId || value.analysisKey !== operation.analysisKey) throw new Error();
        finishAuto(operation, { ...result("JSON_RECEIVED", "Đã nhận JSON đúng lượt. Đang kiểm tra trong Studio…", true), raw: message.raw,receipt:operation.attachmentReceipt,
          identity: { requestId: operation.requestId, sourceId: operation.sourceId, analysisKey: operation.analysisKey } });
      } catch { finishAuto(operation, result("RESULT_IDENTITY_INVALID", "JSON chưa khớp request/source/context. Giữ nguyên plan; kiểm tra bằng tay.")); }
    }
  });
  port.onDisconnect.addListener(() => {
    if (boundOperation && !boundOperation.finished) finishAuto(boundOperation, result("CHATGPT_DISCONNECTED", "Tab/extension đã mất kết nối. Không tự gửi lại; kiểm tra cuộc trò chuyện."));
  });
});
