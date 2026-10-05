"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  FileJson,
  Film,
  Link2,
  LogIn,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  ServerCog,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AiProvider,
  AnalyzeRequest,
  buildPrompt,
  EDIT_PLAN_SCHEMA,
  EditPlan,
  durationOf,
  finalDurationOf,
  formatTime,
  isChronological,
  manualPlan,
  mockPlan,
  normalizePlan,
} from "@/lib/edit-plan";
import { buildRenderManifest, fitOverlayText, fontStackFor } from "@/lib/render-spec";

const WORKER_ORIGIN = "http://127.0.0.1:8787";

type WorkerHealth = {
  ok: boolean;
  readyForYouTube: boolean;
  chatGPTAuthAvailable: boolean;
  tools: { ffmpeg: string | null; ffprobe: string | null; ytDlp: string | null };
  render?: { encoder: string; hardwareAccelerated: boolean; label: string; colorSpace: string };
};

type ChatGPTSession = {
  available: boolean;
  connected: boolean;
  sharing: boolean;
  email?: string | null;
  name?: string | null;
  expiresAt?: string | null;
};

type WorkerSource = {
  id: string;
  kind: "youtube" | "upload";
  title: string;
  originalFilename: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  transcript: string;
  subtitleFound: boolean;
};

type RenderJob = {
  id: string;
  sourceId: string;
  state: "queued" | "rendering" | "done" | "error";
  progress: number;
  currentPart: number | null;
  outputs: Array<{ part: number; filename: string; size: number; url: string }>;
  error: string | null;
};

const DEMO_TRANSCRIPT = `00:00 Willkommen zurück auf dem Kanal.
00:38 Heute schauen wir uns diesen völlig verrückten Audi A2 an.
01:12 Beim ersten Start klingt alles noch ganz normal.
01:46 Dann öffnen wir die Motorhaube und sehen den Umbau.
02:25 Niemand erwartet, was hier eingebaut wurde.
03:18 Der Motor startet sofort und die erste Reaktion sagt alles.
04:07 Jetzt zeigen wir den kompletten Motorraum.
05:26 Dieses kleine Detail macht den ganzen Umbau besonders.
06:22 Bei der Probefahrt taucht plötzlich ein Problem auf.
07:14 Wir finden die Ursache und ändern den Plan.
08:41 Nach dem Fix läuft das Auto endlich sauber.
09:36 Das Ergebnis ist besser als erwartet.`;

