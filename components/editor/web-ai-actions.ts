"use client";
import { readAiOperation } from "@/lib/ai-progress";
import { contextResult } from "@/lib/ai-response";
import { workerFetch, type RenderJob, type WebAiContext, type WorkerSource } from "@/lib/api/worker-client";
import { lockedParts } from "@/lib/auto-cut/locks.mjs";
import { AiProvider, EDIT_PLAN_SCHEMA, EditPlan, normalizePlan } from "@/lib/edit-plan";
import { webAiEditorSignature } from "@/lib/editor-identity";
import { captureAiMainRanges } from "@/lib/main-ranges.mjs";
import { WEB_AI_PROMPT_VERSION, buildMusePrompt, parseMusePlan } from "@/lib/muse-plan.mjs";
import { effectiveCaptionTrack, type CaptionTrack } from "@/lib/subtitles.mjs";
import { effectiveCutPlan } from "@/worker/part-start.mjs";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
type State = {
  analysisRequests: RefObject<{
    begin(): { serial: number; controller: AbortController };
    invalidate(): void;
    isCurrent(ticket: { serial: number; controller: AbortController }): boolean;
    finish(ticket: { serial: number; controller: AbortController }): void;
  }>;
  currentWebRevision: RefObject<string>;
  effectiveTiming: { plan: EditPlan; error: string };
  hasEditPlan: boolean;
  hookIdentity: string;
  invalidateAnalysis: () => void;
  isAnalyzing: boolean;
  isPreparingSource: boolean;
  isWebAi: boolean;
  lastTxtDownloadClick: RefObject<number>;
  latestHookIdentity: RefObject<string>;
  latestMainSignature: RefObject<string>;
  prepareSource: (signal?: AbortSignal) => Promise<WorkerSource | null>;
  preparedSource: WorkerSource | null;
  previewPlan: EditPlan;
  provider: AiProvider;
  replacePlan: (next: EditPlan) => void;
  setActivePartIndex: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string>>;
  setHasEditPlan: Dispatch<SetStateAction<boolean>>;
  setInstruction: Dispatch<SetStateAction<string>>;
  setIsAnalyzing: Dispatch<SetStateAction<boolean>>;
  setProvider: Dispatch<SetStateAction<AiProvider>>;
  setRenderJob: Dispatch<SetStateAction<RenderJob | null>>;
  setSupplementalPrompt: Dispatch<SetStateAction<string>>;
  setTxtDownloadTask: Dispatch<
    SetStateAction<{ revision: string; startedAt: number; state: "running" | "done" | "error" | "cancelled" } | null>
  >;
  setWebAiContext: Dispatch<SetStateAction<WebAiContext | null>>;
  setWebAiError: Dispatch<SetStateAction<string>>;
  setWebAiNotice: Dispatch<SetStateAction<string>>;
  setWebAiPhase: Dispatch<SetStateAction<"prompt" | "import" | null>>;
  setWebAiPreparationLabel: Dispatch<SetStateAction<string>>;
  setWebAiPrompt: Dispatch<SetStateAction<string>>;
  setWebAiStartedAt: Dispatch<SetStateAction<number>>;
  sourceCaptions: CaptionTrack | null;
  sourceSelectionEpoch: RefObject<number>;
  transcript: string;
  txtDownloadPending: RefObject<boolean>;
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
  webAiName: "Gemini" | "ChatGPT" | "Muse";
  webAiPending: RefObject<boolean>;
  webAiPrompt: string;
  webAiPromptIsCurrent: boolean;
  webAiResult: string;
  instruction: string;
  supplementalPrompt: string;
};
/** Pure action factory. State is read only when an action is invoked, after render. */
export function createWebAiActions(read: () => State) {
  function changeProvider(value: string) {
    const { invalidateAnalysis, setError, setProvider } = read();

    invalidateAnalysis();
    setProvider(value as AiProvider);
    setError("");
  }
  function editSupplementalPrompt(value: string) {
    const { invalidateAnalysis, setInstruction, setSupplementalPrompt } = read();

    invalidateAnalysis();
    setInstruction("");
    setSupplementalPrompt(value);
  }
  async function createWebAiPrompt(throwOnError = false) {
    const { provider, instruction, supplementalPrompt } = read();

    const {
      analysisRequests,
      currentWebRevision,
      effectiveTiming,
      hasEditPlan,
      isWebAi,
      latestMainSignature,
      prepareSource,
      preparedSource,
      previewPlan,
      setIsAnalyzing,
      setWebAiContext,
      setWebAiError,
      setWebAiNotice,
      setWebAiPhase,
      setWebAiPreparationLabel,
      setWebAiPrompt,
      setWebAiStartedAt,
      sourceCaptions,
      sourceSelectionEpoch,
      transcript,
      webAiName,
      webAiPending,
    } = read();

    const requestedRevision = currentWebRevision.current;
    const selectionEpoch = sourceSelectionEpoch.current;
    if (!isWebAi || webAiPending.current) {
      if (throwOnError) throw Error("Đang có tác vụ chuẩn bị khác.");
      return;
    }
    if (effectiveTiming.error) {
      if (throwOnError) throw Error(effectiveTiming.error);
      setWebAiError(effectiveTiming.error);
      return;
    }
    const ticket = analysisRequests.current.begin();
    webAiPending.current = true;
    setWebAiPhase("prompt");
    setWebAiStartedAt(Date.now());
    setWebAiPreparationLabel("Chuẩn bị dữ liệu prompt");
    const signal = ticket.controller.signal;
    setWebAiError("");
    setWebAiNotice("");
    setIsAnalyzing(true);
    try {
      const source = preparedSource || (await prepareSource(signal));
      if (!source || selectionEpoch !== sourceSelectionEpoch.current) return;
      const content = preparedSource ? transcript : source.transcript || transcript;

      const requestId = crypto.randomUUID();
      const lockedPlan = hasEditPlan ? structuredClone(previewPlan) : undefined;
      const requestedMainSignature = latestMainSignature.current;
      const response = await workerFetch(`/api/sources/${source.id}/auto-cut`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "context",
          progress: true,
          requestId,
          provider,
          transcript: content,
          instruction,
          supplementalPrompt,
          currentPlan: lockedPlan,
          ...(sourceCaptions?.sourceId === source.id ? { captionCues: sourceCaptions } : {}),
        }),
      });
      const data = await readAiOperation<{
        context?: {
          analysisKey: string;
          captionTrack?: CaptionTrack;
          attachments?: { sourceVideo: NonNullable<WebAiContext["media"]> };
        } & Record<string, unknown>;
      }>(
        response,
        (diagnostics) => {
          if (!analysisRequests.current.isCurrent(ticket) || currentWebRevision.current !== requestedRevision) return;
          const labels: Record<string, string> = {
            "source-context": "Thu thập metadata, replay và bình luận",
            "local-signals": "Chuẩn bị tín hiệu nguồn",
            "source-captions": "Chuẩn bị phụ đề nguồn",
            "web-video-manifest": "Kiểm tra định danh video",
            "main-candidates": "Sắp xếp dữ liệu nội dung",
            "prompt-context": "Đóng gói dữ liệu prompt",
          };
          const pending = new Set<string>();
          let latest: string | undefined;
          for (const event of diagnostics.events)
            if (event.reason && labels[event.reason]) {
              latest = event.reason;
              if (event.durationMs === undefined) pending.add(event.reason);
              else pending.delete(event.reason);
            }
          setWebAiPreparationLabel(
            pending.size > 1
              ? "Thu thập dữ liệu và tín hiệu nguồn"
              : labels[[...pending][0] || latest || ""] || "Chuẩn bị dữ liệu prompt",
          );
        },
        contextResult,
      );
      if (!response.ok || !data.context) throw new Error(data.error || "Không chuẩn bị được context/candidates.");
      const prepared = data.context;
      signal.throwIfAborted();
      if (!analysisRequests.current.isCurrent(ticket) || currentWebRevision.current !== requestedRevision)
        throw Error("Dữ liệu đã đổi; đã dừng chuẩn bị lượt cũ.");
      if (latestMainSignature.current !== requestedMainSignature)
        throw Error("Main hoặc phụ đề đã đổi trong lúc tạo prompt. Tạo lại prompt cho bản hiện tại.");
      setWebAiPreparationLabel("Tạo tệp TXT");
      const prompt = buildMusePrompt("", EDIT_PLAN_SCHEMA, source, {
        requestId,
        analysisKey: prepared.analysisKey,
        context: prepared,
      });
      const context: WebAiContext = {
        sourceId: source.id,
        transcript: content,
        instruction,
        supplementalPrompt,
        provider,
        requestId,
        analysisKey: prepared.analysisKey,
        lockedPlan,
        mainSignature: requestedMainSignature,
        promptVersion: WEB_AI_PROMPT_VERSION,
        captionTrack: prepared.captionTrack,
        media: prepared.attachments?.sourceVideo,
      };
      setWebAiPrompt(prompt);
      setWebAiContext(context);
      // Do not erase a manually entered JSON draft while preparing a new run.
      if (!throwOnError) setWebAiNotice("Đã tạo prompt.");
      return { prompt, context };
    } catch (caughtError) {
      if (throwOnError) throw caughtError;
      if (analysisRequests.current.isCurrent(ticket) && selectionEpoch === sourceSelectionEpoch.current)
        setWebAiError(caughtError instanceof Error ? caughtError.message : `Không tạo được prompt ${webAiName}.`);
    } finally {
      if (analysisRequests.current.isCurrent(ticket)) {
        webAiPending.current = false;
        setWebAiPhase(null);
        setIsAnalyzing(false);
        analysisRequests.current.finish(ticket);
      }
    }
  }
  async function applyWebAiResult() {
    const {
      analysisRequests,
      currentWebRevision,
      hookIdentity,
      latestHookIdentity,
      preparedSource,
      previewPlan,
      provider,
      replacePlan,
      setActivePartIndex,
      setError,
      setHasEditPlan,
      setIsAnalyzing,
      setRenderJob,
      setWebAiContext,
      setWebAiError,
      setWebAiNotice,
      setWebAiPhase,
      setWebAiStartedAt,
      sourceCaptions,
      sourceSelectionEpoch,
      webAiContext,
      webAiContextIssue,
      webAiName,
      webAiPending,
      webAiPromptIsCurrent,
      webAiResult,
    } = read();

    if (webAiPending.current) return;
    webAiPending.current = true;
    setWebAiPhase("import");
    setWebAiStartedAt(Date.now());
    const selectionEpoch = sourceSelectionEpoch.current;
    const ticket = analysisRequests.current.begin();
    const signal = ticket.controller.signal;
    setWebAiError("");
    setWebAiNotice("");
    setIsAnalyzing(true);
    try {
      if (!preparedSource) throw new Error("Chuẩn bị source của video trước khi nhập JSON.");
      const context = webAiContext;
      const raw = webAiResult;
      if (!context || !webAiPromptIsCurrent || context.sourceId !== preparedSource.id || context.provider !== provider)
        throw new Error(webAiContextIssue || "Source/provider không khớp lượt TXT hiện tại.");
      if (!context.media) throw Error("Thiếu định danh video nguồn của lượt phân tích.");
      const identity = hookIdentity;
      const revision = currentWebRevision.current;
      const imported = parseMusePlan(raw, preparedSource, webAiName, {
        requestId: context.requestId,
        analysisKey: context.analysisKey,
        lockedPlan: context.lockedPlan,
      });
      const normalized = normalizePlan(imported, provider);
      const refined = {
        ...normalized,
        parts: normalized.parts.map((p, i) => {
          const locked = context.lockedPlan && lockedParts(context.lockedPlan)[i];
          const previous = context.lockedPlan?.parts[i];
          return locked
            ? structuredClone(context.lockedPlan!.parts[i])
            : {
                ...p,
                smartCutApplied: true,
                ...(typeof previous?.teaserEnabled === "boolean" ? { teaserEnabled: previous.teaserEnabled } : {}),
                ...(previous?.teaserEnabled === false
                  ? { teaser: previous.teaser, customTeaser: previous.customTeaser }
                  : {}),
              };
        }),
      };
      const selections = imported.hookSelections || [];
      const importTrack = context.captionTrack || previewPlan.captionCues;
      let nextPlan: EditPlan = { ...refined, captionCues: importTrack };
      if (context.analysisKey) {
        const response = await workerFetch(`/api/sources/${preparedSource.id}/auto-cut`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "import",
            sourceId: preparedSource.id,
            requestId: context.requestId,
            analysisKey: context.analysisKey,
            provider: context.provider,
            transcript: context.transcript,
            instruction: context.instruction,
            supplementalPrompt: context.supplementalPrompt,
            currentPlan: context.lockedPlan,
            ...(context.captionTrack ? { captionCues: context.captionTrack } : {}),
            attachmentConfirmation: {
              attached: true,
              sourceId: preparedSource.id,
              requestId: context.requestId,
              analysisKey: context.analysisKey,
              mediaId: context.media.id,
              sourceKey: context.media.sourceKey,
              method: "manual-import",
            },
            hookSelections: selections,
            plan: nextPlan,
          }),
        });
        const data = (await response.json()) as { plan?: EditPlan; error?: string };
        if (!response.ok || !data.plan) throw new Error(data.error || "Import context đã thay đổi.");
        nextPlan = data.plan;
      }
      const verified = await workerFetch(`/api/sources/${preparedSource.id}/teaser-hooks`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "validate-import",
          plan: nextPlan,
          transcript: context.transcript,
          instruction: context.instruction,
          supplementalPrompt: context.supplementalPrompt,
        }),
      });
      const checked = (await verified.json()) as { plan?: EditPlan; error?: string };
      if (!verified.ok || !checked.plan) throw Error(checked.error || "Không xác nhận được hook import.");
      nextPlan = checked.plan;
      signal.throwIfAborted();
      if (currentWebRevision.current !== revision || latestHookIdentity.current !== identity)
        throw new Error("Nội dung/provider đã đổi trong lúc kiểm tra. Tạo prompt mới; kết quả cũ không được áp dụng.");
      if (!analysisRequests.current.isCurrent(ticket) || selectionEpoch !== sourceSelectionEpoch.current) {
        return;
      }

      // Preserve the original TXT snapshot/lockedPlan and its analysisKey.
      // Only a fully validated import may acknowledge the new Editor state;
      // another JSON from the same conversation can then revise that result.
      const installed = captureAiMainRanges(nextPlan);
      const effective = captureAiMainRanges({ ...installed, ...effectiveCutPlan(installed) });
      const captions = effectiveCaptionTrack(
        effective,
        preparedSource,
        sourceCaptions?.sourceId === preparedSource.id ? sourceCaptions : undefined,
      );
      const acceptedSignature = webAiEditorSignature(effective, captions?.cues || []);
      replacePlan(installed);
      setWebAiContext({ ...context, lastImportMainSignature: acceptedSignature });
      setHasEditPlan(true);
      setActivePartIndex(0);
      setRenderJob(null);
      setError("");
      setWebAiNotice(`Đã áp dụng 2 part từ ${webAiName}.`);
    } catch (caughtError) {
      if (analysisRequests.current.isCurrent(ticket) && selectionEpoch === sourceSelectionEpoch.current)
        setWebAiError(caughtError instanceof Error ? caughtError.message : `Không nhập được JSON ${webAiName}.`);
    } finally {
      if (analysisRequests.current.isCurrent(ticket)) {
        webAiPending.current = false;
        setWebAiPhase(null);
        setIsAnalyzing(false);
        analysisRequests.current.finish(ticket);
      }
    }
  }
  async function downloadWebAiPrompt() {
    const {
      currentWebRevision,
      isAnalyzing,
      isPreparingSource,
      lastTxtDownloadClick,
      setTxtDownloadTask,
      setWebAiError,
      setWebAiNotice,
      setWebAiPreparationLabel,
      txtDownloadPending,
      webAiContext,
      webAiPending,
      webAiPrompt,
      webAiPromptIsCurrent,
    } = read();

    const startedAt = Date.now();
    if (
      webAiPending.current ||
      isAnalyzing ||
      isPreparingSource ||
      txtDownloadPending.current ||
      startedAt - lastTxtDownloadClick.current < 800
    )
      return;
    const revision = currentWebRevision.current;
    txtDownloadPending.current = true;
    lastTxtDownloadClick.current = startedAt;
    setTxtDownloadTask({ revision, startedAt, state: "running" });
    setWebAiPreparationLabel("Tạo tệp TXT");
    setWebAiError("");
    setWebAiNotice("");
    try {
      // Old TXT versions remain valid for importing their existing JSON, but
      // a fresh download must not keep re-exporting the removed review gate.
      const prepared =
        webAiPromptIsCurrent && webAiContext?.promptVersion === WEB_AI_PROMPT_VERSION
          ? { prompt: webAiPrompt, context: webAiContext }
          : await createWebAiPrompt(true);
      if (!prepared || currentWebRevision.current !== revision) return;
      const url = URL.createObjectURL(new Blob([prepared.prompt], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `analysis-${prepared.context.requestId}.txt`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setTxtDownloadTask({ revision, startedAt, state: "done" });
    } catch (caught) {
      if (currentWebRevision.current !== revision || (caught instanceof DOMException && caught.name === "AbortError")) {
        setTxtDownloadTask((current) =>
          current?.startedAt === startedAt ? { ...current, state: "cancelled" } : current,
        );
        return;
      }
      setTxtDownloadTask({ revision, startedAt, state: "error" });
      setWebAiError(caught instanceof Error ? caught.message : "Không tạo được tệp TXT.");
    } finally {
      txtDownloadPending.current = false;
      setTxtDownloadTask((current) =>
        current?.startedAt === startedAt && current.state === "running" ? { ...current, state: "cancelled" } : current,
      );
    }
  }
  return { changeProvider, editSupplementalPrompt, createWebAiPrompt, applyWebAiResult, downloadWebAiPrompt };
}

/** Event handlers read the latest committed reader, never refs during render. */
export function useWebAiActions(read: () => State) {
  const readerRef = useRef(read);
  useLayoutEffect(() => {
    readerRef.current = read;
  }, [read]);
  const changeProvider = useCallback(
    (...args: Parameters<ReturnType<typeof createWebAiActions>["changeProvider"]>) =>
      createWebAiActions(readerRef.current).changeProvider(...args),
    [],
  );
  const editSupplementalPrompt = useCallback(
    (...args: Parameters<ReturnType<typeof createWebAiActions>["editSupplementalPrompt"]>) =>
      createWebAiActions(readerRef.current).editSupplementalPrompt(...args),
    [],
  );
  const createWebAiPrompt = useCallback(
    (...args: Parameters<ReturnType<typeof createWebAiActions>["createWebAiPrompt"]>) =>
      createWebAiActions(readerRef.current).createWebAiPrompt(...args),
    [],
  );
  const applyWebAiResult = useCallback(
    (...args: Parameters<ReturnType<typeof createWebAiActions>["applyWebAiResult"]>) =>
      createWebAiActions(readerRef.current).applyWebAiResult(...args),
    [],
  );
  const downloadWebAiPrompt = useCallback(
    (...args: Parameters<ReturnType<typeof createWebAiActions>["downloadWebAiPrompt"]>) =>
      createWebAiActions(readerRef.current).downloadWebAiPrompt(...args),
    [],
  );
  return useMemo(
    () => ({ changeProvider, editSupplementalPrompt, createWebAiPrompt, applyWebAiResult, downloadWebAiPrompt }),
    [changeProvider, editSupplementalPrompt, createWebAiPrompt, applyWebAiResult, downloadWebAiPrompt],
  );
}
