"use client";
import { PreservedDrafts } from "@/components/preserved-drafts";
import { EditorDraftContext } from "@/components/editor-draft-context";
import { EditorWorkspace } from "@/components/editor-workspace";
import { createAutoAnalysisActions } from "@/components/editor/auto-analysis-actions";
import { createBatchActions } from "@/components/editor/batch-actions";
import { BatchView } from "@/components/editor/batch-view";
import { InspectorView } from "@/components/editor/inspector-view";
import { PreviewView } from "@/components/editor/preview-view";
import { createRenderActions } from "@/components/editor/render-actions";
import { createSourceActions } from "@/components/editor/source-actions";
import { SourceView } from "@/components/editor/source-view";
import { StorageView } from "@/components/editor/storage-view";
import { TimelineView } from "@/components/editor/timeline-view";
import { useBatchQueue } from "@/components/editor/use-batch-queue";
import { useChatGPTSession } from "@/components/editor/use-chatgpt-session";
import { useEditPlan } from "@/components/editor/use-edit-plan";
import { usePreviewPlayback } from "@/components/editor/use-preview-playback";
import { useRenderJobs } from "@/components/editor/use-render-jobs";
import { useSessionSave } from "@/components/editor/use-session-save";
import { useSourcePreparation } from "@/components/editor/use-source-preparation";
import { useWorkerHealth } from "@/components/editor/use-worker-health";
import { createWebAiActions } from "@/components/editor/web-ai-actions";
import type { SaveState } from "@/components/studio-header";
import { StudioHeader } from "@/components/studio-header";
import { StudioRenderStatus } from "@/components/studio-render-status";
import { useManualCutDraft } from "@/components/use-manual-cut-draft";
import { type AiDiagnostics } from "@/lib/ai-progress";
import type { ChatGPTSession } from "@/lib/api/worker-client";
import { WORKER_ORIGIN, type RenderJob, type WebAiContext, type WorkerSource } from "@/lib/api/worker-client";
import type { AiProvider, EditPart, EditPlan, Segment } from "@/lib/edit-plan";
import type { Controls } from "@/lib/editor-session";
import type { Caption } from "@/lib/subtitles.mjs";
import { type CaptionTrack } from "@/lib/subtitles.mjs";
import type { CutTransitionWindow } from "@/lib/visual-style/cut-transitions.mjs";
import type { TextStyle, VisualStyle } from "@/lib/visual-style/types";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
type Props = {
  activeAnalysis: RefObject<AbortController | null>;
  activePart: EditPart;
  activePartIndex: number;
  activeTeaserRequests: RefObject<Map<number, { controller: AbortController; identity: string }>>;
  analysisActions: ReturnType<typeof createAutoAnalysisActions>;
  analysisDiagnostics: AiDiagnostics | null;
  analysisFinishedAt: number;
  analysisFinishedStage: "complete" | "error" | "cancelled";
  analysisNotice: string;
  analysisStartedAt: number;
  applyManualPlan: () => void;
  batchActions: ReturnType<typeof createBatchActions>;
  batchPreviewOutput: { key: string; title: string; part: number; filename: string; size: number; url: string };
  batchState: ReturnType<typeof useBatchQueue>;
  cancelSubtitles: () => void;
  changeWorkspace: (next: "editor" | "batch" | "storage") => void;
  chatGPTSession: ChatGPTSession | null;
  chatGPTState: ReturnType<typeof useChatGPTSession>;
  chooseSubtitleLanguage: (value: string) => void;
  chooseSubtitleSource: (source: "youtube" | "whisper") => void;
  cutHistoryBlocked: boolean;
  cutHistoryTravelRevision: RefObject<number>;
  draftContext: {
    controls: Controls;
    setControls: Dispatch<SetStateAction<Controls>>;
    scope: string;
    activity: (key: string, busy: boolean) => void;
  };
  editCaption: (index: number, text: string) => void;
  editorSourceId: string;
  editPlanState: ReturnType<typeof useEditPlan>;
  editTranscript: (value: string) => void;
  effectiveTiming: { plan: EditPlan; error: string };
  ensureEditorSource: () => Promise<void>;
  error: string;
  exportActivity: boolean;
  foregroundImage: {
    fittedWidth: number;
    fittedHeight: number;
    scaledWidth: number;
    scaledHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  foregroundSourceHeight: number;
  foregroundSourceWidth: number;
  hasEditPlan: boolean;
  inspectorTab: "music" | "appearance" | "text";
  installWhisperModel: () => Promise<void>;
  interruptedTasks: string[];
  isAnalyzing: boolean;
  isCurrentPreviewVideo: (video: HTMLVideoElement) => boolean;
  isStartingRender: boolean;
  isWebAi: boolean;
  latestPartHookIdentities: RefObject<{ [k: string]: string }>;
  loadSubtitles: (install?: boolean, regenerate?: boolean) => Promise<void>;
  mainDraftErrors: Record<number, { sourceKey: string; key: string; invalid: boolean }>;
  mainEditorSourceKey: string;
  manualDraftState: ReturnType<typeof useManualCutDraft>;
  measuredTitlePair: {
    input: { original: string; part: string; originalStyle: TextStyle; partStyle: TextStyle; scale: number };
    pair: {
      original: {
        text: string;
        fontSize: number;
        lineSpacing: number;
        lineCount: number;
        maxLines: number;
        truncated: boolean;
      };
      part: {
        text: string;
        fontSize: number;
        lineSpacing: number;
        lineCount: number;
        maxLines: number;
        truncated: boolean;
      };
    };
  } | null;
  newSession: () => void;
  originalTitleFit: {
    text: string;
    fontSize: number;
    lineSpacing: number;
    lineCount: number;
    maxLines: number;
    truncated: boolean;
  };
  overlayPartTitle: string;
  partTitleFit: {
    text: string;
    fontSize: number;
    lineSpacing: number;
    lineCount: number;
    maxLines: number;
    truncated: boolean;
  };
  playbackSegments: Segment[];
  preparedSource: WorkerSource | null;
  preserveCurrentDraft: () => boolean;
  preservedDrafts: { key: string; label: string }[];
  previewCaption: Caption | undefined;
  previewEffectTime: number;
  previewPlan: EditPlan;
  previewScale: number;
  previewSourceEpoch: number;
  previewState: ReturnType<typeof usePreviewPlayback>;
  previewVideoUrl: string;
  previewVisualStyle: VisualStyle;
  provider: AiProvider;
  renderActions: ReturnType<typeof createRenderActions>;
  renderJob: RenderJob | null;
  renderState: ReturnType<typeof useRenderJobs>;
  restoreBlocked: boolean;
  restorePreservedDraft: (key: string) => Promise<void>;
  deletePreservedDraft: (key: string) => Promise<void>;
  retainedSourceId: string;
  reviewVisible: boolean;
  saveError: string;
  saveSession: (onlyIfChanged?: boolean) => boolean;
  saveState: SaveState;
  seekPreview: (value: number) => void;
  sessionNotice: string;
  sessionReady: boolean;
  sessionState: ReturnType<typeof useSessionSave>;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setAnalysisNotice: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setInspectorTab: Dispatch<SetStateAction<"music" | "appearance" | "text">>;
  setSessionNotice: Dispatch<SetStateAction<string>>;
  setSourceAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setSourceRestoreVersion: Dispatch<SetStateAction<number>>;
  setTimelineStatusTarget: Dispatch<SetStateAction<HTMLDivElement | null>>;
  setWebAiResult: Dispatch<SetStateAction<string>>;
  sourceActions: ReturnType<typeof createSourceActions>;
  sourceAdvancedOpen: boolean;
  sourceLeaseError: string;
  sourceRestoreNotice: string;
  sourceState: ReturnType<typeof useSourcePreparation>;
  speechModel: {
    modelReady: boolean;
    installing: boolean;
    model?: string;
    backend?: string;
    modelId?: string;
    downloadedBytes?: number;
    totalBytes?: number;
  } | null;
  startRender: () => Promise<void>;
  stoppingRenderIds: string[];
  stopRender: (job: RenderJob) => Promise<void>;
  subtitleBusy: boolean;
  subtitleController: RefObject<AbortController | null>;
  subtitleCues: Caption[];
  subtitleNotice: string;
  subtitleStartedAt: number;
  teaserDraftErrors: Record<number, { sourceKey: string; key: string; message: string }>;
  teaserIssues: { partId: number; reason: string }[];
  teaserOperations: Record<
    number,
    {
      diagnostics: AiDiagnostics | null;
      startedAt: number;
      running: boolean;
      finishedAt?: number;
      finishedStage?: "complete" | "error" | "cancelled";
    }
  >;
  timelineDuration: number;
  timelineStatusTarget: HTMLDivElement | null;
  titleFitInput: { original: string; part: string; originalStyle: TextStyle; partStyle: TextStyle; scale: number };
  titleShineStyle: { maskImage: string; maskRepeat: string; maskSize: string; maskPosition: string };
  togglePreview: () => Promise<void>;
  transitionWindows: CutTransitionWindow[];
  travelCutHistory: (direction: "undo" | "redo") => void;
  txtDownloadTask: { revision: string; startedAt: number; state: "running" | "done" | "error" | "cancelled" } | null;
  updatePartTitle: (title: string) => void;
  updatePreviewClock: () => void;
  videoColorFilter: string;
  visibleSupplementalPrompt: string;
  visualControls: {
    overlay: JSX.Element;
    background: JSX.Element;
    filter: JSX.Element;
    animation: JSX.Element;
    transition: JSX.Element;
    text: JSX.Element;
    font: JSX.Element;
  };
  webActions: ReturnType<typeof createWebAiActions>;
  webAiContext: WebAiContext | null;
  webAiContextIssue:
    | ""
    | "Tải TXT trước khi nhập JSON."
    | "TXT thuộc phiên bản cũ. Tải TXT mới."
    | "JSON/TXT thuộc nguồn khác. Tải TXT cho nguồn hiện tại."
    | "Đã đổi AI. Tải TXT cho AI đang chọn."
    | "Transcript đã đổi. Tải TXT mới."
    | "Yêu cầu đã đổi. Tải TXT mới."
    | "Main, phụ đề hoặc teaser thủ công đã đổi. Tải TXT mới để giữ chỉnh sửa hiện tại.";
  webAiError: string;
  webAiName: "Gemini" | "ChatGPT" | "Muse";
  webAiNotice: string;
  webAiPhase: "prompt" | "import" | null;
  webAiPreparationLabel: string;
  webAiPrompt: string;
  webAiPromptIsCurrent: boolean;
  webAiResult: string;
  webAiStartedAt: number;
  webFlowRevision: string;
  whisperSmallReady: boolean;
  workerHealth: ReturnType<typeof useWorkerHealth>;
  workspace: "batch" | "editor" | "storage";
  workspaceRef: RefObject<"batch" | "editor" | "storage">;
};
export function StudioView({
  activeAnalysis,
  activePart,
  activePartIndex,
  activeTeaserRequests,
  analysisActions,
  analysisDiagnostics,
  analysisFinishedAt,
  analysisFinishedStage,
  analysisNotice,
  analysisStartedAt,
  applyManualPlan,
  batchActions,
  batchPreviewOutput,
  batchState,
  cancelSubtitles,
  changeWorkspace,
  chatGPTSession,
  chatGPTState,
  chooseSubtitleLanguage,
  chooseSubtitleSource,
  cutHistoryBlocked,
  cutHistoryTravelRevision,
  draftContext,
  editCaption,
  editorSourceId,
  editPlanState,
  editTranscript,
  effectiveTiming,
  ensureEditorSource,
  error,
  exportActivity,
  foregroundImage,
  foregroundSourceHeight,
  foregroundSourceWidth,
  hasEditPlan,
  inspectorTab,
  installWhisperModel,
  interruptedTasks,
  isAnalyzing,
  isCurrentPreviewVideo,
  isStartingRender,
  isWebAi,
  latestPartHookIdentities,
  loadSubtitles,
  mainDraftErrors,
  mainEditorSourceKey,
  manualDraftState,
  measuredTitlePair,
  newSession,
  originalTitleFit,
  overlayPartTitle,
  partTitleFit,
  playbackSegments,
  preparedSource,
  preserveCurrentDraft,
  preservedDrafts,
  previewCaption,
  previewEffectTime,
  previewPlan,
  previewScale,
  previewSourceEpoch,
  previewState,
  previewVideoUrl,
  previewVisualStyle,
  provider,
  renderActions,
  renderJob,
  renderState,
  restoreBlocked,
  restorePreservedDraft,
  deletePreservedDraft,
  retainedSourceId,
  reviewVisible,
  saveError,
  saveSession,
  saveState,
  seekPreview,
  sessionNotice,
  sessionReady,
  sessionState,
  setActivePartIndex,
  setAnalysisNotice,
  setError,
  setInspectorTab,
  setSessionNotice,
  setSourceAdvancedOpen,
  setSourceCaptions,
  setSourceRestoreVersion,
  setTimelineStatusTarget,
  setWebAiResult,
  sourceActions,
  sourceAdvancedOpen,
  sourceLeaseError,
  sourceRestoreNotice,
  sourceState,
  speechModel,
  startRender,
  stoppingRenderIds,
  stopRender,
  subtitleBusy,
  subtitleController,
  subtitleCues,
  subtitleNotice,
  subtitleStartedAt,
  teaserDraftErrors,
  teaserIssues,
  teaserOperations,
  timelineDuration,
  timelineStatusTarget,
  titleFitInput,
  titleShineStyle,
  togglePreview,
  transitionWindows,
  travelCutHistory,
  txtDownloadTask,
  updatePartTitle,
  updatePreviewClock,
  videoColorFilter,
  visibleSupplementalPrompt,
  visualControls,
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
  webFlowRevision,
  whisperSmallReady,
  workerHealth,
  workspace,
  workspaceRef,
}: Props) {
  return (
    <EditorDraftContext.Provider value={draftContext}>
      <main className="prototype-shell">
        <StudioHeader
          workspace={workspace}
          onWorkspace={changeWorkspace}
          workerReady={!!workerHealth?.ok}
          providerReady={provider === "chatgpt" ? !!chatGPTSession?.sharing : isWebAi}
          providerLabel={
            provider === "chatgpt"
              ? chatGPTSession?.sharing
                ? "ChatGPT kết nối"
                : "ChatGPT · cần đăng nhập"
              : isWebAi
                ? `${webAiName} · web`
                : provider === "mock"
                  ? "Mô phỏng (không AI)"
                  : provider
          }
          saveState={saveState}
          saveMessage={
            saveError ||
            sessionNotice ||
            "Lưu bằng nút Lưu hoặc ⌘/Ctrl+S; giữ bản nháp khi ẩn/đóng tab. Không lưu theo timer."
          }
          onSave={() => saveSession()}
          saveBlocked={restoreBlocked}
          onNewSession={newSession}
          ready={sessionReady}
        />
        {(sessionNotice ||
          saveError ||
          sourceRestoreNotice ||
          (sourceLeaseError && workspace !== "storage") ||
          interruptedTasks.length > 0 ||
          preservedDrafts.length > 0) && (
          <div className="studio-notices" role="status">
            {sessionNotice && <span>{sessionNotice}</span>}
            {saveError && <span className="studio-danger">{saveError}</span>}
            {sourceRestoreNotice && <span className="studio-warning">{sourceRestoreNotice}</span>}
            {sourceLeaseError && workspace !== "storage" && <span className="studio-warning">{sourceLeaseError}</span>}
            {!!interruptedTasks.length && (
              <span className="studio-warning">
                Đã gián đoạn: {interruptedTasks.join(", ")}. Dùng nút tác vụ để tiếp tục; không tự gửi lại.
              </span>
            )}
            {retainedSourceId && !preparedSource && (
              <button type="button" onClick={() => setSourceRestoreVersion((v) => v + 1)}>
                Nối lại source
              </button>
            )}
            {restoreBlocked && (
              <button
                type="button"
                onClick={() => {
                  if (preserveCurrentDraft()) setSessionNotice("Đã giữ nguyên bản gốc. Bấm Lưu để lưu phiên hiện tại.");
                }}
              >
                Giữ bản gốc
              </button>
            )}
            {!!preservedDrafts.length && (
              <PreservedDrafts
                drafts={preservedDrafts}
                onOpen={restorePreservedDraft}
                onDelete={deletePreservedDraft}
              />
            )}
          </div>
        )}
        {workspace === "storage" && (
          <StorageView model={{ ...renderActions, ...renderState, editorSourceId, ensureEditorSource, workerHealth }} />
        )}
        {workspace === "batch" && (
          <BatchView
            model={{
              ...batchState,
              batchPreviewOutput,
              ...previewState,
              ...webActions,
              changeWorkspace,
              ...chatGPTState,
              ...batchActions,
              isWebAi,
              ...editPlanState,
              visibleSupplementalPrompt,
              webAiName,
              workerHealth,
            }}
          />
        )}
        <div className={workspace !== "editor" ? "hidden" : "studio-editor-host"}>
          <EditorWorkspace
            visible={workspace === "editor"}
            source={
              <SourceView
                model={{
                  activeAnalysis,
                  analysisDiagnostics,
                  analysisFinishedAt,
                  analysisFinishedStage,
                  analysisNotice,
                  analysisStartedAt,
                  ...analysisActions,
                  applyManualPlan,
                  ...webActions,
                  ...batchState,
                  ...chatGPTState,
                  ...editPlanState,
                  effectiveTiming,
                  error,
                  ...sourceActions,
                  isAnalyzing,
                  ...sourceState,
                  ...renderState,
                  isWebAi,
                  ...manualDraftState,
                  previewPlan,
                  ...batchActions,
                  setAnalysisNotice,
                  setError,
                  setSourceAdvancedOpen,
                  setWebAiResult,
                  sourceAdvancedOpen,
                  teaserIssues,
                  teaserOperations,
                  txtDownloadTask,
                  visibleSupplementalPrompt,
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
                  webFlowRevision,
                  workerHealth,
                  onEditTranscript: editTranscript,
                }}
              />
            }
            preview={
              <PreviewView
                model={{
                  activePart,
                  activePartIndex,
                  ...previewState,
                  foregroundImage,
                  foregroundSourceHeight,
                  foregroundSourceWidth,
                  ...editPlanState,
                  isCurrentPreviewVideo,
                  ...sourceState,
                  mainEditorSourceKey,
                  measuredTitlePair,
                  originalTitleFit,
                  overlayPartTitle,
                  partTitleFit,
                  playbackSegments,
                  previewCaption,
                  previewEffectTime,
                  previewPlan,
                  previewScale,
                  previewSourceEpoch,
                  previewVideoUrl,
                  previewVisualStyle,
                  reviewVisible,
                  seekPreview,
                  setActivePartIndex,
                  teaserIssues,
                  timelineDuration,
                  titleFitInput,
                  titleShineStyle,
                  togglePreview,
                  transitionWindows,
                  updatePreviewClock,
                  videoColorFilter,
                  workspace,
                  workspaceRef,
                }}
              />
            }
            timeline={
              <TimelineView
                model={{
                  activePart,
                  activePartIndex,
                  activeTeaserRequests,
                  ...editPlanState,
                  cutHistoryBlocked,
                  cutHistoryTravelRevision,
                  ...previewState,
                  ...analysisActions,
                  isAnalyzing,
                  latestPartHookIdentities,
                  mainEditorSourceKey,
                  ...sourceState,
                  previewPlan,
                  previewVideoUrl,
                  reviewVisible,
                  seekPreview,
                  ...sessionState,
                  setActivePartIndex,
                  setError,
                  ...renderState,
                  setSourceCaptions,
                  subtitleCues,
                  teaserIssues,
                  teaserOperations,
                  timelineStatusTarget,
                  travelCutHistory,
                  workspace,
                }}
              />
            }
            inspector={
              <InspectorView
                model={{
                  activePart,
                  chooseSubtitleLanguage,
                  chooseSubtitleSource,
                  ...editPlanState,
                  inspectorTab,
                  installWhisperModel,
                  ...previewState,
                  loadSubtitles,
                  ...sessionState,
                  ...sourceState,
                  previewPlan,
                  previewVisualStyle,
                  setInspectorTab,
                  speechModel,
                  subtitleBusy,
                  subtitleController,
                  subtitleCues,
                  subtitleNotice,
                  subtitleStartedAt,
                  timelineDuration,
                  updatePartTitle,
                  visualControls,
                  whisperSmallReady,
                  workerHealth,
                  workspace,
                  onEditCaption: editCaption,
                  onCancelSubtitles: cancelSubtitles,
                }}
              />
            }
            status={
              <StudioRenderStatus
                timelineDraftInvalid={Boolean(
                  (mainDraftErrors[activePart.id]?.sourceKey === mainEditorSourceKey &&
                    mainDraftErrors[activePart.id]?.invalid) ||
                  (teaserDraftErrors[activePart.id]?.sourceKey === mainEditorSourceKey &&
                    teaserDraftErrors[activePart.id]?.message),
                )}
                timelineNotice={<div ref={setTimelineStatusTarget} className="studio-timeline-notices" />}
                job={renderJob}
                submitting={isStartingRender}
                canRender={
                  hasEditPlan &&
                  !teaserIssues.length &&
                  !isStartingRender &&
                  !subtitleBusy &&
                  !isAnalyzing &&
                  !effectiveTiming.error &&
                  renderJob?.state !== "queued" &&
                  renderJob?.state !== "rendering" &&
                  !!workerHealth?.ok
                }
                hasPlan={hasEditPlan}
                blockedReason={
                  !workerHealth?.ok
                    ? "Worker chưa kết nối"
                    : subtitleBusy
                      ? "Đang tạo phụ đề…"
                      : isAnalyzing
                        ? "Đang phân tích…"
                        : ""
                }
                validation={effectiveTiming.error}
                issues={teaserIssues}
                stopping={!!renderJob && stoppingRenderIds.includes(renderJob.id)}
                worker={WORKER_ORIGIN}
                onRender={() => void startRender()}
                onCancel={() => {
                  if (renderJob) void stopRender(renderJob);
                }}
                onPart={(id) => setActivePartIndex(id - 1)}
                busy={exportActivity}
              />
            }
          />
        </div>
      </main>
    </EditorDraftContext.Provider>
  );
}