const DEFAULT_REQUEST: AnalyzeRequest = {
  originalTitle: "Umbau völlig ESKALIERT — Audi A2 1.9 TDI",
  transcript: DEMO_TRANSCRIPT,
  instruction: `Hãy phân tích transcript như một editor short-form chuyên nghiệp và chia video thành đúng 2 part.

QUAN TRỌNG NHẤT: tuyệt đối không được đảo thứ tự footage. Các đoạn được chọn trong mỗi part phải luôn đi từ timestamp nhỏ đến lớn theo đúng timeline gốc. Được phép bỏ qua bất kỳ đoạn nào ở giữa nhưng không được lấy đoạn sau đưa lên trước.

Không cần giữ toàn bộ video. Hãy mạnh tay bỏ những phần dài dòng hoặc ít giá trị như intro/chào hỏi, giới thiệu kênh, quảng bá subscribe, đi đường, chuẩn bị trước khi vào nội dung chính, music-only dài, ăn uống không liên quan, hội thoại filler, nội dung lặp lại và outro không cần thiết.

Part 1 phải vào việc nhanh, bắt đầu bằng một hook tự nhiên mạnh và có một chủ đề rõ ràng. Không bắt buộc phải bắt đầu từ 00:00.

Part 2 phải được xem như một video độc lập, có hook riêng và không được trở thành nơi chứa các đoạn thừa của Part 1. Ưu tiên bắt đầu Part 2 ở một chuyển cảnh/chủ đề tự nhiên như sự cố mới, reveal, mở capo, test, soundcheck, kết quả, giải pháp hoặc một hành động mới.

Ưu tiên giữ các đoạn có khả năng giữ chân người xem cao: sự cố, vấn đề, reveal, reaction, before/after, thử nghiệm, kết quả, con số đáng chú ý, âm thanh hay, chi tiết hiếm, phần sửa chữa/thay đổi quan trọng và payoff.

Nếu một nội dung được nói nhiều lần, chỉ giữ phiên bản rõ nhất hoặc thú vị nhất.

Không cắt giữa câu nếu có thể. Chọn điểm bắt đầu/kết thúc tự nhiên theo câu nói hoặc chuyển chủ đề.

Mỗi part phải có mạch nội dung dễ hiểu:
Hook → nội dung chính → payoff.

Title của Part 1 và Part 2 phải viết bằng đúng ngôn ngữ gốc của video. Tạo 5–7 hashtag phù hợp với nội dung và thị trường của video. Không bịa thông tin, thông số hoặc chi tiết không có trong transcript.

Không cần chia hai part có thời lượng bằng nhau. Chất lượng và retention quan trọng hơn độ dài.

Nếu phần đầu video dài dòng nhưng phần hay nằm ở giữa hoặc cuối, hãy bỏ toàn bộ phần đầu và bắt đầu ở đoạn hay.

Mục tiêu cuối cùng là chọn ra 2 video ngắn hấp dẫn nhất từ video gốc, không phải chia video gốc thành hai nửa.`,
  provider: "mock",
};

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [editMode, setEditMode] = useState<"ai" | "manual">("ai");
  const [sourceMode, setSourceMode] = useState<"youtube" | "local">("youtube");
  const [provider, setProvider] = useState<AiProvider>("chatgpt");
  const [chatGPTSession, setChatGPTSession] = useState<ChatGPTSession | null>(null);
  const [isChatGPTConnecting, setIsChatGPTConnecting] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState(DEFAULT_REQUEST.originalTitle);
  const [transcript, setTranscript] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [hasEditPlan, setHasEditPlan] = useState(false);
  const [instruction, setInstruction] = useState(DEFAULT_REQUEST.instruction || "");
  const [plan, setPlan] = useState<EditPlan>(() => mockPlan(DEFAULT_REQUEST));
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [localVideoUrl, setLocalVideoUrl] = useState("");
  const [localFileName, setLocalFileName] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [youtubeState, setYoutubeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [youtubeError, setYoutubeError] = useState("");
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [isPreparingSource, setIsPreparingSource] = useState(false);
  const [preparedSource, setPreparedSource] = useState<WorkerSource | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [manualPart1Title, setManualPart1Title] = useState("THE DETAIL NOBODY EXPECTED");
  const [manualPart2Title, setManualPart2Title] = useState("THEN EVERYTHING CHANGED");
  const [manualPart1Ranges, setManualPart1Ranges] = useState("01:12 - 01:46 First reaction\n02:25 - 03:18 Engine reveal");
  const [manualPart2Ranges, setManualPart2Ranges] = useState("06:22 - 07:14 The problem\n08:41 - 09:36 Final result");
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(384);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  const activePart = plan.parts[activePartIndex];
  const partDuration = durationOf(activePart) / 1.25;
  const timelineDuration = hasEditPlan ? partDuration : previewDuration;
  const fontStack = useMemo(
    () => fontStackFor(`${plan.originalTitle} ${activePart.title}`),
    [activePart.title, plan.originalTitle],
  );
  const originalTitleFit = useMemo(
    () => fitOverlayText(plan.originalTitle.toUpperCase(), "original"),
    [plan.originalTitle],
  );
  const partTitleFit = useMemo(
    () => fitOverlayText(activePart.title, "part"),
    [activePart.title],
  );
  const previewScale = previewWidth / 1080;
  const previewVideoUrl = useMemo(
    () => (sourceMode === "local" && localVideoUrl) || (preparedSource ? `${WORKER_ORIGIN}/api/sources/${preparedSource.id}/media` : ""),
    [localVideoUrl, preparedSource, sourceMode],
  );
  const renderJobId = renderJob?.id;
  const renderJobState = renderJob?.state;

  useEffect(() => {
    if (!hasEditPlan || !previewVideoUrl) return;
    const video = previewVideoRef.current;
    const background = backgroundVideoRef.current;
    if (!video) return;
    video.pause();
    background?.pause();
    video.currentTime = activePart.segments[0]?.start || 0;
    video.playbackRate = 1.25;
    video.preservesPitch = true;
    if (background) {
      background.currentTime = video.currentTime;
      background.playbackRate = 1.25;
    }
    const timer = window.setTimeout(() => setPreviewCurrentTime(0), 0);
    return () => window.clearTimeout(timer);
  }, [hasEditPlan, activePart.segments, previewVideoUrl]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = previewVideoRef.current;
      if (video && hasEditPlan && !video.paused && !video.seeking) {
        const segments = activePart.segments;
        const index = segments.findIndex((segment) => video.currentTime >= segment.start - 0.05 && video.currentTime < segment.end);
        if (index < 0) {
          const next = segments.find((segment) => segment.start > video.currentTime);
          if (next) {
            video.currentTime = next.start;
            if (backgroundVideoRef.current) backgroundVideoRef.current.currentTime = next.start;
          } else {
            video.pause();
            backgroundVideoRef.current?.pause();
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasEditPlan, activePart.segments]);

  useEffect(() => {
    if (sourceMode !== "youtube" || !sourceUrl.trim() || !workerHealth?.ok) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTranscript("");
      setTranscriptStatus("Đang tự lấy phụ đề gốc từ YouTube…");
      try {
        const response = await fetch(`${WORKER_ORIGIN}/api/youtube/transcript`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceUrl.trim() }), signal: controller.signal,
        });
        const data = await response.json() as { transcript?: string; title?: string; message?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Không lấy được transcript.");
        if (controller.signal.aborted) return;
        setTranscript(data.transcript || "");
        setTranscriptStatus(data.transcript ? "Đã tự lấy transcript theo ngôn ngữ gốc." : data.message || "Video không có phụ đề.");
      } catch (caughtError) {
        if (!controller.signal.aborted) setTranscriptStatus(caughtError instanceof Error ? caughtError.message : "Không lấy được transcript.");
      }
    }, 700);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sourceUrl, sourceMode, workerHealth?.ok]);

  useEffect(() => () => {
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  }, [localVideoUrl]);

  useEffect(() => {
    if (!previewElement) return;
    const updateWidth = () => setPreviewWidth(previewElement.getBoundingClientRect().width);
    updateWidth();
    const frame = window.requestAnimationFrame(updateWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(previewElement);
    window.addEventListener("resize", updateWidth);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateWidth);
      observer.disconnect();
    };
  }, [previewElement]);

  useEffect(() => {
    let active = true;
    async function checkWorker() {
      try {
        const response = await fetch(`${WORKER_ORIGIN}/health`, { cache: "no-store" });
        const data = (await response.json()) as WorkerHealth;
        if (active) setWorkerHealth(response.ok ? data : null);
      } catch {
        if (active) setWorkerHealth(null);
      }
    }
    void checkWorker();
    const timer = window.setInterval(checkWorker, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!workerHealth?.ok) {
      const timer = window.setTimeout(() => setChatGPTSession(null), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    fetch(`${WORKER_ORIGIN}/api/chatgpt/session`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { session?: ChatGPTSession };
        if (active && data.session) setChatGPTSession(data.session);
      })
      .catch(() => {
        if (active) setChatGPTSession(null);
      });
    return () => { active = false; };
  }, [workerHealth?.ok]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
      setIsPreviewPlaying(false);
      setPreviewError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewVideoUrl]);

  useEffect(() => {
    if (!renderJobId || !renderJobState || !["queued", "rendering"].includes(renderJobState)) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`${WORKER_ORIGIN}/api/jobs/${renderJobId}`, { cache: "no-store" });
        const data = (await response.json()) as { job?: RenderJob; error?: string };
        if (!response.ok || !data.job) throw new Error(data.error || "Không đọc được render progress.");
        if (active) setRenderJob(data.job);
      } catch (caughtError) {
        if (active) setError(caughtError instanceof Error ? caughtError.message : "Mất kết nối với media worker.");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1_200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [renderJobId, renderJobState]);

  useEffect(() => {
    if (sourceMode !== "youtube" || !sourceUrl.trim()) {
      const idleTimer = window.setTimeout(() => {
        setYoutubeState("idle");
        setYoutubeError("");
      }, 0);
      return () => window.clearTimeout(idleTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setYoutubeState("loading");
      setYoutubeError("");
      try {
        const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(sourceUrl.trim())}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { title?: string; error?: string };
        if (!response.ok || !data.title) throw new Error(data.error || "Không lấy được YouTube title.");
        setSourceTitle(data.title);
        setPlan((current) => ({ ...current, originalTitle: data.title as string }));
        setYoutubeState("ready");
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setYoutubeState("error");
        setYoutubeError(caughtError instanceof Error ? caughtError.message : "Không lấy được YouTube title.");
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sourceMode, sourceUrl]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: "apply_manual_edit_plan",
        title: "Apply manual edit plan",
        description: "Apply chronological timestamp ranges for two video parts without using AI, and update the visible edit plan.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            originalTitle: { type: "string" },
            part1Title: { type: "string" },
            part1Ranges: { type: "string", description: "One timestamp range per line, for example 00:10 - 00:25 Hook" },
            part2Title: { type: "string" },
            part2Ranges: { type: "string", description: "One timestamp range per line" },
          },
          required: ["originalTitle", "part1Title", "part1Ranges", "part2Title", "part2Ranges"],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const values = input as {
            originalTitle: string;
            part1Title: string;
            part1Ranges: string;
            part2Title: string;
            part2Ranges: string;
          };
          if (!values || Object.values(values).some((value) => typeof value !== "string")) {
            throw new Error("All manual edit-plan fields must be strings.");
          }
          const nextPlan = manualPlan(values);
          setSourceTitle(values.originalTitle);
          setManualPart1Title(values.part1Title);
          setManualPart1Ranges(values.part1Ranges);
          setManualPart2Title(values.part2Title);
          setManualPart2Ranges(values.part2Ranges);
          setPlan(nextPlan);
          setHasEditPlan(true);
          setEditMode("manual");
          setActivePartIndex(0);
          setError("");
          return {
            source: "manual",
            partCount: nextPlan.parts.length,
            sourceDurations: nextPlan.parts.map((part) => durationOf(part)),
            finalSpeed: nextPlan.render.speed,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function readChatGPTSession() {
    const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/session`, { cache: "no-store" });
    const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
    if (!response.ok || !data.session) throw new Error(data.error || "Không đọc được ChatGPT session.");
    setChatGPTSession(data.session);
    return data.session;
  }

  async function connectChatGPT() {
    setError("");
    if (!workerHealth?.ok) {
      setError("Media worker đang offline. Chạy `npm run personal` trước.");
      return;
    }
    const popup = window.open("about:blank", "shortcut-chatgpt", "popup,width=560,height=760");
    setIsChatGPTConnecting(true);
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/auth/start`, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Không bắt đầu được ChatGPT sign-in.");
      if (!popup) throw new Error("Trình duyệt đang chặn popup. Cho phép popup rồi thử lại.");
      popup.location.href = data.url;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        const session = await readChatGPTSession();
        if (session.connected) {
          if (!session.sharing) setError("Đã đăng nhập nhưng ChatGPT plan usage chưa được cấp quyền. Bấm kết nối lại và cho phép plan usage.");
          return;
        }
      }
      throw new Error("ChatGPT sign-in hết thời gian chờ. Hãy thử lại.");
    } catch (caughtError) {
      popup?.close();
      setError(caughtError instanceof Error ? caughtError.message : "Không kết nối được ChatGPT.");
    } finally {
      setIsChatGPTConnecting(false);
    }
  }

  async function disconnectChatGPT() {
    setError("");
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/session`, { method: "DELETE" });
      const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || "Không disconnect được ChatGPT.");
      setChatGPTSession(data.session);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không disconnect được ChatGPT.");
    }
  }

  async function analyze() {
    setError("");
    if (!transcript.trim()) {
      setError(transcriptStatus || "Đang chờ transcript từ YouTube. Video không có phụ đề thì dùng Manual cut hoặc nhập transcript.");
      return;
    }
    if (provider === "chatgpt" && !chatGPTSession?.sharing) {
      setError("Hãy bấm Continue with ChatGPT và cho phép dùng ChatGPT plan trước.");
      return;
    }
    setIsAnalyzing(true);
    try {
      if (provider === "mock") {
        setPlan(mockPlan({ provider: "mock", originalTitle: sourceTitle, transcript, instruction }));
        setHasEditPlan(true);
        setActivePartIndex(0);
        if (!preparedSource) await prepareSource();
        return;
      }
      const request = { provider, originalTitle: sourceTitle, transcript, instruction } satisfies AnalyzeRequest;
      const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: "You are a precise short-form video editor. Return only the requested structured edit plan.",
          input: buildPrompt(request),
          schema: EDIT_PLAN_SCHEMA,
        }),
      });
      const data = (await response.json()) as { plan?: Omit<EditPlan, "providerUsed" | "render">; model?: string; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error || "Không thể tạo edit plan.");
      setPlan(normalizePlan(data.plan, "chatgpt"));
      setHasEditPlan(true);
      setActivePartIndex(0);
      if (!preparedSource) await prepareSource();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể tạo edit plan.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function changeProvider(value: string) {
    setProvider(value as AiProvider);
    setError("");
  }

  function applyManualPlan() {
    setError("");
    try {
      const nextPlan = manualPlan({
        originalTitle: sourceTitle,
        part1Title: manualPart1Title,
        part1Ranges: manualPart1Ranges,
        part2Title: manualPart2Title,
        part2Ranges: manualPart2Ranges,
      });
      setPlan(nextPlan);
      setHasEditPlan(true);
      setActivePartIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Timestamp không hợp lệ.");
    }
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl(URL.createObjectURL(file));
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

  async function togglePreview() {
    const video = previewVideoRef.current;
    if (!video || !previewVideoUrl) return;
    setPreviewError("");
    if (video.paused) {
      try {
        if (hasEditPlan) {
          const last = activePart.segments.at(-1);
          if (last && video.currentTime >= last.end - 0.05) video.currentTime = activePart.segments[0].start;
          video.playbackRate = 1.25;
        }
        await video.play();
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.currentTime = video.currentTime;
          backgroundVideoRef.current.playbackRate = video.playbackRate;
          await backgroundVideoRef.current.play().catch(() => undefined);
        }
      } catch {
        setPreviewError("Trình duyệt chưa phát được video source này.");
      }
    } else {
      video.pause();
      backgroundVideoRef.current?.pause();
    }
  }

  function seekPreview(value: number) {
    const video = previewVideoRef.current;
    if (!video || !Number.isFinite(value)) return;
    let sourceTime = value;
    if (hasEditPlan) {
      let remaining = value * 1.25;
      for (const segment of activePart.segments) {
        const duration = segment.end - segment.start;
        sourceTime = segment.start + Math.min(remaining, duration);
        if (remaining < duration) break;
        remaining -= duration;
      }
    }
    video.currentTime = sourceTime;
    if (backgroundVideoRef.current) backgroundVideoRef.current.currentTime = sourceTime;
    setPreviewCurrentTime(value);
  }

  function updatePreviewClock() {
    const video = previewVideoRef.current;
    if (!video) return;
    let timelineTime = video.currentTime;
    if (hasEditPlan) {
      timelineTime = 0;
      for (const segment of activePart.segments) {
        timelineTime += Math.max(0, Math.min(video.currentTime - segment.start, segment.end - segment.start));
        if (video.currentTime < segment.end) break;
      }
      timelineTime /= 1.25;
    }
    setPreviewCurrentTime(timelineTime);
    const background = backgroundVideoRef.current;
    if (background && Math.abs(background.currentTime - video.currentTime) > 0.3) {
      background.currentTime = video.currentTime;
    }
  }

  async function prepareSource() {
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

    setIsPreparingSource(true);
    setRenderJob(null);
    try {
      const response = sourceMode === "youtube"
        ? await fetch(`${WORKER_ORIGIN}/api/sources/youtube`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: sourceUrl.trim() }),
          })
        : await fetch(`${WORKER_ORIGIN}/api/sources/upload?filename=${encodeURIComponent(localFile!.name)}`, {
            method: "POST",
            headers: { "Content-Type": localFile!.type || "application/octet-stream", "X-Filename": encodeURIComponent(localFile!.name) },
            body: localFile,
          });
      const data = (await response.json()) as { source?: WorkerSource; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Không chuẩn bị được source.");
      setPreparedSource(data.source);
      setSourceTitle(data.source.title);
      setPlan((current) => ({ ...current, originalTitle: data.source!.title }));
      if (data.source.transcript) setTranscript(data.source.transcript);
      return data.source;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không chuẩn bị được source.");
      return null;
    } finally {
      setIsPreparingSource(false);
    }
  }

  async function startRender() {
    setError("");
    if (!plan.parts.every(isChronological)) {
      setError("Edit plan có timestamp không hợp lệ.");
      return;
    }
    setIsStartingRender(true);
    try {
      const source = preparedSource || await prepareSource();
      if (!source) return;
      for (const part of plan.parts) {
        for (const segment of part.segments) {
          if (segment.end > source.duration + 0.05) {
            throw new Error(`Part ${part.id} có timestamp ${formatTime(segment.end)} vượt quá video source (${formatTime(source.duration)}). Hãy sửa timestamp hoặc Generate plan lại.`);
          }
        }
      }
      const response = await fetch(`${WORKER_ORIGIN}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, plan }),
      });
      const data = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Không thể bắt đầu render.");
      setRenderJob(data.job);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể bắt đầu render.");
    } finally {
      setIsStartingRender(false);
    }
  }

  function updatePartTitle(title: string) {
    setPlan((current) => ({
      ...current,
      parts: current.parts.map((part, index) => index === activePartIndex ? { ...part, title } : part),
    }));
  }

  function downloadRenderConfig() {
    const manifests = plan.parts.map((part) => buildRenderManifest({
      sourcePath: localFileName || "source.mp4",
      outputPath: `part-${part.id}.mp4`,
      originalTitle: plan.originalTitle,
      part,
      totalParts: plan.parts.length,
    }));
    downloadJson("render-manifest.json", { editPlan: plan, manifests });
  }

  return (
    <main className="min-h-screen bg-[#090a0c] text-white">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-[#090a0c]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-[#ff4d2e] shadow-[0_0_24px_rgba(255,77,46,.26)]">
            <Clapperboard className="size-[18px]" strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-[-0.02em]">ShortCut Studio</p>
            <p className="text-[11px] text-zinc-500">personal vertical video editor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`hidden border-white/10 bg-white/[.03] sm:flex ${workerHealth?.ok ? "text-emerald-300" : "text-zinc-500"}`}>
            {workerHealth?.ok ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {workerHealth?.ok ? "Worker ready" : "Worker offline"}
          </Badge>
          <Badge variant="outline" className="hidden border-white/10 bg-white/[.03] text-zinc-400 sm:flex">1080 × 1920</Badge>
          <Badge className="border-[#ff4d2e]/25 bg-[#ff4d2e]/10 text-[#ff806a]">1.25× final</Badge>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 xl:grid-cols-[340px_minmax(430px,1fr)_390px]">
        <aside className="border-b border-white/8 bg-[#0d0e11] p-5 xl:border-b-0 xl:border-r xl:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">01 / SOURCE</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Create the cut</h1>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[.03] text-zinc-500">
              {editMode === "ai" ? "AI plan" : "Manual cut"}
            </Badge>
          </div>

          <Tabs value={sourceMode} onValueChange={(value) => { setSourceMode(value as "youtube" | "local"); setPreparedSource(null); setRenderJob(null); }} className="mt-6">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
              <TabsTrigger value="youtube" className="rounded-lg text-xs">YouTube</TabsTrigger>
              <TabsTrigger value="local" className="rounded-lg text-xs">Local video</TabsTrigger>
            </TabsList>
            <TabsContent value="youtube" className="pt-3">
              <label htmlFor="youtube-url" className="field-label">YouTube URL</label>
              <div className="relative mt-2">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input id="youtube-url" value={sourceUrl} onChange={(event) => { setSourceUrl(event.target.value); setPreparedSource(null); setRenderJob(null); setHasEditPlan(false); setTranscript(""); }} placeholder="youtube.com/watch?v=..." className="studio-input pl-10" />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-600">
                {youtubeState === "loading" && "Đang lấy title gốc từ YouTube…"}
                {youtubeState === "ready" && "Đã tự động lấy title gốc từ YouTube."}
                {youtubeState === "error" && youtubeError}
                {youtubeState === "idle" && "Paste URL để app tự lấy original title."}
              </p>
            </TabsContent>
            <TabsContent value="local" className="pt-3">
              <label className="flex h-[84px] cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[.02] text-sm text-zinc-400 transition hover:border-[#ff4d2e]/40 hover:bg-[#ff4d2e]/5 hover:text-white">
                <Upload className="size-4" />
                <span className="max-w-[220px] truncate">{localFileName || "Choose MP4, MOV or WebM"}</span>
                <input className="sr-only" type="file" accept="video/*" onChange={handleVideoUpload} />
              </label>
            </TabsContent>
          </Tabs>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><ServerCog className="size-3.5" /> Media worker</p>
                <p className="mt-1 truncate text-[10px] leading-4 text-zinc-600">
                  {workerHealth?.ok
                    ? `FFmpeg ready · ${workerHealth.render?.hardwareAccelerated ? workerHealth.render.label : "CPU render"} · ${workerHealth.render?.colorSpace || "Rec.709"}`
                    : "Chạy npm run personal để upload / render MP4"}
                </p>
              </div>
              <span className={`size-2 shrink-0 rounded-full ${workerHealth?.ok ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-zinc-700"}`} />
            </div>
            <Button
              variant="outline"
              onClick={() => void prepareSource()}
              disabled={isPreparingSource || !workerHealth?.ok || (sourceMode === "youtube" ? !sourceUrl.trim() : !localFile)}
              className="mt-3 h-9 w-full rounded-xl border-white/10 bg-white/[.03] text-xs text-zinc-300 hover:bg-white/[.07] hover:text-white"
            >
              {isPreparingSource ? <><Loader2 className="animate-spin" /> {sourceMode === "youtube" ? "Đang tải video + subtitle…" : "Đang upload video…"}</> : preparedSource ? <><Check /> Source đã sẵn sàng</> : <><Download /> Chuẩn bị source để render</>}
            </Button>
            {preparedSource && (
              <p className="mt-2 text-[10px] leading-4 text-emerald-300/80">
                {preparedSource.width}×{preparedSource.height} · {formatTime(preparedSource.duration)} · {preparedSource.hasAudio ? "có audio" : "audio rỗng sẽ được tạo"}
                {preparedSource.kind === "youtube" ? ` · ${preparedSource.subtitleFound ? "đã lấy subtitle" : "không có subtitle — dùng Manual cut"}` : ""}
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label htmlFor="source-title" className="field-label">Original title</label>
              {sourceMode === "youtube" && (
                <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  {youtubeState === "loading" ? <Loader2 className="size-3 animate-spin" /> : youtubeState === "ready" ? <Check className="size-3 text-emerald-400" /> : null}
                  Auto from YouTube
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

          <Tabs value={editMode} onValueChange={(value) => { setEditMode(value as "ai" | "manual"); setError(""); }} className="mt-5">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1">
              <TabsTrigger value="ai" className="rounded-lg text-xs"><Sparkles /> AI plan</TabsTrigger>
              <TabsTrigger value="manual" className="rounded-lg text-xs"><Scissors /> Manual cut</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <div>
                <label className="field-label">AI provider</label>
                <Select value={provider} onValueChange={changeProvider}>
                  <SelectTrigger aria-label="AI provider" className="studio-input mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#17181d] text-zinc-200">
                    <SelectItem value="chatgpt">ChatGPT Plus / Pro</SelectItem>
                    <SelectItem value="mock">Mock · fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {provider === "chatgpt" && (
                <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                        <span className={`size-2 rounded-full ${chatGPTSession?.sharing ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-zinc-700"}`} />
                        {chatGPTSession?.sharing ? "ChatGPT plan connected" : "Connect your ChatGPT plan"}
                      </p>
                      <p className="mt-1 truncate text-[10px] leading-4 text-zinc-500">
                        {chatGPTSession?.connected
                          ? chatGPTSession.email || chatGPTSession.name || "Connected account"
                          : "Không cần API key · dùng Plus / Pro nếu account đủ điều kiện"}
                      </p>
                    </div>
                    {chatGPTSession?.connected && (
                      <button type="button" onClick={() => void disconnectChatGPT()} className="shrink-0 text-[10px] text-zinc-600 transition hover:text-zinc-300">
                        Disconnect
                      </button>
                    )}
                  </div>
                  <Button
                    variant={chatGPTSession?.sharing ? "outline" : "default"}
                    onClick={() => void connectChatGPT()}
                    disabled={isChatGPTConnecting || !workerHealth?.chatGPTAuthAvailable}
                    className={`mt-3 h-10 w-full rounded-xl text-xs font-bold ${chatGPTSession?.sharing ? "border-white/10 bg-white/[.03] text-zinc-200 hover:bg-white/[.07]" : "bg-white text-black hover:bg-zinc-200"}`}
                  >
                    {isChatGPTConnecting ? <><Loader2 className="animate-spin" /> Waiting for ChatGPT…</> : chatGPTSession?.sharing ? <><LogIn /> Reconnect ChatGPT</> : <><LogIn /> Continue with ChatGPT</>}
                  </Button>
                  <p className="mt-2 text-[10px] leading-4 text-zinc-600">OAuth token chỉ nằm trong macOS Keychain của máy này, không lưu trong web.</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="transcript" className="field-label">Timestamped transcript</label>
                  <span className="text-[10px] text-zinc-600">{transcript.length.toLocaleString()} chars</span>
                </div>
                <Textarea id="transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} className="studio-textarea studio-transcript mt-2 font-mono text-[12px] leading-5" placeholder="00:00 Transcript..." />
                <p className="mt-2 text-xs leading-5 text-zinc-500">{transcriptStatus}</p>
              </div>
              <div>
                <label htmlFor="instruction" className="field-label">Your instruction</label>
                <Textarea id="instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} className="studio-textarea studio-transcript mt-2" placeholder="Ví dụ: bỏ intro, Part 2 mở bằng sự cố..." />
              </div>
              <Button onClick={analyze} disabled={isAnalyzing} className="h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]">
                {isAnalyzing ? <><Loader2 className="animate-spin" /> Building edit plan…</> : <><WandSparkles /> Generate 2-part plan</>}
              </Button>
              <p className="text-center text-[10px] leading-5 text-zinc-600">Không muốn đăng nhập? Chọn Mock hoặc chuyển sang Manual cut.</p>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="rounded-xl border border-[#ff4d2e]/15 bg-[#ff4d2e]/5 px-3 py-2 text-[11px] leading-5 text-[#ff9a88]">
                Không gọi AI, không cần transcript. Mỗi dòng: <strong>start - end tên đoạn</strong>.
              </div>
              <div>
                <label htmlFor="manual-title-1" className="field-label">Part 1 title</label>
                <Input id="manual-title-1" value={manualPart1Title} onChange={(event) => setManualPart1Title(event.target.value.toUpperCase())} className="studio-input mt-2" />
                <Textarea aria-label="Part 1 timestamp ranges" value={manualPart1Ranges} onChange={(event) => setManualPart1Ranges(event.target.value)} className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5" />
              </div>
              <div>
                <label htmlFor="manual-title-2" className="field-label">Part 2 title</label>
                <Input id="manual-title-2" value={manualPart2Title} onChange={(event) => setManualPart2Title(event.target.value.toUpperCase())} className="studio-input mt-2" />
                <Textarea aria-label="Part 2 timestamp ranges" value={manualPart2Ranges} onChange={(event) => setManualPart2Ranges(event.target.value)} className="studio-textarea mt-2 min-h-[88px] font-mono text-[12px] leading-5" />
              </div>
              <Button onClick={applyManualPlan} className="h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]">
                <Scissors /> Apply manual timestamps
              </Button>
              <p className="text-center text-[10px] leading-5 text-zinc-600">Accepted: MM:SS, HH:MM:SS, seconds · ranges must be chronological.</p>
            </TabsContent>
          </Tabs>

          {error && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs leading-5 text-red-300">{error}</p>}
        </aside>

        <section className="relative flex min-h-[820px] flex-col items-center overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_50%_38%,rgba(255,77,46,.11),transparent_36%)] px-4 py-7 xl:border-b-0 xl:border-r xl:px-8">
          <div className="mb-5 flex w-full max-w-[520px] items-center justify-between">
            <div>
              <p className="eyebrow">02 / PORTRAIT PREVIEW</p>
              <p className="mt-1 text-xs text-zinc-500">{hasEditPlan ? "Preview các đoạn đã chọn · 1.25×" : "Source preview · native 100%"}</p>
            </div>
            <div className="flex rounded-xl border border-white/8 bg-black/25 p-1">
              {plan.parts.map((part, index) => (
                <button key={part.id} onClick={() => setActivePartIndex(index)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activePartIndex === index ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>Part {part.id}</button>
              ))}
            </div>
          </div>

          <div
            ref={setPreviewElement}
            className="portrait-preview relative aspect-[9/16] shrink-0 overflow-hidden rounded-[34px] border border-white/12 bg-[#17191e] shadow-[0_38px_100px_rgba(0,0,0,.55)]"
            style={{ width: "min(100%, 388px, calc(56.25vh - 101.25px))" }}
          >
            {previewVideoUrl ? (
              <video ref={backgroundVideoRef} className="absolute inset-0 size-full object-cover opacity-50 blur-[22px]" src={previewVideoUrl} muted preload="metadata" playsInline />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_46%,#6c3422,transparent_28%),linear-gradient(145deg,#101114_10%,#292024_48%,#0d0e11_80%)]" />
            )}
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-x-[8.35%] top-[4.9%] z-10 flex h-[12.7%] items-end justify-center overflow-hidden text-center">
              <p
                className="social-copy overlay-copy-block"
                style={{
                  fontFamily: fontStack.join(", "),
                  fontSize: `${(originalTitleFit.fontSize * previewScale).toFixed(2)}px`,
                  lineHeight: (originalTitleFit.fontSize + originalTitleFit.lineSpacing) / originalTitleFit.fontSize,
                }}
              >
                {originalTitleFit.text}
              </p>
            </div>
            <div className="absolute inset-x-0 top-[18.75%] z-10 h-[56.25%] overflow-hidden border-y border-white/15 bg-[#22242a]">
              {previewVideoUrl ? (
                <video
                  ref={previewVideoRef}
                  className="native-preview-video cursor-pointer"
                  src={previewVideoUrl}
                  preload="metadata"
                  playsInline
                  onClick={() => void togglePreview()}
                  onLoadedMetadata={(event) => {
                    const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : preparedSource?.duration || 0;
                    setPreviewDuration(duration);
                    if (hasEditPlan) {
                      event.currentTarget.currentTime = activePart.segments[0]?.start || 0;
                      event.currentTarget.playbackRate = 1.25;
                    }
                    setPreviewError("");
                  }}
                  onTimeUpdate={updatePreviewClock}
                  onPlay={() => setIsPreviewPlaying(true)}
                  onPause={() => setIsPreviewPlaying(false)}
                  onEnded={() => { setIsPreviewPlaying(false); backgroundVideoRef.current?.pause(); }}
                  onError={() => setPreviewError("Không phát được source. Hãy bấm Chuẩn bị source lại hoặc thử video MP4/H.264.")}
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(125deg,#111_0%,#572317_42%,#ef6b32_43%,#241716_47%,#0b0c0f_100%)]" />
              )}
              {previewVideoUrl && !isPreviewPlaying && <button type="button" onClick={() => void togglePreview()} aria-label="Play preview" className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/50 backdrop-blur-md"><Play className="ml-0.5 size-5 fill-white" /></button>}
              <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[9px] font-bold tracking-[.08em] text-white backdrop-blur-md">NATIVE 100% · CENTER CROP</div>
            </div>
            <div className="absolute inset-x-[8.35%] top-[76.65%] z-10 flex h-[12.7%] items-start justify-center overflow-hidden text-center">
              <p
                className="social-copy social-copy-main overlay-copy-block"
                style={{
                  fontFamily: fontStack.join(", "),
                  fontSize: `${(partTitleFit.fontSize * previewScale).toFixed(2)}px`,
                  lineHeight: (partTitleFit.fontSize + partTitleFit.lineSpacing) / partTitleFit.fontSize,
                }}
              >
                {partTitleFit.text}
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-[4.2%] z-10 text-center"><span className="social-copy text-[clamp(17px,2.7vh,23px)]">{activePart.id}/{plan.parts.length}</span></div>
            <div className="absolute bottom-2.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/65" />
          </div>

          <div className="preview-controls mt-4 w-full max-w-[520px]">
            <button type="button" onClick={() => void togglePreview()} disabled={!previewVideoUrl} aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}>
              {isPreviewPlaying ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
            </button>
            <span>{formatTime(previewCurrentTime)}</span>
            <input
              className="preview-seek"
              type="range"
              min={0}
              max={Math.max(timelineDuration, 0)}
              step={0.05}
              value={Math.min(previewCurrentTime, timelineDuration || 0)}
              onChange={(event) => seekPreview(Number(event.target.value))}
              disabled={!previewVideoUrl || timelineDuration <= 0}
              aria-label={hasEditPlan ? "Seek edited part" : "Seek source video"}
            />
            <span>{formatTime(timelineDuration)}</span>
          </div>
          {previewError && <p className="mt-2 max-w-[520px] text-center text-[11px] leading-5 text-red-300">{previewError}</p>}

          <div className="mt-4 grid w-full max-w-[520px] grid-cols-3 gap-2">
            <div className="preview-stat"><span>Source cut</span><strong>{formatTime(durationOf(activePart))}</strong></div>
            <div className="preview-stat accent"><span>After 1.25×</span><strong>{formatTime(finalDurationOf(activePart))}</strong></div>
            <div className="preview-stat"><span>Font preset</span><strong>{fontStack[0]}</strong></div>
          </div>
        </section>

        <aside className="bg-[#0d0e11] p-5 xl:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">03 / EDIT PLAN</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Part {activePart.id}</h2>
            </div>
            <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/8 text-emerald-300"><Check /> Timeline valid</Badge>
          </div>

          <div className="mt-5">
            <label htmlFor="part-title" className="field-label">New part title</label>
            <Textarea id="part-title" value={activePart.title} onChange={(event) => updatePartTitle(event.target.value.toUpperCase())} className="studio-textarea mt-2 min-h-[72px] text-base font-bold leading-5" />
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">Main hook text · auto-scale trong vùng cố định 4 dòng · không tràn layout</p>
          </div>

          <div className="mt-5 space-y-2">
            {activePart.segments.map((segment, index) => (
              <article key={`${segment.start}-${segment.end}`} className="group rounded-2xl border border-white/8 bg-white/[.025] p-4 transition hover:border-white/15 hover:bg-white/[.045]">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#ff4d2e]/10 text-xs font-bold text-[#ff6b50]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-200">{segment.label}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600"><Clock3 className="size-3" /> {formatTime(segment.start)} — {formatTime(segment.end)}</div>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">{segment.reason}</span>
                  <ChevronRight className="size-4 text-zinc-700" />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-[#15161a] p-4">
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Scissors className="size-3.5" /> Source-timestamp duration</span><strong>{formatTime(durationOf(activePart))}</strong></div>
            <div className="my-3 h-px bg-white/8" />
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Sparkles className="size-3.5 text-[#ff6b50]" /> Final duration at 1.25×</span><strong className="text-[#ff806a]">{formatTime(finalDurationOf(activePart))}</strong></div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-300"><Settings2 className="size-3.5" /> Pipeline</span>
              <Badge variant="outline" className="border-white/10 text-zinc-500">{plan.providerUsed}</Badge>
            </div>
            <ol className="mt-3 space-y-2 text-[11px] text-zinc-500">
              {["Cut source ranges", "Concatenate chronologically", "Build 1080×1920 layout", "Add titles + part number", "Apply video + audio 1.25×"].map((step, index) => (
                <li key={step} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full bg-white/5 text-[9px] text-zinc-600">{index + 1}</span>{step}</li>
              ))}
            </ol>
          </div>

          {renderJob && (
            <div className={`mt-5 rounded-2xl border p-4 ${renderJob.state === "error" ? "border-red-400/20 bg-red-400/5" : renderJob.state === "done" ? "border-emerald-400/20 bg-emerald-400/5" : "border-[#ff4d2e]/20 bg-[#ff4d2e]/5"}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200">
                  {renderJob.state === "done" ? "Render hoàn tất" : renderJob.state === "error" ? "Render lỗi" : `Đang render Part ${renderJob.currentPart || 1}`}
                </span>
                <strong className="text-[#ff806a]">{renderJob.progress}%</strong>
              </div>
              <Progress value={renderJob.progress} className="mt-3 h-1.5 bg-white/8 [&>div]:bg-[#ff4d2e]" />
              {renderJob.error && <p className="mt-3 text-[11px] leading-5 text-red-300">{renderJob.error}</p>}
              {renderJob.outputs.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {renderJob.outputs.map((output) => (
                    <a key={output.part} href={`${WORKER_ORIGIN}${output.url}`} className="flex h-9 items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-zinc-200">
                      <Download className="size-3.5" /> Part {output.part} · {(output.size / 1024 / 1024).toFixed(1)} MB
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => void startRender()}
            disabled={isStartingRender || renderJob?.state === "queued" || renderJob?.state === "rendering" || !workerHealth?.ok}
            className="mt-5 h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]"
          >
            {isStartingRender || renderJob?.state === "queued" ? <><Loader2 className="animate-spin" /> Starting render…</> : renderJob?.state === "rendering" ? <><Loader2 className="animate-spin" /> Rendering {renderJob.progress}%</> : <><Film /> Render 2 MP4 files</>}
          </Button>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => downloadJson("edit-plan.json", plan)} className="h-10 rounded-xl border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"><FileJson /> Edit plan</Button>
            <Button variant="outline" onClick={downloadRenderConfig} className="h-10 rounded-xl border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"><Download /> Manifest</Button>
          </div>
          <button onClick={() => setPlan(mockPlan({ ...DEFAULT_REQUEST, originalTitle: sourceTitle, transcript, instruction }))} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs text-zinc-600 transition hover:text-zinc-300"><RotateCcw className="size-3.5" /> Reset demo plan</button>
          {!isChronological(activePart) && <p className="mt-3 text-xs text-red-300">Timeline is invalid. Regenerate this plan.</p>}
          <p className="mt-3 text-center text-[10px] leading-5 text-zinc-600">Timestamps luôn giữ theo source gốc. Worker chỉ apply 1.25× sau layout + typography.</p>
        </aside>
      </div>
    </main>
  );
}
