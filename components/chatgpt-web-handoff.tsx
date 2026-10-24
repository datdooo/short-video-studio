"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";

const CHANNEL = "shortcut-studio-chatgpt-handoff-v1";
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const TOTAL_TIMEOUT_MS = 20 * 60_000;
export type ChatGptHandoffIdentity = { requestId: string; sourceId: string; analysisKey: string };
export type ChatGptHandoffReceipt = { mediaId: string; filename: string; bytes: number; variantKey:string; evidence: "composer-upload-ready" };
export type ChatGptHandoffPrepared = {
  prompt: string;
  identity: ChatGptHandoffIdentity;
  media: { id: string; filename: string; bytes: number | null; duration: number; variantKey:string };
};
type WebProvider = "chatgpt-web" | "gemini" | "muse";
type Props = {
  revision: string;
  provider: WebProvider;
  providerLabel: string;
  disabled?: boolean;
  prepare: (signal: AbortSignal) => Promise<ChatGptHandoffPrepared>;
  onResult: (raw: string, identity: ChatGptHandoffIdentity, receipt: ChatGptHandoffReceipt, signal: AbortSignal) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
};
type Status = { ok: boolean; code: string; message: string; detail?: string };
type Pending = {
  operationId: string; revision: string; provider: WebProvider; controller: AbortController;
  startedAt: number; prepared?: ChatGptHandoffPrepared; acknowledged: boolean;
  phase: "preparing" | "web" | "importing"; timer: ReturnType<typeof setTimeout> | null;
};
const sameIdentity = (a: ChatGptHandoffIdentity | undefined, b: ChatGptHandoffIdentity) =>
  Boolean(a && a.requestId === b.requestId && a.sourceId === b.sourceId && a.analysisKey === b.analysisKey);
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256;

