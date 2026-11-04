"use client";
import { useAutoAnalysisActions } from "@/components/editor/auto-analysis-actions";
import { useBatchActions } from "@/components/editor/batch-actions";
import { usePlanActions } from "@/components/editor/plan-actions";
import { useRenderActions } from "@/components/editor/render-actions";
import { useSessionActions } from "@/components/editor/session-actions";
import { useSourceActions } from "@/components/editor/source-actions";
import { StudioView } from "@/components/editor/studio-view";
import { useSubtitleActions } from "@/components/editor/subtitle-actions";
import { useAnalysisContext } from "@/components/editor/use-analysis-context";
import { useBatchHistory } from "@/components/editor/use-batch-history";
import { useBatchPoll } from "@/components/editor/use-batch-poll";
import { useBatchQueue } from "@/components/editor/use-batch-queue";
import { useCutHistoryControls } from "@/components/editor/use-cut-history-controls";
import { useEditPlan } from "@/components/editor/use-edit-plan";
import { useManualEditTool } from "@/components/editor/use-manual-edit-tool";
import { usePlanTiming } from "@/components/editor/use-plan-timing";
import { usePreviewCommands } from "@/components/editor/use-preview-commands";
import { usePreviewDecks } from "@/components/editor/use-preview-decks";
import { usePreviewPlayback } from "@/components/editor/use-preview-playback";
import { usePreviewStyle } from "@/components/editor/use-preview-style";
import { useRenderJobs } from "@/components/editor/use-render-jobs";
import { useSavedRender } from "@/components/editor/use-saved-render";
import { useSavedSource } from "@/components/editor/use-saved-source";
import { useSessionExitSave } from "@/components/editor/use-session-exit-save";
import { useSessionHydration } from "@/components/editor/use-session-hydration";
import { useSessionSave } from "@/components/editor/use-session-save";
import { useSessionTracking } from "@/components/editor/use-session-tracking";
import { useSourcePreparation } from "@/components/editor/use-source-preparation";
import { useSourceTitle } from "@/components/editor/use-source-title";
import { useSourceTranscript } from "@/components/editor/use-source-transcript";
import { useSubtitleRequests } from "@/components/editor/use-subtitle-requests";
import { useSubtitleState } from "@/components/editor/use-subtitle-state";
import { useVisualControls } from "@/components/editor/use-visual-controls";
import { useWebAiActions } from "@/components/editor/web-ai-actions";

import { useConfirm } from "@/components/confirmation-provider";
import { useChatGPTSession } from "@/components/editor/use-chatgpt-session";
import { useWorkerHealth } from "@/components/editor/use-worker-health";
import { WORKER_ORIGIN, type WebAiContext } from "@/lib/api/worker-client";

import { useEditorSourceLease } from "@/components/use-editor-source-lease";
import { manualCutScope, useManualCutDraft } from "@/components/use-manual-cut-draft";
import { type AiDiagnostics } from "@/lib/ai-progress";
import { mainInstruction } from "@/lib/main-instructions.mjs";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createAnalysisRequestGuard } from "@/lib/auto-cut/request.mjs";
import { isCompatibleWebAiPromptVersion } from "@/lib/muse-plan.mjs";

