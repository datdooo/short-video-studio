import { resolveWorkerOrigin } from "@/lib/worker-origin.mjs";
import type { AiProvider, EditPlan } from "@/lib/edit-plan";
import type { CaptionTrack, SubtitleStyle } from "@/lib/subtitles.mjs";
export type WebAiContext = {
  sourceId: string;
  transcript: string;
  instruction: string;
  provider: AiProvider;
  requestId: string;
  analysisKey?: string;
  supplementalPrompt?: string;
  lockedPlan?: EditPlan;
  hookPlan?: EditPlan;
  mainSignature?: string;
  lastImportMainSignature?: string;
  promptVersion?: string;
  captionTrack?: CaptionTrack;
  media?: {
    id: string;
    filename: string;
    bytes: number | null;
    duration: number;
    sourceKey?: string;
    variantKey?: string;
  };
};

export const WORKER_ORIGIN = resolveWorkerOrigin(process.env.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN);

export type WorkerHealth = {
  ok: boolean;
  readyForYouTube: boolean;
  codex?: { installed: boolean; loggedIn: boolean; version: string | null } | null;
  tools: { ffmpeg: string | null; ffprobe: string | null; ytDlp: string | null };
  render?: {
    encoder: string;
    hardwareAccelerated: boolean;
    label: string;
    colorSpace: string;
    resources?: { renderBusy: boolean; profile: string };
    contrast?: number;
    saturation?: number;
  };
};

export type ChatGPTSession = {
  available: boolean;
  connected: boolean;
  sharing: boolean;
  installed?: boolean;
  version?: string | null;
  model?: string;
  reasoning?: string;
  needsSignIn?: boolean;
  error?: string;
};

export type WorkerSource = {
  id: string;
  kind: "youtube" | "upload";
  sourceUrl?: string;
  title: string;
  originalFilename: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  transcript: string;
  subtitleFound: boolean;
  language?: string;
  captionTrackId?: string;
  captions?: CaptionTrack["cues"];
  captionWarning?: string;
  captionLanguage?: string;
};

export type SourcePreparationProgress = {
  phase:
    | "upload"
    | "metadata"
    | "connecting"
    | "download"
    | "muxing"
    | "probing"
    | "upscaling"
    | "completing"
    | "waiting-render"
    | "waiting-resource";
  percent: number | null;
  stream?: "video" | "audio" | "media";
  estimated?: boolean;
  downloadedBytes?: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
};

export const SOURCE_PREPARATION_PHASES = [
  "upload",
  "metadata",
  "connecting",
  "download",
  "muxing",
  "probing",
  "upscaling",
  "completing",
  "waiting-render",
  "waiting-resource",
] as const;

export function sourcePreparationLabel(progress: SourcePreparationProgress | null) {
  if (!progress) return "Đang chuẩn bị…";
  if (progress.phase === "download") {
    const label = progress.stream === "audio" ? "Tải tiếng" : progress.stream === "video" ? "Tải hình" : "Tải nguồn";
    return progress.percent === null ? `${label}…` : `${label} ${progress.estimated ? "≈ " : ""}${progress.percent}%`;
  }
  return {
    upload: "Truyền file lên worker…",
    metadata: "Đọc thông tin nguồn…",
    connecting: "Kết nối nguồn…",
    muxing: "Ghép hình và tiếng…",
    probing: "Kiểm tra video…",
    upscaling: "Chuẩn hóa video…",
    completing: "Hoàn tất nguồn…",
    "waiting-render": "Chờ render để xử lý nguồn…",
    "waiting-resource": "Chờ tác vụ media khác…",
  }[progress.phase];
}

