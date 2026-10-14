"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label = "Copy title + hashtag", ariaLabel, className, disabled = false, onCopied, onError, errorMessage = "Trình duyệt chưa cho copy. Có thể chọn văn bản và copy bằng tay." }: {
  text: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onCopied?: () => void;
  onError?: () => void;
  errorMessage?: string;
}) {
  const [result, setResult] = useState<{ text: string; status: "pending" | "done" | "error" } | null>(null);
  const status = result?.text === text ? result.status : null;
  const pending = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  async function copy() {
    if (disabled || pending.current) return;
    pending.current = true;
    clearTimeout(timer.current);
    setResult({ text, status: "pending" });
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current) { setResult({ text, status: "done" }); onCopied?.(); }
    } catch {
      if (mounted.current) { setResult({ text, status: "error" }); onError?.(); }
    } finally {
      pending.current = false;
      if (mounted.current) timer.current = setTimeout(() => setResult(null), 2500);
    }
  }
  return <span className="inline-flex max-w-full flex-col items-start gap-2">
    <button type="button" aria-label={ariaLabel || label} disabled={disabled || status === "pending"} onClick={() => void copy()} className={cn(
      "flex items-center justify-center gap-1.5 rounded-lg bg-white/8 px-3 py-2 text-xs text-zinc-300 transition duration-150 hover:bg-white/15 active:scale-95 disabled:opacity-50",
      className,
      status === "done" && "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-400/20",
      status === "error" && "bg-red-400/10 text-red-300 hover:bg-red-400/15",
    )}>
      {status === "done" ? <Check className="size-3.5 shrink-0" /> : status === "pending" ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Copy className="size-3.5 shrink-0" />}
      <span aria-live="polite">{status === "done" ? "Đã copy!" : status === "pending" ? "Đang copy…" : status === "error" ? "Chưa copy được · thử lại" : label}</span>
    </button>
    {status === "error" && <span role="alert" className="text-xs leading-5 text-red-300">{errorMessage}</span>}
  </span>;
}
