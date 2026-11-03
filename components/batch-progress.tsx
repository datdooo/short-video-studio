"use client";
import { TaskProgress } from "./task-progress";
export function BatchProgress({ items }: { items: { state: string; job?: { stopping?: boolean } | null }[] }) {
  const done = items.filter((i) => i.state === "done").length,
    error = items.filter((i) => i.state === "error").length,
    cancelled = items.filter((i) => i.state === "cancelled" && !i.job?.stopping).length;
  const stopping = items.filter((i) => i.job?.stopping).length;
  const ended = done + error + cancelled,
    review = items.filter((i) => ["paused", "awaiting-import", "review-required"].includes(i.state)).length;
  if (!items.length) return null;
  return (
    <TaskProgress
      label="Tiến trình hàng đợi"
      percent={(ended / items.length) * 100}
      scope="item kết thúc"
      state={ended === items.length ? "done" : "waiting"}
      detail={`${ended}/${items.length} item kết thúc · thành công ${done} · lỗi ${error} · hủy ${cancelled}${stopping ? ` · đang dừng ${stopping}` : ""}${review ? ` · cần xử lý ${review}` : ""}`}
    />
  );
}
