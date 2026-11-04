"use client";
import { registerSessionCheckpoint } from "@/lib/session-checkpoint";
import { writeEditorSession } from "@/lib/editor-session";
import type { SaveState } from "@/components/studio-header";
import { type RenderJob, type WebAiContext, type WorkerSource } from "@/lib/api/worker-client";
import type { AiProvider } from "@/lib/edit-plan";
import { EditPlan } from "@/lib/edit-plan";
import type { Controls } from "@/lib/editor-session";
import { type EditorSession } from "@/lib/editor-session";
import { PREVIEW_TIMEBASE } from "@/lib/preview-config.mjs";
import { type CaptionTrack } from "@/lib/subtitles.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo } from "react";
type State = {
  activePartIndex: number;
  batchDraftItem: { batchId: string; itemId: string; sourceId: string } | null | undefined;
  batchEditing: { batchId: string; itemId: string; sourceId: string } | null;
  batchId: string;
  batchUrls: string;
  controls: Controls;
  draftActivities: Record<string, boolean>;
  draftWriteBlocked: RefObject<boolean>;
  editMode: "ai" | "manual";
  hasEditPlan: boolean;
  inspectorTab: "music" | "appearance" | "text";
  instruction: string;
  interruptedTasks: string[];
  isAnalyzing: boolean;
  isPreparingSource: boolean;
  isStartingBatch: boolean;
  isStartingRender: boolean;
  lastWrittenSession: RefObject<{ snapshot: Omit<EditorSession, "previewTime">; previewTime: number } | null>;
  latestSession: RefObject<EditorSession | null>;
  localDraftId: string;
  localFileName: string;
  manualPart1Ranges: string;
  manualPart1Title: string;
  manualPart2Ranges: string;
  manualPart2Title: string;
  observedSession: RefObject<Omit<EditorSession, "previewTime"> | null>;
  pendingSaveBaseline: RefObject<"saved" | "dirty" | "idle" | null>;
  plan: EditPlan;
  preparedSource: WorkerSource | null;
  previewCurrentTimeRef: RefObject<number>;
  provider: AiProvider;
  renderJob: RenderJob | null;
  restoredJobId: string;
  retainedSourceId: string;
  selectedBatchPreviewKey: string;
  sessionReady: boolean;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  sourceAdvancedOpen: boolean;
  sourceCaptions: CaptionTrack | null;
  sourceMode: "youtube" | "local";
  sourceTitle: string;
  sourceUrl: string;
  subtitleBusy: boolean;
  supplementalPrompt: string;
  transcript: string;
  transcriptStatus: string;
  unsavedSession: RefObject<boolean>;
  webAiContext: WebAiContext | null;
  webAiPrompt: string;
  webAiResult: string;
  workspace: "editor" | "batch" | "storage";
  youtubeState: "idle" | "error" | "loading" | "ready";
};
export function useSessionTracking(state: State) {
  const {
    activePartIndex,
    batchDraftItem,
    batchEditing,
    batchId,
    batchUrls,
    controls,
    draftActivities,
    draftWriteBlocked: draftWriteBlockedRef,
    editMode,
    hasEditPlan,
    inspectorTab,
    instruction,
    interruptedTasks,
    isAnalyzing,
    isPreparingSource,
    isStartingBatch,
    isStartingRender,
    lastWrittenSession: lastWrittenSessionRef,
    latestSession: latestSessionRef,
    localDraftId,
    localFileName,
    manualPart1Ranges,
    manualPart1Title,
    manualPart2Ranges,
    manualPart2Title,
    observedSession: observedSessionRef,
    pendingSaveBaseline: pendingSaveBaselineRef,
    plan,
    preparedSource,
    previewCurrentTimeRef,
    provider,
    renderJob,
    restoredJobId,
    retainedSourceId,
    selectedBatchPreviewKey,
    sessionReady,
    setSaveState,
    sourceAdvancedOpen,
    sourceCaptions,
    sourceMode,
    sourceTitle,
    sourceUrl,
    subtitleBusy,
    supplementalPrompt,
    transcript,
    transcriptStatus,
    unsavedSession: unsavedSessionRef,
    webAiContext,
    webAiPrompt,
    webAiResult,
    workspace,
    youtubeState,
  } = state;
  const sessionSnapshot = useMemo<Omit<EditorSession, "previewTime">>(
    () => ({
      previewTimebase: PREVIEW_TIMEBASE,
      sourceAdvancedOpen,
      inspectorTab,
      sourceMode,
      sourceUrl,
      sourceId: preparedSource?.id || retainedSourceId,
      localFileName,
      localDraftId,
      sourceTitle,
      transcript,
      editMode,
      provider,
      instruction,
      supplementalPrompt,
      plan,
      hasEditPlan,
      sourceCaptions,
      activePartIndex,
      workspace,
      batchId,
      renderJobId: renderJob?.id || restoredJobId,
      batchEditing,
      batchDraftItem,
      selectedBatchPreviewKey,
      batchUrls,
      manualPart1Title,
      manualPart2Title,
      manualPart1Ranges,
      manualPart2Ranges,
      webAiPrompt,
      webAiResult,
      webAiContext,
      controls,
      interrupted: [
        ...interruptedTasks,
        ...(isAnalyzing ? ["phân tích AI"] : []),
        ...(isPreparingSource ? ["chuẩn bị nguồn"] : []),
        ...(subtitleBusy ? ["tạo phụ đề"] : []),
        ...(youtubeState === "loading" ? ["metadata nguồn"] : []),
        ...(transcriptStatus.startsWith("Đang tự") ? ["lấy transcript"] : []),
        ...(isStartingRender ? ["gửi render (kiểm tra danh sách worker trước khi thử lại)"] : []),
        ...(isStartingBatch ? ["gửi batch (kiểm tra lịch sử trước khi thử lại)"] : []),
        ...Object.entries(draftActivities)
          .filter(([, busy]) => busy)
          .map(([key]) => key),
      ],
    }),
    [
      sourceAdvancedOpen,
      inspectorTab,
      sourceMode,
      sourceUrl,
      preparedSource?.id,
      retainedSourceId,
      localFileName,
      localDraftId,
      sourceTitle,
      transcript,
      editMode,
      provider,
      instruction,
      supplementalPrompt,
      plan,
      hasEditPlan,
      sourceCaptions,
      activePartIndex,
      workspace,
      batchId,
      renderJob?.id,
      restoredJobId,
      batchEditing,
      batchDraftItem,
      selectedBatchPreviewKey,
      batchUrls,
      manualPart1Title,
      manualPart2Title,
      manualPart1Ranges,
      manualPart2Ranges,
      webAiPrompt,
      webAiResult,
      webAiContext,
      controls,
      isAnalyzing,
      isPreparingSource,
      subtitleBusy,
      youtubeState,
      transcriptStatus,
      isStartingRender,
      isStartingBatch,
      draftActivities,
      interruptedTasks,
    ],
  );
  useLayoutEffect(() => {
    latestSessionRef.current = {
      ...sessionSnapshot,
      get previewTime() {
        return previewCurrentTimeRef.current;
      },
    };
    if (!sessionReady) return;
    registerSessionCheckpoint(() => {
      if (draftWriteBlockedRef.current || !latestSessionRef.current)
        return "Bản gốc đang được bảo vệ; chưa ghi đè checkpoint.";
      return writeEditorSession(latestSessionRef.current);
    });
    const baseline = pendingSaveBaselineRef.current;
    if (baseline) {
      pendingSaveBaselineRef.current = null;
      unsavedSessionRef.current = baseline === "dirty";
      lastWrittenSessionRef.current =
        baseline === "saved" && !draftWriteBlockedRef.current
          ? { snapshot: sessionSnapshot, previewTime: previewCurrentTimeRef.current }
          : null;
      setSaveState(draftWriteBlockedRef.current ? "error" : baseline);
    } else if (observedSessionRef.current !== sessionSnapshot) {
      // Shallow memo identity only: no stringify/storage write per keystroke,
      // polling event or preview frame. Playback time alone is not a dirty edit.
      const previous = observedSessionRef.current;
      const viewOnly = [
        "workspace",
        "activePartIndex",
        "sourceAdvancedOpen",
        "inspectorTab",
        "selectedBatchPreviewKey",
        "interrupted",
      ];
      if (
        !previous ||
        (Object.keys(sessionSnapshot) as (keyof typeof sessionSnapshot)[]).some(
          (key) => !viewOnly.includes(key) && previous[key] !== sessionSnapshot[key],
        )
      ) {
        unsavedSessionRef.current = true;
        setSaveState(draftWriteBlockedRef.current ? "error" : "dirty");
      }
    }
    observedSessionRef.current = sessionSnapshot;
  }, [
    sessionSnapshot,
    previewCurrentTimeRef,
    sessionReady,
    draftWriteBlockedRef,
    lastWrittenSessionRef,
    latestSessionRef,
    observedSessionRef,
    pendingSaveBaselineRef,
    setSaveState,
    unsavedSessionRef,
  ]);
  const markPreviewPositionDirty = useCallback(() => {
    if (!latestSessionRef.current) return;
    unsavedSessionRef.current = true;
    if (!draftWriteBlockedRef.current) setSaveState("dirty");
  }, [draftWriteBlockedRef, latestSessionRef, setSaveState, unsavedSessionRef]);
  return { sessionSnapshot, markPreviewPositionDirty };
}