export default function Home() {
  const planActionsState = usePlanActions(() => ({
    activePartIndex,
    ...editPlanState,
    ...analysisActions,
    ...manualDraftState,
    ...sourceState,
    setActivePartIndex,
    setError,
  }));

  const subtitleActionsState = useSubtitleActions(() => ({
    ...planTimingState,
    ...sourceState,
    ...subtitleStateState,
    ...editPlanState,
  }));

  const webActions = useWebAiActions(() => ({
    analysisRequests,
    ...analysisContextState,
    ...planTimingState,
    ...editPlanState,
    ...analysisActions,
    isAnalyzing,
    ...sourceState,
    isWebAi,
    lastTxtDownloadClick,
    ...sourceActions,
    setActivePartIndex,
    setError,
    setIsAnalyzing,
    ...renderState,
    setTxtDownloadTask,
    setWebAiContext,
    setWebAiError,
    setWebAiNotice,
    setWebAiPhase,
    setWebAiPreparationLabel,
    setWebAiPrompt,
    setWebAiStartedAt,
    ...subtitleStateState,
    txtDownloadPending,
    webAiContext,
    webAiContextIssue,
    webAiName,
    webAiPending,
    webAiPrompt,
    webAiPromptIsCurrent,
    webAiResult,
  }));

  const analysisActions = useAutoAnalysisActions(() => ({
    activeAnalysis,
    activeTeaserRequests,
    analysisRequests,
    ...planTimingState,
    ...editPlanState,
    isAnalyzing,
    isWebAi,
    ...analysisContextState,
    ...sourceActions,
    ...sourceState,
    setActivePartIndex,
    setAnalysisDiagnostics,
    setAnalysisFinishedAt,
    setAnalysisFinishedStage,
    setAnalysisNotice,
    setAnalysisStartedAt,
    setError,
    ...sessionState,
    setIsAnalyzing,
    setTeaserOperations,
    setTxtDownloadTask,
    setWebAiPhase,
    ...subtitleStateState,
    webAiPending,
  }));

  const renderActions = useRenderActions(() => ({
    ...batchState,
    confirm,
    ...renderState,
    ...planTimingState,
    ...sessionState,
    mutationPending,
    ...sourceActions,
    ...sourceState,
    setError,
    ...editPlanState,
    ...analysisContextState,
  }));

  const batchActions = useBatchActions(() => ({
    ...batchState,
    batchOpenRequest,
    changeWorkspace,
    ...renderActions,
    confirm,
    ...sessionActions,
    ...planTimingState,
    ...sessionState,
    mutationPending,
    ...sourceState,
    ...editPlanState,
    ...renderState,
    ...sourceActions,
    setError,
    ...subtitleStateState,
  }));

  const sourceActions = useSourceActions(() => ({
    activeTeaserRequests,
    ...editPlanState,
    ...previewState,
    ...analysisActions,
    ...sessionState,
    ...sourceState,
    setActivePartIndex,
    setAnalysisDiagnostics,
    setAnalysisStartedAt,
    ...batchState,
    setError,
    ...renderState,
    ...subtitleStateState,
    setTeaserOperations,
    setWebAiContext,
    setWebAiError,
    setWebAiNotice,
    setWebAiPhase,
    setWebAiPrompt,
    setWebAiResult,
    webAiPending,
    workerHealth,
  }));

  const sessionActions = useSessionActions(() => ({
    ...batchState,
    changeWorkspace,
    confirm,
    ...editPlanState,
    ...sessionState,
    ...sourceActions,
    ...sessionTrackingState,
    setActivePartIndex,
    setAnalysisNotice,
    ...renderState,
    setInspectorTab,
    ...sourceState,
    ...previewState,
    setSourceAdvancedOpen,
    ...subtitleStateState,
    setWebAiContext,
    setWebAiPrompt,
    setWebAiResult,
  }));

  const confirm = useConfirm();
  const [sourceAdvancedOpen, setSourceAdvancedOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"appearance" | "text" | "music">("appearance");
  const editPlanState = useEditPlan();
  const { provider, hasEditPlan, instruction, supplementalPrompt } = editPlanState;
  const sourceState = useSourcePreparation();
  const { sourceMode, sourceUrl, transcript, localVideoUrl, localFileName, localDraftId, preparedSource } = sourceState;
  const subtitleStateState = useSubtitleState();
  const { speechModel } = subtitleStateState;
  const whisperSmallReady = speechModel?.modelId === "ggml-small.bin" && speechModel.modelReady;
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisRequests = useRef(createAnalysisRequestGuard());
  const activeAnalysis = useRef<AbortController | null>(null);
  const activeTeaserRequests = useRef(new Map<number, { controller: AbortController; identity: string }>());
  const [analysisDiagnostics, setAnalysisDiagnostics] = useState<AiDiagnostics | null>(null);
  const [analysisStartedAt, setAnalysisStartedAt] = useState(0);
  const [analysisFinishedAt, setAnalysisFinishedAt] = useState(0);
  const [analysisFinishedStage, setAnalysisFinishedStage] = useState<"complete" | "error" | "cancelled">("complete");
  const [teaserOperations, setTeaserOperations] = useState<
    Record<
      number,
      {
        diagnostics: AiDiagnostics | null;
        startedAt: number;
        running: boolean;
        finishedAt?: number;
        finishedStage?: "complete" | "error" | "cancelled";
      }
    >
  >({});
  const [analysisNotice, setAnalysisNotice] = useState("");
  useEffect(() => {
    const guard = analysisRequests.current;
    return () => guard.invalidate();
  }, []);
  const [webAiPrompt, setWebAiPrompt] = useState("");
  const [webAiResult, setWebAiResult] = useState("");
  const [webAiContext, setWebAiContext] = useState<WebAiContext | null>(null);
  const [webAiPhase, setWebAiPhase] = useState<"prompt" | "import" | null>(null);
  const webAiPending = useRef(false);
  const [webAiStartedAt, setWebAiStartedAt] = useState(0);
  const [webAiPreparationLabel, setWebAiPreparationLabel] = useState("Chuẩn bị dữ liệu prompt");
  const [txtDownloadTask, setTxtDownloadTask] = useState<{
    revision: string;
    startedAt: number;
    state: "running" | "done" | "error" | "cancelled";
  } | null>(null);
  const txtDownloadPending = useRef(false);
  const lastTxtDownloadClick = useRef(0);
  useEffect(() => {
    if (!txtDownloadTask || txtDownloadTask.state === "running" || txtDownloadTask.state === "error") return;
    const timer = setTimeout(() => setTxtDownloadTask(null), 5000);
    return () => clearTimeout(timer);
  }, [txtDownloadTask]);
  const [webAiNotice, setWebAiNotice] = useState("");
  const [webAiError, setWebAiError] = useState("");
  const [error, setError] = useState("");
  const workerHealth = useWorkerHealth();
  const chatGPTState = useChatGPTSession(!!workerHealth?.ok);
  const renderState = useRenderJobs();
  const { renderJob, editorRenderJobs, isStartingRender } = renderState;
  const previewState = usePreviewPlayback();
  const { stopWorkspacePlayback } = previewState;
  const batchState = useBatchQueue();
  const { batch, batchEditing, batchDraftItem, pastBatches, selectedBatchPreviewKey } = batchState;
  const [workspace, setWorkspace] = useState<"editor" | "batch" | "storage">("editor");
  const workspaceRef = useRef<"editor" | "batch" | "storage">("editor");
  const batchOpenRequest = useRef<AbortController | null>(null);
  // Synchronous event guards; React disabled/state updates are not a mutex.
  const mutationPending = useRef(new Set<string>());
  const reviewVisible = hasEditPlan;
  function changeWorkspace(next: "editor" | "batch" | "storage") {
    batchOpenRequest.current?.abort();
    batchOpenRequest.current = null;
    if (next !== workspaceRef.current) stopWorkspacePlayback();
    workspaceRef.current = next;
    setWorkspace(next);
  }
  const exportActivity =
    isStartingRender ||
    renderJob?.state === "queued" ||
    renderJob?.state === "rendering" ||
    Boolean(workerHealth?.render?.resources?.renderBusy) ||
    editorRenderJobs.some((job) => job.state === "queued" || job.state === "rendering");
  const sessionState = useSessionSave();
  const { sessionReady, retainedSourceId, controls, setControls, setDraftActivities } = sessionState;
  const editorSourceId = sessionReady ? preparedSource?.id || retainedSourceId : "";
  const editorSourceLeaseState = useEditorSourceLease(
    WORKER_ORIGIN,
    editorSourceId,
    sessionReady && Boolean(workerHealth),
  );
  const [timelineStatusTarget, setTimelineStatusTarget] = useState<HTMLDivElement | null>(null);
  const manualDraftState = useManualCutDraft({
    controls,setControls,
    scope: manualCutScope(sourceMode, sourceUrl, localFileName, batchDraftItem || batchEditing, localDraftId),
  });
  const reportDraftActivity = useCallback(
    (key: string, busy: boolean) =>
      setDraftActivities((current) => (current[key] === busy ? current : { ...current, [key]: busy })),
    [setDraftActivities],
  );
  const sessionScope = manualCutScope(
    sourceMode,
    sourceUrl,
    localFileName,
    batchDraftItem || batchEditing,
    localDraftId,
  );
  const draftContext = useMemo(
    () => ({controls,setControls,scope:sessionScope,activity:reportDraftActivity}),
    [controls, sessionScope, reportDraftActivity, setControls],
  );
  useSessionHydration({ ...sessionState, ...sessionActions, ...batchState });
  useSavedSource({ ...sourceState, ...sessionState, workerHealth });
  useSavedRender({ ...sessionState, ...renderState, workerHealth });
  const sessionTrackingState = useSessionTracking({
    activePartIndex,
    ...batchState,
    ...sessionState,
    ...editPlanState,
    inspectorTab,
    isAnalyzing,
    ...sourceState,
    ...renderState,
    ...manualDraftState,
    ...previewState,
    sourceAdvancedOpen,
    ...subtitleStateState,
    webAiContext,
    webAiPrompt,
    webAiResult,
    workspace,
  });
  useSessionExitSave({ ...sessionActions, ...sessionState });
  const planTimingState = usePlanTiming({
    activePartIndex,
    ...editPlanState,
    ...sourceState,
    ...previewState,
    ...subtitleStateState,
    workerHealth,
  });
  const { mainSignature } = planTimingState;
  const cutHistoryControlsState = useCutHistoryControls({
    ...editPlanState,
    ...sessionState,
    ...planTimingState,
    ...analysisActions,
    isAnalyzing,
    ...sourceState,
    sessionScope,
    setActivePartIndex,
    ...renderState,
    ...previewState,
    teaserOperations,
    workspace,
    workspaceRef,
  });
  const analysisContextState = useAnalysisContext({
    activeAnalysis,
    activeTeaserRequests,
    ...editPlanState,
    ...analysisActions,
    ...planTimingState,
    ...sourceState,
    ...previewState,
    setAnalysisNotice,
  });
  const previewStyleState = usePreviewStyle({ ...planTimingState, ...previewState, ...editPlanState, ...sourceState });
  usePreviewDecks({
    ...previewState,
    ...editPlanState,
    ...planTimingState,
    ...sessionState,
    ...previewStyleState,
    workspaceRef,
  });
  useSourceTranscript({ ...sessionState, ...sourceState, workerHealth });

  useEffect(
    () => () => {
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    },
    [localVideoUrl],
  );
  useSourceTitle({ ...sessionState, ...editPlanState, ...sourceState });
  useManualEditTool({ ...editPlanState, setActivePartIndex, setError, ...manualDraftState, ...sourceState });
  useBatchPoll({ ...batchState, ...renderState, ...sessionState });
  useBatchHistory({ ...batchState, ...renderState, workerHealth, workspace });

  const legacyUserInstruction = mainInstruction(instruction).text;
  const visibleSupplementalPrompt = legacyUserInstruction
    ? legacyUserInstruction + (supplementalPrompt ? "\n\n" + supplementalPrompt : "")
    : supplementalPrompt;

  const isWebAi = provider === "muse" || provider === "gemini" || provider === "chatgpt-web";
  const webAiName =
    provider === "gemini" ? "Gemini" : provider === "chatgpt-web" || provider === "chatgpt" ? "ChatGPT" : "Muse";

  // Transcript retrieval / editing rules cannot change the identity of a video.
  // The imported JSON's sourceId is validated separately by parseMusePlan.
  const webAiContextIssue = !webAiContext
    ? "Tải TXT trước khi nhập JSON."
    : !isCompatibleWebAiPromptVersion(webAiContext.promptVersion) || webAiContext.hookPlan
      ? "TXT thuộc phiên bản cũ. Tải TXT mới."
      : !preparedSource || webAiContext.sourceId !== preparedSource.id
        ? "JSON/TXT thuộc nguồn khác. Tải TXT cho nguồn hiện tại."
        : !isWebAi || webAiContext.provider !== provider
          ? "Đã đổi AI. Tải TXT cho AI đang chọn."
          : webAiContext.transcript !== transcript
            ? "Transcript đã đổi. Tải TXT mới."
            : webAiContext.instruction !== instruction || webAiContext.supplementalPrompt !== supplementalPrompt
              ? "Yêu cầu đã đổi. Tải TXT mới."
              : webAiContext.mainSignature !== mainSignature && webAiContext.lastImportMainSignature !== mainSignature
                ? "Main, phụ đề hoặc teaser thủ công đã đổi. Tải TXT mới để giữ chỉnh sửa hiện tại."
                : "";
  const webAiPromptIsCurrent = !webAiContextIssue;
  const subtitleRequestsState = useSubtitleRequests({
    ...sourceState,
    ...sessionState,
    ...subtitleStateState,
    ...editPlanState,
    workerHealth,
  });
  const previewCommandsState = usePreviewCommands({
    ...previewState,
    ...editPlanState,
    ...sessionTrackingState,
    ...planTimingState,
    ...previewStyleState,
    ...sessionState,
    ...sourceState,
    workspace,
    workspaceRef,
  });

  const batchPreviewOutputs = [
    ...(batch ? [batch] : []),
    ...pastBatches.filter((group) => group.id !== batch?.id),
  ].flatMap((group) =>
    group.items.flatMap((item) =>
      (item.job?.outputs || [])
        .filter((output) => output.url.startsWith("/files/"))
        .map((output) => ({ ...output, key: `${group.id}:${item.id}:${output.part}`, title: item.title || item.url })),
    ),
  );
  const batchPreviewOutput =
    batchPreviewOutputs.find((output) => output.key === selectedBatchPreviewKey) || batchPreviewOutputs[0];
  const visualControlsState = useVisualControls({ ...planTimingState, ...editPlanState });
  return (
    <StudioView
      {...{
        activeAnalysis,
        ...planTimingState,
        activePartIndex,
        activeTeaserRequests,
        analysisActions,
        analysisDiagnostics,
        analysisFinishedAt,
        analysisFinishedStage,
        analysisNotice,
        analysisStartedAt,
        ...planActionsState,
        batchActions,
        batchPreviewOutput,
        batchState,
        ...subtitleActionsState,
        changeWorkspace,
        ...chatGPTState,
        chatGPTState,
        ...cutHistoryControlsState,
        draftContext,
        editorSourceId,
        editPlanState,
        ...sourceActions,
        ensureEditorSource:editorSourceLeaseState.ensureCurrent,sourceLeaseError:editorSourceLeaseState.error,
        error,
        exportActivity,
        ...previewStyleState,
        ...editPlanState,
        inspectorTab,
        ...sessionState,
        isAnalyzing,
        ...renderState,
        isWebAi,
        ...analysisContextState,
        ...subtitleRequestsState,
        manualDraftState,
        ...sessionActions,
        ...sourceState,
        previewState,
        renderActions,
        renderState,
        reviewVisible,
        ...previewCommandsState,
        sessionState,
        setActivePartIndex,
        setAnalysisNotice,
        setError,
        setInspectorTab,
        setSourceAdvancedOpen,
        ...subtitleStateState,
        setTimelineStatusTarget,
        setWebAiResult,
        sourceActions,
        sourceAdvancedOpen,
        sourceState,
        ...renderActions,
        teaserOperations,
        timelineStatusTarget,
        txtDownloadTask,
        visibleSupplementalPrompt,
        ...visualControlsState,
        webActions,
        webAiContext,
        webAiContextIssue,
        webAiError,
        webAiName,
        webAiNotice,
        webAiPhase,
        webAiPreparationLabel,
        webAiPrompt,
        webAiPromptIsCurrent,
        webAiResult,
        webAiStartedAt,
        whisperSmallReady,
        workerHealth,
        workspace,
        workspaceRef,
      }}
    />
  );
}
