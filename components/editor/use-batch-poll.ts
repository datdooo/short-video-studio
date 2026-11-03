"use client";
import { workerFetch, type BatchJob } from "@/lib/api/worker-client";
import type { BatchDownload } from "@/lib/batch-downloads.mjs";
import { collectBatchDownloads } from "@/lib/batch-downloads.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  batchDownloadQueue: RefObject<{
    enqueue: (outputs: BatchDownload[]) => void;
    remove: (keys: string[]) => void;
    dispose: () => void;
  } | null>;
  batchId: string;
  batchPollEpoch: RefObject<number>;
  batchPollVersion: number;
  deletedBatchItems: RefObject<Set<string>>;
  removedMediaUrls: RefObject<Set<string>>;
  restorePassive: boolean;
  setBatch: Dispatch<SetStateAction<BatchJob | null>>;
  setBatchError: Dispatch<SetStateAction<string>>;
};
export function useBatchPoll(state: State) {
  const {
    batchDownloadQueue,
    batchId,
    batchPollEpoch,
    batchPollVersion,
    deletedBatchItems,
    removedMediaUrls,
    restorePassive,
    setBatch,
    setBatchError,
  } = state;
  useEffect(() => {
    if (!batchId) return;
    let disposed = false;
    const epoch = batchPollEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await workerFetch(`/api/batches/${batchId}`, { cache: "no-store" });
        const data = (await response.json()) as { batch?: BatchJob; error?: string };
        if (!response.ok || !data.batch) throw new Error(data.error || "Không đọc được hàng đợi.");
        if (disposed || epoch !== batchPollEpoch.current) return;
        data.batch.items = data.batch.items.filter((item) => !deletedBatchItems.current.has(item.id));
        for (const item of data.batch.items)
          if (item.job)
            item.job.outputs = item.job.outputs.filter((output) => !removedMediaUrls.current.has(output.url));
        setBatch(data.batch);
        setBatchError("");
        if (!restorePassive) batchDownloadQueue.current?.enqueue(collectBatchDownloads(data.batch));
        if (!data.batch.finished || data.batch.items.some((item) => item.job?.stopping))
          timer = setTimeout(() => void poll(), 2000);
      } catch (error) {
        if (disposed || epoch !== batchPollEpoch.current) return;
        setBatchError(error instanceof Error ? error.message : "Không đọc được hàng đợi.");
        timer = setTimeout(() => void poll(), 5000);
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [
    batchId,
    batchPollVersion,
    restorePassive,
    batchDownloadQueue,
    batchPollEpoch,
    deletedBatchItems,
    removedMediaUrls,
    setBatch,
    setBatchError,
  ]);
  return {};
}
