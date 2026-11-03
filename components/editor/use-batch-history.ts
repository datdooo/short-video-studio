"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { workerFetch, type BatchJob } from "@/lib/api/worker-client";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  batch: BatchJob | null;
  batchId: string;
  batchPollVersion: number;
  removedMediaUrls: RefObject<Set<string>>;
  setPastBatches: Dispatch<SetStateAction<BatchJob[]>>;
  workerHealth: WorkerHealth | null;
  workspace: "batch" | "editor" | "storage";
};
export function useBatchHistory(state: State) {
  const { batch, batchId, batchPollVersion, removedMediaUrls, setPastBatches, workerHealth, workspace } = state;
  useEffect(() => {
    if (workspace !== "batch" || !workerHealth?.ok) return;
    let disposed = false;
    async function loadHistory() {
      try {
        const response = await workerFetch(`/api/batches`, { cache: "no-store" });
        const data = (await response.json()) as { batches?: BatchJob[] };
        if (response.ok && data.batches && !disposed) {
          for (const group of data.batches)
            for (const item of group.items)
              if (item.job)
                item.job.outputs = item.job.outputs.filter((output) => !removedMediaUrls.current.has(output.url));
          setPastBatches(data.batches);
        }
      } catch {
        /* The active queue still reports worker connection errors. */
      }
    }
    void loadHistory();
    return () => {
      disposed = true;
    };
  }, [workspace, workerHealth?.ok, batchId, batch?.finished, batchPollVersion, removedMediaUrls, setPastBatches]);
  return {};
}
