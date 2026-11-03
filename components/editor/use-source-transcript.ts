"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { workerFetch } from "@/lib/api/worker-client";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  restorePassive: boolean;
  sessionReady: boolean;
  setTranscript: Dispatch<SetStateAction<string>>;
  setTranscriptStatus: Dispatch<SetStateAction<string>>;
  sourceMode: "youtube" | "local";
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  sourceUrl: string;
  transcriptEdited: RefObject<boolean>;
  transcriptRequest: RefObject<AbortController | null>;
  transcriptRevision: RefObject<number>;
  workerHealth: WorkerHealth | null;
};
export function useSourceTranscript(state: State) {
  const {
    restorePassive,
    sessionReady,
    setTranscript,
    setTranscriptStatus,
    sourceMode,
    sourceRequests,
    sourceSelectionEpoch,
    sourceUrl,
    transcriptEdited,
    transcriptRequest: transcriptRequestRef,
    transcriptRevision,
    workerHealth,
  } = state;
  useEffect(() => {
    if (
      !sessionReady ||
      restorePassive ||
      transcriptEdited.current ||
      sourceMode !== "youtube" ||
      !sourceUrl.trim() ||
      !workerHealth?.ok
    )
      return;
    const controller = new AbortController(),
      epoch = sourceSelectionEpoch.current,
      revision = transcriptRevision.current;
    transcriptRequestRef.current = controller;
    sourceRequests.current.add(controller);
    const timer = window.setTimeout(async () => {
      if (
        controller.signal.aborted ||
        epoch !== sourceSelectionEpoch.current ||
        revision !== transcriptRevision.current
      )
        return;
      setTranscriptStatus("Đang tự lấy phụ đề gốc từ YouTube…");
      try {
        const response = await workerFetch(`/api/youtube/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl.trim() }),
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          transcript?: string;
          title?: string;
          message?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Không lấy được transcript.");
        if (
          controller.signal.aborted ||
          epoch !== sourceSelectionEpoch.current ||
          revision !== transcriptRevision.current
        )
          return;
        setTranscript(typeof data.transcript === "string" ? data.transcript : "");
        setTranscriptStatus(
          typeof data.transcript === "string" && data.transcript
            ? "Đã tự lấy transcript theo ngôn ngữ gốc."
            : typeof data.message === "string"
              ? data.message
              : "Video không có phụ đề.",
        );
      } catch (caughtError) {
        if (!controller.signal.aborted && epoch === sourceSelectionEpoch.current)
          setTranscriptStatus(caughtError instanceof Error ? caughtError.message : "Không lấy được transcript.");
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      sourceRequests.current.delete(controller);
      if (transcriptRequestRef.current === controller) transcriptRequestRef.current = null;
    };
  }, [
    sessionReady,
    restorePassive,
    sourceUrl,
    sourceMode,
    workerHealth?.ok,
    setTranscript,
    setTranscriptStatus,
    sourceRequests,
    sourceSelectionEpoch,
    transcriptEdited,
    transcriptRequestRef,
    transcriptRevision,
  ]);
  return {};
}