// The primary action owns preparation -> web transfer -> validated import.
// A JSON response alone is never presented as successful analysis.
export function ChatGptWebHandoff({ revision, provider, providerLabel, disabled = false, prepare, onResult, onBusyChange }: Props) {
  const latest = useRef({ revision, provider, disabled, prepare, onResult, onBusyChange });
  latest.current = { revision, provider, disabled, prepare, onResult, onBusyChange };
  const pending = useRef<Pending | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Status | null>(null);
  const [received, setReceived] = useState<string | null>(null);

  function isCurrent(current: Pending) {
    return pending.current === current && !current.controller.signal.aborted && mounted.current
      && latest.current.revision === current.revision && latest.current.provider === current.provider && !latest.current.disabled;
  }
  function relayCancel(current: Pending) {
    window.postMessage({ channel: CHANNEL, type: "cancel-request", operationId: current.operationId }, window.location.origin);
  }
  function finish(current: Pending, status?: Status) {
    if (pending.current !== current) return;
    if (current.timer) clearTimeout(current.timer);
    pending.current = null;
    if (mounted.current) { setBusy(false); setProgress(""); if (status) setResult(status); }
    latest.current.onBusyChange?.(false);
  }
  function stop(current: Pending, status?: Status) {
    if (pending.current !== current) return;
    current.controller.abort(new DOMException("Lượt web AI đã dừng hoặc dữ liệu đã đổi.", "AbortError"));
    relayCancel(current); finish(current, status);
  }
  function arm(current: Pending, milliseconds: number, code: string, message: string) {
    if (current.timer) clearTimeout(current.timer);
    current.timer = setTimeout(() => stop(current, { ok: false, code, message }), milliseconds);
  }

  useEffect(() => {
    mounted.current = true;
    const onMessage = (event: MessageEvent) => {
      const current = pending.current;
      if (event.source !== window || event.origin !== window.location.origin || event.data?.channel !== CHANNEL
        || !current || event.data.operationId !== current.operationId || current.phase === "preparing") return;
      if (!isCurrent(current)) { stop(current); return; }
      if (event.data.type === "auto-confirm-send") {
        if (current.phase === "web") window.postMessage({ channel: CHANNEL, type: "confirm-auto-send", operationId: current.operationId }, window.location.origin);
        return;
      }
      if (event.data.type === "auto-progress" && current.phase === "web" && typeof event.data.message === "string") {
        if (!current.acknowledged) {
          current.acknowledged = true;
          arm(current, Math.max(1, TOTAL_TIMEOUT_MS), "WEB_TIMEOUT", "Hết thời gian chờ. Kiểm tra tab AI; app không tự gửi lại.");
        }
        setProgress(event.data.message.slice(0, 200)); return;
      }
      if (event.data.type !== "auto-result" || current.phase !== "web") return;
      const response = event.data.response;
      if (!response || typeof response.ok !== "boolean" || typeof response.code !== "string" || typeof response.message !== "string") return;
      if (!response.ok) {
        finish(current, { ok: false, code: response.code.slice(0, 80), message: response.message.slice(0, 400) }); return;
      }
      const prepared = current.prepared!;
      const receipt = response.receipt as ChatGptHandoffReceipt | undefined;
      if (typeof response.raw !== "string" || response.raw.length > 4_000_000 || !sameIdentity(response.identity, prepared.identity)
        || !receipt || receipt.mediaId !== prepared.media.id || receipt.filename !== prepared.media.filename
        || receipt.variantKey!==prepared.media.variantKey || receipt.evidence !== "composer-upload-ready" || !Number.isSafeInteger(receipt.bytes) || receipt.bytes <= 0 || receipt.bytes > MAX_VIDEO_BYTES
        || (prepared.media.bytes !== null && receipt.bytes !== prepared.media.bytes)) {
        finish(current, { ok: false, code: "RESULT_IDENTITY_INVALID", message: "Kết quả hoặc video không khớp lượt hiện tại. Plan được giữ nguyên." }); return;
      }
      try {
        const value = JSON.parse(response.raw);
        if (!value || Array.isArray(value) || !sameIdentity(value, prepared.identity)) throw new Error();
      } catch {
        finish(current, { ok: false, code: "OUTPUT_NOT_JSON", message: "Kết quả chưa có JSON đúng định danh. Plan được giữ nguyên." }); return;
      }
      const raw = response.raw;
      setReceived(raw); current.phase = "importing"; setProgress("Kiểm tra và áp dụng kết quả…");
      // The callback must validate source/schema/ranges before committing a plan.
      // Keep the controller alive so Cancel or source changes abort that work too.
      void Promise.resolve().then(() => {
        current.controller.signal.throwIfAborted();
        return latest.current.onResult(raw, prepared.identity, receipt, current.controller.signal);
      }).then(() => {
        if (pending.current === current && !current.controller.signal.aborted) finish(current, { ok: true, code: "RESULT_APPLIED", message: "Đã áp dụng kết quả." });
      }).catch((error: unknown) => {
        if (pending.current !== current || current.controller.signal.aborted) return;
        const detail = error instanceof Error ? error.message : "Không nhập được kết quả.";
        finish(current, { ok: false, code: "RESULT_NOT_IMPORTED", message: "Kết quả chưa hợp lệ. Plan được giữ nguyên.", detail });
      });
    };
    window.addEventListener("message", onMessage);
    return () => {
      mounted.current = false; window.removeEventListener("message", onMessage);
      const current = pending.current;
      if (current) { current.controller.abort(); relayCancel(current); if (current.timer) clearTimeout(current.timer); pending.current = null; latest.current.onBusyChange?.(false); }
    };
  }, []);
  useEffect(() => {
    const current = pending.current;
    if (!current) return;
    if (current.provider !== provider || disabled) { stop(current); return; }
    if (current.revision === revision) return;
    if (current.phase === "importing") {
      // A validated import commits a new main before its Promise resolves. Let
      // that completion microtask finish before treating its own revision as an
      // external edit. The parent still checks the live revision before commit.
      const timer = setTimeout(() => {
        if (pending.current !== current) return;
        stop(current); setResult(null); setReceived(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    stop(current);
  }, [revision, provider, disabled]);
  useEffect(() => {
    if (pending.current?.phase === "importing") return;
    setResult(null); setReceived(null);
  }, [revision, provider]);
  useEffect(() => {
    if (!busy) return;
    const update = () => { const current = pending.current; if (current) setElapsed(Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000))); };
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [busy]);

  async function run() {
    if (latest.current.disabled || pending.current) return;
    if (!["http://127.0.0.1:5373", "http://localhost:5373"].includes(window.location.origin)) {
      setResult({ ok: false, code: "STUDIO_ORIGIN_UNSUPPORTED", message: "Mở Studio Beta cổng 5373 trong trình duyệt đã cài extension." }); return;
    }
    const current: Pending = { operationId: crypto.randomUUID(), revision: latest.current.revision, provider: latest.current.provider,
      controller: new AbortController(), startedAt: Date.now(), acknowledged: false, phase: "preparing", timer: null };
    pending.current = current; setBusy(true); setElapsed(0); setResult(null); setReceived(null); setProgress("Chuẩn bị dữ liệu và video gửi web…"); latest.current.onBusyChange?.(true);
    arm(current, TOTAL_TIMEOUT_MS, "WEB_TIMEOUT", "Hết thời gian chuẩn bị. Plan được giữ nguyên; app không tự gửi lại.");
    try {
      const prepared = await latest.current.prepare(current.controller.signal);
      if (!isCurrent(current)) { stop(current); return; }
      const { prompt, identity, media } = prepared;
      if (!prompt || prompt.length > 2_000_000) throw new Error("Prompt trống hoặc vượt giới hạn 2.000.000 ký tự của extension. Nội dung không bị cắt.");
      if (!validId(identity?.requestId) || !validId(identity?.sourceId) || !validId(identity?.analysisKey)
        || !/^[a-f0-9-]{16,64}$/i.test(identity.sourceId) || media?.id !== `source-video-${identity.sourceId}`
        || typeof media.variantKey!=="string" || !/^[a-f0-9]{64}$/.test(media.variantKey) || typeof media.filename !== "string" || !media.filename.startsWith(`source-${identity.sourceId}.`)
        || !Number.isFinite(media.duration) || media.duration <= 0
        || (media.bytes !== null && (!Number.isSafeInteger(media.bytes) || media.bytes <= 0))) throw new Error("Thiếu định danh hoặc thông tin video nguồn. Chuẩn bị lại source trước.");
      if (media.bytes !== null && media.bytes > MAX_VIDEO_BYTES) throw new Error("Video vượt giới hạn truyền 512 MiB của extension. App chưa gửi text thay thế.");
      current.prepared = prepared; current.phase = "web"; setProgress("Kết nối tab AI đang mở…");
      arm(current, 13_000, "EXTENSION_UNAVAILABLE", "Chưa kết nối được extension. Tải lại extension và trang Studio rồi thử lại.");
      window.postMessage({ channel: CHANNEL, type: "auto-request", operationId: current.operationId, provider: current.provider,
        ...identity, prompt, media, issuedAt: Date.now() }, window.location.origin);
    } catch (error) {
      if (pending.current !== current || current.controller.signal.aborted) return;
      const detail = error instanceof Error ? error.message : "Không chuẩn bị được dữ liệu.";
      stop(current, { ok: false, code: "WEB_PREPARATION_FAILED", message: "Chưa gửi được lượt phân tích.", detail });
    }
  }
  function cancel() {
    const current = pending.current; if (!current) return;
    stop(current, { ok: false, code: "HANDOFF_CANCELLED", message: "Đã dừng. Nếu đã gửi, AI có thể vẫn chạy trong tab; app chưa nhận thêm kết quả." });
  }
  return <div className="min-w-0 space-y-2">
    <Button type="button" className="studio-primary w-full min-w-0" onClick={() => void run()} disabled={disabled || busy} aria-busy={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
      Phân tích bằng {providerLabel}
    </Button>
    {busy && <div className="flex min-w-0 items-center gap-2 text-xs leading-5">
      <span className="min-w-0 flex-1 text-muted-foreground"><span role="status" aria-live="polite">{progress}</span> · {elapsed}s</span>
      <Button type="button" variant="outline" size="timeline" onClick={cancel}><Square className="size-3" aria-hidden="true" /> Dừng</Button>
    </div>}
    {result && <div className="space-y-1 text-xs leading-5">
      <p role="status" aria-live="polite" className={result.ok ? "text-emerald-300" : "text-amber-200"}>{result.message}</p>
      {!result.ok && <details className="text-muted-foreground"><summary className="cursor-pointer">Chi tiết</summary><p className="break-words whitespace-pre-wrap">{result.code}{result.detail ? ` · ${result.detail}` : ""}</p>
        {received && <><textarea readOnly value={received} aria-label="JSON nhận từ lượt web AI" className="mt-2 min-h-28 w-full min-w-0 resize-y rounded-md border bg-background p-2 font-mono text-xs" /><CopyButton text={received} label="Sao chép kết quả nhận được" /></>}
      </details>}
    </div>}
  </div>;
}
