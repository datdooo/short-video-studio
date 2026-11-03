"use client";
import type { WorkerHealth } from "@/lib/api/worker-client";
import { workerFetch, type RenderJob } from "@/lib/api/worker-client";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";
type State = {
  jobRestoreEpoch: RefObject<number>;
  restoredJobId: string;
  sessionReady: boolean;
  setEditorRenderNotice: Dispatch<SetStateAction<string>>;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  workerHealth: WorkerHealth | null;
};
export function useSavedRender(state: State) {
  const { jobRestoreEpoch, restoredJobId, sessionReady, setEditorRenderNotice, setRenderJob, workerHealth } = state;
  useEffect(() => {
    if (!sessionReady || !restoredJobId || !workerHealth?.ok) return;
    const controller = new AbortController(),
      epoch = jobRestoreEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await workerFetch(`/api/jobs/${restoredJobId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as { job?: RenderJob; error?: string };
        if (!response.ok || data.job?.id !== restoredJobId) throw Error(data.error || "Chưa tìm thấy job đã lưu.");
        if (controller.signal.aborted || epoch !== jobRestoreEpoch.current) return;
        setRenderJob(data.job);
        if (["queued", "rendering"].includes(data.job.state)) timer = setTimeout(() => void poll(), 1500);
      } catch {
        if (!controller.signal.aborted && epoch === jobRestoreEpoch.current) {
          setEditorRenderNotice("Job đã theo dõi chưa khả dụng; không gửi render lại. Đang chờ worker.");
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionReady, restoredJobId, workerHealth?.ok, jobRestoreEpoch, setEditorRenderNotice, setRenderJob]);
  return {};
}
