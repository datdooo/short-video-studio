"use client";
import type { AiDiagnostics } from "@/lib/ai-progress";
import { readAiOperation } from "@/lib/ai-progress";
import { planResult } from "@/lib/ai-response";
import { workerFetch, type WorkerSource } from "@/lib/api/worker-client";
import type { MainAnalysis } from "@/lib/auto-cut/main-content.mjs";
import type { EditPart } from "@/lib/edit-plan";
import { AiProvider, EditPlan, mockPlan } from "@/lib/edit-plan";
import { explainInVietnamese } from "@/lib/explanation-language.mjs";
import { sourceCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import { teaserReadiness, validateTeaser } from "@/lib/teaser-hooks.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  activeAnalysis: RefObject<AbortController | null>;
  activeTeaserRequests: RefObject<Map<number, { controller: AbortController; identity: string }>>;
  analysisRequests: RefObject<{
    begin(): { serial: number; controller: AbortController };
    invalidate(): void;
    isCurrent(ticket: { serial: number; controller: AbortController }): boolean;
    finish(ticket: { serial: number; controller: AbortController }): void;
  }>;
  draftError: string;
  effectiveTiming: { plan: EditPlan; error: string };
  hasEditPlan: boolean;
  isAnalyzing: boolean;
  isWebAi: boolean;
  latestPartHookIdentities: RefObject<{ [k: string]: string }>;
  prepareSource: (signal?: AbortSignal) => Promise<WorkerSource | null>;
  preparedSource: WorkerSource | null;
  previewPlan: EditPlan;
  provider: AiProvider;
  replacePlan: (next: EditPlan) => void;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setAnalysisDiagnostics: Dispatch<SetStateAction<AiDiagnostics | null>>;
  setAnalysisFinishedAt: Dispatch<SetStateAction<number>>;
  setAnalysisFinishedStage: Dispatch<SetStateAction<"error" | "complete" | "cancelled">>;
  setAnalysisNotice: Dispatch<SetStateAction<string>>;
  setAnalysisStartedAt: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setInterruptedTasks: Dispatch<SetStateAction<string[]>>;
  setIsAnalyzing: Dispatch<SetStateAction<boolean>>;
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
  setTxtDownloadTask: Dispatch<
    SetStateAction<{ revision: string; startedAt: number; state: "running" | "done" | "error" | "cancelled" } | null>
  >;
  setWebAiPhase: Dispatch<SetStateAction<"prompt" | "import" | null>>;
  sourceCaptions: CaptionTrack | null;
  sourceRequests: RefObject<Set<AbortController>>;
  sourceSelectionEpoch: RefObject<number>;
  sourceTitle: string;
  subtitleSourceRef: RefObject<string | undefined>;
  timing: { parts: EditPart[]; analysis: MainAnalysis | undefined; error: string };
  transcript: string;
  webAiPending: RefObject<boolean>;
  instruction: string;
  supplementalPrompt: string;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createAutoAnalysisActions(read: () => State) {
  function invalidateAnalysis() {
    const {
      activeAnalysis,
      analysisRequests,
      setAnalysisFinishedAt,
      setAnalysisFinishedStage,
      setAnalysisNotice,
      setIsAnalyzing,
      setTxtDownloadTask,
      setWebAiPhase,
      webAiPending,
    } = read();

    if (activeAnalysis.current) {
      setAnalysisFinishedStage("cancelled");
      setAnalysisFinishedAt(Date.now());
    }
    analysisRequests.current.invalidate();
    activeAnalysis.current = null;
    webAiPending.current = false;
    setWebAiPhase(null);
    setTxtDownloadTask((current) => (current?.state === "running" ? { ...current, state: "cancelled" } : current));
    setIsAnalyzing(false);
    setAnalysisNotice("");
  }
  async function analyze() {
    const { instruction, supplementalPrompt } = read();

    const {
      activeAnalysis,
      activeTeaserRequests,
      analysisRequests,
      effectiveTiming,
      hasEditPlan,
      isAnalyzing,
      isWebAi,
      prepareSource,
      preparedSource,
      previewPlan,
      provider,
      replacePlan,
      setActivePartIndex,
      setAnalysisDiagnostics,
      setAnalysisFinishedAt,
      setAnalysisFinishedStage,
      setAnalysisNotice,
      setAnalysisStartedAt,
      setError,
      setHasEditPlan,
      setInterruptedTasks,
      setIsAnalyzing,
      sourceCaptions,
      sourceSelectionEpoch,
      sourceTitle,
      transcript,
    } = read();

    if (isWebAi || isAnalyzing || (activeAnalysis.current && !activeAnalysis.current.signal.aborted)) return;
    if ([...activeTeaserRequests.current.values()].some((request) => !request.controller.signal.aborted)) {
      setAnalysisNotice("Đang chọn teaser; dừng hoặc chờ lượt đó trước khi phân tích lại main.");
      return;
    }
    const selectionEpoch = sourceSelectionEpoch.current,
      ticket = analysisRequests.current.begin();
    activeAnalysis.current = ticket.controller;
    setAnalysisDiagnostics(null);
    setAnalysisStartedAt(Date.now());
    setAnalysisFinishedAt(0);
    setAnalysisFinishedStage("complete");
    setInterruptedTasks((current) => current.filter((s) => !s.includes("AI")));
    setError("");
    setAnalysisNotice("Đang chuẩn bị source…");
    setIsAnalyzing(true);
    try {
      if (provider === "mock") {
        replacePlan(mockPlan({ provider: "mock", originalTitle: sourceTitle, transcript, instruction }));
        setHasEditPlan(true);
        if (!preparedSource) await prepareSource(ticket.controller.signal);
        return;
      }
      if (provider !== "chatgpt") throw new Error("Auto dùng ChatGPT đã cấu hình; Gemini/Muse dùng prompt và import.");
      if (effectiveTiming.error) throw new Error(effectiveTiming.error);
      const source = preparedSource || (await prepareSource(ticket.controller.signal));
      if (!source || !analysisRequests.current.isCurrent(ticket) || selectionEpoch !== sourceSelectionEpoch.current)
        return;
      setAnalysisNotice("");
      const response = await workerFetch(`/api/sources/${source.id}/auto-cut`, {
        method: "POST",
        signal: ticket.controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: true,
          transcript: transcript || source.transcript,
          instruction,
          supplementalPrompt,
          ...(hasEditPlan ? { currentPlan: previewPlan } : {}),
          ...(sourceCaptions?.sourceId === source.id ? { captionCues: sourceCaptions } : {}),
        }),
      });
      const data = await readAiOperation<{ plan?: EditPlan }>(
        response,
        (diagnostics) => {
          if (analysisRequests.current.isCurrent(ticket) && selectionEpoch === sourceSelectionEpoch.current)
            setAnalysisDiagnostics(diagnostics);
        },
        planResult,
      );
      if (!analysisRequests.current.isCurrent(ticket) || selectionEpoch !== sourceSelectionEpoch.current) return;
      if (!response.ok || !data.plan) throw new Error(data.error || "Không tạo được Smart Auto Cut.");
      replacePlan(data.plan);
      setHasEditPlan(true);
      setActivePartIndex(0);
      const missingTeasers = teaserReadiness(data.plan, source.duration, [], source.id);
      const mainNotice =
        data.plan.analysis?.method === "deterministic-fallback"
          ? `Main dự phòng · ${explainInVietnamese(data.plan.analysis.fallbackReason, "AI chưa khả dụng; main dự phòng chưa được AI xác minh ngữ nghĩa.")}. `
          : "";
      setAnalysisFinishedStage(
        missingTeasers.length || data.plan.analysis?.method === "deterministic-fallback" ? "error" : "complete",
      );
      setAnalysisNotice(
        mainNotice +
          (missingTeasers.length
            ? `Main đã lưu; chưa hoàn tất teaser. ${missingTeasers.map((issue) => `Part ${issue.partId}: ${issue.reason}`).join(" ")} Chọn lại, nhập mốc tay hoặc tắt teaser tại Timeline.`
            : "Đã tạo main; các teaser đang bật hợp lệ. Có thể xem/chỉnh trong Timeline."),
      );
    } catch (caught) {
      if (analysisRequests.current.isCurrent(ticket)) {
        setAnalysisFinishedStage("error");
        setError(caught instanceof Error ? caught.message : "Không tạo được Smart Auto Cut.");
      }
    } finally {
      if (activeAnalysis.current === ticket.controller) activeAnalysis.current = null;
      if (analysisRequests.current.isCurrent(ticket)) {
        setAnalysisFinishedAt(Date.now());
        setIsAnalyzing(false);
        analysisRequests.current.finish(ticket);
      }
    }
  }
  async function resolveCustomTeaser(
    partId: number,
    input: string,
    signal: AbortSignal,
    previousRanges: { start: number; end: number }[] = [],
  ) {
    const { instruction, supplementalPrompt, transcript } = read();

    const {
      activeTeaserRequests,
      draftError,
      isAnalyzing,
      latestPartHookIdentities,
      preparedSource,
      previewPlan,
      setInterruptedTasks,
      setTeaserOperations,
      sourceCaptions,
      sourceRequests,
      sourceSelectionEpoch,
      subtitleSourceRef,
      timing,
    } = read();

    setInterruptedTasks((current) => current.filter((s) => s !== `teaser Part ${partId}`));
    if (timing.error || draftError) throw new Error(timing.error || draftError);
    const source = preparedSource;
    if (!source) throw new Error("Chuẩn bị nguồn video trước khi chọn teaser.");
    const requestIdentity = latestPartHookIdentities.current[partId],
      sourceId = source.id,
      epoch = sourceSelectionEpoch.current;
    if (isAnalyzing) throw new Error("Đang phân tích main; dừng hoặc chờ lượt hiện tại trước khi chọn lại teaser.");
    const previous = activeTeaserRequests.current.get(partId);
    previous?.controller.abort();
    const controller = new AbortController(),
      combined = AbortSignal.any([signal, controller.signal]);
    const operation = { controller, identity: requestIdentity };
    activeTeaserRequests.current.set(partId, operation);
    sourceRequests.current.add(controller);
    const current = () =>
      activeTeaserRequests.current.get(partId) === operation && epoch === sourceSelectionEpoch.current;
    setTeaserOperations((current) => ({
      ...current,
      [partId]: { diagnostics: null, startedAt: Date.now(), running: true },
    }));
    let selected = false;
    try {
      const captionCues =
        sourceCaptions?.sourceId === sourceId ? sourceCaptionTrack(sourceCaptions, source) : previewPlan.captionCues;
      const requestPlan = {
        ...previewPlan,
        parts: previewPlan.parts.map((p) =>
          p.id === partId ? { ...p, teaser: undefined, customTeaser: undefined } : p,
        ),
        ...(captionCues ? { captionCues } : {}),
      };
      const response = await workerFetch(`/api/sources/${sourceId}/teaser-hooks`, {
        method: "POST",
        signal: combined,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: true,
          plan: requestPlan,
          partId,
          previousRanges,
          instruction,
          supplementalPrompt,
          transcript,
          ...(input ? { customInstruction: input } : {}),
        }),
      });
      const result = await readAiOperation<{ plan?: EditPlan }>(
        response,
        (diagnostics) => {
          if (current())
            setTeaserOperations((previous) => ({ ...previous, [partId]: { ...previous[partId], diagnostics } }));
        },
        planResult,
      );
      if (!response.ok || !result.plan) throw new Error(result.error || "Không chọn được teaser.");
      if (
        combined.aborted ||
        !current() ||
        requestIdentity !== latestPartHookIdentities.current[partId] ||
        subtitleSourceRef.current !== sourceId
      )
        throw new Error("Nguồn/main đã thay đổi. Chuẩn bị teaser lại.");
      const part = result.plan.parts.find((p) => p.id === partId);
      if (!part?.teaser) throw new Error("Provider không trả kết quả teaser cho part này.");
      if (part.teaser.status !== "selected")
        throw new Error(part.teaser.reason || "ChatGPT chưa trả teaser hợp lệ; bản đang dùng được giữ.");
      validateTeaser(part, source.duration);
      selected = true;
      return { teaser: part.teaser, captionTrack: result.plan.captionCues };
    } finally {
      sourceRequests.current.delete(controller);
      if (current()) {
        activeTeaserRequests.current.delete(partId);
        setTeaserOperations((previous) => ({
          ...previous,
          [partId]: {
            ...previous[partId],
            running: false,
            finishedAt: Date.now(),
            finishedStage: combined.aborted ? "cancelled" : selected ? "complete" : "error",
          },
        }));
      }
    }
  }
  return { invalidateAnalysis, analyze, resolveCustomTeaser };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useAutoAnalysisActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const invalidateAnalysis = useCallback(
    (...args: Parameters<ReturnType<typeof createAutoAnalysisActions>["invalidateAnalysis"]>) =>
      createAutoAnalysisActions(readerRef.current).invalidateAnalysis(...args),
    [],
  );
  const analyze = useCallback(
    (...args: Parameters<ReturnType<typeof createAutoAnalysisActions>["analyze"]>) =>
      createAutoAnalysisActions(readerRef.current).analyze(...args),
    [],
  );
  const resolveCustomTeaser = useCallback(
    (...args: Parameters<ReturnType<typeof createAutoAnalysisActions>["resolveCustomTeaser"]>) =>
      createAutoAnalysisActions(readerRef.current).resolveCustomTeaser(...args),
    [],
  );
  return useMemo(
    () => ({ invalidateAnalysis, analyze, resolveCustomTeaser }),
    [invalidateAnalysis, analyze, resolveCustomTeaser],
  );
}
