"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";

const CHANNEL = "shortcut-studio-chatgpt-handoff-v1";
export type ChatGptHandoffIdentity = { requestId: string; sourceId: string; analysisKey: string };
type Props = ChatGptHandoffIdentity & {
  prompt: string;
  disabled?: boolean;
  attachmentConfirmed?: boolean;
  onResult?: (raw: string, identity: ChatGptHandoffIdentity) => void;
};
type Status = { ok: boolean; code: string; message: string };
type Pending = { operationId: string; identity: string; context: ChatGptHandoffIdentity; mode: "fill" | "auto"; startedAt: number; acknowledged: boolean; timer: ReturnType<typeof setTimeout> };

export function ChatGptWebHandoff({ prompt, requestId, sourceId, analysisKey, disabled = false, attachmentConfirmed = false, onResult }: Props) {
  const identity = JSON.stringify([requestId, sourceId, analysisKey, prompt]);
  const latest = useRef(identity); latest.current = identity;
  const autoAllowed = useRef(!disabled && attachmentConfirmed); autoAllowed.current = !disabled && attachmentConfirmed;
  const resultHandler = useRef(onResult); resultHandler.current = onResult;
  const pending = useRef<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ identity: string; status: Status } | null>(null);
  const [received, setReceived] = useState<{ identity: string; raw: string } | null>(null);
  const shown = result?.identity === identity ? result.status : null;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const current = pending.current;
      if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== CHANNEL || !current
        || event.data.operationId !== current.operationId || current.identity !== latest.current) return;
      // Props are reflected in the ref during render, before the cancellation effect runs.
      if (current.mode === "auto" && !autoAllowed.current) {
        clearTimeout(current.timer); pending.current = null; setBusy(false); setProgress("");
        window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin);
        return;
      }
      if (event.data.type === "auto-confirm-send" && current.mode === "auto") {
        window.postMessage({ channel: CHANNEL, type: autoAllowed.current ? "confirm-auto-send" : "cancel-request", operationId: current.operationId }, window.location.origin); return;
      }
      if (event.data.type === "auto-progress" && current.mode === "auto" && typeof event.data.message === "string") {
        if (!current.acknowledged) {
          current.acknowledged = true; clearTimeout(current.timer);
          current.timer = setTimeout(() => {
            if (pending.current !== current) return;
            pending.current = null; setBusy(false); setProgress("");
            window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin);
            if (latest.current === current.identity) setResult({ identity: current.identity, status: { ok: false, code: "CHATGPT_TIMEOUT", message: "Hết 10 phút chờ. Kiểm tra tab ChatGPT; không tự gửi lại hoặc áp dụng kết quả." } });
          }, 10 * 60_000 + 3000);
        }
        setProgress(event.data.message.slice(0,200)); return;
      }
      if (event.data.type !== (current.mode === "auto" ? "auto-result" : "fill-result")) return;
      const response = event.data.response;
      if (!response || typeof response.ok !== "boolean" || typeof response.code !== "string" || typeof response.message !== "string") return;
      clearTimeout(current.timer); pending.current = null; setBusy(false); setProgress("");
      let status: Status = { ok: response.ok, code: response.code.slice(0,80), message: response.message.slice(0,400) };
      if (current.mode === "auto" && response.ok) {
        const context = response.identity;
        if (typeof response.raw !== "string" || response.raw.length > 4_000_000 || !context || context.requestId !== current.context.requestId
          || context.sourceId !== current.context.sourceId || context.analysisKey !== current.context.analysisKey) {
          status = { ok: false, code: "RESULT_IDENTITY_INVALID", message: "Kết quả không khớp source/request/context hiện tại. Plan được giữ nguyên." };
        } else {
          try {
            const value = JSON.parse(response.raw);
            if (!value || value.requestId !== context.requestId || value.sourceId !== context.sourceId || value.analysisKey !== context.analysisKey || !resultHandler.current) throw new Error();
            setReceived({ identity: current.identity, raw: response.raw });
            resultHandler.current(response.raw, current.context);
          } catch { status = { ok: false, code: "RESULT_NOT_IMPORTED", message: "Chưa đưa được JSON vào ô kết quả. Plan được giữ nguyên; kiểm tra và copy từ tab bằng tay." }; }
        }
      }
      setResult({ identity: current.identity, status });
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      const current = pending.current;
      if (current) { clearTimeout(current.timer); window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin); pending.current = null; }
    };
  }, []);
  useEffect(() => {
    const current = pending.current;
    if (current && (current.identity !== identity || disabled || (current.mode === "auto" && !attachmentConfirmed))) {
      clearTimeout(current.timer); pending.current = null; setBusy(false); setProgress("");
      window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin);
    }
  }, [identity, disabled, attachmentConfirmed]);
  useEffect(() => {
    setReceived(null); setResult(null);
  }, [identity]);
  useEffect(() => {
    if (!busy) return;
    const update = () => { const current = pending.current; if (current) setElapsed(Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000))); };
    update(); const interval = setInterval(update, 1000); return () => clearInterval(interval);
  }, [busy]);

  function run(mode: "fill" | "auto") {
    if (disabled || pending.current || !prompt || !requestId || !sourceId || !analysisKey || (mode === "auto" && (!attachmentConfirmed || !onResult))) return;
    if (!["http://127.0.0.1:5373", "http://localhost:5373"].includes(window.location.origin)) {
      setResult({ identity, status: { ok: false, code: "STUDIO_ORIGIN_UNSUPPORTED", message: "Mở Studio Beta cổng 5373 trong cùng trình duyệt có extension, hoặc copy bằng tay." } }); return;
    }
    const operationId = crypto.randomUUID(); const startedAt = Date.now();
    const timer = setTimeout(() => {
      if (pending.current?.operationId !== operationId) return;
      pending.current = null; setBusy(false); setProgress("");
      window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId }, window.location.origin);
      if (latest.current === identity) setResult({ identity, status: { ok: false, code: "HANDOFF_TIMEOUT", message: mode === "auto"
        ? "Hết thời gian chờ. Kiểm tra tab ChatGPT; không tự gửi lại hoặc áp dụng kết quả."
        : "Chưa có xác nhận. Mở extension, chọn tab ChatGPT và kiểm tra ô soạn thảo trước khi bấm lại." } });
    }, 13_000);
    pending.current = { operationId, identity, context: { requestId, sourceId, analysisKey }, mode, startedAt, acknowledged: false, timer };
    setElapsed(0); setBusy(true); setResult(null); setReceived(null); setProgress(mode === "auto" ? "Đang kết nối tab ChatGPT…" : "Đang điền prompt…");
    window.postMessage({ channel: CHANNEL, type: mode === "auto" ? "auto-request" : "fill-request", operationId,
      requestId, sourceId, analysisKey, prompt, issuedAt: startedAt, attachmentConfirmed: mode === "auto" && attachmentConfirmed }, window.location.origin);
  }
  function cancel() {
    const current = pending.current; if (!current) return;
    clearTimeout(current.timer); pending.current = null; setBusy(false); setProgress("");
    window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin);
    setResult({ identity, status: { ok: false, code: "HANDOFF_CANCELLED", message: "Đã dừng chờ. Nếu đã gửi, ChatGPT vẫn có thể chạy trong tab; chưa áp dụng kết quả." } });
  }
  const unavailable = disabled || busy || !prompt || !requestId || !sourceId || !analysisKey;
  return <div className="min-w-0 space-y-2">
    <div className="grid min-w-0 gap-2">
      <Button type="button" size="sm" className="w-full min-w-0" onClick={() => run("auto")} disabled={unavailable || !attachmentConfirmed || !onResult}>
        {busy && pending.current?.mode === "auto" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        Gửi và nhận JSON từ ChatGPT
      </Button>
      <Button type="button" variant="outline" size="sm" className="w-full min-w-0" onClick={() => run("fill")} disabled={unavailable}>
        <ExternalLink className="size-4" aria-hidden="true" /> Chỉ điền prompt
      </Button>
    </div>
    {busy && <div className="flex min-w-0 items-center gap-2 text-xs leading-5" role="status" aria-live="polite">
      <span className="min-w-0 flex-1 text-muted-foreground">{progress} · {elapsed}s</span>
      <Button type="button" variant="outline" size="timeline" onClick={cancel}><Square className="size-3" aria-hidden="true" /> Dừng chờ</Button>
    </div>}
    {shown && <div className="space-y-1 text-xs leading-5" role="status" aria-live="polite">
      <p className={shown.ok ? "text-emerald-300" : "text-amber-200"}>{shown.message}</p>
      {!shown.ok && <details className="text-muted-foreground"><summary className="cursor-pointer">Chi tiết</summary><p className="break-words">{shown.code}</p></details>}
    </div>}
    {received?.identity === identity && !disabled && <div className="min-w-0 space-y-2">
      <details className="min-w-0 text-xs text-muted-foreground"><summary className="cursor-pointer">JSON nhận được · chưa tự áp dụng</summary>
        <textarea readOnly value={received.raw} aria-label="JSON nhận từ lượt ChatGPT web này" className="mt-2 min-h-36 w-full min-w-0 resize-y rounded-md border bg-background p-2 font-mono text-xs" />
      </details>
      <CopyButton text={received.raw} label="Sao chép JSON nhận được" />
    </div>}
  </div>;
}
