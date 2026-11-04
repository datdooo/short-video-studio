"use client";
import { workerErrorMessage } from "@/lib/api/worker-client";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState, InlineNotice, Panel, PanelHeader, Toolbar } from "@/components/ui/workspace";
import { Button } from "@/components/ui/button";

import { Download, Film, Loader2, Square, Trash2 } from "lucide-react";
import type { EditPlan } from "@/lib/edit-plan";
import { RenderProgress } from "./render-progress";
import { CopyButton } from "@/components/copy-button";
import { completedRenderJobs } from "@/lib/render-delete.mjs";

export type EditorRenderJob = {
  id: string;
  sourceId: string;
  state: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  currentPart: number | null;
  outputs: Array<{ part: number; filename: string; size: number; url: string }>;
  error: string | null;
  plan?: EditPlan;
  planSummary?: import("@/lib/api/worker-client").RenderJob["planSummary"];
  createdAt?: string;
  stopping?: boolean;
  phase?: string | null;
  startedAt?: string;
  attempt?: number;
};

export function EditorRenderList({
  query = "",
  jobs,
  stopping,
  deleting,
  deletingAll,
  error,
  notice,
  origin,
  onStop,
  onDelete,
  onDeleteAll,
}: {
  query?: string;
  jobs: EditorRenderJob[];
  stopping: string[];
  deleting: string[];
  deletingAll: boolean;
  error: string;
  notice: string;
  origin: string;
  onStop: (job: EditorRenderJob) => void;
  onDelete: (job: EditorRenderJob) => void;
  onDeleteAll: () => void;
}) {
  const filter = query.trim().toLocaleLowerCase();
  const visibleJobs = jobs.filter((job) =>
    [
      job.id,
      (job.planSummary || job.plan)?.originalTitle,
      ...job.outputs.map((output) => output.filename),
      ...((job.planSummary || job.plan)?.parts.map((part) => part.title) || []),
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(filter),
  );
  return (
    <Panel className="studio-render-list" aria-label="Danh sách render từng video">
      <PanelHeader>
        <h2 className="text-base font-semibold">
          Danh sách render <span className="text-muted-foreground">· {jobs.length}</span>
        </h2>
        <Toolbar>
          <span className="text-xs text-muted-foreground">
            {jobs.filter((job) => ["queued", "rendering"].includes(job.state)).length} tác vụ đang chạy / chờ
          </span>
          <Button
            variant="destructive"
            size="md"
            type="button"
            onClick={onDeleteAll}
            disabled={deletingAll || deleting.length > 0 || stopping.length > 0 || !completedRenderJobs(jobs).length}
            title="Chuyển tất cả render đã kết thúc vào Thùng rác; giữ video gốc và tác vụ đang chạy"
          >
            {deletingAll ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            {deletingAll ? "Đang xoá…" : "Xoá tất cả"}
          </Button>
        </Toolbar>
      </PanelHeader>
      {error && (
        <InlineNotice tone="error" role="alert" className="mt-3">
          {workerErrorMessage(error)}
        </InlineNotice>
      )}
      {notice && (
        <InlineNotice tone="success" role="status" className="mt-3">
          {notice}
        </InlineNotice>
      )}
      {!jobs.length && (
        <EmptyState
          icon={<Film />}
          title="Chưa có tác vụ render."
          description="Các tác vụ render sẽ xuất hiện tại đây."
          className="mt-3"
        />
      )}
      {!!jobs.length && !visibleJobs.length && (
        <EmptyState
          icon={<Film />}
          title="Không có tác vụ khớp tìm kiếm."
          description="Thử từ khóa khác."
          className="mt-3"
        />
      )}
      <div className="studio-render-job-list mt-3 max-h-[640px] space-y-4 overflow-y-auto overscroll-contain pr-1">
        {visibleJobs.map((job) => {
          const active = ["queued", "rendering"].includes(job.state);
          const cancelling = stopping.includes(job.id) || Boolean(job.stopping);
          const removing = deleting.includes(job.id) || deletingAll;
          return (
            <Panel as="article" padding="sm" data-render-state={job.state} key={job.id} className="workspace-list-row">
              <div className="studio-render-job-heading flex items-start justify-between gap-3">
                <div className="studio-render-job-title flex min-w-0 flex-nowrap items-center gap-3">
                  <h3
                    className="min-w-0 truncate text-sm font-semibold"
                    title={(job.planSummary || job.plan)?.originalTitle || undefined}
                  >
                    {(job.planSummary || job.plan)?.originalTitle || "Video đã render"}
                  </h3>
                  <StatusChip
                    className="shrink-0"
                    tone={job.state === "error" ? "error" : job.state === "done" ? "success" : "neutral"}
                  >
                    {cancelling
                      ? "Đang huỷ…"
                      : {
                          queued: "Chờ render",
                          rendering: "Đang render",
                          done: "Đã kết thúc",
                          error: "Lỗi",
                          cancelled: "Đã dừng",
                        }[job.state]}
                  </StatusChip>
                </div>
                <div className="studio-action-row flex shrink-0 flex-wrap justify-end gap-2">
                  {(active || cancelling) && (
                    <Button
                      variant="destructive"
                      size="md"
                      type="button"
                      aria-label={`Huỷ render ${(job.planSummary || job.plan)?.originalTitle || job.id}`}
                      onClick={() => onStop(job)}
                      disabled={cancelling || removing}
                    >
                      {cancelling ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}{" "}
                      {cancelling ? "Đang huỷ…" : "Huỷ render"}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="md"
                    type="button"
                    aria-label={`Xoá render ${(job.planSummary || job.plan)?.originalTitle || job.id}`}
                    title={
                      active || cancelling
                        ? "Huỷ render và chờ dừng hẳn trước khi xoá"
                        : "Chuyển các part vào Thùng rác; giữ video gốc"
                    }
                    onClick={() => onDelete(job)}
                    disabled={active || cancelling || removing}
                  >
                    {removing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}{" "}
                    {removing ? "Đang xoá…" : "Xoá"}
                  </Button>
                </div>
              </div>
              <RenderProgress job={{ ...job, stopping: cancelling }} />
              {job.error && (
                <InlineNotice tone="error" className="mt-3">
                  {workerErrorMessage(job.error)}
                </InlineNotice>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(job.planSummary || job.plan)?.parts.map((part) => {
                  const title = `${(job.planSummary || job.plan)!.originalTitle} | ${part.title} (${part.id}/${(job.planSummary || job.plan)!.parts.length})`;
                  const hashtags = part.hashtags?.join(" ") || "";
                  const output = job.outputs.find((output) => output.part === part.id);
                  return (
                    <Panel as="div" padding="sm" key={part.id}>
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                        TITLE SAU CÙNG · PART {part.id}
                      </p>
                      <p className="mt-2 select-text break-words text-sm leading-6 text-foreground">{title}</p>
                      <p className="mt-2 select-text text-xs leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                        {hashtags || "Chưa có hashtag (chỉnh tay)."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyButton
                          text={`${title}\n\n${hashtags}`}
                          ariaLabel={`Copy title và hashtag Part ${part.id} của ${(job.planSummary || job.plan)!.originalTitle}`}
                        />
                        {output && (
                          <Button variant="secondary" size="sm" asChild>
                            <a href={`${origin}${output.url}`} className="studio-download">
                              <Download className="size-3" /> Tải Part {part.id} ·{" "}
                              {(output.size / 1024 / 1024).toFixed(1)} MB
                            </a>
                          </Button>
                        )}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </Panel>
  );
}
