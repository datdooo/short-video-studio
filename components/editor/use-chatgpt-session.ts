"use client";
import { workerFetch, type ChatGPTSession } from "@/lib/api/worker-client";
import { useCallback, useEffect, useRef, useState } from "react";
/** ChatGPT Auto runs through the user's local Codex CLI; the app only reports its status. */
export function useChatGPTSession(workerReady: boolean) {
  const [chatGPTSession, setChatGPTSession] = useState<ChatGPTSession | null>(null);
  const [isChatGPTChecking, setIsChatGPTChecking] = useState(false);
  const revision = useRef(0);
  const read = useCallback(async (refresh: boolean, signal: AbortSignal, current: number) => {
    const response = await workerFetch(`/api/codex/status${refresh ? "?refresh=1" : ""}`, {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    });
    const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
    if (!response.ok || !data.session) throw new Error(data.error || "Không đọc được trạng thái Codex.");
    if (current === revision.current) setChatGPTSession(data.session);
  }, []);
  useEffect(() => {
    if (!workerReady) {
      const timer = window.setTimeout(() => setChatGPTSession(null), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController(),
      current = ++revision.current;
    read(false, controller.signal, current).catch(() => {
      if (current === revision.current) setChatGPTSession(null);
    });
    return () => controller.abort();
  }, [workerReady, read]);
  const refreshChatGPTSession = useCallback(async () => {
    if (!workerReady || isChatGPTChecking) return;
    setIsChatGPTChecking(true);
    try {
      await read(true, new AbortController().signal, ++revision.current);
    } catch {
      setChatGPTSession(null);
    } finally {
      setIsChatGPTChecking(false);
    }
  }, [workerReady, isChatGPTChecking, read]);
  return { chatGPTSession, isChatGPTChecking, refreshChatGPTSession };
}
