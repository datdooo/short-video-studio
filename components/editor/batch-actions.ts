"use client";
import { useConfirm } from "@/components/confirmation-provider";
import { workerFetch, type BatchJob, type WorkerSource } from "@/lib/api/worker-client";
import type { BatchDownload } from "@/lib/batch-downloads.mjs";
import { collectBatchDownloads } from "@/lib/batch-downloads.mjs";
import { clearSubmittedBatchInput } from "@/lib/batch-submission.mjs";
import { AiProvider, EditPlan, mockPlan } from "@/lib/edit-plan";
import { DEFAULT_REQUEST } from "@/lib/editor-defaults";
import { editorSessionIdentity, readPreservedEditorSession, type EditorSession } from "@/lib/editor-session";
import type { SubtitleStyle } from "@/lib/subtitles.mjs";
import { sourceCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import { snapshotPlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import type { VisualStyle } from "@/lib/visual-style/types";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  batch: BatchJob | null;
  batchDownloadQueue: RefObject<{
    enqueue: (outputs: BatchDownload[]) => void;
    remove: (keys: string[]) => void;
    dispose: () => void;
  } | null>;
  batchEditing: { batchId: string; itemId: string; sourceId: string } | null;
  batchOpenRequest: RefObject<AbortController | null>;
  batchPollEpoch: RefObject<number>;
  batchSubmitPending: RefObject<boolean>;
  batchUrls: string;
  changeWorkspace: (next: "editor" | "batch" | "storage") => void;
  checkTeasersForExport: (nextPlan: EditPlan, source: WorkerSource) => Promise<void>;
  confirm: ReturnType<typeof useConfirm>;
  confirmReplaceEditorDraft: () => Promise<boolean>;
  deletedBatchItems: RefObject<Set<string>>;
  effectiveTiming: { plan: EditPlan; error: string };
  isStoppingBatch: boolean;
  latestSession: RefObject<EditorSession | null>;
  mutationPending: RefObject<Set<string>>;
  preparedSource: WorkerSource | null;
  previewPlan: EditPlan;
  previewVisualStyle: VisualStyle;
  provider: AiProvider;
  renderSubmissionPending: RefObject<boolean>;
  resetSourceSelection: () => void;
  restoreEditorDraft: (
    d: Partial<EditorSession>,
    nextWorkspace?: "batch" | "editor" | "storage",
    savedBaseline?: boolean,
  ) => void;
  restoringSource: RefObject<boolean>;
  sessionEpoch: RefObject<number>;
  setBatch: Dispatch<SetStateAction<BatchJob | null>>;
  setBatchDraftItem: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null | undefined>>;
  setBatchEditing: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null>>;
  setBatchError: Dispatch<SetStateAction<string>>;
  setBatchId: Dispatch<SetStateAction<string>>;
  setBatchNotice: Dispatch<SetStateAction<string>>;
  setBatchPollVersion: Dispatch<SetStateAction<number>>;
  setBatchUrls: Dispatch<SetStateAction<string>>;
  setDeletingBatchItems: Dispatch<SetStateAction<string[]>>;
  setEditMode: Dispatch<SetStateAction<"ai" | "manual">>;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setInstruction: Dispatch<SetStateAction<string>>;
  setIsStartingBatch: Dispatch<SetStateAction<boolean>>;
  setIsStartingRender: Dispatch<SetStateAction<boolean>>;
  setIsStoppingBatch: Dispatch<SetStateAction<boolean>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  setLocalFileName: Dispatch<SetStateAction<string>>;
  setLocalVideoUrl: Dispatch<SetStateAction<string>>;
  setPastBatches: Dispatch<SetStateAction<BatchJob[]>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setPreparedSource: Dispatch<SetStateAction<WorkerSource | null>>;
  setProvider: Dispatch<SetStateAction<AiProvider>>;
  setRestorePassive: Dispatch<SetStateAction<boolean>>;
  setResumingBatchItems: Dispatch<SetStateAction<string[]>>;
  setRetainedSourceId: Dispatch<SetStateAction<string>>;
  setSessionNotice: Dispatch<SetStateAction<string>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setSourceMode: Dispatch<SetStateAction<"youtube" | "local">>;
  setSourceSize: Dispatch<SetStateAction<{ width: number; height: number }>>;
  setSourceTitle: Dispatch<SetStateAction<string>>;
  setSourceUrl: Dispatch<SetStateAction<string>>;
  setSupplementalPrompt: Dispatch<SetStateAction<string>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  setYoutubeState: Dispatch<SetStateAction<"idle" | "error" | "loading" | "ready">>;
  sourceCaptions: CaptionTrack | null;
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  subtitleSettings: SubtitleStyle;
  transcript: string;
  instruction: string;
  supplementalPrompt: string;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createBatchActions(read: () => State) {
  async function deleteBatchVideo(group: BatchJob, item: BatchJob["items"][number]) {
    const {
      batchDownloadQueue,
      batchPollEpoch,
      batchSubmitPending,
      confirm,
      deletedBatchItems,
      mutationPending,
      setBatch,
      setBatchError,
      setBatchNotice,
      setBatchPollVersion,
      setDeletingBatchItems,
      setPastBatches,
    } = read();

    const operationKey = `delete-batch:${group.id}:${item.id}`;
    if (!item.id || batchSubmitPending.current || mutationPending.current.has(operationKey)) return;
    if (
      (await confirm({
        message: `Chuyển các Part của “${item.title || item.url}” vào Thùng rác và bỏ video khỏi hàng đợi?\n\nVideo nguồn và bản đã tải về Downloads vẫn được giữ. Có thể khôi phục hoặc xoá vĩnh viễn trong tab Thùng rác.`,
      })) !== "confirm"
    )
      return;
    mutationPending.current.add(operationKey);
    batchPollEpoch.current++;
    setDeletingBatchItems((ids) => [...ids, item.id]);
    setBatchError("");
    try {
      const response = await workerFetch(`/api/batches/${group.id}/items/${item.id}`, { method: "DELETE" });
      const data = (await response.json()) as { batch?: BatchJob; error?: string; recoveryPath?: string | null };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không xoá được video.");
      deletedBatchItems.current.add(item.id);
      batchDownloadQueue.current?.remove(
        collectBatchDownloads({ id: group.id, items: [item] }).map((output) => output.key),
      );
      data.batch.items = data.batch.items.filter((candidate) => !deletedBatchItems.current.has(candidate.id));
      setBatch((current) => (current?.id === group.id ? data.batch! : current));
      setPastBatches((history) => history.map((previous) => (previous.id === group.id ? data.batch! : previous)));
      setBatchNotice(
        data.recoveryPath
          ? "Đã chuyển các Part vào Thùng rác. Có thể khôi phục hoặc xoá vĩnh viễn ở tab Thùng rác; video gốc và Downloads vẫn giữ nguyên."
          : "Đã xoá video khỏi danh sách.",
      );
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không xoá được video.");
    } finally {
      mutationPending.current.delete(operationKey);
      batchPollEpoch.current++;
      setBatchPollVersion((v) => v + 1);
      setDeletingBatchItems((ids) => ids.filter((id) => id !== item.id));
    }
  }
  async function stopBatch() {
    const {
      batch,
      batchPollEpoch,
      batchSubmitPending,
      mutationPending,
      setBatch,
      setBatchError,
      setBatchPollVersion,
      setIsStoppingBatch,
      setPastBatches,
    } = read();

    if (!batch || batch.finished || batchSubmitPending.current) return;
    const operationKey = `stop-batch:${batch.id}`;
    if (mutationPending.current.has(operationKey)) return;
    mutationPending.current.add(operationKey);
    batchPollEpoch.current++;
    setIsStoppingBatch(true);
    try {
      const response = await workerFetch(`/api/batches/${batch.id}/cancel`, { method: "POST" });
      const data = (await response.json()) as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không dừng được hàng đợi.");
      setBatch((current) => (current?.id === data.batch!.id ? data.batch! : current));
      setPastBatches((history) => history.map((group) => (group.id === data.batch!.id ? data.batch! : group)));
      setBatchError("");
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không dừng được hàng đợi.");
    } finally {
      mutationPending.current.delete(operationKey);
      batchPollEpoch.current++;
      setBatchPollVersion((v) => v + 1);
      setIsStoppingBatch(false);
    }
  }
  async function resumeBatchItem(group: BatchJob, item: BatchJob["items"][number]) {
    const {
      batchPollEpoch,
      batchSubmitPending,
      mutationPending,
      setBatch,
      setBatchError,
      setBatchId,
      setBatchPollVersion,
      setResumingBatchItems,
    } = read();

    if (
      batchSubmitPending.current ||
      mutationPending.current.has(`stop-batch:${group.id}`) ||
      mutationPending.current.has(`delete-batch:${group.id}:${item.id}`)
    )
      return;
    batchSubmitPending.current = true;
    setResumingBatchItems((ids) => [...ids, item.id]);
    setBatchError("");
    try {
      const response = await workerFetch(`/api/batches/${group.id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: [item.id] }),
      });
      const data = (await response.json()) as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không tiếp tục được item.");
      batchPollEpoch.current++;
      setBatchPollVersion((v) => v + 1);
      setBatch(data.batch);
      setBatchId(data.batch.id);
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không tiếp tục được item.");
    } finally {
      batchSubmitPending.current = false;
      setResumingBatchItems((ids) => ids.filter((id) => id !== item.id));
    }
  }
  async function openBatchItem(group: BatchJob, item: BatchJob["items"][number]) {
    const {
      batchOpenRequest,
      changeWorkspace,
      confirmReplaceEditorDraft,
      latestSession,
      resetSourceSelection,
      restoreEditorDraft,
      restoringSource,
      sessionEpoch,
      setBatchDraftItem,
      setBatchEditing,
      setBatchError,
      setEditMode,
      setHasEditPlan,
      setInstruction,
      setLocalFile,
      setLocalFileName,
      setLocalVideoUrl,
      setPlan,
      setPreparedSource,
      setProvider,
      setRestorePassive,
      setRetainedSourceId,
      setSessionNotice,
      setSourceCaptions,
      setSourceMode,
      setSourceSize,
      setSourceTitle,
      setSourceUrl,
      setSupplementalPrompt,
      setTranscript,
      setYoutubeState,
      sourceRequests,
      sourceSelectionEpoch,
    } = read();

    if (!item.sourceId) return;
    batchOpenRequest.current?.abort();
    batchOpenRequest.current = null;
    const identity = { batchId: group.id, itemId: item.id, sourceId: item.sourceId };
    const key = editorSessionIdentity({ sourceId: item.sourceId, batchEditing: identity });
    if (latestSession.current && editorSessionIdentity(latestSession.current) === key) {
      changeWorkspace("editor");
      return;
    }
    const controller = new AbortController(),
      epoch = sourceSelectionEpoch.current,
      session = sessionEpoch.current;
    batchOpenRequest.current = controller;
    sourceRequests.current.add(controller);
    setBatchError("");
    const current = () =>
      !controller.signal.aborted &&
      batchOpenRequest.current === controller &&
      epoch === sourceSelectionEpoch.current &&
      session === sessionEpoch.current;
    try {
      // Fetch/validate first: a missing source must never erase the open draft.
      const response = await workerFetch(`/api/sources/${item.sourceId}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as { source?: WorkerSource; error?: string };
      if (!current()) return;
      if (
        !response.ok ||
        data.source?.id !== item.sourceId ||
        typeof data.source.title !== "string" ||
        !Number.isFinite(data.source.duration) ||
        data.source.duration <= 0 ||
        !Number.isFinite(data.source.width) ||
        !Number.isFinite(data.source.height)
      )
        throw Error(data.error || "Không mở được đúng source của item; bản nháp hiện tại được giữ.");
      const source = data.source,
        saved = readPreservedEditorSession(key);
      if (saved.blocked) throw Error(saved.notice || "Không đọc được bản nháp của item; chưa thay phiên.");
      if (saved.draft && editorSessionIdentity(saved.draft) !== key)
        throw Error("Bản nháp không khớp source/item; chưa thay phiên.");
      const captions = source.captions?.length
        ? sourceCaptionTrack({ sourceId: source.id, cues: source.captions, origin: "youtube" }, source)
        : null;
      const nextPlan = saved.draft
        ? null
        : snapshotPlanVisualStyle(
            item.plan || {
              ...mockPlan({ ...DEFAULT_REQUEST, originalTitle: source.title }),
              music: item.settings?.music,
              musicSpeech: undefined,
              hookTransition: item.settings?.hookTransition,
              visualStyle: item.settings?.visualStyle,
              subtitles: item.settings?.subtitles,
            },
          );
      if (!(await confirmReplaceEditorDraft()) || !current()) return;
      resetSourceSelection();
      if (saved.draft) {
        restoreEditorDraft(saved.draft, "editor");
      } else {
        setSourceMode("youtube");
        setSourceUrl(source.sourceUrl || item.url);
        setLocalFile(null);
        setLocalVideoUrl("");
        setLocalFileName("");
        setSourceTitle(source.title);
        setTranscript(source.transcript || "");
        setProvider(item.settings?.provider || "chatgpt");
        setEditMode("ai");
        setInstruction(item.settings?.instruction || "");
        setSupplementalPrompt(item.settings?.supplementalPrompt || "");
        setSourceCaptions(captions);
        setPlan(nextPlan!);
        setHasEditPlan(!!item.plan);
        setRestorePassive(true);
        setYoutubeState("ready");
        changeWorkspace("editor");
      }
      setPreparedSource(source);
      setRetainedSourceId(source.id);
      restoringSource.current = false;
      setSourceSize({ width: source.width, height: source.height });
      setBatchEditing(identity);
      setBatchDraftItem(identity);
      setSessionNotice(saved.draft ? "Đã mở lại bản nháp đã lưu của item." : "Đã mở item.");
    } catch (error) {
      if (current()) setBatchError(error instanceof Error ? error.message : "Không mở được item.");
    } finally {
      sourceRequests.current.delete(controller);
      if (batchOpenRequest.current === controller) batchOpenRequest.current = null;
    }
  }
  async function queueEditedBatchItem() {
    const { transcript, instruction, supplementalPrompt } = read();

    const {
      batchEditing,
      batchPollEpoch,
      changeWorkspace,
      checkTeasersForExport,
      effectiveTiming,
      latestSession,
      preparedSource,
      previewPlan,
      renderSubmissionPending,
      sessionEpoch,
      setBatch,
      setBatchEditing,
      setBatchId,
      setBatchPollVersion,
      setError,
      setIsStartingRender,
      sourceCaptions,
      sourceSelectionEpoch,
    } = read();

    if (renderSubmissionPending.current || !batchEditing || preparedSource?.id !== batchEditing.sourceId) return;
    renderSubmissionPending.current = true;
    const owner = { ...batchEditing },
      epoch = sourceSelectionEpoch.current,
      session = sessionEpoch.current;
    const current = () =>
      epoch === sourceSelectionEpoch.current &&
      session === sessionEpoch.current &&
      latestSession.current?.batchEditing?.itemId === owner.itemId &&
      latestSession.current?.batchEditing?.batchId === owner.batchId;
    setError("");
    setIsStartingRender(true);
    try {
      if (effectiveTiming.error) throw new Error(effectiveTiming.error);
      const submitted = previewPlan;
      await checkTeasersForExport(submitted, preparedSource);
      if (!current()) return;
      const response = await workerFetch(`/api/batches/${batchEditing.batchId}/items/${batchEditing.itemId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: preparedSource.id,
          transcript,
          instruction,
          supplementalPrompt,
          plan: snapshotPlanVisualStyle({
            ...submitted,
            ...(sourceCaptions?.sourceId === preparedSource.id ? { captionCues: sourceCaptions } : {}),
          }),
        }),
      });
      const data = (await response.json()) as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không lưu được plan item.");
      if (!current()) return;
      batchPollEpoch.current++;
      setBatchPollVersion((v) => v + 1);
      setBatch(data.batch);
      setBatchId(data.batch.id);
      setBatchEditing(null);
      changeWorkspace("batch");
    } catch (error) {
      if (current()) setError(error instanceof Error ? error.message : "Không lưu được plan item.");
    } finally {
      renderSubmissionPending.current = false;
      setIsStartingRender(false);
    }
  }
  async function startBatch() {
    const { instruction, supplementalPrompt } = read();

    const {
      batch,
      batchPollEpoch,
      batchSubmitPending,
      batchUrls,
      isStoppingBatch,
      mutationPending,
      previewPlan,
      previewVisualStyle,
      provider,
      sessionEpoch,
      setBatch,
      setBatchError,
      setBatchId,
      setBatchNotice,
      setBatchPollVersion,
      setBatchUrls,
      setIsStartingBatch,
      subtitleSettings,
    } = read();

    if (isStoppingBatch || (batch && mutationPending.current.has(`stop-batch:${batch.id}`))) return;
    if (batchSubmitPending.current || isStoppingBatch) return;
    batchSubmitPending.current = true;
    const submittedInput = batchUrls,
      epoch = sessionEpoch.current;
    setBatchError("");
    setBatchNotice("");
    setIsStartingBatch(true);
    try {
      if (!["chatgpt", "gemini", "muse", "chatgpt-web"].includes(provider))
        throw new Error("Chọn ChatGPT Auto hoặc web AI import thủ công.");
      const urls = [...new Set(submittedInput.split(/\s+/).filter(Boolean))];
      if (!urls.length || urls.length > 20) throw new Error("Nhập từ 1 đến 20 link, mỗi link một dòng.");
      const response = await workerFetch(`/api/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          provider,
          instruction,
          supplementalPrompt,
          visualStyle: previewVisualStyle,
          subtitles: subtitleSettings,
          music: previewPlan.music,
          hookTransition: previewPlan.hookTransition,
          batchId: batch && !batch.finished ? batch.id : undefined,
        }),
      });
      const data = (await response.json()) as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không tạo được hàng đợi.");
      if (epoch !== sessionEpoch.current) return;
      // Invalidate older in-flight polls before applying the longer queue. Restart
      // polling even if the batch ID is unchanged or a last poll said finished.
      batchPollEpoch.current += 1;
      setBatchPollVersion((version) => version + 1);
      try {
        localStorage.setItem("shortcut-beta-batch-id", data.batch.id);
      } catch {
        /* The current queue still runs without browser storage. */
      }
      setBatch(data.batch);
      setBatchId(data.batch.id);
      setBatchUrls((current) => clearSubmittedBatchInput(current, submittedInput));
      setBatchNotice(
        `Đã thêm ${urls.length} link vào hàng đợi. Có thể paste thêm link và bấm chạy ngay, không cần chờ lượt trước xong.`,
      );
    } catch (error) {
      if (epoch === sessionEpoch.current)
        setBatchError(error instanceof Error ? error.message : "Không tạo được hàng đợi.");
    } finally {
      if (epoch === sessionEpoch.current) {
        batchSubmitPending.current = false;
        setIsStartingBatch(false);
      }
    }
  }
  return { deleteBatchVideo, stopBatch, resumeBatchItem, openBatchItem, queueEditedBatchItem, startBatch };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useBatchActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const deleteBatchVideo = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["deleteBatchVideo"]>) =>
      createBatchActions(readerRef.current).deleteBatchVideo(...args),
    [],
  );
  const stopBatch = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["stopBatch"]>) =>
      createBatchActions(readerRef.current).stopBatch(...args),
    [],
  );
  const resumeBatchItem = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["resumeBatchItem"]>) =>
      createBatchActions(readerRef.current).resumeBatchItem(...args),
    [],
  );
  const openBatchItem = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["openBatchItem"]>) =>
      createBatchActions(readerRef.current).openBatchItem(...args),
    [],
  );
  const queueEditedBatchItem = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["queueEditedBatchItem"]>) =>
      createBatchActions(readerRef.current).queueEditedBatchItem(...args),
    [],
  );
  const startBatch = useCallback(
    (...args: Parameters<ReturnType<typeof createBatchActions>["startBatch"]>) =>
      createBatchActions(readerRef.current).startBatch(...args),
    [],
  );
  return useMemo(
    () => ({ deleteBatchVideo, stopBatch, resumeBatchItem, openBatchItem, queueEditedBatchItem, startBatch }),
    [deleteBatchVideo, stopBatch, resumeBatchItem, openBatchItem, queueEditedBatchItem, startBatch],
  );
}
