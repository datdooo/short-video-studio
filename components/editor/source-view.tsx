"use client";

import { Disclosure, DisclosureTrigger } from "@/components/ui/disclosure";

import { AiOperationStatus } from "@/components/ai-operation-status";
import { ManualVideoDownload } from "@/components/manual-video-download";
import { SourceOptionsSection } from "@/components/source-options-section";
import { TaskProgress } from "@/components/task-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type AiDiagnostics } from "@/lib/ai-progress";
import {
  WORKER_ORIGIN,
  sourcePreparationLabel,
  type ChatGPTSession,
  type SourcePreparationProgress,
  type WebAiContext,
  type WorkerHealth,
  type WorkerSource,
} from "@/lib/api/worker-client";
import { AiProvider, EditPlan, formatTime } from "@/lib/edit-plan";
import { explainInVietnamese } from "@/lib/explanation-language.mjs";
import { UI_STRINGS } from "@/lib/ui-strings";
import { Check, Download, Link2, Loader2, LogIn, Scissors, Sparkles, Square, Upload, WandSparkles } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { ChangeEvent } from "react";

type Props = {
  onEditTranscript: (value: string) => void;
  activeAnalysis: RefObject<AbortController | null>;
  analysisDiagnostics: AiDiagnostics | null;
  analysisFinishedAt: number;
  analysisFinishedStage: "error" | "complete" | "cancelled";
  analysisNotice: string;
  analysisStartedAt: number;
  analyze: () => Promise<void>;
  applyManualPlan: () => void;
  applyWebAiResult: () => Promise<void>;
  batchEditing: { batchId: string; itemId: string; sourceId: string } | null;
  changeProvider: (value: string) => void;
  chatGPTSession: ChatGPTSession | null;
  connectChatGPT: () => Promise<void>;
  disconnectChatGPT: () => Promise<void>;
  downloadWebAiPrompt: () => Promise<void>;
  editMode: "manual" | "ai";
  editSupplementalPrompt: (value: string) => void;
  effectiveTiming: { plan: EditPlan; error: string };
  error: string;
  handleVideoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  hasEditPlan: boolean;
  invalidateAnalysis: () => void;
  isAnalyzing: boolean;
  isChatGPTConnecting: boolean;
  isChatGPTDisconnecting: boolean;
  isPreparingSource: boolean;
  isStartingRender: boolean;
  isWebAi: boolean;
  localFile: File | null;
  localFileName: string;
  manualPart1Ranges: string;
  manualPart1Title: string;
  manualPart2Ranges: string;
  manualPart2Title: string;
  preparedSource: WorkerSource | null;
  prepareSource: (signal?: AbortSignal) => Promise<WorkerSource | null>;
  previewPlan: EditPlan;
  provider: AiProvider;
  queueEditedBatchItem: () => Promise<void>;
  resetSourceSelection: () => void;
  setAnalysisNotice: Dispatch<SetStateAction<string>>;
  setEditMode: Dispatch<SetStateAction<"manual" | "ai">>;
  setError: Dispatch<SetStateAction<string>>;
  setManualPart1Ranges: Dispatch<SetStateAction<string>>;
  setManualPart1Title: Dispatch<SetStateAction<string>>;
  setManualPart2Ranges: Dispatch<SetStateAction<string>>;
  setManualPart2Title: Dispatch<SetStateAction<string>>;
  setSourceAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setSourceMode: Dispatch<SetStateAction<"youtube" | "local">>;
  setSourceTitle: Dispatch<SetStateAction<string>>;
  setSourceUrl: Dispatch<SetStateAction<string>>;
  setWebAiResult: Dispatch<SetStateAction<string>>;
  sourceAdvancedOpen: boolean;
  sourceMode: "youtube" | "local";
  sourcePreparation: RefObject<AbortController | null>;
  sourcePreparationProgress: SourcePreparationProgress | null;
  sourcePreparationStartedAt: number;
  sourceTitle: string;
  sourceUrl: string;
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
  transcript: string;
  transcriptStatus: string;
  txtDownloadTask: { revision: string; startedAt: number; state: "running" | "done" | "error" | "cancelled" } | null;
  visibleSupplementalPrompt: string;
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
  workerHealth: WorkerHealth | null;
  youtubeError: string;
  youtubeState: "error" | "idle" | "loading" | "ready";
};
export function SourceView({ model }: { model: Props }) {
  const {
    onEditTranscript,
    activeAnalysis,
    analysisDiagnostics,
    analysisFinishedAt,
    analysisFinishedStage,
    analysisNotice,
    analysisStartedAt,
    analyze,
    applyManualPlan,
    applyWebAiResult,
    batchEditing,
    changeProvider,
    chatGPTSession,
    connectChatGPT,
    disconnectChatGPT,
    downloadWebAiPrompt,
    editMode,
    editSupplementalPrompt,
    effectiveTiming,
    error,
    handleVideoUpload,
    hasEditPlan,
    invalidateAnalysis,
    isAnalyzing,
    isChatGPTConnecting,
    isChatGPTDisconnecting,
    isPreparingSource,
    isStartingRender,
    isWebAi,
    localFile,
    localFileName,
    manualPart1Ranges,
    manualPart1Title,
    manualPart2Ranges,
    manualPart2Title,
    preparedSource,
    prepareSource,
    previewPlan,
    provider,
    queueEditedBatchItem,
    resetSourceSelection,
    setAnalysisNotice,
    setEditMode,
    setError,
    setManualPart1Ranges,
    setManualPart1Title,
    setManualPart2Ranges,
    setManualPart2Title,
    setSourceAdvancedOpen,
    setSourceMode,
    setSourceTitle,
    setSourceUrl,
    setWebAiResult,
    sourceAdvancedOpen,
    sourceMode,
    sourcePreparation,
    sourcePreparationProgress,
    sourcePreparationStartedAt,
    sourceTitle,
    sourceUrl,
    teaserIssues,
    teaserOperations,
    transcript,
    transcriptStatus,
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
    youtubeError,
    youtubeState,
  } = model;

  const txtDisabledReason = !preparedSource
    ? "Chuẩn bị nguồn trước khi tải TXT."
    : !workerHealth?.ok
      ? "Chờ worker kết nối để tải TXT."
      : effectiveTiming.error ||
        (isAnalyzing || isPreparingSource || Object.values(teaserOperations).some((operation) => operation.running)
          ? "Chờ hoặc dừng tác vụ đang xử lý trước khi tải TXT."
          : "");
  return (
    <>
      <Tabs
        value={sourceMode}
        onValueChange={(value) => {
          resetSourceSelection();
          setSourceMode(value as "youtube" | "local");
        }}
        className="mt-4"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
          <TabsTrigger value="youtube" className="min-w-0 rounded-lg text-xs">
            YouTube
          </TabsTrigger>
          <TabsTrigger value="local" className="min-w-0 rounded-lg text-xs">
            {UI_STRINGS.localVideo}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="youtube" className="pt-3">
          <label htmlFor="youtube-url" className="field-label">
            {UI_STRINGS.sourceUrl}
          </label>
          <div className="relative mt-2">
            <Link2
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
            />
            <Input
              id="youtube-url"
              value={sourceUrl}
              onChange={(event) => {
                resetSourceSelection();
                setSourceUrl(event.target.value);
              }}
              placeholder="youtube.com/watch?v=..."
              className="studio-input studio-icon-input pl-10"
            />
          </div>
        </TabsContent>
        <TabsContent value="local" className="pt-3">
          <label className="flex h-[84px] cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[.02] text-sm text-zinc-400 transition hover:border-primary/40 hover:bg-primary/5 hover:text-white">
            <Upload className="size-4" />
            <span className="max-w-[220px] truncate">{localFileName || "Chọn MP4, MOV hoặc WebM"}</span>
            <input
              aria-label="Chọn video từ máy"
              className="sr-only"
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
            />
          </label>
        </TabsContent>
      </Tabs>
      <Button variant="primary" size="md"
        type="button"
        onClick={() => void prepareSource()}
        disabled={
          isPreparingSource ||
          !workerHealth?.ok ||
          (!preparedSource && (sourceMode === "youtube" ? !sourceUrl.trim() : !localFile))
        }
        className={`studio-primary w-full${preparedSource && !isPreparingSource ? " studio-source-ready" : ""}`}
        aria-busy={isPreparingSource}
      >
        {isPreparingSource ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>
              {sourcePreparationLabel(
                sourcePreparationProgress ? { ...sourcePreparationProgress, percent: null } : null,
              )}
            </span>
          </>
        ) : preparedSource ? (
          <>
            <Check size={14} />
            Nguồn sẵn sàng
          </>
        ) : (
          <>
            <Download size={14} />
            Chuẩn bị nguồn
          </>
        )}
      </Button>
      {sourceMode === "youtube" && (youtubeState === "loading" || youtubeState === "error") && (
        <p className="text-xs leading-5 text-zinc-600 break-words" role="status">
          {youtubeState === "loading" && "Đang lấy title gốc từ YouTube…"}
          {youtubeState === "error" && youtubeError}
        </p>
      )}
      {isPreparingSource && (
        <>
          <TaskProgress
            label={sourcePreparationLabel(
              sourcePreparationProgress ? { ...sourcePreparationProgress, percent: null } : null,
            )}
            startedAt={sourcePreparationStartedAt}
            percent={sourcePreparationProgress?.percent}
            estimated={sourcePreparationProgress?.estimated}
            detail={
              sourcePreparationProgress?.downloadedBytes !== undefined
                ? `${(sourcePreparationProgress.downloadedBytes / 1048576).toFixed(1)}${sourcePreparationProgress.totalBytes ? ` / ${(sourcePreparationProgress.totalBytes / 1048576).toFixed(1)}` : ""} MiB${sourcePreparationProgress.bytesPerSecond ? ` · ${(sourcePreparationProgress.bytesPerSecond / 1048576).toFixed(1)} MiB/s` : ""}${sourcePreparationProgress.etaSeconds !== undefined ? ` · còn khoảng ${Math.ceil(sourcePreparationProgress.etaSeconds)}s của bước tải` : ""}`
                : undefined
            }
          />
          <Button variant="ghost" size="md"
            type="button"
            className="studio-ghost"
            onClick={() => {
              sourcePreparation.current?.abort(new DOMException("Đã dừng chuẩn bị nguồn", "AbortError"));
              setError("Đã dừng chuẩn bị nguồn.");
            }}
          >
            Dừng chuẩn bị
          </Button>
        </>
      )}
      {preparedSource ? (
        <div className="studio-source-status">
          <span>
            {formatTime(preparedSource.duration)} · {preparedSource.width}×{preparedSource.height}
          </span>
        </div>
      ) : (
        <p className="studio-muted text-xs">{isPreparingSource ? "" : localFileName || "Chưa có nguồn"}</p>
      )}
      <div className="mt-1">
        <div className="flex items-center justify-between">
          <label htmlFor="source-title" className="field-label">
            Tiêu đề gốc
          </label>
          {sourceMode === "youtube" && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              {youtubeState === "loading" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : youtubeState === "ready" ? (
                <Check className="size-3 text-emerald-400" />
              ) : null}
              Từ YouTube
            </span>
          )}
        </div>
        <Input
          id="source-title"
          value={sourceTitle}
          readOnly={sourceMode === "youtube"}
          onChange={(event) => setSourceTitle(event.target.value)}
          className="studio-input mt-2 read-only:cursor-default read-only:text-zinc-400"
        />
      </div>

      <div>
        <label htmlFor="extra-prompt" className="field-label">
          Yêu cầu bổ sung
        </label>
        <Textarea
          id="extra-prompt"
          value={visibleSupplementalPrompt}
          onChange={(event) => editSupplementalPrompt(event.target.value)}
          className="studio-textarea mt-2 min-h-[80px]"
          placeholder="Ví dụ: Bỏ đoạn đầu, tập trung cảnh sửa xe, Part 2 ưu tiên cảnh chạy thử."
        />
      </div>
      {editMode === "ai" && (
        <>
          <div className="studio-source-provider">
            <label htmlFor="editor-ai-provider" className="field-label">
              Chọn AI
            </label>
            <Select value={provider} onValueChange={changeProvider}>
              <SelectTrigger id="editor-ai-provider" aria-label="Chọn AI" className="studio-input mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="chatgpt">ChatGPT Auto · Sol low</SelectItem>
                <SelectItem value="chatgpt-web">ChatGPT</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="muse">Muse</SelectItem>
                {provider === "mock" && <SelectItem value="mock">Mô phỏng cũ · không AI</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {editMode === "ai" && isWebAi ? (
        <section aria-label={`Phân tích thủ công bằng ${webAiName}`} className="studio-web-ai-panel">
          <div className="studio-web-ai-actions">
            <div className="studio-web-download-control">
              <Button
                type="button"
                size="md"
                onClick={() => void downloadWebAiPrompt()}
                disabled={
                  isAnalyzing ||
                  Object.values(teaserOperations).some((operation) => operation.running) ||
                  isPreparingSource ||
                  !workerHealth?.ok ||
                  !preparedSource ||
                  Boolean(effectiveTiming.error)
                }
                aria-describedby={txtDisabledReason ? "web-txt-disabled-reason" : undefined}
                aria-busy={webAiPhase === "prompt"}
              >
                {webAiPhase === "prompt" ? <Loader2 className="animate-spin" /> : <Download />}Tải TXT
              </Button>
              {txtDisabledReason && (
                <p id="web-txt-disabled-reason" className="studio-muted text-xs">
                  {txtDisabledReason}
                </p>
              )}
              {txtDownloadTask?.revision === webFlowRevision && (
                <TaskProgress
                  compact
                  indeterminate
                  state={txtDownloadTask.state}
                  label={
                    txtDownloadTask.state === "running"
                      ? webAiPreparationLabel
                      : txtDownloadTask.state === "done"
                        ? "Đã tạo TXT cho trình duyệt"
                        : txtDownloadTask.state === "cancelled"
                          ? "Đã dừng tạo TXT"
                          : "Chưa tạo được TXT"
                  }
                  startedAt={txtDownloadTask.startedAt}
                  detail={txtDownloadTask.state === "done" ? "Trình duyệt quản lý bước lưu tệp." : undefined}
                />
              )}
              {webAiPhase === "prompt" && (
                <Button type="button" variant="ghost" size="sm" onClick={() => invalidateAnalysis()}>
                  <Square />
                  Dừng tạo TXT
                </Button>
              )}
            </div>
            <ManualVideoDownload
              key={preparedSource?.id || "no-source"}
              worker={WORKER_ORIGIN}
              sourceId={preparedSource?.id || ""}
              sourceKey={webAiPromptIsCurrent ? webAiContext?.media?.sourceKey : undefined}
              variantKey={webAiPromptIsCurrent ? webAiContext?.media?.variantKey : undefined}
              disabled={!preparedSource || !workerHealth?.ok || isPreparingSource}
            />
          </div>
          <p className="studio-muted text-xs">Gửi TXT + video cho AI, rồi dán JSON bên dưới.</p>
          {webAiPrompt && webAiPromptIsCurrent && (
            <p className="studio-muted text-xs">
              TXT · {(new TextEncoder().encode(webAiPrompt).byteLength / 1024).toFixed(1)} KiB
              {webAiPrompt.length > 100000 ? " · Tệp lớn; nơi nhận có thể giới hạn dung lượng." : ""}
            </p>
          )}
          {webAiPrompt && !webAiPromptIsCurrent && (
            <p role="status" className="text-xs text-amber-200">
              {webAiContextIssue}
            </p>
          )}
          <label htmlFor="web-ai-result" className="field-label block">
            JSON kết quả
          </label>
          <Textarea
            id="web-ai-result"
            value={webAiResult}
            onChange={(event) => setWebAiResult(event.target.value)}
            placeholder="Dán JSON kết quả…"
            className="studio-textarea studio-web-json font-mono"
          />
          <Button
            type="button"
            size="md"
            onClick={() => void applyWebAiResult()}
            disabled={
              !preparedSource || !webAiPromptIsCurrent || !webAiResult.trim() || isAnalyzing || isPreparingSource
            }
            aria-describedby={
              !preparedSource || !webAiPromptIsCurrent || !webAiResult.trim() || isAnalyzing || isPreparingSource
                ? "web-apply-reason"
                : undefined
            }
            className="w-full"
          >
            <Check />
            Áp dụng 2 part
          </Button>
          {(!preparedSource || !webAiPromptIsCurrent || !webAiResult.trim() || isAnalyzing || isPreparingSource) && (
            <p id="web-apply-reason" className="studio-muted text-xs">
              {isAnalyzing || isPreparingSource
                ? "Chờ tác vụ hiện tại hoàn tất."
                : !preparedSource
                  ? "Chuẩn bị nguồn trước."
                  : !webAiPromptIsCurrent
                    ? "Tải TXT hiện tại trước khi nhập kết quả."
                    : "Dán JSON kết quả để áp dụng."}
            </p>
          )}
          {webAiError && (
            <p role="alert" className="break-words text-xs text-red-300">
              {webAiError}
            </p>
          )}
          {webAiNotice && (
            <p role="status" className="text-xs text-emerald-300">
              {webAiNotice}
            </p>
          )}
        </section>
      ) : null}
      {!(editMode === "ai" && isWebAi) && (
        <Button variant="primary" size="md"
          type="button"
          className="studio-primary w-full"
          disabled={
            isAnalyzing ||
            Object.values(teaserOperations).some((operation) => operation.running) ||
            isPreparingSource ||
            !workerHealth?.ok ||
            !preparedSource ||
            (editMode === "manual" && hasEditPlan)
          }
          onClick={() => {
            if (editMode === "manual") applyManualPlan();
            else if (isWebAi) void downloadWebAiPrompt();
            else void analyze();
          }}
        >
          {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <WandSparkles size={14} />}{" "}
          {isAnalyzing
            ? "Đang phân tích…"
            : editMode === "manual"
              ? "Áp dụng main thủ công"
              : isWebAi
                ? `Tạo prompt ${webAiName}`
                : "Phân tích"}
        </Button>
      )}
      {isAnalyzing && webAiPhase !== "prompt" && (
        <Button
          variant="secondary"
          onClick={() => {
            invalidateAnalysis();
            setAnalysisNotice("Đã dừng phân tích; giữ plan hiện tại.");
          }}
        >
          Dừng phân tích
        </Button>
      )}
      {error && (
        <p role="alert" className="studio-inline-error">
          {error}
        </p>
      )}
      {analysisNotice && (
        <p role="status" className="studio-inline-notice">
          {analysisNotice}
        </p>
      )}
      {isWebAi ? (
        webAiPhase === "import" ? (
          <TaskProgress indeterminate label="Kiểm tra và lưu JSON" startedAt={webAiStartedAt} />
        ) : null
      ) : (
        <AiOperationStatus
          diagnostics={analysisDiagnostics}
          startedAt={analysisStartedAt}
          running={isAnalyzing && Boolean(activeAnalysis.current)}
          finishedAt={analysisFinishedAt}
          finishedStage={analysisFinishedStage}
        />
      )}
      <SourceOptionsSection
        id="source-advanced"
        label="Nâng cao"
        open={sourceAdvancedOpen}
        onOpenChange={setSourceAdvancedOpen}
        className="studio-advanced"
      >
        <Tabs
          value={editMode}
          onValueChange={(value) => {
            setEditMode(value as "ai" | "manual");
            setError("");
          }}
          className="mt-5"
        >
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
            <TabsTrigger value="ai" className="rounded-lg text-xs">
              <Sparkles /> Cắt bằng AI
            </TabsTrigger>
            <TabsTrigger value="manual" className="rounded-lg text-xs">
              <Scissors /> Cắt thủ công
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4 pt-4">
            {provider === "chatgpt" && (
              <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <span
                        className={`size-2 rounded-full ${chatGPTSession?.sharing ? "bg-emerald-400 shadow-[0_0_10px_var(--provider-glow)]" : "bg-zinc-700"}`}
                      />
                      {chatGPTSession?.sharing ? "ChatGPT plan connected" : "Connect your ChatGPT plan"}
                    </p>
                    <p className="mt-1 truncate text-xs leading-4 text-zinc-500">
                      {chatGPTSession?.connected
                        ? chatGPTSession.email || chatGPTSession.name || "Connected account"
                        : "Chưa đăng nhập"}
                    </p>
                  </div>
                  {chatGPTSession?.connected && (
                    <Button variant="destructive" size="md"
                      type="button"
                      disabled={isChatGPTConnecting || isChatGPTDisconnecting}
                      onClick={() => void disconnectChatGPT()}
                      className="shrink-0 text-xs text-zinc-600 transition hover:text-zinc-300 disabled:opacity-50"
                    >
                      {isChatGPTDisconnecting ? "Đang ngắt…" : "Disconnect"}
                    </Button>
                  )}
                </div>
                <Button
                  variant={chatGPTSession?.sharing ? "secondary" : "primary"}
                  onClick={() => void connectChatGPT()}
                  disabled={isChatGPTConnecting || isChatGPTDisconnecting || !workerHealth?.chatGPTAuthAvailable}
                  className={`mt-3 h-10 w-full rounded-xl text-xs font-bold ${chatGPTSession?.sharing ? "border-white/10 bg-white/[.03] text-zinc-200 hover:bg-white/[.07]" : "bg-white text-black hover:bg-zinc-200"}`}
                >
                  {isChatGPTConnecting ? (
                    <>
                      <Loader2 className="animate-spin" /> Waiting for ChatGPT…
                    </>
                  ) : chatGPTSession?.sharing ? (
                    <>
                      <LogIn /> Reconnect ChatGPT
                    </>
                  ) : (
                    <>
                      <LogIn /> Continue with ChatGPT
                    </>
                  )}
                </Button>
                {chatGPTSession?.error && (
                  <p role="status" className="mt-2 text-xs text-amber-300">
                    {chatGPTSession.error}
                  </p>
                )}
              </div>
            )}
            <Disclosure className="rounded-xl border border-white/8 p-3">
              <DisclosureTrigger className="cursor-pointer text-xs font-semibold text-zinc-300">
                Transcript · {transcript.length.toLocaleString()} ký tự · xem / sửa
              </DisclosureTrigger>
              <div className="mt-3 flex items-center justify-between">
                <label htmlFor="transcript" className="field-label">
                  Transcript
                </label>
                <span className="text-xs text-zinc-600">{transcript.length.toLocaleString()} chars</span>
              </div>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(event) => onEditTranscript(event.target.value)}
                className="studio-textarea studio-transcript mt-2 font-mono text-[12px] leading-5"
                placeholder="00:00 Transcript..."
              />
              <p className="mt-2 text-xs leading-5 text-zinc-500">{transcriptStatus}</p>
            </Disclosure>

            {batchEditing && preparedSource?.id === batchEditing.sourceId && hasEditPlan && (
              <Button
                variant="secondary"
                disabled={
                  isAnalyzing || isStartingRender || Boolean(effectiveTiming.error) || Boolean(teaserIssues.length)
                }
                onClick={() => void queueEditedBatchItem()}
                className="w-full text-xs"
              >
                Lưu plan đã duyệt & tiếp tục item này
              </Button>
            )}

            {previewPlan.analysis && (
              <Disclosure className="rounded-xl border border-white/10 p-3 text-xs">
                <DisclosureTrigger className="cursor-pointer">
                  Lý do chọn ·{" "}
                  {previewPlan.analysis.method === "ai"
                    ? "AI"
                    : previewPlan.analysis.method === "deterministic-fallback"
                      ? "Dự phòng"
                      : "Nhập/đã lưu"}{" "}
                  · {previewPlan.analysis.provider}
                </DisclosureTrigger>
                {previewPlan.analysis.parts.map((p) => (
                  <div key={p.id} className="mt-2">
                    <strong>Part {p.id}</strong>
                    <p>{explainInVietnamese(p.reason)}</p>
                    <p className="text-zinc-400">
                      {Object.entries(p.signals)
                        .map(
                          ([name, s]) =>
                            `${({ transcript: "Lời thoại", replay: "Replay tương đối", comments: "Bình luận", chapters: "Chương", visual: "Hình ảnh", audio: "Âm thanh" } as Record<string, string>)[name] || "Tín hiệu hỗ trợ"}: ${s.contribution.toFixed(3)}`,
                        )
                        .join(" · ") ||
                        (previewPlan.analysis?.method === "ai"
                          ? "AI chọn theo nội dung; không gán điểm heuristic cho các range mới."
                          : previewPlan.analysis?.method === "external-import"
                            ? "Lựa chọn đã nhập; xem lý do theo nội dung."
                            : "Dự phòng theo cấu trúc; chưa được AI xác minh.")}
                    </p>
                  </div>
                ))}
                {previewPlan.analysis.limitations.map((line, i) => (
                  <p key={i} className="mt-1 text-zinc-500">
                    {explainInVietnamese(line, "Thiếu hoặc giới hạn bằng chứng; ghi chú gốc vẫn giữ trong plan.")}
                  </p>
                ))}
              </Disclosure>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            {!hasEditPlan && (
              <>
                <div>
                  <label htmlFor="manual-title-1" className="field-label">
                    Part 1 title
                  </label>
                  <Input
                    id="manual-title-1"
                    value={manualPart1Title}
                    onChange={(event) => setManualPart1Title(event.target.value.toUpperCase())}
                    className="studio-input mt-2"
                  />
                  <Textarea
                    aria-label="Part 1 timestamp ranges"
                    value={manualPart1Ranges}
                    onChange={(event) => setManualPart1Ranges(event.target.value)}
                    className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5"
                  />
                </div>
                <div>
                  <label htmlFor="manual-title-2" className="field-label">
                    Part 2 title
                  </label>
                  <Input
                    id="manual-title-2"
                    value={manualPart2Title}
                    onChange={(event) => setManualPart2Title(event.target.value.toUpperCase())}
                    className="studio-input mt-2"
                  />
                  <Textarea
                    aria-label="Part 2 timestamp ranges"
                    value={manualPart2Ranges}
                    onChange={(event) => setManualPart2Ranges(event.target.value)}
                    className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5"
                  />
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </SourceOptionsSection>
    </>
  );
}
