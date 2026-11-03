"use client";
import { toast, useConfirm } from "@/components/confirmation-provider";
import { useEditPlan } from "@/components/editor/use-edit-plan";
import type { SaveState } from "@/components/studio-header";
import { isManualCutDraft, manualCutDraftKey, manualCutScope } from "@/components/use-manual-cut-draft";
import { type BatchJob, type WebAiContext, type WorkerSource } from "@/lib/api/worker-client";
import { AiProvider, EditPlan, mockPlan } from "@/lib/edit-plan";
import { DEFAULT_REQUEST } from "@/lib/editor-defaults";
import type { Controls } from "@/lib/editor-session";
import {
  SESSION_KEY,
  editorSessionIdentity,
  listPreservedEditorSessions,
  preserveEditorSession,
  readPreservedEditorSession,
  writeEditorSession,
  type EditorSession,
} from "@/lib/editor-session";
import { type CaptionTrack } from "@/lib/subtitles.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  batchPollEpoch: RefObject<number>;
  batchSubmitPending: RefObject<boolean>;
  changeWorkspace: (next: "editor" | "batch" | "storage") => void;
  confirm: ReturnType<typeof useConfirm>;
  cutHistory: ReturnType<typeof useEditPlan>["cutHistory"];
  draftWriteBlocked: RefObject<boolean>;
  lastWrittenSession: RefObject<{ snapshot: Omit<EditorSession, "previewTime">; previewTime: number } | null>;
  latestSession: RefObject<EditorSession | null>;
  manualSavePending: RefObject<boolean>;
  observedSession: RefObject<Omit<EditorSession, "previewTime"> | null>;
  pendingPreviewRestore: RefObject<number | null>;
  pendingSaveBaseline: RefObject<"saved" | "dirty" | "idle" | null>;
  resetSourceSelection: () => void;
  restoringSource: RefObject<boolean>;
  savedSessionNeedsArchive: RefObject<boolean>;
  sessionEpoch: RefObject<number>;
  sessionReady: boolean;
  sessionSnapshot: Omit<EditorSession, "previewTime">;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setAnalysisNotice: Dispatch<SetStateAction<string>>;
  setBatch: Dispatch<SetStateAction<BatchJob | null>>;
  setBatchDraftItem: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null | undefined>>;
  setBatchEditing: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null>>;
  setBatchError: Dispatch<SetStateAction<string>>;
  setBatchId: Dispatch<SetStateAction<string>>;
  setBatchNotice: Dispatch<SetStateAction<string>>;
  setBatchUrls: Dispatch<SetStateAction<string>>;
  setControls: Dispatch<SetStateAction<Controls>>;
  setDraftActivities: Dispatch<SetStateAction<Record<string, boolean>>>;
  setEditMode: Dispatch<SetStateAction<"ai" | "manual">>;
  setEditorRenderNotice: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setInspectorTab: Dispatch<SetStateAction<"appearance" | "text" | "music">>;
  setInstruction: Dispatch<SetStateAction<string>>;
  setInterruptedTasks: Dispatch<SetStateAction<string[]>>;
  setIsStartingBatch: Dispatch<SetStateAction<boolean>>;
  setIsStartingRender: Dispatch<SetStateAction<boolean>>;
  setLocalDraftId: Dispatch<SetStateAction<string>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  setLocalFileName: Dispatch<SetStateAction<string>>;
  setLocalVideoUrl: Dispatch<SetStateAction<string>>;
  setMusicIntent: Dispatch<SetStateAction<boolean>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setPreparedSource: Dispatch<SetStateAction<WorkerSource | null>>;
  setPreservedDrafts: Dispatch<SetStateAction<{ key: string; label: string }[]>>;
  setPreviewCurrentTime: Dispatch<SetStateAction<number>>;
  setProvider: Dispatch<SetStateAction<AiProvider>>;
  setRestoreBlocked: Dispatch<SetStateAction<boolean>>;
  setRestorePassive: Dispatch<SetStateAction<boolean>>;
  setRestoredJobId: Dispatch<SetStateAction<string>>;
  setRetainedSourceId: Dispatch<SetStateAction<string>>;
  setSaveError: Dispatch<SetStateAction<string>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setSelectedBatchPreviewKey: Dispatch<SetStateAction<string>>;
  setSessionNotice: Dispatch<SetStateAction<string>>;
  setSourceAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setSourceMode: Dispatch<SetStateAction<"youtube" | "local">>;
  setSourceRestoreNotice: Dispatch<SetStateAction<string>>;
  setSourceTitle: Dispatch<SetStateAction<string>>;
  setSourceUrl: Dispatch<SetStateAction<string>>;
  setSupplementalPrompt: Dispatch<SetStateAction<string>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  setWebAiContext: Dispatch<SetStateAction<WebAiContext | null>>;
  setWebAiPrompt: Dispatch<SetStateAction<string>>;
  setWebAiResult: Dispatch<SetStateAction<string>>;
  setYoutubeState: Dispatch<SetStateAction<"idle" | "error" | "loading" | "ready">>;
  sourceSelectionEpoch: RefObject<number>;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  transcriptEdited: RefObject<boolean>;
  transcriptRevision: RefObject<number>;
  unsavedSession: RefObject<boolean>;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createSessionActions(read: () => State) {
  function restoreEditorDraft(
    d: Partial<EditorSession>,
    nextWorkspace = d.workspace || "editor",
    savedBaseline = false,
  ) {
    const {
      changeWorkspace,
      cutHistory,
      pendingPreviewRestore,
      pendingSaveBaseline,
      restoringSource,
      savedSessionNeedsArchive,
      setActivePartIndex,
      setAnalysisNotice,
      setBatchDraftItem,
      setBatchEditing,
      setBatchId,
      setBatchUrls,
      setControls,
      setEditMode,
      setHasEditPlan,
      setInspectorTab,
      setInstruction,
      setInterruptedTasks,
      setLocalDraftId,
      setLocalFile,
      setLocalFileName,
      setLocalVideoUrl,
      setMusicIntent,
      setPlan,
      setPreparedSource,
      setPreviewCurrentTime,
      setProvider,
      setRestorePassive,
      setRestoredJobId,
      setRetainedSourceId,
      setSelectedBatchPreviewKey,
      setSourceAdvancedOpen,
      setSourceCaptions,
      setSourceMode,
      setSourceRestoreNotice,
      setSourceTitle,
      setSourceUrl,
      setSupplementalPrompt,
      setTranscript,
      setWebAiContext,
      setWebAiPrompt,
      setWebAiResult,
      setYoutubeState,
      stopWorkspacePlayback,
      transcriptEdited,
      transcriptRevision,
      unsavedSession,
    } = read();

    pendingSaveBaseline.current = savedBaseline ? "saved" : "dirty";
    unsavedSession.current = !savedBaseline;
    savedSessionNeedsArchive.current = savedBaseline;
    cutHistory.clear();
    stopWorkspacePlayback();
    setPreparedSource(null);
    setLocalFile(null);
    setLocalVideoUrl("");
    setRestorePassive(true);
    setMusicIntent(false);
    setSourceMode(d.sourceMode || "youtube");
    setSourceUrl(d.sourceUrl || "");
    setLocalFileName(d.localFileName || "");
    const restoredLocalId = d.sourceMode === "local" ? d.localDraftId || d.sourceId || crypto.randomUUID() : "";
    setLocalDraftId(restoredLocalId);
    transcriptRevision.current++;
    transcriptEdited.current = Boolean(d.transcript);
    setSourceTitle(d.sourceTitle || "");
    setTranscript(d.transcript || "");
    setInstruction(d.instruction || "");
    setSupplementalPrompt(d.supplementalPrompt || "");
    setEditMode(d.editMode || "ai");
    setProvider(d.provider || "chatgpt");
    setPlan(d.plan || mockPlan({ ...DEFAULT_REQUEST, originalTitle: d.sourceTitle || "" }));
    setHasEditPlan(!!d.hasEditPlan);
    setSourceAdvancedOpen(!!d.sourceAdvancedOpen);
    setInspectorTab(d.inspectorTab || "appearance");
    setActivePartIndex(d.activePartIndex || 0);
    changeWorkspace(nextWorkspace);
    const owner = d.batchDraftItem || d.batchEditing;
    const restoredControls = { ...d.controls },
      newScope = manualCutScope(
        d.sourceMode || "youtube",
        d.sourceUrl || "",
        d.localFileName || "",
        owner,
        restoredLocalId,
      ),
      manualKey = manualCutDraftKey(newScope);
    const legacyScope = JSON.stringify([
      d.sourceMode || "youtube",
      d.sourceMode === "local" ? d.localFileName || "" : d.sourceUrl || "",
    ]);
    for (const [key, value] of Object.entries(d.controls || {}))
      if (key.startsWith(legacyScope + ":")) {
        const migrated = newScope + key.slice(legacyScope.length);
        if (!(migrated in restoredControls)) restoredControls[migrated] = value;
      }
    // Old sessions stored four global strings; migrate only into their own scope.
    if (!isManualCutDraft(restoredControls[manualKey]))
      restoredControls[manualKey] = {
        manualPart1Title: d.manualPart1Title ?? "",
        manualPart2Title: d.manualPart2Title ?? "",
        manualPart1Ranges: d.manualPart1Ranges ?? "",
        manualPart2Ranges: d.manualPart2Ranges ?? "",
      };
    setSourceCaptions(d.sourceCaptions || null);
    setControls(restoredControls);
    setBatchId(d.batchId || "");
    setRestoredJobId(d.renderJobId || "");
    setBatchEditing(d.batchEditing || null);
    setBatchDraftItem(owner || null);
    setSelectedBatchPreviewKey(d.selectedBatchPreviewKey || "");
    setBatchUrls(d.batchUrls || "");
    setWebAiPrompt(d.webAiPrompt || "");
    setWebAiResult(d.webAiResult || "");
    const restoredWeb = d.webAiContext;
    // Legacy prompts/JSON remain available as drafts, but an old attachment
    // without a source/variant identity cannot bind to a new video silently.
    const restoredMedia = restoredWeb?.media;
    setWebAiContext(
      restoredWeb
        ? {
            ...restoredWeb,
            media:
              restoredMedia &&
              (typeof restoredMedia.sourceKey === "string" || typeof restoredMedia.variantKey === "string")
                ? restoredMedia
                : undefined,
          }
        : null,
    );
    pendingPreviewRestore.current = d.previewTime || 0;
    setPreviewCurrentTime(d.previewTime || 0);
    restoringSource.current = !!d.sourceId;
    setRetainedSourceId(d.sourceId || "");
    setInterruptedTasks(d.interrupted || []);
    if (d.interrupted?.length)
      setAnalysisNotice("Tác vụ đã gián đoạn: " + d.interrupted.join(", ") + ". Không tự gửi lại.");
    if (d.sourceMode === "local" && !d.sourceId)
      setSourceRestoreNotice(
        "File local chưa import: chọn lại file để nối vào bản nháp; plan và các ô nhập vẫn được giữ.",
      );
    if (d.sourceMode === "youtube") setYoutubeState(d.sourceId ? "ready" : "idle");
  }
  function saveSession(onlyIfChanged = false): boolean {
    const {
      draftWriteBlocked,
      lastWrittenSession,
      latestSession,
      manualSavePending,
      observedSession,
      sessionReady,
      sessionSnapshot,
      setSaveError,
      setSaveState,
      setSessionNotice,
      unsavedSession,
    } = read();

    if (!sessionReady || !latestSession.current || manualSavePending.current) return false;
    if (draftWriteBlocked.current) {
      setSaveError("Giữ bản gốc chưa đọc được trước khi lưu thay thế.");
      setSaveState("error");
      return false;
    }
    const written = lastWrittenSession.current;
    if (
      onlyIfChanged &&
      !unsavedSession.current &&
      (!written ||
        (written.snapshot === observedSession.current && written.previewTime === latestSession.current.previewTime))
    )
      return true;
    manualSavePending.current = true;
    setSaveState("saving");
    try {
      // Explicit Save or the user's hide/exit exception keeps the item draft
      // and current checkpoint. No periodic/content-change writer remains.
      // Incomplete timecode/IME drafts stay in controls; no export validation.
      if (!preserveCurrentDraft()) return false;
      const error = writeEditorSession(latestSession.current);
      setSaveError(error);
      setSaveState(error ? "error" : "saved");
      if (!error) {
        unsavedSession.current = false;
        lastWrittenSession.current = {
          snapshot: observedSession.current || sessionSnapshot,
          previewTime: latestSession.current.previewTime,
        };
        setSessionNotice("");
        if (!onlyIfChanged) toast.success("Đã lưu phiên");
      } else if (!onlyIfChanged) toast.error("Chưa lưu được phiên");
      return !error;
    } finally {
      manualSavePending.current = false;
    }
  }
  function preserveCurrentDraft() {
    const {
      draftWriteBlocked,
      latestSession,
      savedSessionNeedsArchive,
      sessionReady,
      setPreservedDrafts,
      setRestoreBlocked,
      setSaveError,
      setSaveState,
      unsavedSession,
    } = read();

    if (!sessionReady || !latestSession.current) {
      setSaveError("Phiên chưa khôi phục xong; chưa thay bản nháp.");
      return false;
    }
    const result = preserveEditorSession(latestSession.current, { preserveBlockedRaw: draftWriteBlocked.current });
    if (result.error) {
      setSaveState("error");
      setSaveError(result.error);
      return false;
    }
    // A blocked raw value may be replaced only after exact preservation succeeds.
    draftWriteBlocked.current = false;
    setRestoreBlocked(false);
    setSaveError("");
    savedSessionNeedsArchive.current = false;
    unsavedSession.current = true;
    setSaveState("dirty");
    setPreservedDrafts(listPreservedEditorSessions());
    return true;
  }
  async function confirmReplaceEditorDraft() {
    const { confirm, draftWriteBlocked, savedSessionNeedsArchive, sessionReady, setSaveError, unsavedSession } = read();

    if (!sessionReady) return false;
    if (draftWriteBlocked.current) {
      setSaveError("Giữ bản gốc chưa đọc được hoặc chọn Phiên mới trước khi thay phiên.");
      return false;
    }
    if (!unsavedSession.current && !savedSessionNeedsArchive.current) return true;
    const choice = await confirm({
      title: "Mở phiên khác?",
      message: "Giữ bản nháp hiện tại trước khi mở phiên khác?",
      save: true,
    });
    return choice === "save" ? saveSession() : choice === "confirm";
  }
  async function restorePreservedDraft(key: string) {
    const {
      changeWorkspace,
      latestSession,
      resetSourceSelection,
      sessionEpoch,
      setSaveError,
      setSessionNotice,
      sourceSelectionEpoch,
    } = read();

    if (!key) return;
    if (latestSession.current && editorSessionIdentity(latestSession.current) === key) {
      changeWorkspace("editor");
      return;
    }
    const ownerEpoch = sessionEpoch.current,
      sourceEpoch = sourceSelectionEpoch.current;
    const saved = readPreservedEditorSession(key);
    if (saved.blocked || !saved.draft) {
      setSaveError(saved.notice || "Không đọc được bản nháp đã giữ; phiên hiện tại chưa thay đổi.");
      return;
    }
    if (
      !(await confirmReplaceEditorDraft()) ||
      ownerEpoch !== sessionEpoch.current ||
      sourceEpoch !== sourceSelectionEpoch.current
    )
      return;
    resetSourceSelection();
    restoreEditorDraft(saved.draft, "editor");
    setSessionNotice("Đã mở bản nháp đã lưu.");
  }
  function newSession() {
    const {
      batchPollEpoch,
      batchSubmitPending,
      changeWorkspace,
      draftWriteBlocked,
      lastWrittenSession,
      latestSession,
      pendingPreviewRestore,
      pendingSaveBaseline,
      resetSourceSelection,
      restoringSource,
      savedSessionNeedsArchive,
      sessionEpoch,
      setBatch,
      setBatchError,
      setBatchId,
      setBatchNotice,
      setBatchUrls,
      setControls,
      setDraftActivities,
      setEditMode,
      setEditorRenderNotice,
      setInspectorTab,
      setInstruction,
      setInterruptedTasks,
      setIsStartingBatch,
      setIsStartingRender,
      setLocalDraftId,
      setLocalFile,
      setLocalFileName,
      setLocalVideoUrl,
      setMusicIntent,
      setPlan,
      setProvider,
      setRestoreBlocked,
      setRestorePassive,
      setRestoredJobId,
      setRetainedSourceId,
      setSaveError,
      setSaveState,
      setSelectedBatchPreviewKey,
      setSessionNotice,
      setSourceAdvancedOpen,
      setSourceMode,
      setSourceRestoreNotice,
      setSourceTitle,
      setSourceUrl,
      setSupplementalPrompt,
      unsavedSession,
    } = read();

    // Remove the single draft only. Worker jobs/media/library/auth are untouched.
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem("shortcut-beta-batch-id");
    } catch {
      setSaveState("error");
      setSaveError("Không bỏ được bản nháp trong bộ nhớ local; phiên hiện tại chưa bị xóa.");
      return;
    }
    sessionEpoch.current++;
    batchSubmitPending.current = false;
    setIsStartingBatch(false);
    setIsStartingRender(false);
    latestSession.current = null;
    lastWrittenSession.current = null;
    draftWriteBlocked.current = false;
    setRestoreBlocked(false);
    unsavedSession.current = false;
    savedSessionNeedsArchive.current = false;
    pendingSaveBaseline.current = "idle";
    setInterruptedTasks([]);
    resetSourceSelection();
    setControls({});
    setDraftActivities({});
    setRestorePassive(false);
    setMusicIntent(false);
    setRetainedSourceId("");
    restoringSource.current = false;
    pendingPreviewRestore.current = null;
    setSaveState("idle");
    setSourceAdvancedOpen(false);
    setInspectorTab("appearance");
    setLocalFile(null);
    setLocalVideoUrl("");
    setLocalFileName("");
    setLocalDraftId("");
    setSourceMode("youtube");
    setSourceUrl("");
    setEditMode("ai");
    setProvider("chatgpt");
    setPlan(mockPlan(DEFAULT_REQUEST));
    setSourceTitle(DEFAULT_REQUEST.originalTitle);
    setInstruction(DEFAULT_REQUEST.instruction || "");
    setSupplementalPrompt("");
    setBatchUrls("");
    batchPollEpoch.current++;
    setBatchId("");
    setBatch(null);
    setRestoredJobId("");
    setSelectedBatchPreviewKey("");
    changeWorkspace("editor");
    setBatchError("");
    setBatchNotice("");
    setEditorRenderNotice("");
    setSessionNotice("Đã bắt đầu phiên mới. Job đã gửi vẫn được giữ trong lịch sử worker.");
    setSourceRestoreNotice("");
    setSaveError("");
  }
  return {
    restoreEditorDraft,
    saveSession,
    preserveCurrentDraft,
    confirmReplaceEditorDraft,
    restorePreservedDraft,
    newSession,
  };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useSessionActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const restoreEditorDraft = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["restoreEditorDraft"]>) =>
      createSessionActions(readerRef.current).restoreEditorDraft(...args),
    [],
  );
  const saveSession = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["saveSession"]>) =>
      createSessionActions(readerRef.current).saveSession(...args),
    [],
  );
  const preserveCurrentDraft = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["preserveCurrentDraft"]>) =>
      createSessionActions(readerRef.current).preserveCurrentDraft(...args),
    [],
  );
  const confirmReplaceEditorDraft = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["confirmReplaceEditorDraft"]>) =>
      createSessionActions(readerRef.current).confirmReplaceEditorDraft(...args),
    [],
  );
  const restorePreservedDraft = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["restorePreservedDraft"]>) =>
      createSessionActions(readerRef.current).restorePreservedDraft(...args),
    [],
  );
  const newSession = useCallback(
    (...args: Parameters<ReturnType<typeof createSessionActions>["newSession"]>) =>
      createSessionActions(readerRef.current).newSession(...args),
    [],
  );
  return useMemo(
    () => ({
      restoreEditorDraft,
      saveSession,
      preserveCurrentDraft,
      confirmReplaceEditorDraft,
      restorePreservedDraft,
      newSession,
    }),
    [
      restoreEditorDraft,
      saveSession,
      preserveCurrentDraft,
      confirmReplaceEditorDraft,
      restorePreservedDraft,
      newSession,
    ],
  );
}
