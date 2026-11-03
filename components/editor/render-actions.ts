"use client";
import { toast, useConfirm } from "@/components/confirmation-provider";
import { type LibraryFile } from "@/components/media-library-panel";
import { workerFetch, type BatchJob, type RenderJob, type WorkerSource } from "@/lib/api/worker-client";
import type { BatchDownload } from "@/lib/batch-downloads.mjs";
import { collectBatchDownloads } from "@/lib/batch-downloads.mjs";
import { EditPlan, formatTime, isChronological } from "@/lib/edit-plan";
import { completedRenderJobs } from "@/lib/render-delete.mjs";
import { validSourceRange } from "@/lib/source-ranges.mjs";
import type { Caption, SubtitleStyle } from "@/lib/subtitles.mjs";
import { sourceCaptionTrack } from "@/lib/subtitles.mjs";
import { assertTeaserContexts } from "@/lib/teaser-context.mjs";
import { requireBothTeasers } from "@/lib/teaser-hooks.mjs";
import { externalHooksCurrent } from "@/lib/teaser-import.mjs";
import { snapshotPlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  batch: BatchJob | null;
  batchDownloadQueue: RefObject<{
    enqueue: (outputs: BatchDownload[]) => void;
    remove: (keys: string[]) => void;
    dispose: () => void;
  } | null>;
  batchPollEpoch: RefObject<number>;
  confirm: ReturnType<typeof useConfirm>;
  deletedBatchItems: RefObject<Set<string>>;
  deletedEditorJobs: RefObject<Set<string>>;
  deletingAllPending: RefObject<boolean>;
  deletingRenderIds: string[];
  editorMutationEpoch: RefObject<number>;
  editorRenderJobs: RenderJob[];
  effectiveTiming: { plan: EditPlan; error: string };
  jobRestoreEpoch: RefObject<number>;
  mutationPending: RefObject<Set<string>>;
  pastBatches: BatchJob[];
  prepareSource: (signal?: AbortSignal) => Promise<WorkerSource | null>;
  preparedSource: WorkerSource | null;
  previewPlan: EditPlan;
  removedMediaUrls: RefObject<Set<string>>;
  renderSubmissionPending: RefObject<boolean>;
  setBatch: Dispatch<SetStateAction<BatchJob | null>>;
  setBatchPollVersion: Dispatch<SetStateAction<number>>;
  setDeletingAllRenders: Dispatch<SetStateAction<boolean>>;
  setDeletingRenderIds: Dispatch<SetStateAction<string[]>>;
  setEditorRenderError: Dispatch<SetStateAction<string>>;
  setEditorRenderJobs: Dispatch<SetStateAction<RenderJob[]>>;
  setEditorRenderNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setIsStartingRender: Dispatch<SetStateAction<boolean>>;
  setPastBatches: Dispatch<SetStateAction<BatchJob[]>>;
  setPreparedSource: Dispatch<SetStateAction<WorkerSource | null>>;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  setRestoredJobId: Dispatch<SetStateAction<string>>;
  setStoppingRenderIds: Dispatch<SetStateAction<string[]>>;
  sourceSelectionEpoch: RefObject<number>;
  stoppingRenderIds: string[];
  subtitleCues: Caption[];
  subtitleSettings: SubtitleStyle;
  teaserIssues: { partId: number; reason: string }[];
  transcript: string;
  instruction: string;
  supplementalPrompt: string;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createRenderActions(read: () => State) {
  function libraryMoved(file: LibraryFile) {
    const {
      batch,
      batchDownloadQueue,
      pastBatches,
      removedMediaUrls,
      setBatch,
      setEditorRenderJobs,
      setPastBatches,
      setPreparedSource,
      setRenderJob,
    } = read();

    if (file.storageId !== "current") return;
    if (file.kind === "original") {
      setPreparedSource((current) => (current?.id === file.sourceId ? null : current));
      return;
    }
    const url = file.renderUrl;
    if (!url) return;
    removedMediaUrls.current.add(url);
    const groups = [...(batch ? [batch] : []), ...pastBatches];
    batchDownloadQueue.current?.remove(
      groups
        .flatMap(collectBatchDownloads)
        .filter((output) => output.url === url)
        .map((output) => output.key),
    );
    const prune = (group: BatchJob): BatchJob => ({
      ...group,
      items: group.items.map((item) =>
        item.job
          ? { ...item, job: { ...item.job, outputs: item.job.outputs.filter((output) => output.url !== url) } }
          : item,
      ),
    });
    setBatch((current) => (current ? prune(current) : null));
    setPastBatches((groups) => groups.map(prune));
    setRenderJob((current) =>
      current ? { ...current, outputs: current.outputs.filter((output) => output.url !== url) } : null,
    );
    setEditorRenderJobs((jobs) =>
      jobs.map((job) => ({ ...job, outputs: job.outputs.filter((output) => output.url !== url) })),
    );
  }
  function libraryRestored(file: LibraryFile) {
    const {
      batchPollEpoch,
      deletedBatchItems,
      deletedEditorJobs,
      editorMutationEpoch,
      removedMediaUrls,
      setBatchPollVersion,
    } = read();

    if (file.storageId !== "current") return;
    if (file.kind === "part")
      removedMediaUrls.current.delete(
        `/files/${file.sourceId}/outputs/${file.jobId}/part-${file.part}/${encodeURIComponent(file.filename)}`,
      );
    file.restoredUrls?.forEach((url) => removedMediaUrls.current.delete(url));
    file.restoredItemIds?.forEach((id) => deletedBatchItems.current.delete(id));
    if (file.jobId) deletedEditorJobs.current.delete(file.jobId);
    editorMutationEpoch.current += 1;
    batchPollEpoch.current += 1;
    setBatchPollVersion((version) => version + 1);
  }
  async function stopRender(job: RenderJob) {
    const {
      editorMutationEpoch,
      mutationPending,
      setEditorRenderError,
      setEditorRenderJobs,
      setRenderJob,
      setStoppingRenderIds,
    } = read();

    const operationKey = `stop-render:${job.id}`;
    if (mutationPending.current.has(operationKey) || !["queued", "rendering"].includes(job.state)) return;
    mutationPending.current.add(operationKey);
    setEditorRenderError("");
    setStoppingRenderIds((ids) => [...ids, job.id]);
    try {
      const response = await workerFetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      const data = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Không dừng được render.");
      editorMutationEpoch.current += 1;
      setRenderJob((current) => (current?.id === job.id ? data.job! : current));
      setEditorRenderJobs((jobs) => jobs.map((current) => (current.id === job.id ? data.job! : current)));
    } catch (error) {
      setEditorRenderError(error instanceof Error ? error.message : "Không dừng được render.");
    } finally {
      mutationPending.current.delete(operationKey);
      setStoppingRenderIds((ids) => ids.filter((id) => id !== job.id));
    }
  }
  async function deleteEditorRender(job: RenderJob, confirmed = false) {
    const {
      confirm,
      deletedEditorJobs,
      editorMutationEpoch,
      mutationPending,
      setDeletingRenderIds,
      setEditorRenderError,
      setEditorRenderJobs,
      setEditorRenderNotice,
      setRenderJob,
    } = read();

    const operationKey = `delete-render:${job.id}`;
    if (mutationPending.current.has(operationKey) || job.stopping || ["queued", "rendering"].includes(job.state))
      return false;
    if (
      !confirmed &&
      (await confirm({
        message: `Chuyển các Part của “${job.plan?.originalTitle || "video này"}” vào Thùng rác và xoá khỏi danh sách render?\n\nVideo gốc và bản trong Downloads vẫn được giữ. Có thể khôi phục các Part trong tab Thùng rác.`,
      })) !== "confirm"
    )
      return false;
    mutationPending.current.add(operationKey);
    setDeletingRenderIds((ids) => [...ids, job.id]);
    setEditorRenderError("");
    try {
      const response = await workerFetch(`/api/editor-renders/${job.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as { removed?: boolean; trashId?: string | null; error?: string };
      if (!response.ok || !data.removed) throw new Error(data.error || "Không xoá được render.");
      editorMutationEpoch.current += 1;
      deletedEditorJobs.current.add(job.id);
      setEditorRenderJobs((jobs) => jobs.filter((current) => current.id !== job.id));
      setRenderJob((current) => (current?.id === job.id ? null : current));
      setEditorRenderNotice(
        data.trashId
          ? "Đã chuyển các Part vào Thùng rác. Video gốc và Downloads vẫn được giữ."
          : "Đã xoá tác vụ khỏi danh sách render.",
      );
      return true;
    } catch (caught) {
      setEditorRenderError(caught instanceof Error ? caught.message : "Không xoá được render.");
      return false;
    } finally {
      mutationPending.current.delete(operationKey);
      setDeletingRenderIds((ids) => ids.filter((id) => id !== job.id));
    }
  }
  async function deleteAllEditorRenders() {
    const {
      confirm,
      deletingAllPending,
      deletingRenderIds,
      editorRenderJobs,
      setDeletingAllRenders,
      setEditorRenderError,
      setEditorRenderNotice,
      stoppingRenderIds,
    } = read();

    if (deletingAllPending.current || deletingRenderIds.length || stoppingRenderIds.length) return;
    const targets = completedRenderJobs(editorRenderJobs);
    if (
      !targets.length ||
      (await confirm({
        message: `Chuyển ${targets.length} tác vụ render đã kết thúc vào Thùng rác?\n\nVideo gốc và Downloads vẫn được giữ. Tác vụ đang chạy/chờ không bị huỷ hoặc xoá. Có thể khôi phục trong Thùng rác.`,
      })) !== "confirm"
    )
      return;
    deletingAllPending.current = true;
    setDeletingAllRenders(true);
    setEditorRenderError("");
    let removed = 0;
    try {
      for (const job of targets) if (await deleteEditorRender(job, true)) removed++;
      setEditorRenderNotice(
        `Đã xoá ${removed}/${targets.length} tác vụ render. Video gốc và tác vụ đang chạy vẫn được giữ.`,
      );
      if (removed < targets.length)
        setEditorRenderError(
          `${targets.length - removed} tác vụ chưa xoá được (có thể source đang được xử lý). Các mục này vẫn được giữ; thử lại sau.`,
        );
    } finally {
      deletingAllPending.current = false;
      setDeletingAllRenders(false);
    }
  }
  async function checkTeasersForExport(nextPlan: EditPlan, source: WorkerSource) {
    const { instruction, supplementalPrompt } = read();

    const { subtitleCues, transcript } = read();

    requireBothTeasers(nextPlan, source.duration, nextPlan.captionCues?.cues || subtitleCues, source.id);
    await assertTeaserContexts(
      nextPlan,
      source,
      nextPlan.captionCues?.cues || subtitleCues,
      transcript || source.transcript || "",
      { instruction, supplementalPrompt },
    );
    if (!(await externalHooksCurrent(nextPlan, source, transcript || source.transcript || "")))
      throw new Error("Teaser import đã cũ; tạo prompt/import lại trước khi xuất, không tự chuyển provider.");
  }
  async function startRender() {
    const { instruction, supplementalPrompt } = read();

    const {
      effectiveTiming,
      jobRestoreEpoch,
      prepareSource,
      preparedSource,
      previewPlan,
      renderSubmissionPending,
      setEditorRenderJobs,
      setError,
      setIsStartingRender,
      setRenderJob,
      setRestoredJobId,
      sourceSelectionEpoch,
      subtitleSettings,
      teaserIssues,
      transcript,
    } = read();

    if (renderSubmissionPending.current) return;
    const selectionEpoch = sourceSelectionEpoch.current;
    const submittedPlan = structuredClone(previewPlan);
    setError("");
    if (effectiveTiming.error) {
      setError(effectiveTiming.error);
      return;
    }
    if (teaserIssues.length) {
      setError(teaserIssues.map((i) => `Part ${i.partId}: ${i.reason}`).join(" "));
      return;
    }
    if (!submittedPlan.parts.every(isChronological)) {
      setError("Edit plan có timestamp không hợp lệ.");
      return;
    }
    setIsStartingRender(true);
    renderSubmissionPending.current = true;
    try {
      const source = preparedSource || (await prepareSource());
      if (!source) return;
      if (selectionEpoch !== sourceSelectionEpoch.current) return;
      await checkTeasersForExport(submittedPlan, source);
      if (selectionEpoch !== sourceSelectionEpoch.current) return;
      for (const part of submittedPlan.parts) {
        for (const segment of part.segments) {
          if (!validSourceRange(segment, source.duration)) {
            throw new Error(
              `Part ${part.id} có timestamp ${formatTime(segment.end)} vượt quá video source (${formatTime(source.duration)}). Hãy sửa timestamp hoặc Generate plan lại.`,
            );
          }
        }
      }
      const response = await workerFetch(`/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id,
          transcript: transcript || source.transcript || "",
          instruction,
          supplementalPrompt,
          plan: snapshotPlanVisualStyle({
            ...submittedPlan,
            subtitles: subtitleSettings,
            ...(submittedPlan.captionCues
              ? { captionCues: sourceCaptionTrack(submittedPlan.captionCues, source) }
              : {}),
          }),
        }),
      });
      const data = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Không thể bắt đầu render.");
      toast.success("Đã đưa vào hàng đợi render");
      setEditorRenderJobs((jobs) => [data.job!, ...jobs.filter((job) => job.id !== data.job!.id)]);
      if (selectionEpoch === sourceSelectionEpoch.current) {
        jobRestoreEpoch.current++;
        setRestoredJobId("");
        setRenderJob(data.job);
        // The queued job owns its submitted snapshot. Its response must not
        // write over teaser/range edits made while submission was in flight.
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể bắt đầu render.");
    } finally {
      setIsStartingRender(false);
      renderSubmissionPending.current = false;
    }
  }
  return {
    stopRender,
    deleteEditorRender,
    deleteAllEditorRenders,
    startRender,
    checkTeasersForExport,
    libraryMoved,
    libraryRestored,
  };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useRenderActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const libraryMoved = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["libraryMoved"]>) =>
      createRenderActions(readerRef.current).libraryMoved(...args),
    [],
  );
  const libraryRestored = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["libraryRestored"]>) =>
      createRenderActions(readerRef.current).libraryRestored(...args),
    [],
  );
  const stopRender = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["stopRender"]>) =>
      createRenderActions(readerRef.current).stopRender(...args),
    [],
  );
  const deleteEditorRender = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["deleteEditorRender"]>) =>
      createRenderActions(readerRef.current).deleteEditorRender(...args),
    [],
  );
  const deleteAllEditorRenders = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["deleteAllEditorRenders"]>) =>
      createRenderActions(readerRef.current).deleteAllEditorRenders(...args),
    [],
  );
  const checkTeasersForExport = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["checkTeasersForExport"]>) =>
      createRenderActions(readerRef.current).checkTeasersForExport(...args),
    [],
  );
  const startRender = useCallback(
    (...args: Parameters<ReturnType<typeof createRenderActions>["startRender"]>) =>
      createRenderActions(readerRef.current).startRender(...args),
    [],
  );
  return useMemo(
    () => ({
      libraryMoved,
      libraryRestored,
      stopRender,
      deleteEditorRender,
      deleteAllEditorRenders,
      checkTeasersForExport,
      startRender,
    }),
    [
      libraryMoved,
      libraryRestored,
      stopRender,
      deleteEditorRender,
      deleteAllEditorRenders,
      checkTeasersForExport,
      startRender,
    ],
  );
}
