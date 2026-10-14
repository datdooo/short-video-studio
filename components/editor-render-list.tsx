"use client";

import { Download, Loader2, Square, Trash2 } from "lucide-react";
import type { EditPlan } from "@/lib/edit-plan";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/copy-button";
import { completedRenderJobs } from '@/lib/render-delete.mjs';

export type EditorRenderJob = {
  id: string;
  sourceId: string;
  state: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  currentPart: number | null;
  outputs: Array<{ part: number; filename: string; size: number; url: string }>;
  error: string | null;
  plan?: EditPlan;
  createdAt?: string;
  stopping?: boolean;
};

export function EditorRenderList({ jobs, stopping, deleting, deletingAll, error, notice, origin, onStop, onDelete, onDeleteAll }: {
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
  return <section className="border-t border-white/8 bg-[#0d0e11] p-5 lg:p-6" aria-label="Danh sách render từng video">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Danh sách render <span className="text-zinc-500">· {jobs.length}</span></h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-zinc-400">{jobs.filter((job) => ["queued", "rendering"].includes(job.state)).length} tác vụ đang chạy / chờ</span>
        <button type="button" onClick={onDeleteAll} disabled={deletingAll || deleting.length > 0 || stopping.length > 0 || !completedRenderJobs(jobs).length} title="Chuyển tất cả render đã kết thúc vào Thùng rác; giữ video gốc và tác vụ đang chạy" className="flex items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-40">{deletingAll ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}{deletingAll ? 'Đang xoá…' : 'Xoá tất cả'}</button>
      </div>
    </div>
    <p className="mt-2 text-xs leading-6 text-zinc-500">Cứ nhập link mới để chuẩn bị và chia part. Render cũ tiếp tục ở nền; các video render lần lượt để tránh quá tải GPU. Mỗi part tự bỏ 1 giây đầu.</p>
    {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-300">{notice}</p>}
    {!jobs.length && <p className="mt-4 text-sm text-zinc-500">Chưa có tác vụ render. Title sau cùng, hashtag và file tải về sẽ được giữ tại đây.</p>}
    <div className="mt-4 max-h-[640px] space-y-4 overflow-y-auto overscroll-contain pr-1">
      {jobs.map((job) => {
        const active = ["queued", "rendering"].includes(job.state);
        const cancelling = stopping.includes(job.id) || Boolean(job.stopping);
        const removing = deleting.includes(job.id) || deletingAll;
        const status = { queued: "Chờ render", rendering: `Đang render Part ${job.currentPart || 1}`, done: "Hoàn tất", error: "Render lỗi", cancelled: "Đã dừng" }[job.state];
        return <article key={job.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold">{job.plan?.originalTitle || "Video đã render"}</h3>
              <p className="mt-1 text-xs text-[#ff806a]">{job.stopping ? "Đang huỷ render…" : status} · {job.progress}%</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {(active || cancelling) && <button aria-label={`Huỷ render ${job.plan?.originalTitle || job.id}`} onClick={() => onStop(job)} disabled={cancelling || removing} className="flex items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-300 transition hover:bg-red-400/10 active:scale-95 disabled:opacity-50">{cancelling ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />} {cancelling ? "Đang huỷ…" : "Huỷ render"}</button>}
              <button aria-label={`Xoá render ${job.plan?.originalTitle || job.id}`} title={active || cancelling ? "Huỷ render và chờ dừng hẳn trước khi xoá" : "Chuyển các part vào Thùng rác; giữ video gốc"} onClick={() => onDelete(job)} disabled={active || cancelling || removing} className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300 active:scale-95 disabled:opacity-40">{removing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} {removing ? "Đang xoá…" : "Xoá"}</button>
            </div>
          </div>
          <Progress value={job.progress} className="mt-3 h-1.5 bg-white/8 [&>div]:bg-[#ff4d2e]" />
          {job.error && <p className="mt-3 break-words text-xs text-red-300">{job.error}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {job.plan?.parts.map((part) => {
              const title = `${job.plan!.originalTitle} | ${part.title} (${part.id}/${job.plan!.parts.length})`;
              const hashtags = part.hashtags?.join(" ") || "";
              const output = job.outputs.find((output) => output.part === part.id);
              return <div key={part.id} className="min-w-0 rounded-lg bg-black/20 p-3">
                <p className="text-[10px] font-semibold tracking-wider text-zinc-500">TITLE SAU CÙNG · PART {part.id}</p>
                <p className="mt-2 select-text break-words text-sm leading-6 text-zinc-200">{title}</p>
                <p className="mt-2 select-text text-xs leading-6 text-zinc-400 [overflow-wrap:anywhere]">{hashtags || "Chưa có hashtag (chỉnh tay)."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton text={`${title}\n\n${hashtags}`} ariaLabel={`Copy title và hashtag Part ${part.id} của ${job.plan!.originalTitle}`} />
                  {output && <a href={`${origin}${output.url}`} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black"><Download className="size-3" /> Tải Part {part.id} · {(output.size / 1024 / 1024).toFixed(1)} MB</a>}
                </div>
              </div>;
            })}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
