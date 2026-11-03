"use client";
import { TaskProgress } from "./task-progress";
export type RenderProgressJob = {
  state: string;
  progress: number;
  currentPart: number | null;
  phase?: string | null;
  startedAt?: string;
  attempt?: number;
  stopping?: boolean;
  outputs?: unknown[];
  plan?: { parts: unknown[] };
};
export function RenderProgress({ job, compact = false }: { job: RenderProgressJob; compact?: boolean }) {
  const done = job.state === "done" && (!job.plan || job.outputs?.length === job.plan.parts.length);
  // The worker marks a cancelled job as stopping while its process/cleanup is
  // still active. Do not announce completion before that flag clears.
  const stopping = Boolean(job.stopping) && ["queued", "rendering", "cancelled"].includes(job.state);
  const state = stopping
    ? "waiting"
    : done
      ? "done"
      : job.state === "error"
        ? "error"
        : job.state === "cancelled"
          ? "cancelled"
          : ["queued", "done"].includes(job.state)
            ? "waiting"
            : "running";
  const part = job.currentPart ? ` · Part ${job.currentPart}` : "";
  const label = stopping
    ? "Đang dừng render"
    : job.state === "done"
      ? done
        ? "Đã lưu output"
        : "Job kết thúc · kiểm tra output"
      : job.state === "error"
        ? "Render lỗi"
        : job.state === "cancelled"
          ? "Đã dừng"
          : job.state === "queued"
            ? "Chờ / chuẩn bị render"
            : job.phase === "validating"
              ? `Kiểm tra output${part}`
              : job.phase === "publishing"
                ? `Lưu output${part}`
                : job.currentPart
                  ? `Render Part ${job.currentPart}`
                  : "Chuẩn bị render";
  return (
    <TaskProgress
      label={label}
      state={state}
      scope="toàn tác vụ"
      percent={job.state === "queued" ? null : job.progress}
      startedAt={job.startedAt ? Date.parse(job.startedAt) : undefined}
      compact={compact}
      detail={job.attempt && job.attempt > 1 ? `Lượt render ${job.attempt}` : undefined}
    />
  );
}
