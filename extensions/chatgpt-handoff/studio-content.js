(() => {
  const channel = "shortcut-studio-chatgpt-handoff-v1";
  const allowed = new Set(["http://127.0.0.1:5373", "http://localhost:5373"]);
  const maxBytes=512*1024*1024,chunkBytes=192*1024;
  if (!allowed.has(location.origin) || window.top !== window) return;
  const inFlight = new Set();
  const autoPorts = new Map();
  function validMedia(media,sourceId){
    return /^[a-f0-9-]{16,64}$/i.test(sourceId)&&media&&media.id===`source-video-${sourceId}`
      &&typeof media.variantKey==='string'&&/^[a-f0-9]{64}$/i.test(media.variantKey)
      &&typeof media.filename==='string'&&new RegExp(`^source-${sourceId}\\.(mp4|m4v|mov|webm|mkv|avi)$`,'i').test(media.filename)
      &&Number.isSafeInteger(media.bytes)&&media.bytes>0&&media.bytes<=maxBytes;
  }
  function encode(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
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
      let port; let finished = false; let heartbeat; let timeout;let transferStarted=false;let ack=null;let reader=null;
      const controller=new AbortController();
      const publish = (type, extra) => window.postMessage({ channel, type, operationId: message.operationId, ...extra }, location.origin);
      const cleanup = () => {
        if (finished) return; finished = true; clearInterval(heartbeat); clearTimeout(timeout);autoPorts.delete(message.operationId);
        controller.abort();if(reader)void reader.cancel().catch(()=>undefined);
        if(ack){clearTimeout(ack.timer);ack.reject(Error('TRANSFER_CANCELLED'));ack=null;}
        try { port?.disconnect(); } catch { /* Disconnected. */ }
      };
      const fail = (code, text) => { if (finished) return; publish("auto-result", { response: { ok: false, code, message: text } }); cleanup(); };
      const send=(data)=>{if(finished)throw Error('TRANSFER_CANCELLED');port.postMessage({channel,operationId:message.operationId,...data});};
      const transfer=async(media)=>{
        if(transferStarted||!validMedia(media,message.sourceId)||!validMedia(message.media,message.sourceId)||media.id!==message.media.id||media.variantKey!==message.media.variantKey||media.filename!==message.media.filename||media.bytes!==message.media.bytes)throw Object.assign(Error('Định danh video không khớp lượt hiện tại.'),{code:'VIDEO_MANIFEST_INVALID'});
        transferStarted=true;
        // Fetch from the trusted Studio content-script origin, not from the AI
        // website. The endpoint is constructed, never supplied by a web page.
        const response=await fetch(`http://127.0.0.1:8987/api/sources/${encodeURIComponent(message.sourceId)}/manual-video?variant=${encodeURIComponent(media.variantKey)}`,{signal:controller.signal,credentials:'omit',cache:'no-store'});
        if(!response.ok||response.status!==200||!response.body)throw Object.assign(Error(`Không đọc được video nguồn (HTTP ${response.status}).`),{code:'VIDEO_SOURCE_UNAVAILABLE'});
        const length=response.headers.get('content-length'),bytes=length&&/^\d+$/.test(length)?Number(length):null;
        const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
        if(bytes!==media.bytes||!Number.isSafeInteger(bytes)||bytes<=0||bytes>maxBytes)throw Object.assign(Error('Dung lượng video không khớp nguồn đã chuẩn bị.'),{code:'VIDEO_SIZE_MISMATCH'});
        if(!/^(video\/[a-z0-9.+-]+|application\/octet-stream)$/i.test(mime))throw Object.assign(Error('Nguồn không phải loại video đã khai báo.'),{code:'VIDEO_TYPE_INVALID'});
        send({type:'video-start',bytes,mime,filename:media.filename,mediaId:media.id,variantKey:media.variantKey});
        reader=response.body.getReader();let sent=0,seq=0;
        while(true){
          const {done,value}=await reader.read();if(done)break;
          for(let offset=0;offset<value.byteLength;offset+=chunkBytes){
            controller.signal.throwIfAborted();const chunk=value.subarray(offset,Math.min(value.byteLength,offset+chunkBytes));
            if(sent+chunk.byteLength>bytes)throw Object.assign(Error('Video nguồn lớn hơn dữ liệu đã khai báo.'),{code:'VIDEO_SIZE_MISMATCH'});
            const waiting=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(ack?.seq===seq){ack=null;reject(Object.assign(Error('Hết thời gian xác nhận truyền video.'),{code:'VIDEO_TRANSFER_TIMEOUT'}));}},30_000);ack={seq,resolve,reject,timer};});
            send({type:'video-chunk',seq,data:encode(chunk)});await waiting;
            sent+=chunk.byteLength;seq++;
          }
        }
        reader.releaseLock();reader=null;
        if(sent!==bytes)throw Object.assign(Error('Video nguồn bị ngắt trước khi truyền đủ.'),{code:'VIDEO_INCOMPLETE'});
        send({type:'video-complete',chunks:seq,bytes:sent});
      };
      try {
        port = chrome.runtime.connect({ name: `${channel}:studio` });
        autoPorts.set(message.operationId, { port, cleanup, fail });
        port.onMessage.addListener((data) => {
          if (finished || data?.channel !== channel || data.operationId !== message.operationId) return;
          if(data.type==='video-request'){
            void transfer(data.media).catch(error=>{
              if(finished)return;
              const code=String(error?.code||'VIDEO_TRANSFER_FAILED').slice(0,80);
              const text=typeof error?.message==='string'&&error.code?error.message:'Không chuyển được video nguồn. Chưa tự gửi lại.';
              try{send({type:'video-error',code,message:text});}catch{/* Port already failed. */}
              fail(code,text);
            });return;
          }
          if(data.type==='video-ack'){
            if(!ack||ack.seq!==data.seq){try{send({type:'video-error',code:'VIDEO_ACK_INVALID',message:'Xác nhận truyền video không khớp.'});}catch{/* Closed. */}fail('VIDEO_ACK_INVALID','Xác nhận truyền video không khớp.');return;}
            const current=ack;ack=null;clearTimeout(current.timer);current.resolve();return;
          }
          if (data.type === "auto-progress") publish("auto-progress", { phase: data.phase, message: data.message });
          if(data.type==='attachment-ready')publish('attachment-ready',{receipt:data.receipt});
          if (data.type === "auto-confirm-send") publish("auto-confirm-send", {receipt:data.receipt});
          if (data.type === "auto-result") { publish("auto-result", { response: data.response }); cleanup(); }
        });
        port.onDisconnect.addListener(() => {
          fail("EXTENSION_DISCONNECTED", "Extension mất kết nối. Kiểm tra tab web; không tự gửi lại.");
        });
        heartbeat = setInterval(() => { try { port.postMessage({ channel, type: "heartbeat",operationId:message.operationId }); }
          catch { fail("EXTENSION_DISCONNECTED", "Extension mất kết nối. Kiểm tra tab web; không tự gửi lại."); } }, 15_000);
        timeout = setTimeout(() => {
          try { port.postMessage({ channel, type: "cancel-request", operationId: message.operationId }); } catch { /* Disconnected. */ }
          publish("auto-result", { response: { ok: false, code: "CHATGPT_TIMEOUT", message: "Hết thời gian chờ web. Kiểm tra tab; không tự gửi lại." } }); cleanup();
        }, 20 * 60_000 + 1500);
        port.postMessage({ channel, type: "auto-request", operationId: message.operationId, requestId: message.requestId,provider:message.provider,
          sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt, issuedAt: message.issuedAt,media:message.media });
      } catch { publish("auto-result", { response: { ok: false, code: "EXTENSION_UNAVAILABLE", message: "Extension chưa sẵn sàng. Tải lại Studio và chọn tab web." } }); cleanup(); }
      return;
    }
    if (message.type !== "fill-request" || typeof message.operationId !== "string" || inFlight.has(message.operationId)) return;
    inFlight.add(message.operationId);
    void chrome.runtime.sendMessage({
      channel, type: "fill-request", operationId: message.operationId, requestId: message.requestId,provider:message.provider,
      sourceId: message.sourceId, analysisKey: message.analysisKey, prompt: message.prompt, issuedAt: message.issuedAt,
    }).then((response) => {
      window.postMessage({ channel, type: "fill-result", operationId: message.operationId, response }, location.origin);
    }).catch(() => {
      window.postMessage({ channel, type: "fill-result", operationId: message.operationId, response: {
        ok: false, code: "EXTENSION_UNAVAILABLE", message: "Extension chưa sẵn sàng. Tải lại Studio và chọn tab web trong extension.",
      } }, location.origin);
    }).finally(() => inFlight.delete(message.operationId));
  });
})();
