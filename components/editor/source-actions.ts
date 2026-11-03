"use client";
import { useEditPlan } from "@/components/editor/use-edit-plan";
import type { AiDiagnostics } from "@/lib/ai-progress";
import type { SourcePreparationProgress, WorkerHealth } from "@/lib/api/worker-client";
import {
  WORKER_ORIGIN,
  readSourcePreparation,
  workerFetch,
  type RenderJob,
  type WebAiContext,
  type WorkerSource,
} from "@/lib/api/worker-client";
import { EditPlan } from "@/lib/edit-plan";
import type { Controls } from "@/lib/editor-session";
import { sourceCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import { uploadJson } from "@/lib/upload-json";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { ChangeEvent, useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  setSourceRevision: Dispatch<SetStateAction<number>>;
  activeTeaserRequests: RefObject<Map<number, { controller: AbortController; identity: string }>>;
  cutHistory: ReturnType<typeof useEditPlan>["cutHistory"];
  deckVideos: RefObject<(HTMLVideoElement | null)[]>;
  decks: RefObject<{
    clock: () => number;
    pause: () => void;
    play: () => Promise<void>;
    tick: () => void;
    seek: (seconds: number) => void;
    dispose: () => void;
  } | null>;
  invalidateAnalysis: () => void;
  jobRestoreEpoch: RefObject<number>;
  localFile: File | null;
  localFileName: string;
  localVideoUrl: string;
  musicPlaybackControl: RefObject<{ play: () => void; pause: () => void } | null>;
  pendingPreviewRestore: RefObject<number | null>;
  preparedSource: WorkerSource | null;
  previewEpoch: RefObject<number>;
  previewPlayingRef: RefObject<boolean>;
  restorePassive: boolean;
  restoringSource: RefObject<boolean>;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setAnalysisDiagnostics: Dispatch<SetStateAction<AiDiagnostics | null>>;
  setAnalysisStartedAt: Dispatch<SetStateAction<number>>;
  setBatchDraftItem: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null | undefined>>;
  setBatchEditing: Dispatch<SetStateAction<{ batchId: string; itemId: string; sourceId: string } | null>>;
  setControls: Dispatch<SetStateAction<Controls>>;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setInterruptedTasks: Dispatch<SetStateAction<string[]>>;
  setIsPreparingSource: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setLocalDraftId: Dispatch<SetStateAction<string>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  setLocalFileName: Dispatch<SetStateAction<string>>;
  setLocalVideoUrl: Dispatch<SetStateAction<string>>;
  setMainDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; invalid: boolean }>>>;
  setMusicIntent: Dispatch<SetStateAction<boolean>>;
  setPlan: (update: SetStateAction<EditPlan>) => void;
  setPreparedSource: Dispatch<SetStateAction<WorkerSource | null>>;
  setPreviewBuffering: Dispatch<SetStateAction<boolean>>;
  setPreviewCurrentTime: Dispatch<SetStateAction<number>>;
  setPreviewDuration: Dispatch<SetStateAction<number>>;
  setPreviewError: Dispatch<SetStateAction<string>>;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  setRestorePassive: Dispatch<SetStateAction<boolean>>;
  setRestoredJobId: Dispatch<SetStateAction<string>>;
  setRetainedSourceId: Dispatch<SetStateAction<string>>;
  setSourceCaptions: Dispatch<SetStateAction<CaptionTrack | null>>;
  setSourcePreparationProgress: Dispatch<SetStateAction<SourcePreparationProgress | null>>;
  setSourcePreparationStartedAt: Dispatch<SetStateAction<number>>;
  setSourceRestoreNotice: Dispatch<SetStateAction<string>>;
  setSourceSize: Dispatch<SetStateAction<{ width: number; height: number }>>;
  setSourceTitle: Dispatch<SetStateAction<string>>;
  setSubtitleBusy: Dispatch<SetStateAction<boolean>>;
  setSubtitleNotice: Dispatch<SetStateAction<string>>;
  setTeaserDraftErrors: Dispatch<SetStateAction<Record<number, { sourceKey: string; key: string; message: string }>>>;
  setTeaserOperations: Dispatch<
    SetStateAction<
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
    >
  >;
  setTranscript: Dispatch<SetStateAction<string>>;
  setTranscriptStatus: Dispatch<SetStateAction<string>>;
  setWebAiContext: Dispatch<SetStateAction<WebAiContext | null>>;
  setWebAiError: Dispatch<SetStateAction<string>>;
  setWebAiNotice: Dispatch<SetStateAction<string>>;
  setWebAiPhase: Dispatch<SetStateAction<"prompt" | "import" | null>>;
  setWebAiPrompt: Dispatch<SetStateAction<string>>;
  setWebAiResult: Dispatch<SetStateAction<string>>;
  setYoutubeError: Dispatch<SetStateAction<string>>;
  setYoutubeState: Dispatch<SetStateAction<"idle" | "loading" | "ready" | "error">>;
  sourceMode: "youtube" | "local";
  sourcePreparation: RefObject<AbortController | null>;
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  sourceUrl: string;
  stopWorkspacePlayback: (exceptTeaser?: number) => void;
  subtitleController: RefObject<AbortController | null>;
  subtitleRequestSerial: RefObject<number>;
  subtitleSourceRef: RefObject<string | undefined>;
  transcript: string;
  transcriptEdited: RefObject<boolean>;
  transcriptRequest: RefObject<AbortController | null>;
  transcriptRevision: RefObject<number>;
  webAiPending: RefObject<boolean>;
  workerHealth: WorkerHealth | null;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createSourceActions(read: () => State) {
  function resetSourceSelection() {
    const {
      activeTeaserRequests,
      cutHistory,
      deckVideos,
      decks,
      invalidateAnalysis,
      jobRestoreEpoch,
      musicPlaybackControl,
      pendingPreviewRestore,
      previewEpoch,
      previewPlayingRef,
      restoringSource,
      setActivePartIndex,
      setAnalysisDiagnostics,
      setAnalysisStartedAt,
      setBatchDraftItem,
      setBatchEditing,
      setControls,
      setError,
      setHasEditPlan,
      setInterruptedTasks,
      setIsPreparingSource,
      setIsPreviewPlaying,
      setMainDraftErrors,
      setMusicIntent,
      setPlan,
      setPreparedSource,
      setPreviewBuffering,
      setPreviewCurrentTime,
      setPreviewDuration,
      setPreviewError,
      setRenderJob,
      setRestorePassive,
      setRestoredJobId,
      setRetainedSourceId,
      setSourceCaptions,
      setSourcePreparationProgress,
      setSourceRestoreNotice,
      setSourceSize,
      setSourceTitle,
      setSubtitleBusy,
      setSubtitleNotice,
      setTeaserDraftErrors,
      setTeaserOperations,
      setTranscript,
      setTranscriptStatus,
      setWebAiContext,
      setWebAiError,
      setWebAiNotice,
      setWebAiPhase,
      setWebAiPrompt,
      setWebAiResult,
      setYoutubeError,
      setYoutubeState,
      sourcePreparation,
      sourceRequests,
      sourceSelectionEpoch,
      stopWorkspacePlayback,
      subtitleController,
      subtitleRequestSerial,
      subtitleSourceRef,
      transcriptEdited,
      transcriptRequest,
      transcriptRevision,
      webAiPending,
      setSourceRevision,
    } = read();

    cutHistory.clear();
    stopWorkspacePlayback();
    transcriptRequest.current?.abort();
    transcriptRequest.current = null;
    transcriptRevision.current++;
    transcriptEdited.current = false;
    subtitleController.current?.abort();
    subtitleController.current = null;
    webAiPending.current = false;
    setWebAiPhase(null);
    jobRestoreEpoch.current++;
    setRestorePassive(false);
    setMusicIntent(false);
    setRetainedSourceId("");
    setRestoredJobId("");
    setControls((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key.endsWith(":manual-cut"))),
    );
    setInterruptedTasks([]);
    setSourceRestoreNotice("");
    restoringSource.current = false;
    pendingPreviewRestore.current = null;
    sourceSelectionEpoch.current++;
    setSourceRevision(sourceSelectionEpoch.current);
    previewEpoch.current++;
    invalidateAnalysis();
    for (const request of sourceRequests.current) request.abort();
    sourceRequests.current.clear();
    activeTeaserRequests.current.clear();
    sourcePreparation.current = null;
    previewPlayingRef.current = false;
    musicPlaybackControl.current?.pause();
    decks.current?.dispose();
    decks.current = null;
    for (const video of deckVideos.current) video?.pause();
    setIsPreviewPlaying(false);
    setPreviewBuffering(false);
    setPreviewCurrentTime(0);
    setPreviewDuration(0);
    setPreviewError("");
    setPreparedSource(null);
    setRenderJob(null);
    setHasEditPlan(false);
    setIsPreparingSource(false);
    setSourcePreparationProgress(null);
    setAnalysisDiagnostics(null);
    setAnalysisStartedAt(0);
    setTeaserOperations({});
    setTranscript("");
    setTranscriptStatus("");
    setSourceCaptions(null);
    subtitleRequestSerial.current++;
    subtitleSourceRef.current = undefined;
    setSubtitleBusy(false);
    setSubtitleNotice("");
    setMainDraftErrors({});
    setTeaserDraftErrors({});
    setBatchEditing(null);
    setBatchDraftItem(null);
    setActivePartIndex(0);
    setWebAiPrompt("");
    setWebAiResult("");
    setWebAiContext(null);
    setWebAiNotice("");
    setWebAiError("");
    setError("");
    setSourceTitle("");
    setYoutubeState("idle");
    setYoutubeError("");
    setSourceSize({ width: 1920, height: 1080 });
    // Retain appearance, subtitle settings, music choice/gain/ducking. Only
    // source-bound caption/VAD evidence is cleared; queued snapshots are untouched.
    setPlan((current) => ({ ...current, originalTitle: "", captionCues: undefined, musicSpeech: undefined }));
  }
  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const {
      localFileName,
      localVideoUrl,
      preparedSource,
      restorePassive,
      setHasEditPlan,
      setLocalDraftId,
      setLocalFile,
      setLocalFileName,
      setLocalVideoUrl,
      setPlan,
      setPreparedSource,
      setRenderJob,
      setSourceRestoreNotice,
      setSourceTitle,
      setTranscript,
      sourceMode,
    } = read();

    const file = event.target.files?.[0];
    if (!file) return;
    if (restorePassive && sourceMode === "local" && file.name === localFileName && !preparedSource) {
      setLocalFile(file);
      setLocalVideoUrl(URL.createObjectURL(file));
      setSourceRestoreNotice("File đã chọn lại; bấm Chuẩn bị nguồn để import, không tự tải/AI.");
      return;
    }
    resetSourceSelection();
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl(URL.createObjectURL(file));
    setLocalDraftId(crypto.randomUUID());
    setLocalFileName(file.name);
    setLocalFile(file);
    setPreparedSource(null);
    setHasEditPlan(false);
    setRenderJob(null);
    setTranscript("");
    const fileTitle = file.name.replace(/\.[^.]+$/, "");
    setSourceTitle(fileTitle);
    setPlan((current) => ({ ...current, originalTitle: fileTitle }));
  }
  async function prepareSource(signal?: AbortSignal) {
    const {
      localFile,
      preparedSource,
      restorePassive,
      setError,
      setInterruptedTasks,
      setIsPreparingSource,
      setPlan,
      setPreparedSource,
      setRenderJob,
      setRetainedSourceId,
      setSourceCaptions,
      setSourcePreparationProgress,
      setSourcePreparationStartedAt,
      setSourceRestoreNotice,
      setSourceTitle,
      setSubtitleNotice,
      setTranscript,
      setYoutubeError,
      setYoutubeState,
      sourceMode,
      sourcePreparation,
      sourceRequests,
      sourceSelectionEpoch,
      sourceUrl,
      transcript,
      transcriptEdited,
      transcriptRevision,
      workerHealth,
    } = read();

    const selectionEpoch = sourceSelectionEpoch.current,
      revision = transcriptRevision.current;
    if (preparedSource) return preparedSource;
    setError("");
    if (!workerHealth?.ok) {
      setError("Media worker đang offline. Chạy `npm run personal` trong thư mục app.");
      return null;
    }
    if (sourceMode === "youtube" && !sourceUrl.trim()) {
      setError("Hãy nhập YouTube URL trước.");
      return null;
    }
    if (sourceMode === "local" && !localFile) {
      setError("Hãy chọn video local trước.");
      return null;
    }

    sourcePreparation.current?.abort();
    const controller = new AbortController();
    sourcePreparation.current = controller;
    sourceRequests.current.add(controller);
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const current = () =>
      !requestSignal.aborted &&
      sourcePreparation.current === controller &&
      selectionEpoch === sourceSelectionEpoch.current;
    setSourcePreparationStartedAt(Date.now());
    setSourcePreparationProgress({ phase: sourceMode === "youtube" ? "metadata" : "upload", percent: null });
    setIsPreparingSource(true);
    setInterruptedTasks((current) => current.filter((s) => !s.includes("nguồn") && !s.includes("transcript")));
    setRenderJob(null);
    try {
      const response =
        sourceMode === "youtube"
          ? await workerFetch(`/api/sources/youtube`, {
              method: "POST",
              signal: requestSignal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: sourceUrl.trim(), progress: true }),
            })
          : null;
      const data = response
        ? await readSourcePreparation(response, (value) => {
            if (current())
              setSourcePreparationProgress((previous) =>
                JSON.stringify(previous) === JSON.stringify(value) ? previous : value,
              );
          })
        : await uploadJson<{ source?: WorkerSource; error?: string }>(
            `${WORKER_ORIGIN}/api/sources/upload?filename=${encodeURIComponent(localFile!.name)}`,
            localFile!,
            {
              signal: requestSignal,
              headers: {
                "Content-Type": localFile!.type || "application/octet-stream",
                "X-Filename": encodeURIComponent(localFile!.name),
              },
              onProgress: (value) => {
                if (current())
                  setSourcePreparationProgress({
                    phase: "upload",
                    percent: value.percent,
                    downloadedBytes: value.loaded,
                    totalBytes: value.total ?? undefined,
                  });
              },
              onTransferred: () => {
                if (current()) setSourcePreparationProgress({ phase: "probing", percent: null });
              },
            },
          );
      if (
        (response && !response.ok) ||
        !data.source ||
        typeof data.source.id !== "string" ||
        typeof data.source.title !== "string" ||
        !Number.isFinite(data.source.duration) ||
        data.source.duration <= 0
      )
        throw new Error(
          typeof data.error === "string" ? data.error : "Không chuẩn bị được source: API trả dữ liệu không hợp lệ.",
        );
      if (!current()) return null;
      setPreparedSource(data.source);
      setRetainedSourceId(data.source.id);
      setSourceRestoreNotice("");
      if (restorePassive) {
        // Reattaching an explicitly selected source must not overwrite draft text/cues.
        if (!transcript && data.source.transcript && revision === transcriptRevision.current)
          setTranscript(data.source.transcript);
        return data.source;
      }

      try {
        setSourceCaptions(
          data.source.captions?.length
            ? sourceCaptionTrack(
                { sourceId: data.source.id, cues: data.source.captions, origin: "youtube" },
                data.source,
              )
            : null,
        );
      } catch (caught) {
        setSourceCaptions(null);
        setSubtitleNotice(caught instanceof Error ? caught.message : "Dữ liệu phụ đề không hợp lệ.");
      }
      setSourceTitle(data.source.title);
      setPlan((current) => ({ ...current, originalTitle: data.source!.title }));
      if (
        typeof data.source.transcript === "string" &&
        revision === transcriptRevision.current &&
        !transcriptEdited.current
      )
        setTranscript(data.source.transcript);
      return data.source;
    } catch (caughtError) {
      if (current()) {
        const message = caughtError instanceof Error ? caughtError.message : "Không chuẩn bị được source.";
        if (sourceMode === "youtube") {
          setYoutubeState("error");
          setYoutubeError(message);
        } else setError(message);
      }
      return null;
    } finally {
      sourceRequests.current.delete(controller);
      if (sourcePreparation.current === controller) {
        sourcePreparation.current = null;
        setIsPreparingSource(false);
        setSourcePreparationProgress(null);
      }
    }
  }
  function editTranscript(value: string) {
    const {
      invalidateAnalysis,
      setTranscript,
      setTranscriptStatus,
      transcriptEdited,
      transcriptRequest,
      transcriptRevision,
    } = read();

    transcriptRevision.current++;
    transcriptEdited.current = true;
    transcriptRequest.current?.abort();
    setTranscriptStatus("Transcript chỉnh tay");
    invalidateAnalysis();
    setTranscript(value);
  }
  return { resetSourceSelection, handleVideoUpload, prepareSource, editTranscript };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useSourceActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const resetSourceSelection = useCallback(
    (...args: Parameters<ReturnType<typeof createSourceActions>["resetSourceSelection"]>) =>
      createSourceActions(readerRef.current).resetSourceSelection(...args),
    [],
  );
  const handleVideoUpload = useCallback(
    (...args: Parameters<ReturnType<typeof createSourceActions>["handleVideoUpload"]>) =>
      createSourceActions(readerRef.current).handleVideoUpload(...args),
    [],
  );
  const prepareSource = useCallback(
    (...args: Parameters<ReturnType<typeof createSourceActions>["prepareSource"]>) =>
      createSourceActions(readerRef.current).prepareSource(...args),
    [],
  );
  const editTranscript = useCallback(
    (...args: Parameters<ReturnType<typeof createSourceActions>["editTranscript"]>) =>
      createSourceActions(readerRef.current).editTranscript(...args),
    [],
  );
  return useMemo(
    () => ({ resetSourceSelection, handleVideoUpload, prepareSource, editTranscript }),
    [resetSourceSelection, handleVideoUpload, prepareSource, editTranscript],
  );
}
