"use client";
import { Button } from "@/components/ui/button";

import { toast } from "./confirmation-provider";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Sao chép tiêu đề + hashtag",
  ariaLabel,
  className,
  disabled = false,
  onCopied,
  onError,
  errorMessage = "Chưa sao chép được. Chọn văn bản để sao chép bằng tay.",
}: {
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
  const latestText = useRef(text);
  useLayoutEffect(() => {
    latestText.current = text;
  }, [text]);
  const pending = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  async function copy() {
    if (disabled || pending.current) return;
    pending.current = true;
    clearTimeout(timer.current);
    setResult({ text, status: "pending" });
    try {
      await navigator.clipboard.writeText(text);
      if (mounted.current && latestText.current === text) {
        setResult({ text, status: "done" });
        toast.success("Đã sao chép");
        onCopied?.();
      }
    } catch {
      if (mounted.current && latestText.current === text) {
        setResult({ text, status: "error" });
        toast.error("Chưa sao chép được");
        onError?.();
      }
    } finally {
      pending.current = false;
      if (mounted.current) timer.current = setTimeout(() => setResult(null), 2500);
    }
  }
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-2">
      <Button
        variant="secondary"
        size="md"
        type="button"
        aria-label={ariaLabel || label}
        data-copy-state={status}
        disabled={disabled || status === "pending"}
        onClick={() => void copy()}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs text-zinc-300 transition duration-150 hover:bg-white/15 active:scale-95",
          className,
        )}
      >
        {status === "done" ? (
          <Check className="size-3.5 shrink-0" />
        ) : status === "pending" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <Copy className="size-3.5 shrink-0" />
        )}
        <span className="studio-copy-label">
          <span aria-hidden="true" className="studio-copy-reserve">
            {label}
          </span>
          <span aria-live="polite">
            {status === "done"
              ? "Đã sao chép"
              : status === "pending"
                ? "Đang sao chép…"
                : status === "error"
                  ? "Sao chép lại"
                  : label}
          </span>
        </span>
      </Button>
      {status === "error" && (
        <span role="alert" className="text-xs leading-5 text-red-300">
          {errorMessage}
        </span>
      )}
    </span>
  );
}
