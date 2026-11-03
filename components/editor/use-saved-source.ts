"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { workerFetch, type WorkerSource } from "@/lib/api/worker-client";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  preparedSource: WorkerSource | null;
  retainedSourceId: string;
  sessionReady: boolean;
  setPreparedSource: Dispatch<SetStateAction<WorkerSource | null>>;
  setSourceRestoreNotice: Dispatch<SetStateAction<string>>;
  setSourceSize: Dispatch<SetStateAction<{ width: number; height: number }>>;
  sourceRequests: RefObject<Set<AbortController>>;
  sourceRestoreVersion: number;
  sourceSelectionEpoch: RefObject<number>;
  workerHealth: WorkerHealth | null;
};
export function useSavedSource(state: State) {
  const {
    preparedSource,
    retainedSourceId,
    sessionReady,
    setPreparedSource,
    setSourceRestoreNotice,
    setSourceSize,
    sourceRequests,
    sourceRestoreVersion,
    sourceSelectionEpoch,
    workerHealth,
  } = state;
  useEffect(() => {
    if (!sessionReady || !retainedSourceId || preparedSource?.id === retainedSourceId || !workerHealth?.ok) return;
    const controller = new AbortController(),
      epoch = sourceSelectionEpoch.current;
    sourceRequests.current.add(controller);
    void workerFetch(`/api/sources/${retainedSourceId}`, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const data = (await r.json()) as { source?: WorkerSource; error?: string };
        if (
          !r.ok ||
          data.source?.id !== retainedSourceId ||
          !Number.isFinite(data.source.duration) ||
          data.source.duration <= 0 ||
          !Number.isFinite(data.source.width) ||
          !Number.isFinite(data.source.height)
        )
          throw Error("Không mở được source đã lưu. Bản nháp được giữ; không tự tải lại.");
        if (controller.signal.aborted || epoch !== sourceSelectionEpoch.current) return;
        setPreparedSource(data.source);
        setSourceSize({ width: data.source.width, height: data.source.height });
        setSourceRestoreNotice("");
      })
      .catch(() => {
        if (!controller.signal.aborted && epoch === sourceSelectionEpoch.current)
          setSourceRestoreNotice(
            "Source đã lưu chưa khả dụng hoặc đã mất. Bản nháp vẫn được giữ; kết nối lại worker hoặc chủ động chuẩn bị/chọn lại nguồn.",
          );
      })
      .finally(() => sourceRequests.current.delete(controller));
    return () => {
      controller.abort();
      sourceRequests.current.delete(controller);
    };
  }, [
    sessionReady,
    retainedSourceId,
    preparedSource?.id,
    workerHealth?.ok,
    sourceRestoreVersion,
    setPreparedSource,
    setSourceRestoreNotice,
    setSourceSize,
    sourceRequests,
    sourceSelectionEpoch,
  ]);
  return {};
}