export async function readSourcePreparation(
  response: Response,
  onProgress: (value: SourcePreparationProgress) => void,
): Promise<{ source?: WorkerSource; error?: string }> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return response.json();
  const reader = response.body?.getReader();
  if (!reader) throw Error("Không đọc được tiến độ chuẩn bị nguồn.");
  const decoder = new TextDecoder();
  let pending = "",
    result: { source?: WorkerSource; error?: string } | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    const value = JSON.parse(line) as Record<string, unknown>;
    if (!value || typeof value !== "object") return;
    if (value.type === "error")
      throw Error(typeof value.error === "string" ? value.error : "Không chuẩn bị được nguồn.");
    if (value.type === "result") {
      result = { source: value.source as WorkerSource };
      return;
    }
    if (
      value.type === "progress" &&
      SOURCE_PREPARATION_PHASES.includes(value.phase as SourcePreparationProgress["phase"])
    )
      onProgress({
        phase: value.phase as SourcePreparationProgress["phase"],
        percent:
          typeof value.percent === "number" &&
          Number.isFinite(value.percent) &&
          value.percent >= 0 &&
          value.percent <= 100
            ? Math.floor(value.percent)
            : null,
        stream:
          value.stream === "video" || value.stream === "audio" || value.stream === "media" ? value.stream : undefined,
        estimated: value.estimated === true,
        ...Object.fromEntries(
          ["downloadedBytes", "totalBytes", "bytesPerSecond", "etaSeconds"]
            .filter((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && Number(value[key]) >= 0)
            .map((key) => [key, value[key]]),
        ),
      });
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 8 * 1024 * 1024) throw Error("Phản hồi chuẩn bị nguồn vượt giới hạn.");
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, end));
        pending = pending.slice(end + 1);
      }
      if (done) {
        if (pending) consume(pending);
        break;
      }
    }
    if (!result) throw Error("Chuẩn bị nguồn bị gián đoạn. Chưa nhận được nguồn hoàn tất.");
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export type RenderJob = {
  id: string;
  sourceId: string;
  state: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  currentPart: number | null;
  outputs: Array<{ part: number; filename: string; size: number; url: string }>;
  error: string | null;
  plan?: EditPlan;
  planSummary?: Pick<EditPlan, "originalTitle"> & { parts: Pick<EditPlan["parts"][number], "id" | "title" | "hashtags">[] };
  createdAt?: string;
  stopping?: boolean;
  phase?: string | null;
  startedAt?: string;
  attempt?: number;
  encoder?: string;
  encoderFallback?: boolean;
  resourceNotice?: string;
};

export type BatchJob = {
  id: string;
  finished: boolean;
  items: Array<{
    id: string;
    url: string;
    title?: string;
    sourceId?: string;
    startedAt?: string;
    sourceProgress?: SourcePreparationProgress;
    state:
      | "pending"
      | "downloading"
      | "analyzing"
      | "queued"
      | "rendering"
      | "done"
      | "error"
      | "cancelled"
      | "paused"
      | "awaiting-import"
      | "review-required"
      | "render-ready"
      | "submitting";
    settings?: {
      music?: EditPlan["music"];
      hookTransition?: EditPlan["hookTransition"];
      provider?: AiProvider;
      instruction?: string;
      supplementalPrompt?: string;
      visualStyle?: EditPlan["visualStyle"];
      subtitles?: SubtitleStyle;
    };
    error: string | null;
    plan?: EditPlan;
  planSummary?: Pick<EditPlan, "originalTitle"> & { parts: Pick<EditPlan["parts"][number], "id" | "title" | "hashtags">[] };
    job?: RenderJob;
  }>;
};
export type WorkerPath = "/health" | `/api/${string}`;
/** Raw Response boundary: streams, cancellation and existing status handling remain owned by their consumers. */
export function workerFetch(path: WorkerPath, init?: RequestInit): Promise<Response> {
  return fetch(WORKER_ORIGIN + path, init);
}
export function workerError(value: unknown, fallback: string): Error {
  const message =
    value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
  return new Error(message);
}
export async function workerJson<T>(path: WorkerPath, decode: (value: unknown) => T, init?: RequestInit): Promise<T> {
  const response = await workerFetch(path, init),
    value: unknown = await response.json();
  if (!response.ok) throw workerError(value, `HTTP ${response.status}`);
  return decode(value);
}
