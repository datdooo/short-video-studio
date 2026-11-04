"use client";

import { Disclosure, DisclosureTrigger } from "@/components/ui/disclosure";

import { BatchProgress } from "@/components/batch-progress";
import { CopyButton } from "@/components/copy-button";
import { RenderProgress } from "@/components/render-progress";
import { TaskProgress } from "@/components/task-progress";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState, InlineNotice, Panel, PanelBody, PanelHeader, Toolbar } from "@/components/ui/workspace";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKER_ORIGIN,
  workerErrorMessage,
  sourcePreparationLabel,
  type BatchJob,
  type ChatGPTSession,
  type WorkerHealth,
} from "@/lib/api/worker-client";
import { AiProvider } from "@/lib/edit-plan";
import { type SubtitleStyle } from "@/lib/subtitles.mjs";
import { Download, Film, ListVideo, Loader2, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";

type Props = {
  autoDownloadError: string;
  autoDownloadRequests: number;
  batch: BatchJob | null;
  batchError: string;
  batchNotice: string;
  batchPreviewError: string;
  batchPreviewOutput: { key: string; title: string; part: number; filename: string; size: number; url: string };
  batchPreviewRef: RefObject<HTMLVideoElement | null>;
  batchUrls: string;
  changeProvider: (value: string) => void;
  changeWorkspace: (next: "editor" | "batch" | "storage") => void;
  chatGPTSession: ChatGPTSession | null;
  refreshChatGPTSession: () => Promise<void>;
  deleteBatchVideo: (group: BatchJob, item: BatchJob["items"][number]) => Promise<void>;
  deletedBatchItems: RefObject<Set<string>>;
  deletingBatchItems: string[];
  editSupplementalPrompt: (value: string) => void;
  isChatGPTChecking: boolean;
  isStartingBatch: boolean;
  isStoppingBatch: boolean;
  isWebAi: boolean;
  openBatchItem: (group: BatchJob, item: BatchJob["items"][number]) => Promise<void>;
  pastBatches: BatchJob[];
  provider: AiProvider;
  resumeBatchItem: (group: BatchJob, item: BatchJob["items"][number]) => Promise<void>;
  resumingBatchItems: string[];
  setBatchPreviewError: Dispatch<SetStateAction<string>>;
  setBatchUrls: Dispatch<SetStateAction<string>>;
  setSelectedBatchPreviewKey: Dispatch<SetStateAction<string>>;
  setSubtitleSettings: (update: SubtitleStyle | ((current: SubtitleStyle) => SubtitleStyle)) => void;
  startBatch: () => Promise<void>;
  stopBatch: () => Promise<void>;
  subtitleSettings: SubtitleStyle;
  visibleSupplementalPrompt: string;
  webAiName: "Gemini" | "ChatGPT" | "Muse";
  workerHealth: WorkerHealth | null;
};
export function BatchView({ model }: { model: Props }) {
  const {
    autoDownloadError,
    autoDownloadRequests,
    batch,
    batchError,
    batchNotice,
    batchPreviewError,
    batchPreviewOutput,
    batchPreviewRef,
    batchUrls,
    changeProvider,
    changeWorkspace,
    chatGPTSession,
    refreshChatGPTSession,
    deleteBatchVideo,
    deletedBatchItems,
    deletingBatchItems,
    editSupplementalPrompt,
    isChatGPTChecking,
    isStartingBatch,
    isStoppingBatch,
    isWebAi,
    openBatchItem,
    pastBatches,
    provider,
    resumeBatchItem,
    resumingBatchItems,
    setBatchPreviewError,
    setBatchUrls,
    setSelectedBatchPreviewKey,
    setSubtitleSettings,
    startBatch,
    stopBatch,
    subtitleSettings,
    visibleSupplementalPrompt,
    webAiName,
    workerHealth,
  } = model;

  return (
    <section className="studio-batch-workspace px-5 py-6">
      <h1 className="sr-only">Xử lý hàng loạt</h1>
      <div className="studio-batch-grid">
        <div className="studio-batch-setup min-w-0">
          <Toolbar>
            <Select value={isWebAi ? provider : "chatgpt"} onValueChange={changeProvider}>
              <SelectTrigger aria-label="AI provider hàng loạt" className="studio-input w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chatgpt">ChatGPT Auto · Terra medium</SelectItem>
                <SelectItem value="chatgpt-web" disabled>
                  ChatGPT web · từng video
                </SelectItem>
                <SelectItem value="gemini" disabled>
                  Gemini Pro · từng video
                </SelectItem>
                <SelectItem value="muse" disabled>
                  Muse · từng video
                </SelectItem>
              </SelectContent>
            </Select>
            <StatusChip tone={provider === "chatgpt" && chatGPTSession?.sharing ? "success" : "neutral"}>
              {isWebAi ? `${webAiName} thủ công` : chatGPTSession?.sharing ? "Codex sẵn sàng" : "Chưa có Codex"}
            </StatusChip>
            {provider === "chatgpt" && !chatGPTSession?.sharing && (
              <Button
                variant="secondary"
                onClick={() => void refreshChatGPTSession()}
                disabled={isChatGPTChecking || !workerHealth?.ok}
              >
                {isChatGPTChecking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Kiểm tra Codex
              </Button>
            )}
            {isWebAi && (
              <InlineNotice tone="warning" className="w-full">
                {webAiName} cần import từng video.{" "}
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  onClick={() => changeWorkspace("editor")}
                  className="underline"
                >
                  Mở Editor
                </Button>
              </InlineNotice>
            )}
          </Toolbar>
          <Disclosure section className="studio-batch-options mt-3">
            <DisclosureTrigger>Yêu cầu và cấu hình lượt mới</DisclosureTrigger>
            <label htmlFor="batch-extra-prompt" className="field-label mt-4 block">
              Yêu cầu bổ sung (không bắt buộc)
            </label>
            <Textarea
              id="batch-extra-prompt"
              value={visibleSupplementalPrompt}
              onChange={(event) => editSupplementalPrompt(event.target.value)}
              className="studio-textarea mt-2 min-h-[80px]"
              placeholder="Yêu cầu thêm cho các video trong lượt chạy mới…"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
              <input
                aria-label="Bật phụ đề tự động"
                type="checkbox"
                checked={subtitleSettings.enabled}
                onChange={(event) => setSubtitleSettings((current) => ({ ...current, enabled: event.target.checked }))}
              />{" "}
              Phụ đề tự động cho lượt chạy mới · dùng style ở tab chỉnh từng video
            </label>
          </Disclosure>
          <Panel>
            <label htmlFor="batch-urls" className="field-label">
              Link video (tối đa 20, mỗi dòng một link) ·{" "}
              {isWebAi ? `${webAiName} · chuẩn bị + import từng item` : "ChatGPT Auto"}
            </label>
            <Textarea
              id="batch-urls"
              value={batchUrls}
              onChange={(event) => setBatchUrls(event.target.value)}
              placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
              className="studio-textarea mt-2 min-h-[100px] text-xs leading-6"
            />
            <Button
              size="md"
              onClick={() => void startBatch()}
              disabled={
                !["chatgpt", "gemini", "muse", "chatgpt-web"].includes(provider) ||
                isStartingBatch ||
                isStoppingBatch ||
                !batchUrls.trim() ||
                !workerHealth?.ok ||
                (provider === "chatgpt" && !chatGPTSession?.sharing)
              }
              className="mt-3 w-full"
            >
              {isStartingBatch ? <Loader2 className="animate-spin" /> : <Film />}{" "}
              {isStartingBatch
                ? "Đang thêm link…"
                : batch && !batch.finished
                  ? "Thêm vào hàng đợi đang chạy"
                  : isWebAi
                    ? "Chuẩn bị nguồn · chờ import thủ công"
                    : "Chạy hàng đợi tự động"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void stopBatch()}
              disabled={!batch || batch.finished || isStoppingBatch || isStartingBatch}
              className="mt-2 w-full"
            >
              {isStoppingBatch ? <Loader2 className="animate-spin" /> : <Square />}{" "}
              {isStoppingBatch ? "Đang dừng…" : "Dừng hàng đợi"}
            </Button>
            <InlineNotice tone="success" className="mt-3">
              <p className="font-semibold">Tự động tải từng part khi render xong</p>
              <p className="mt-1 text-muted-foreground">Giữ trang mở và cho phép tải nhiều file.</p>
              {autoDownloadRequests > 0 && (
                <p className="mt-1">
                  Đã gửi {autoDownloadRequests} yêu cầu tải trong phiên này. Kiểm tra mục Downloads của trình duyệt.
                </p>
              )}
              {autoDownloadError && (
                <InlineNotice tone="error" className="mt-2">
                  {workerErrorMessage(autoDownloadError)}
                </InlineNotice>
              )}
            </InlineNotice>
            {batchError && (
              <InlineNotice tone="error" className="mt-3">
                {workerErrorMessage(batchError)}
              </InlineNotice>
            )}
            {batchNotice && (
              <InlineNotice tone="success" role="status" className="mt-3">
                {batchNotice}
              </InlineNotice>
            )}
          </Panel>
        </div>
        <Panel className="studio-batch-queue" aria-label="Hàng đợi video">
          <PanelHeader>
            <h2 className="text-sm font-semibold">Hàng đợi video</h2>
          </PanelHeader>
          {(batch || pastBatches.length > 0) && (
            <div className="studio-batch-item-list mt-3 max-h-[480px] space-y-3 overflow-y-auto">
              {[...(batch ? [batch] : []), ...pastBatches.filter((group) => group.id !== batch?.id)].map((group) => (
                <div key={group.id} className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {group.id === batch?.id ? "Hàng đợi hiện tại" : "Video đã xử lý trước đó"}
                  </p>
                  <BatchProgress items={group.items.filter((item) => !deletedBatchItems.current.has(item.id))} />
                  {group.items
                    .filter((item) => !deletedBatchItems.current.has(item.id))
                    .map((item, index) => (
                      <Panel
                        as="article"
                        padding="sm"
                        key={item.id || item.url}
                        data-batch-state={item.state}
                        className="workspace-list-row"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 break-words text-xs font-semibold leading-5">
                            {index + 1}. {item.title || item.url}
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void deleteBatchVideo(group, item)}
                            disabled={
                              !item.id ||
                              ![
                                "done",
                                "error",
                                "cancelled",
                                "paused",
                                "awaiting-import",
                                "review-required",
                                "render-ready",
                              ].includes(item.state) ||
                              deletingBatchItems.includes(item.id) ||
                              resumingBatchItems.length > 0 ||
                              isStartingBatch
                            }
                            title={
                              [
                                "done",
                                "error",
                                "cancelled",
                                "paused",
                                "awaiting-import",
                                "review-required",
                                "render-ready",
                              ].includes(item.state)
                                ? "Xoá video và file render"
                                : "Dừng hoặc chờ xử lý xong trước khi xoá"
                            }
                            className="shrink-0"
                          >
                            {deletingBatchItems.includes(item.id) ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}{" "}
                            Xoá
                          </Button>
                        </div>
                        <StatusChip
                          tone={item.state === "done" ? "success" : item.state === "error" ? "error" : "neutral"}
                        >
                          {
                            {
                              pending: "Đang chờ",
                              downloading: "Chuẩn bị nguồn",
                              analyzing: "Phân tích",
                              queued: "Chờ render",
                              rendering: "Đang render",
                              done: "Hoàn tất",
                              error: "Lỗi",
                              cancelled: "Đã dừng",
                              paused: "Tạm dừng",
                              "awaiting-import": "Chờ import",
                              "review-required": "Cần kiểm tra",
                              "render-ready": "Sẵn sàng render",
                              submitting: "Đang ghi tác vụ",
                            }[item.state]
                          }
                        </StatusChip>
                        {item.job ? (
                          <RenderProgress job={item.job} compact />
                        ) : (
                          <TaskProgress
                            label={
                              {
                                paused: "Tạm dừng · có thể tiếp tục",
                                "awaiting-import": "Chờ import trong Editor",
                                "review-required": "Cần kiểm tra trong Editor",
                                "render-ready": "Plan đã lưu · chuẩn bị render",
                                submitting: "Ghi render submission",
                                pending: "Đang chờ",
                                downloading: "Chuẩn bị nguồn",
                                analyzing: "Phân tích nội dung",
                                queued: "Chờ render",
                                rendering: "Đang render",
                                done: "Hoàn tất",
                                error: "Lỗi",
                                cancelled: "Đã dừng",
                              }[item.state]
                            }
                            state={
                              item.state === "done"
                                ? "done"
                                : ["error", "cancelled"].includes(item.state)
                                  ? (item.state as "error" | "cancelled")
                                  : ["downloading", "analyzing", "submitting"].includes(item.state)
                                    ? "running"
                                    : "waiting"
                            }
                            startedAt={item.startedAt ? Date.parse(item.startedAt) : undefined}
                            percent={item.state === "downloading" ? item.sourceProgress?.percent : null}
                            estimated={item.sourceProgress?.estimated}
                            detail={
                              item.state === "downloading" && item.sourceProgress
                                ? sourcePreparationLabel({ ...item.sourceProgress, percent: null })
                                : undefined
                            }
                            compact
                          />
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.sourceId && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void openBatchItem(group, item)}
                              className="h-8 text-xs"
                            >
                              {["awaiting-import", "review-required"].includes(item.state)
                                ? "Mở editor · chọn/import/duyệt"
                                : "Mở bản sao trong editor"}
                            </Button>
                          )}
                          {["error", "cancelled", "paused", "render-ready"].includes(item.state) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void resumeBatchItem(group, item)}
                              disabled={
                                resumingBatchItems.length > 0 ||
                                isStartingBatch ||
                                isStoppingBatch ||
                                deletingBatchItems.includes(item.id)
                              }
                              className="h-8 text-xs"
                            >
                              {resumingBatchItems.includes(item.id) ? "Đang tiếp tục…" : "Tiếp tục / thử lại item"}
                            </Button>
                          )}
                        </div>
                        {item.error && (
                          <InlineNotice tone="error" className="mt-2">
                            {workerErrorMessage(item.error)}
                          </InlineNotice>
                        )}
                        {item.plan?.parts.map((part) => (
                          <div key={part.id} className="mt-3">
                            <p className="text-xs text-muted-foreground">Title sau cùng · Part {part.id}</p>
                            <p className="mt-1 break-words select-text text-xs leading-5">
                              {item.plan!.originalTitle} | {part.title} ({part.id}/{item.plan!.parts.length})
                            </p>
                            <p className="mt-1 break-words select-text text-xs leading-5 text-muted-foreground">
                              {part.hashtags.join(" ")}
                            </p>
                            <CopyButton
                              text={`${item.plan!.originalTitle} | ${part.title} (${part.id}/${item.plan!.parts.length})\n\n${part.hashtags.join(" ")}`}
                              ariaLabel={`Sao chép tiêu đề và hashtag Part ${part.id} trong hàng loạt`}
                              className="mt-2"
                            />
                          </div>
                        ))}
                        {item.job?.outputs.map((output) => (
                          <div key={output.part} className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedBatchPreviewKey(`${group.id}:${item.id}:${output.part}`);
                                setBatchPreviewError("");
                              }}
                              aria-pressed={batchPreviewOutput?.key === `${group.id}:${item.id}:${output.part}`}
                            >
                              <Play className="size-3.5" /> Xem Part {output.part}
                            </Button>
                            <Button variant="secondary" size="sm" asChild>
                              <a
                                href={`${WORKER_ORIGIN}${output.url}`}
                                download={output.filename}
                                className="studio-download min-w-0"
                              >
                                <Download className="mt-0.5 size-4 shrink-0" />
                                <span className="break-all">
                                  Tải lại Part {output.part} · {output.filename}
                                </span>
                              </a>
                            </Button>
                          </div>
                        ))}
                      </Panel>
                    ))}
                  {!group.items.length && <EmptyState icon={<ListVideo />} title="Không còn video trong hàng đợi." />}
                </div>
              ))}
            </div>
          )}
          {!batch && !pastBatches.length && (
            <EmptyState
              icon={<ListVideo />}
              title="Chưa có video trong hàng đợi."
              description="Thêm link trong biểu mẫu để bắt đầu."
            />
          )}
        </Panel>
        <Panel as="aside" aria-label="Xem trước hàng loạt" className="studio-batch-preview">
          <PanelHeader>
            <h2 className="text-sm font-semibold">Xem trước render</h2>
          </PanelHeader>
          <PanelBody>
            {batchPreviewOutput ? (
              <>
                <video
                  ref={batchPreviewRef}
                  key={batchPreviewOutput.url}
                  src={`${WORKER_ORIGIN}${batchPreviewOutput.url}?preview=1`}
                  aria-label={`Xem trước Part ${batchPreviewOutput.part}`}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={() => setBatchPreviewError("")}
                  onError={() => setBatchPreviewError("Không mở được video. Kiểm tra worker hoặc chọn Part khác.")}
                  className="mx-auto mt-3 aspect-[9/16] w-full max-w-[200px] rounded-xl bg-(--sample-black) object-contain"
                />
                <p className="mt-3 break-words text-xs font-semibold leading-5">{batchPreviewOutput.title}</p>
                <p className="mt-1 break-all text-xs text-accent-foreground">
                  Part {batchPreviewOutput.part} · {batchPreviewOutput.filename}
                </p>
                {batchPreviewError && (
                  <InlineNotice tone="error" className="mt-2">
                    {workerErrorMessage(batchPreviewError)}
                  </InlineNotice>
                )}
              </>
            ) : (
              <EmptyState icon={<Play />} title="Chưa chọn Part đã xuất." description="Chọn Xem Part trong hàng đợi." />
            )}
          </PanelBody>
        </Panel>
      </div>
    </section>
  );
}
