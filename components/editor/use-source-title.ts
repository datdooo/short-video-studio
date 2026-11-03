"use client";
import { workerFetch } from "@/lib/api/worker-client";
import type { EditPlan } from "@/lib/edit-plan";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  restorePassive: boolean;
  sessionReady: boolean;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setSourceTitle: Dispatch<SetStateAction<string>>;
  setYoutubeError: Dispatch<SetStateAction<string>>;
  setYoutubeState: Dispatch<SetStateAction<"idle" | "error" | "loading" | "ready">>;
  sourceMode: "youtube" | "local";
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  sourceUrl: string;
};
export function useSourceTitle(state: State) {
  const {
    restorePassive,
    sessionReady,
    setPlan,
    setSourceTitle,
    setYoutubeError,
    setYoutubeState,
    sourceMode,
    sourceRequests,
    sourceSelectionEpoch,
    sourceUrl,
  } = state;
  useEffect(() => {
    if (!sessionReady || restorePassive) return;
    if (sourceMode !== "youtube" || !sourceUrl.trim()) {
      const idleTimer = window.setTimeout(() => {
        setYoutubeState("idle");
        setYoutubeError("");
      }, 0);
      return () => window.clearTimeout(idleTimer);
    }
    const controller = new AbortController(),
      epoch = sourceSelectionEpoch.current;
    const requests = sourceRequests.current;
    requests.add(controller);
    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted || epoch !== sourceSelectionEpoch.current) return;
      setYoutubeState("loading");
      setYoutubeError("");
      try {
        const response = await workerFetch(`/api/youtube/metadata?url=${encodeURIComponent(sourceUrl.trim())}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { title?: string; error?: string };
        if (!response.ok || typeof data.title !== "string" || !data.title.trim())
          throw new Error(data.error || "Không lấy được YouTube title.");
        if (controller.signal.aborted || epoch !== sourceSelectionEpoch.current) return;
        setSourceTitle(data.title);
        setPlan((current) => ({ ...current, originalTitle: data.title as string }));
        setYoutubeState("ready");
      } catch (caughtError) {
        if (controller.signal.aborted || epoch !== sourceSelectionEpoch.current) return;
        setYoutubeState("error");
        setYoutubeError(caughtError instanceof Error ? caughtError.message : "Không lấy được YouTube title.");
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      requests.delete(controller);
    };
  }, [
    sessionReady,
    restorePassive,
    sourceMode,
    sourceUrl,
    setPlan,
    setSourceTitle,
    setYoutubeError,
    setYoutubeState,
    sourceRequests,
    sourceSelectionEpoch,
  ]);
  return {};
}
