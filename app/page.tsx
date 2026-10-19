"use client";

import {hookNeedsReselection,validateTeaser} from "@/lib/teaser-hooks.mjs";
import {MusicPanel} from '@/components/music-panel';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Clock3,
  Download,
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
  Square,
  Trash2,
  Upload,
  WandSparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

import { VisualCustomizePanel } from "@/components/visual-customize-panel";
import { VisualTemplatePanel } from "@/components/visual-template-panel";
import { applyVisualTemplate } from "@/lib/visual-style/templates.mjs";
import { TextStylePanel, TextFontSelector } from "@/components/text-style-panel";
import { OverlayPanel, SceneOverlays } from "@/components/overlay-panel";
import { applyOverlayPreset, applyOverlayOpacity } from "@/lib/visual-style/overlay-presets.mjs";
import { BackgroundPanel } from "@/components/background-panel";
import { backgroundCss } from "@/lib/visual-style/backgrounds.mjs";
import { applyBackgroundPreset } from "@/lib/visual-style/background-presets.mjs";
import { VideoFilterPanel, VideoFilterDefinition } from "@/components/video-filter-panel";
import { applyFilterPreset, applyFilterIntensity } from "@/lib/visual-style/filter-presets.mjs";
import { browserFilterStyle } from "@/lib/visual-style/filters.mjs";
import { TextAnimationPanel } from "@/components/text-animation-panel";
import { CutTransitionPanel, CutTransitionVeil } from "@/components/cut-transition-panel";
import { presentationSegments, partTransitionWindows, TEASER_POLICY } from "@/lib/teaser-hooks.mjs";
import { titleAnimationPreviewCss } from "@/lib/visual-style/animations.mjs";
import { normalizeVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { applyTextPreset, applyFontOverride } from "@/lib/visual-style/text-presets.mjs";
import { textPreviewCss, subtitlePreviewCss } from "@/lib/visual-style/text-render.mjs";
import { constrainTitlePair, needsMeasuredTitleFit } from "@/lib/visual-style/title-fit.mjs";
import { listFonts, fontFamilyForStyle } from "@/lib/visual-style/fonts.mjs";
import { DEFAULT_VISUAL_STYLE } from "@/lib/visual-style/defaults.mjs";
import { resolvePlanVisualStyle, snapshotPlanVisualStyle } from "@/lib/visual-style/normalize.mjs";
import { resolveWorkerOrigin } from "@/lib/worker-origin.mjs";
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
import { MediaLibraryPanel, type LibraryFile } from "@/components/media-library-panel";
import { EditorRenderList } from "@/components/editor-render-list";
import { completedRenderJobs } from '@/lib/render-delete.mjs';
import { CopyButton } from "@/components/copy-button";
import { trimPartStart } from "@/worker/part-start.mjs";
import { applyPartTimes, partTimes, type PartTime } from "@/lib/custom-time.mjs";
import { partCaptions, subtitleY, sourceCaptionTrack, isCurrentCaptionRequest, type CaptionTrack, type SubtitleStyle } from "@/lib/subtitles.mjs";
import { FOREGROUND_SCALE, PLAYBACK_RATE, FOREGROUND_HEIGHT, FOREGROUND_Y, TITLE_LAYOUT, TITLE_SHINE_SECONDS, TITLE_SHINE_WIDTH } from '@/lib/render-config.mjs';
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
import { fitTitlePair } from "@/lib/render-spec";
import { collectBatchDownloads, createBatchDownloadQueue } from "@/lib/batch-downloads.mjs";
import { clearSubmittedBatchInput } from "@/lib/batch-submission.mjs";
import { attachExternalHooks, externalHooksCurrent, buildExternalHookOnlyPrompt, parseExternalHookOnly } from "@/lib/teaser-import.mjs";
import {createAnalysisRequestGuard} from "@/lib/auto-cut/request.mjs";
import {lockedParts} from "@/lib/auto-cut/locks.mjs";
import { buildMusePrompt, parseMusePlan } from "@/lib/muse-plan.mjs";
import { locateTimelineTime, timelineTimeForSegment } from "@/lib/preview-timeline.mjs";

const WORKER_ORIGIN = resolveWorkerOrigin(process.env.NEXT_PUBLIC_MEDIA_WORKER_ORIGIN);

type WorkerHealth = {
  ok: boolean;
  readyForYouTube: boolean;
  chatGPTAuthAvailable: boolean;
  tools: { ffmpeg: string | null; ffprobe: string | null; ytDlp: string | null };
  render?: { encoder: string; hardwareAccelerated: boolean; label: string; colorSpace: string; contrast?: number; saturation?: number };
};

type ChatGPTSession = {
  available: boolean;
  connected: boolean;
  sharing: boolean;
  email?: string | null;
  name?: string | null;
  expiresAt?: string | null;
  needsSignIn?: boolean;
  error?: string;
};
type WorkerSource = {
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
  captions?: CaptionTrack["cues"];
};

type RenderJob = {
  id: string;
  sourceId: string;
  state: "queued" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  currentPart: number | null;
  outputs: Array<{ part: number; filename: string; size: number; url: string }>;
  error: string | null;
  plan?: EditPlan;
  createdAt?: string;
  stopping?: boolean;
};

type BatchJob = {
  id: string;
  finished: boolean;
  items: Array<{
    id: string;
    url: string;
    title?: string;
    sourceId?: string;
    state: "pending" | "downloading" | "analyzing" | "queued" | "rendering" | "done" | "error" | "cancelled" | "paused" | "awaiting-import" | "review-required" | "render-ready" | "submitting";
    settings?:{music?:EditPlan["music"];hookTransition?:EditPlan["hookTransition"];provider?:AiProvider;instruction?:string;supplementalPrompt?:string;visualStyle?:EditPlan["visualStyle"];subtitles?:SubtitleStyle};
    error: string | null;
    plan?: EditPlan;
    job?: RenderJob;
  }>;
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
  originalTitle: "",
  transcript: DEMO_TRANSCRIPT,
  instruction: `Hãy chia video thành đúng 2 part theo quy tắc sau.

QUY TẮC QUAN TRỌNG NHẤT:

1. Phân tích toàn bộ transcript và xác định điểm bắt đầu hấp dẫn nhất của video.
Điểm này sẽ là START của PART 1.

2. Sau đó, trong phần video nằm SAU điểm bắt đầu Part 1, hãy xác định một điểm bắt đầu hấp dẫn mạnh thứ hai.
Điểm này sẽ là START của PART 2.

Hai điểm bắt đầu nên là những đoạn có khả năng giữ chân người xem tốt nhất, ví dụ:
- sự cố
- reveal
- hành động mới
- câu nói gây tò mò
- kết quả bất ngờ
- reaction
- soundcheck
- mở capo
- test
- before/after
- phát hiện quan trọng
- con số đáng chú ý
- một chủ đề mới đủ mạnh để mở video độc lập

PART 1:
- Bắt đầu tại Hook 1.
- Kết thúc ngay trước Hook 2.
- Giữ TOÀN BỘ nội dung nằm giữa Hook 1 và Hook 2.
- Không tự ý bỏ các đoạn chỉ vì chúng hơi chậm, dài dòng, technical, đi đường, ăn uống hoặc ít hấp dẫn.
- Chỉ được loại quảng cáo, sponsor, quảng bá sản phẩm không liên quan, kêu gọi subscribe, like, follow hoặc quảng bá channel.

PART 2:
- Bắt đầu chính xác tại Hook 2.
- Chạy từ Hook 2 đến HẾT VIDEO.
- Giữ TOÀN BỘ nội dung còn lại.
- Không tự ý rút gọn nội dung.
- Chỉ được loại quảng cáo, sponsor, quảng bá sản phẩm không liên quan, kêu gọi subscribe, like, follow hoặc quảng bá channel.

Phần video nằm trước Hook 1 được bỏ hoàn toàn.

TUYỆT ĐỐI KHÔNG:
- đảo thứ tự footage
- gom những đoạn rời rạc lại
- lấy đoạn sau đưa lên trước
- tự cắt các đoạn “nhàm chán”
- tối ưu retention bằng cách bỏ nội dung ở giữa
- chia video thành hai phần bằng nhau theo thời lượng

Mục tiêu không phải tìm những đoạn hay nhất rồi ghép lại.

Mục tiêu là tìm 2 ĐIỂM VÀO tốt nhất, sau đó dùng chúng làm hai mốc chia video.

Cấu trúc bắt buộc:

SOURCE VIDEO:

[Bỏ phần trước Hook 1]

HOOK 1
↓
PART 1 giữ liên tục
↓
HOOK 2
↓
PART 2 giữ liên tục
↓
END

Ngoại lệ duy nhất được phép cắt bên trong Part 1 hoặc Part 2:
- quảng cáo
- sponsor
- self-promotion
- kêu gọi like
- kêu gọi subscribe
- kêu gọi follow
- quảng bá channel

Khi chọn Hook 2, Hook 2 phải:
- nằm sau Hook 1 trên timeline
- đủ mạnh để Part 2 có thể xem như một video riêng
- ưu tiên bắt đầu tại một chủ đề, hành động hoặc tình huống mới

Không cần Part 1 và Part 2 có thời lượng giống nhau.

Tự động nhận diện và loại bỏ credit, quảng cáo, tài trợ, giới thiệu/quảng bá kênh, lời kêu gọi like/subscribe/follow và nội dung không liên quan ở CẢ HAI part, kể cả khi không có yêu cầu riêng. Giữ nội dung chính, tình tiết hấp dẫn và mạch kể tự nhiên. Không loại nội dung chính chỉ vì có tên thương hiệu hoặc sản phẩm. Đây là ngoại lệ cho quy tắc giữ liên tục; không được dùng để tự ý cắt các đoạn chậm nhưng có liên quan.

App tự bỏ 1 giây đầu mỗi part để tránh dính câu nói phía trước. Trả timestamp Hook gốc, KHÔNG tự cộng 1 giây trong kết quả AI.
Chia làm sao phải đảm bảo mỗi part phải trên 1 phút sau khi bỏ 1 giây đầu và xuất video ở tốc độ 1.25× (tức hơn 76 giây footage gốc được giữ lại mỗi part, không tính các đoạn đã loại).
Nếu part hoặc video quá ngắn, được phép chọn một đoạn footage có thật phù hợp nhất trong toàn clip và ghép vào CUỐI part, có thể lặp lại nếu cần để đủ thời lượng. Đây là ngoại lệ duy nhất cho thứ tự footage: phần nội dung chính vẫn giữ timeline gốc, đoạn bổ sung phải đánh dấu isPadding: true và giải thích rõ. Không bịa lời nói, thông tin hoặc footage không có trong source.

Sau khi chọn xong, trả về:
- Part 1 start
- Part 1 end
- Part 2 start
- Part 2 end
- Hook quote của từng part
- các đoạn quảng cáo/sub cần loại
- title Part 1
- title Part 2
- Đúng 10 hashtag cho mỗi part, theo đúng chủ đề và nội dung được giữ lại của part đó
- 10 hashtag, bao gồm tag nội dung + tag nội dung lớn (chủ đề) + tag trending phù hợp với nội dung và thị trường video; không dùng tag không liên quan hoặc bịa rằng tag đang thịnh hành.

Title và hashtag phải dùng ngôn ngữ gốc của video.
Không được bịa thông tin không có trong transcript.`,
  provider: "mock",
};

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
  const [supplementalPrompt, setSupplementalPrompt] = useState("");
  const [customTimes, setCustomTimes] = useState<PartTime[] | null>(null);
  const [plan, setPlan] = useState<EditPlan>(() => mockPlan(DEFAULT_REQUEST));
  const subtitleSettings = useMemo(() => resolvePlanVisualStyle(plan).subtitle, [plan]);
  const setSubtitleSettings = useCallback((update: SubtitleStyle | ((current: SubtitleStyle) => SubtitleStyle)) => {
    setPlan((current) => {
      const subtitle = resolvePlanVisualStyle(current).subtitle;
      const visualStyle = resolvePlanVisualStyle({ ...current, subtitles: typeof update === "function" ? update(subtitle) : update });
      return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
    });
  }, []);
  const replacePlan = useCallback((next: EditPlan) => {
    setPlan((current) => { const style = resolvePlanVisualStyle(current); return snapshotPlanVisualStyle({ ...next, music:current.music, musicSpeech:current.musicSpeech, visualStyle: style, subtitles: style.subtitle, hookTransition:current.hookTransition??next.hookTransition }); });
  }, []);
  const [sourceCaptions, setSourceCaptions] = useState<CaptionTrack | null>(null);
  const subtitleRequestSerial = useRef(0);
  const subtitleSourceRef = useRef<string | undefined>(undefined);
  const subtitleAutoKey = useRef("");
  const [subtitleBusy, setSubtitleBusy] = useState(false);
  const [subtitleNotice, setSubtitleNotice] = useState("");
  const [speechModel, setSpeechModel] = useState<{ modelReady: boolean; installing: boolean; downloadedBytes?: number; totalBytes?: number } | null>(null);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisRequests = useRef(createAnalysisRequestGuard());
  const [analysisNotice,setAnalysisNotice] = useState("");
  useEffect(()=>{const guard=analysisRequests.current;return()=>guard.invalidate();},[]);
  function invalidateAnalysis(){analysisRequests.current.invalidate();setIsAnalyzing(false);setAnalysisNotice("");}
  const [webAiPrompt, setWebAiPrompt] = useState("");
  const [webAiResult, setWebAiResult] = useState("");
  const [webAiContext, setWebAiContext] = useState<{ sourceId: string; transcript: string; instruction: string; provider: AiProvider; requestId: string; analysisKey?:string; supplementalPrompt?:string; lockedPlan?:EditPlan; hookPlan?: EditPlan; mainSignature?: string } | null>(null);
  const [webAiNotice, setWebAiNotice] = useState("");
  const [webAiError, setWebAiError] = useState("");
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
  const [editorRenderJobs, setEditorRenderJobs] = useState<RenderJob[]>([]);
  const [editorRenderError, setEditorRenderError] = useState("");
  const [editorRenderNotice, setEditorRenderNotice] = useState("");
  const [deletingRenderIds, setDeletingRenderIds] = useState<string[]>([]);
  const [deletingAllRenders, setDeletingAllRenders] = useState(false);
  const deletingAllPending = useRef(false);
  const deletedEditorJobs = useRef(new Set<string>());
  const editorMutationEpoch = useRef(0);
  const [stoppingRenderIds, setStoppingRenderIds] = useState<string[]>([]);
  const sourceSelectionEpoch = useRef(0);
  const renderSubmissionPending = useRef(false);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batch, setBatch] = useState<BatchJob | null>(null);
  const [batchEditing,setBatchEditing]=useState<{batchId:string;itemId:string;sourceId:string}|null>(null);
  const [pastBatches, setPastBatches] = useState<BatchJob[]>([]);
  const [selectedBatchPreviewKey, setSelectedBatchPreviewKey] = useState("");
  const [batchPreviewError, setBatchPreviewError] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batchPollVersion, setBatchPollVersion] = useState(0);
  const batchPollEpoch = useRef(0);
  const batchSubmitPending = useRef(false);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [workspace, setWorkspace] = useState<"editor" | "batch" | "storage">("editor");
  const removedMediaUrls = useRef(new Set<string>());
  const [isStoppingBatch, setIsStoppingBatch] = useState(false);
  const [deletingBatchItems, setDeletingBatchItems] = useState<string[]>([]);
  const [batchNotice, setBatchNotice] = useState("");
  const deletedBatchItems = useRef(new Set<string>());
  const [autoDownloadRequests, setAutoDownloadRequests] = useState(0);
  const [autoDownloadError, setAutoDownloadError] = useState("");
  const batchDownloadQueue = useRef<ReturnType<typeof createBatchDownloadQueue> | null>(null);
  const [manualPart1Title, setManualPart1Title] = useState("THE MOMENT THAT MATTERS");
  const [manualPart2Title, setManualPart2Title] = useState("SEE HOW THE STORY ENDS");
  const [manualPart1Ranges, setManualPart1Ranges] = useState("01:12 - 01:46 First reaction\n02:25 - 03:18 Engine reveal");
  const [manualPart2Ranges, setManualPart2Ranges] = useState("06:22 - 07:14 The problem\n08:41 - 09:36 Final result");
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(384);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewSegmentIndex = useRef(0);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const previewPlayingRef = useRef(false);
  function changeWorkspace(next:"editor"|"batch"|"storage"){
    if(next!=="editor"){previewPlayingRef.current=false;setIsPreviewPlaying(false);previewVideoRef.current?.pause();backgroundVideoRef.current?.pause();}
    setWorkspace(next);
  }
  const [sourceSize, setSourceSize] = useState({ width: 1920, height: 1080 });

  // Timing depends on cuts/provider, never on appearance-only edits.
  const timing = useMemo(() => {
    let base = { parts: plan.parts, providerUsed: plan.providerUsed, analysis:plan.analysis };
    try {
      base = { ...base, parts: plan.parts.map(trimPartStart) };
      const effective=customTimes?applyPartTimes(base,customTimes,preparedSource?.duration):base;
      return {parts:effective.parts,analysis:effective.analysis,error:""};
    } catch (caught) { return { parts: base.parts, analysis:base.analysis, error: caught instanceof Error ? caught.message : "Thời gian không hợp lệ." }; }
  }, [plan.parts, plan.providerUsed, plan.analysis, customTimes, preparedSource?.duration]);
  const effectiveTiming = { plan: { ...plan, parts: timing.parts, analysis:timing.analysis }, error: timing.error };
  const previewPlan: EditPlan = {...effectiveTiming.plan,musicSpeech:plan.musicSpeech?.sourceId===preparedSource?.id?plan.musicSpeech:undefined};
  const previewVisualStyle = useMemo(() => resolvePlanVisualStyle({ visualStyle: previewPlan.visualStyle, subtitles: subtitleSettings }), [previewPlan.visualStyle, subtitleSettings]);
  const videoColorFilter = browserFilterStyle(previewVisualStyle.filter, { contrast: workerHealth?.render?.contrast ?? DEFAULT_VISUAL_STYLE.filter.contrast, saturation: workerHealth?.render?.saturation ?? DEFAULT_VISUAL_STYLE.filter.saturation });
  const activePart = previewPlan.parts[activePartIndex];
  const playbackSegments = useMemo(() => presentationSegments(activePart), [activePart]);
  const transitionWindows = useMemo(() => hasEditPlan ? partTransitionWindows(activePart, previewVisualStyle.cutTransition, previewPlan.hookTransition) : [], [hasEditPlan, previewVisualStyle.cutTransition, activePart,previewPlan.hookTransition]);
  const subtitleCues = useMemo(() => sourceCaptions?.sourceId === preparedSource?.id ? sourceCaptions?.cues || [] : [], [sourceCaptions, preparedSource?.id]);
  const previewCaptions = useMemo(() => partCaptions(previewPlan.captionCues?.cues || subtitleCues, activePart, previewVisualStyle.subtitle), [previewPlan.captionCues, subtitleCues, activePart, previewVisualStyle.subtitle]);
  const previewCaption = previewCaptions.find((cue) => previewCurrentTime * PLAYBACK_RATE >= cue.start && previewCurrentTime * PLAYBACK_RATE < cue.end);
  const partDuration = finalDurationOf(activePart);
  const mainSignature = JSON.stringify({ title: plan.originalTitle, parts: previewPlan.parts.map((part) => ({ ...part, teaser: undefined })), cues: sourceCaptions?.cues });
  const latestMainSignature = useRef(mainSignature);
  useEffect(() => { latestMainSignature.current = mainSignature; }, [mainSignature]);
  const hookIdentity = JSON.stringify({ sourceId: preparedSource?.id, provider, transcript, instruction, mainSignature });
  const latestHookIdentity = useRef(hookIdentity);
  useEffect(() => { latestHookIdentity.current = hookIdentity; }, [hookIdentity]);
  const timelineDuration = hasEditPlan ? partDuration : previewDuration;
  const fontStack = useMemo(
    () => fontFamilyForStyle(previewVisualStyle.originalTitle.font, `${plan.originalTitle} ${activePart.title}`, { browser: true }).split(", "),
    [activePart.title, plan.originalTitle, previewVisualStyle.originalTitle.font],
  );
  const legacyTitlePair = useMemo(
    () => fitTitlePair(plan.originalTitle, activePart.title), [plan.originalTitle, activePart.title],
  );
  const titleFitInput = useMemo(() => ({ original: plan.originalTitle, part: activePart.title, originalStyle: previewVisualStyle.originalTitle, partStyle: previewVisualStyle.partTitle, scale: previewWidth / 1080 }), [plan.originalTitle, activePart.title, previewVisualStyle.originalTitle, previewVisualStyle.partTitle, previewWidth]);
  const [measuredTitlePair, setMeasuredTitlePair] = useState<{ input: typeof titleFitInput; pair: typeof legacyTitlePair } | null>(null);
  useEffect(() => {
    const style = { originalTitle: titleFitInput.originalStyle, partTitle: titleFitInput.partStyle };
    if (!needsMeasuredTitleFit(style)) return;
    let cancelled = false;
    void (async () => {
      for (const [text, appearance] of [[titleFitInput.original, style.originalTitle], [titleFitInput.part, style.partTitle]] as const) {
        await document.fonts.load(`${appearance.fontWeight} 70px ${fontFamilyForStyle(appearance.font, text, { browser: true })}`, text || "A");
      }
      if (cancelled) return;
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      const pair = await constrainTitlePair(titleFitInput.original, titleFitInput.part, legacyTitlePair, (text, size, role) => {
        const appearance = role === "original" ? style.originalTitle : style.partTitle;
        context.font = `${appearance.fontWeight} ${(size * titleFitInput.scale).toFixed(2)}px ${fontFamilyForStyle(appearance.font, role === "original" ? titleFitInput.original : titleFitInput.part, { browser: true })}`;
        const metrics = context.measureText(text);
        return Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) / titleFitInput.scale + appearance.outline * 2 + 2;
      });
      if (!cancelled) setMeasuredTitlePair({ input: titleFitInput, pair });
    })().catch((error) => console.error("Title font measurement failed", error));
    return () => { cancelled = true; };
  }, [titleFitInput, legacyTitlePair]);
  const { original: originalTitleFit, part: partTitleFit } = measuredTitlePair?.input === titleFitInput ? measuredTitlePair.pair : legacyTitlePair;
  const previewScale = previewWidth / 1080;
  const titleShineStyle = { maskImage: 'linear-gradient(to right, transparent, #000 50%, transparent)', maskRepeat: 'no-repeat', maskSize: `${TITLE_SHINE_WIDTH * previewScale}px 100%`, maskPosition: `${((1080 - TITLE_SHINE_WIDTH) * (previewCurrentTime % TITLE_SHINE_SECONDS) / TITLE_SHINE_SECONDS - 90) * previewScale}px 0` };
  const previewVideoUrl = useMemo(
    () => (sourceMode === "local" && localVideoUrl) || (preparedSource ? `${WORKER_ORIGIN}/api/sources/${preparedSource.id}/media` : ""),
    [localVideoUrl, preparedSource, sourceMode],
  );

  useEffect(() => {
    if (!hasEditPlan || !previewVideoUrl) return;
    const video = previewVideoRef.current;
    const background = backgroundVideoRef.current;
    if (!video) return;
    video.pause();
    previewPlayingRef.current = false;
    setIsPreviewPlaying(false);
    background?.pause();
    previewSegmentIndex.current = 0;
    video.currentTime = playbackSegments[0]?.start || 0;
    video.playbackRate = PLAYBACK_RATE;
    video.preservesPitch = true;
    if (background) {
      background.currentTime = video.currentTime;
      background.playbackRate = PLAYBACK_RATE;
    }
    const timer = window.setTimeout(() => setPreviewCurrentTime(0), 0);
    return () => window.clearTimeout(timer);
  }, [hasEditPlan, playbackSegments, previewVideoUrl]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = previewVideoRef.current;
      if (video && hasEditPlan && previewPlayingRef.current && !video.seeking) {
        const segments = playbackSegments;
        const current = segments[previewSegmentIndex.current];
        if (!video.paused) updatePreviewClock();
        const complete = current && video.currentTime >= current.end - 0.025;
        if (complete) {
          const next = segments[previewSegmentIndex.current + 1];
          if (next) {
            previewSegmentIndex.current += 1;
            video.currentTime = next.start;
            if (backgroundVideoRef.current) backgroundVideoRef.current.currentTime = next.start;
            void video.play().catch(() => setPreviewError("Bấm Play để tiếp tục footage bổ sung."));
            void backgroundVideoRef.current?.play().catch(() => undefined);
          } else {
            video.pause();
            backgroundVideoRef.current?.pause();
            previewPlayingRef.current = false; setIsPreviewPlaying(false);
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  // The source media supplies the running clock across retained ranges.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEditPlan, playbackSegments]);

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
    let active = true;
    let pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      const epoch = editorMutationEpoch.current;
      try {
        const response = await fetch(`${WORKER_ORIGIN}/api/editor-renders`, { cache: "no-store" });
        const data = (await response.json()) as { jobs?: RenderJob[]; error?: string };
        if (!response.ok || !data.jobs) throw new Error(data.error || "Không đọc được danh sách render.");
        if (active && epoch === editorMutationEpoch.current) {
          const jobs = data.jobs.filter((job) => !deletedEditorJobs.current.has(job.id)).map((job) => ({ ...job, outputs: job.outputs.filter((output) => !removedMediaUrls.current.has(output.url)) }));
          setEditorRenderJobs(jobs);
          setRenderJob((current) => current ? jobs.find((job) => job.id === current.id) || current : null);
          setEditorRenderError("");
        }
      } catch (caughtError) {
        if (active) setEditorRenderError(caughtError instanceof Error ? caughtError.message : "Mất kết nối với media worker.");
      } finally { pending = false; }
    };
    void poll();
    const timer = window.setInterval(poll, 1_200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
        const response = await fetch(`${WORKER_ORIGIN}/api/youtube/metadata?url=${encodeURIComponent(sourceUrl.trim())}`, {
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
          setCustomTimes(null);
          setSourceTitle(values.originalTitle);
          setManualPart1Title(values.part1Title);
          setManualPart1Ranges(values.part1Ranges);
          setManualPart2Title(values.part2Title);
          setManualPart2Ranges(values.part2Ranges);
          replacePlan(nextPlan);
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
  }, [replacePlan]);

  async function readChatGPTSession() {
    const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/session`, { cache: "no-store" });
    const data = (await response.json()) as { session?: ChatGPTSession; error?: string };
    if (!response.ok || !data.session) throw new Error(data.error || "Không đọc được ChatGPT session.");
    setChatGPTSession(data.session);
    return data.session;
  }

  useEffect(() => {
    const timer = setTimeout(() => setBatchId(localStorage.getItem("shortcut-batch-id") || ""), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const historyKey = "shortcut-auto-download-requests";
    let history: Set<string>;
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
      history = new Set(Array.isArray(saved) ? saved : []);
    } catch { history = new Set(); }
    const frames = new Set<HTMLIFrameElement>();
    const cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
    const queue = createBatchDownloadQueue({
      hasRequested: (key) => history.has(key),
      markRequested: (key) => {
        history.add(key);
        try { localStorage.setItem(historyKey, JSON.stringify([...history].slice(-2000))); } catch { /* In-memory deduplication still works. */ }
      },
      requestDownload: (output) => {
        if (!output.url.startsWith("/files/")) throw new Error("Đường dẫn tải video không hợp lệ.");
        const frame = document.createElement("iframe");
        frame.hidden = true;
        frame.title = `Tự động tải ${output.filename}`;
        frame.src = `${WORKER_ORIGIN}${output.url}`;
        document.body.appendChild(frame);
        frames.add(frame);
        const timer = setTimeout(() => { frame.remove(); frames.delete(frame); cleanupTimers.delete(timer); }, 60_000);
        cleanupTimers.add(timer);
      },
      onRequested: () => setAutoDownloadRequests((count) => count + 1),
      onError: () => setAutoDownloadError("Không gửi được yêu cầu tải tự động. Dùng nút Tải lại bên dưới."),
    });
    batchDownloadQueue.current = queue;
    return () => {
      queue.dispose();
      batchDownloadQueue.current = null;
      cleanupTimers.forEach(clearTimeout);
      frames.forEach((frame) => frame.remove());
    };
  }, []);

  useEffect(() => {
    if (!batchId) return;
    let disposed = false;
    const epoch = batchPollEpoch.current;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`${WORKER_ORIGIN}/api/batches/${batchId}`, { cache: "no-store" });
        const data = await response.json() as { batch?: BatchJob; error?: string };
        if (!response.ok || !data.batch) throw new Error(data.error || "Không đọc được hàng đợi.");
        if (disposed || epoch !== batchPollEpoch.current) return;
        data.batch.items = data.batch.items.filter((item) => !deletedBatchItems.current.has(item.id));
        for (const item of data.batch.items) if (item.job) item.job.outputs = item.job.outputs.filter((output) => !removedMediaUrls.current.has(output.url));
        setBatch(data.batch);
        setBatchError("");
        batchDownloadQueue.current?.enqueue(collectBatchDownloads(data.batch));
        if (!data.batch.finished) timer = setTimeout(() => void poll(), 2000);
      } catch (error) {
        if (disposed || epoch !== batchPollEpoch.current) return;
        setBatchError(error instanceof Error ? error.message : "Không đọc được hàng đợi.");
        timer = setTimeout(() => void poll(), 5000);
      }
    }
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [batchId, batchPollVersion]);

  useEffect(() => {
    if (workspace !== "batch" || !workerHealth?.ok) return;
    let disposed = false;
    async function loadHistory() {
      try {
        const response = await fetch(`${WORKER_ORIGIN}/api/batches`, { cache: "no-store" });
        const data = await response.json() as { batches?: BatchJob[] };
        if (response.ok && data.batches && !disposed) {
          for (const group of data.batches) for (const item of group.items) if (item.job) item.job.outputs = item.job.outputs.filter((output) => !removedMediaUrls.current.has(output.url));
          setPastBatches(data.batches);
        }
      } catch { /* The active queue still reports worker connection errors. */ }
    }
    void loadHistory();
    return () => { disposed = true; };
  }, [workspace, workerHealth?.ok, batchId, batch?.finished, batchPollVersion]);

  function libraryMoved(file: LibraryFile) {
    if (file.storageId !== "current") return;
    if (file.kind === "original") {
      if (preparedSource?.id === file.sourceId) setPreparedSource(null);
      return;
    }
    const url = file.renderUrl;
    if (!url) return;
    removedMediaUrls.current.add(url);
    const groups = [...(batch ? [batch] : []), ...pastBatches];
    batchDownloadQueue.current?.remove(groups.flatMap(collectBatchDownloads).filter((output) => output.url === url).map((output) => output.key));
    const prune = (group: BatchJob): BatchJob => ({ ...group, items: group.items.map((item) => item.job ? { ...item, job: { ...item.job, outputs: item.job.outputs.filter((output) => output.url !== url) } } : item) });
    setBatch((current) => current ? prune(current) : null);
    setPastBatches((groups) => groups.map(prune));
    setRenderJob((current) => current ? { ...current, outputs: current.outputs.filter((output) => output.url !== url) } : null);
    setEditorRenderJobs((jobs) => jobs.map((job) => ({ ...job, outputs: job.outputs.filter((output) => output.url !== url) })));
  }

  function libraryRestored(file: LibraryFile) {
    if (file.storageId !== "current") return;
    if (file.kind === "part") removedMediaUrls.current.delete(`/files/${file.sourceId}/outputs/${file.jobId}/part-${file.part}/${encodeURIComponent(file.filename)}`);
    file.restoredUrls?.forEach((url) => removedMediaUrls.current.delete(url));
    file.restoredItemIds?.forEach((id) => deletedBatchItems.current.delete(id));
    if (file.jobId) deletedEditorJobs.current.delete(file.jobId);
    editorMutationEpoch.current += 1;
    batchPollEpoch.current += 1;
    setBatchPollVersion((version) => version + 1);
  }

  async function deleteBatchVideo(group: BatchJob, item: BatchJob["items"][number]) {
    if (!item.id) return;
    if (!window.confirm(`Chuyển các Part của “${item.title || item.url}” vào Thùng rác và bỏ video khỏi hàng đợi?\n\nVideo nguồn và bản đã tải về Downloads vẫn được giữ. Có thể khôi phục hoặc xoá vĩnh viễn trong tab Thùng rác.`)) return;
    setDeletingBatchItems((ids) => [...ids, item.id]);
    setBatchError("");
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/batches/${group.id}/items/${item.id}`, { method: "DELETE" });
      const data = await response.json() as { batch?: BatchJob; error?: string; recoveryPath?: string | null };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không xoá được video.");
      deletedBatchItems.current.add(item.id);
      batchDownloadQueue.current?.remove(collectBatchDownloads({ id: group.id, items: [item] }).map((output) => output.key));
      data.batch.items = data.batch.items.filter((candidate) => !deletedBatchItems.current.has(candidate.id));
      if (batch?.id === group.id) setBatch(data.batch);
      setPastBatches((history) => history.map((previous) => previous.id === group.id ? data.batch! : previous));
      setBatchNotice(data.recoveryPath ? "Đã chuyển các Part vào Thùng rác. Có thể khôi phục hoặc xoá vĩnh viễn ở tab Thùng rác; video gốc và Downloads vẫn giữ nguyên." : "Đã xoá video khỏi danh sách.");
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không xoá được video.");
    } finally { setDeletingBatchItems((ids) => ids.filter((id) => id !== item.id)); }
  }

  async function stopBatch() {
    if (!batch || batch.finished) return;
    setIsStoppingBatch(true);
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/batches/${batch.id}/cancel`, { method: "POST" });
      const data = await response.json() as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không dừng được hàng đợi.");
      setBatch(data.batch);
      setBatchError("");
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không dừng được hàng đợi.");
    } finally { setIsStoppingBatch(false); }
  }

  async function stopRender(job: RenderJob) {
    if (stoppingRenderIds.includes(job.id)) return;
    setStoppingRenderIds((ids) => [...ids, job.id]);
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/jobs/${job.id}/cancel`, { method: "POST" });
      const data = await response.json() as { job?: RenderJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Không dừng được render.");
      editorMutationEpoch.current += 1;
      setRenderJob((current) => current?.id === job.id ? data.job! : current);
      setEditorRenderJobs((jobs) => jobs.map((current) => current.id === job.id ? data.job! : current));
    } catch (error) {
      setEditorRenderError(error instanceof Error ? error.message : "Không dừng được render.");
    } finally { setStoppingRenderIds((ids) => ids.filter((id) => id !== job.id)); }
  }

  async function deleteEditorRender(job: RenderJob, confirmed = false) {
    if (deletingRenderIds.includes(job.id) || job.stopping || ["queued", "rendering"].includes(job.state)) return false;
    if (!confirmed && !window.confirm(`Chuyển các Part của “${job.plan?.originalTitle || "video này"}” vào Thùng rác và xoá khỏi danh sách render?\n\nVideo gốc và bản trong Downloads vẫn được giữ. Có thể khôi phục các Part trong tab Thùng rác.`)) return false;
    setDeletingRenderIds((ids) => [...ids, job.id]);
    setEditorRenderError("");
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/editor-renders/${job.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { removed?: boolean; trashId?: string | null; error?: string };
      if (!response.ok || !data.removed) throw new Error(data.error || "Không xoá được render.");
      editorMutationEpoch.current += 1;
      deletedEditorJobs.current.add(job.id);
      setEditorRenderJobs((jobs) => jobs.filter((current) => current.id !== job.id));
      setRenderJob((current) => current?.id === job.id ? null : current);
      setEditorRenderNotice(data.trashId ? "Đã chuyển các Part vào Thùng rác. Video gốc và Downloads vẫn được giữ." : "Đã xoá tác vụ khỏi danh sách render.");
      return true;
    } catch (caught) { setEditorRenderError(caught instanceof Error ? caught.message : "Không xoá được render."); return false; }
    finally { setDeletingRenderIds((ids) => ids.filter((id) => id !== job.id)); }
  }

  async function deleteAllEditorRenders() {
    if (deletingAllPending.current || deletingRenderIds.length || stoppingRenderIds.length) return;
    const targets = completedRenderJobs(editorRenderJobs);
    if (!targets.length || !window.confirm(`Chuyển ${targets.length} tác vụ render đã kết thúc vào Thùng rác?\n\nVideo gốc và Downloads vẫn được giữ. Tác vụ đang chạy/chờ không bị huỷ hoặc xoá. Có thể khôi phục trong Thùng rác.`)) return;
    deletingAllPending.current = true; setDeletingAllRenders(true); setEditorRenderError('');
    let removed = 0;
    try {
      for (const job of targets) if (await deleteEditorRender(job, true)) removed++;
      setEditorRenderNotice(`Đã xoá ${removed}/${targets.length} tác vụ render. Video gốc và tác vụ đang chạy vẫn được giữ.`);
      if (removed < targets.length) setEditorRenderError(`${targets.length - removed} tác vụ chưa xoá được (có thể source đang được xử lý). Các mục này vẫn được giữ; thử lại sau.`);
    } finally { deletingAllPending.current = false; setDeletingAllRenders(false); }
  }

  async function resumeBatchItem(group:BatchJob,item:BatchJob["items"][number]){
    setBatchError("");
    try{const response=await fetch(`${WORKER_ORIGIN}/api/batches/${group.id}/resume`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({itemIds:[item.id]})});const data=await response.json() as {batch?:BatchJob;error?:string};if(!response.ok||!data.batch)throw new Error(data.error||"Không tiếp tục được item.");batchPollEpoch.current++;setBatchPollVersion(v=>v+1);setBatch(data.batch);setBatchId(data.batch.id);}
    catch(error){setBatchError(error instanceof Error?error.message:"Không tiếp tục được item.");}
  }
  async function openBatchItem(group:BatchJob,item:BatchJob["items"][number]){
    if(!item.sourceId)return;invalidateAnalysis();const ticket=analysisRequests.current.begin();const epoch=++sourceSelectionEpoch.current;setBatchError("");
    try{const response=await fetch(`${WORKER_ORIGIN}/api/sources/${item.sourceId}`,{signal:ticket.controller.signal});const data=await response.json() as {source?:WorkerSource;error?:string};if(!response.ok||!data.source)throw new Error(data.error||"Không mở được source đã lưu.");if(!analysisRequests.current.isCurrent(ticket)||epoch!==sourceSelectionEpoch.current)return;
      const source=data.source;setSourceMode("youtube");setSourceUrl(source.sourceUrl||item.url);setPreparedSource(source);setSourceTitle(source.title);setTranscript(source.transcript||"");setCustomTimes(null);setRenderJob(null);
      setProvider(item.settings?.provider||"chatgpt");setInstruction(item.settings?.instruction||"");setSupplementalPrompt(item.settings?.supplementalPrompt||"");
      setSourceCaptions(source.captions?.length?sourceCaptionTrack({sourceId:source.id,cues:source.captions,origin:"youtube"},source):null);
      if(item.plan){setPlan(snapshotPlanVisualStyle(item.plan));setHasEditPlan(true);}else{setPlan(current=>snapshotPlanVisualStyle({...current,originalTitle:source.title,music:item.settings?.music,musicSpeech:undefined,hookTransition:item.settings?.hookTransition,visualStyle:item.settings?.visualStyle,subtitles:item.settings?.subtitles}));setHasEditPlan(false);}
      setBatchEditing({batchId:group.id,itemId:item.id,sourceId:source.id});setWebAiPrompt("");setWebAiResult("");setWebAiContext(null);setWorkspace("editor");
    }catch(error){if(analysisRequests.current.isCurrent(ticket))setBatchError(error instanceof Error?error.message:"Không mở được item.");}finally{analysisRequests.current.finish(ticket);}
  }
  async function queueEditedBatchItem(){
    if(!batchEditing||preparedSource?.id!==batchEditing.sourceId)return;
    setError("");setIsStartingRender(true);
    try{if(effectiveTiming.error)throw new Error(effectiveTiming.error);const submitted=await chooseTeasers(previewPlan,preparedSource);
      const response=await fetch(`${WORKER_ORIGIN}/api/batches/${batchEditing.batchId}/items/${batchEditing.itemId}/plan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId:preparedSource.id,transcript,instruction,supplementalPrompt,plan:snapshotPlanVisualStyle({...submitted,...(sourceCaptions?.sourceId===preparedSource.id?{captionCues:sourceCaptions}:{})})})});const data=await response.json() as {batch?:BatchJob;error?:string};if(!response.ok||!data.batch)throw new Error(data.error||"Không lưu được plan item.");
      batchPollEpoch.current++;setBatchPollVersion(v=>v+1);setBatch(data.batch);setBatchId(data.batch.id);setBatchEditing(null);setWorkspace("batch");
    }catch(error){setError(error instanceof Error?error.message:"Không lưu được plan item.");}finally{setIsStartingRender(false);}
  }

  async function startBatch() {
    if (batchSubmitPending.current || isStoppingBatch) return;
    batchSubmitPending.current = true;
    const submittedInput = batchUrls;
    setBatchError("");
    setBatchNotice("");
    setIsStartingBatch(true);
    try {
      if(!["chatgpt","gemini","muse"].includes(provider))throw new Error("Chọn ChatGPT Auto hoặc Gemini/Muse import thủ công.");
      const urls = [...new Set(submittedInput.split(/\s+/).filter(Boolean))];
      if (!urls.length || urls.length > 20) throw new Error("Nhập từ 1 đến 20 link, mỗi link một dòng.");
      const response = await fetch(`${WORKER_ORIGIN}/api/batches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, provider, instruction, supplementalPrompt, visualStyle: previewVisualStyle, subtitles: subtitleSettings, music:previewPlan.music, hookTransition:previewPlan.hookTransition, batchId: batch && !batch.finished ? batch.id : undefined }),
      });
      const data = await response.json() as { batch?: BatchJob; error?: string };
      if (!response.ok || !data.batch) throw new Error(data.error || "Không tạo được hàng đợi.");
      // Invalidate older in-flight polls before applying the longer queue. Restart
      // polling even if the batch ID is unchanged or a last poll said finished.
      batchPollEpoch.current += 1;
      setBatchPollVersion((version) => version + 1);
      try { localStorage.setItem("shortcut-batch-id", data.batch.id); } catch { /* The current queue still runs without browser storage. */ }
      setBatch(data.batch);
      setBatchId(data.batch.id);
      setBatchUrls((current) => clearSubmittedBatchInput(current, submittedInput));
      setBatchNotice(`Đã thêm ${urls.length} link vào hàng đợi. Có thể paste thêm link và bấm chạy ngay, không cần chờ lượt trước xong.`);
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "Không tạo được hàng đợi.");
    } finally {
      batchSubmitPending.current = false;
      setIsStartingBatch(false);
    }
  }

  async function connectChatGPT() {
    setError("");
    if (!workerHealth?.ok) {
      setError("Media worker đang offline. Chạy `npm run personal` trước.");
      return;
    }
    const popup = window.open("about:blank", "shortcut-chatgpt", "popup,width=560,height=760");
    let attemptId: string | undefined;
    setIsChatGPTConnecting(true);
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/chatgpt/auth/start`, { method: "POST" });
      const data = (await response.json()) as { url?: string; attemptId?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Không bắt đầu được ChatGPT sign-in.");
      if (!popup) throw new Error("Trình duyệt đang chặn popup. Cho phép popup rồi thử lại.");
      attemptId = data.attemptId;
      if (!attemptId) throw new Error("Worker chưa hỗ trợ trạng thái đăng nhập. Khởi động DEV bản mới.");
      popup.location.href = data.url;

      for (let attempt = 0; attempt < 360; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        const auth = await fetch(`${WORKER_ORIGIN}/api/chatgpt/auth/status?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" }).then(r => r.json()) as { status: string; error?: string };
        if (["failed", "cancelled", "expired"].includes(auth.status)) throw new Error(auth.error || "Đăng nhập bị hủy/hết hạn.");
        if (auth.status !== "exchanging" && popup.closed && auth.status !== "connected") throw new Error("Bạn đã đóng cửa sổ đăng nhập. Bấm kết nối lại khi sẵn sàng.");
        if (auth.status === "connected") {
          const session = await readChatGPTSession();
          if (!session.sharing) setError("Đã đăng nhập nhưng ChatGPT plan usage chưa được cấp quyền. Bấm kết nối lại và cho phép plan usage.");
          return;
        }
      }
      throw new Error("ChatGPT sign-in hết thời gian chờ. Hãy thử lại.");
    } catch (caughtError) {
      popup?.close();
      setError(caughtError instanceof Error ? caughtError.message : "Không kết nối được ChatGPT.");
    } finally {
      if (attemptId) void fetch(`${WORKER_ORIGIN}/api/chatgpt/auth/status?attemptId=${encodeURIComponent(attemptId)}`, { method: "DELETE" }).catch(() => {});
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
    if (isWebAi) return;
    const selectionEpoch=sourceSelectionEpoch.current,ticket=analysisRequests.current.begin();
    setError("");setAnalysisNotice("Đang chuẩn bị source…");setIsAnalyzing(true);
    try {
      if(provider==="mock") {replacePlan(mockPlan({provider:"mock",originalTitle:sourceTitle,transcript,instruction}));setHasEditPlan(true);if(!preparedSource)await prepareSource(ticket.controller.signal);return;}
      if(provider!=="chatgpt")throw new Error("Auto dùng ChatGPT đã cấu hình; Gemini/Muse dùng prompt và import.");
      if(effectiveTiming.error)throw new Error(effectiveTiming.error);
      const source=preparedSource||await prepareSource(ticket.controller.signal);
      if(!source||!analysisRequests.current.isCurrent(ticket)||selectionEpoch!==sourceSelectionEpoch.current)return;
      setAnalysisNotice("Đang phân tích nội dung + scene/audio, chọn main và hook từng part… Có thể dừng mà không mất plan cũ.");
      const response=await fetch(`${WORKER_ORIGIN}/api/sources/${source.id}/auto-cut`,{method:"POST",signal:ticket.controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:transcript||source.transcript,instruction,supplementalPrompt,...(hasEditPlan?{currentPlan:previewPlan}:{}),...(sourceCaptions?.sourceId===source.id?{captionCues:sourceCaptions}:{})})});
      const data=await response.json() as {plan?:EditPlan;error?:string};
      if(!analysisRequests.current.isCurrent(ticket)||selectionEpoch!==sourceSelectionEpoch.current)return;
      if(!response.ok||!data.plan)throw new Error(data.error||"Không tạo được Smart Auto Cut.");
      setCustomTimes(null);replacePlan(data.plan);setHasEditPlan(true);setActivePartIndex(0);
      setAnalysisNotice(data.plan.analysis?.method==='deterministic-fallback'?`Fallback xác định · ${data.plan.analysis.fallbackReason}. Chưa kiểm chứng độ hấp dẫn/ngữ nghĩa bằng AI.`:"Đã chọn main + hook; kiểm tra lý do/tín hiệu và chỉnh từng part bên dưới.");
    }catch(caught){if(analysisRequests.current.isCurrent(ticket))setError(caught instanceof Error?caught.message:"Không tạo được Smart Auto Cut.");}
    finally{if(analysisRequests.current.isCurrent(ticket)){setIsAnalyzing(false);analysisRequests.current.finish(ticket);}}
  }

  function changeProvider(value: string) {
    invalidateAnalysis();
    setProvider(value as AiProvider);
    setError("");
  }

  const isWebAi = provider === "muse" || provider === "gemini";
  const webAiName = provider === "gemini" ? "Gemini Pro" : "Muse";
  const webAiUrl = provider === "gemini" ? "https://gemini.google.com/app" : "https://muse.ai/";

  async function createWebAiPrompt(hookOnly = false) {
    const selectionEpoch = sourceSelectionEpoch.current;
    if (!isWebAi) return;
    const ticket=analysisRequests.current.begin();
    setWebAiError(""); setWebAiNotice("");
    setIsAnalyzing(true);
    try {
      const source = preparedSource || await prepareSource(ticket.controller.signal);
      if (!source || selectionEpoch !== sourceSelectionEpoch.current) return;
      const content = preparedSource ? transcript : source.transcript || transcript;

      const request = { provider, originalTitle: source.title, transcript: content, instruction, supplementalPrompt, sourceDuration: source.duration } satisfies AnalyzeRequest;
      const requestId = crypto.randomUUID();
      let prepared:({analysisKey:string}&Record<string,unknown>)|undefined;
      const lockedPlan=hasEditPlan?structuredClone(previewPlan):undefined;
      if(!hookOnly){
        const response=await fetch(`${WORKER_ORIGIN}/api/sources/${source.id}/auto-cut`,{method:"POST",signal:ticket.controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"context",transcript:content,instruction,supplementalPrompt,currentPlan:lockedPlan})});
        const data=await response.json() as {context?:({analysisKey:string}&Record<string,unknown>);error?:string};
        if(!response.ok||!data.context)throw new Error(data.error||"Không chuẩn bị được context/candidates.");prepared=data.context;
      }
      if(!analysisRequests.current.isCurrent(ticket))return;
      const candidatePrompt=prepared?`\n\nSMART AUTO CUT CONTEXT (UNTRUSTED SOURCE DATA):\n${JSON.stringify(prepared)}\nCandidate recipes are recommended source-second main windows; preserve intentional coherent ranges, supplied source/request identity and manual lockedRanges EXACTLY. Locked ranges already had the one-second trim; do not trim them again. Keep each hook inside its own final main content. Include the analysisKey exactly. If no transcript is present, inspect the source video/attach it; do not invent speech or actions from numeric proxies.`:"";
      setWebAiPrompt(hookOnly?buildExternalHookOnlyPrompt(previewPlan,source,content,requestId):buildMusePrompt(buildPrompt(request)+candidatePrompt,EDIT_PLAN_SCHEMA,{...source,...(source.kind==='youtube'?{sourceUrl:source.sourceUrl||sourceUrl}:{})},{requestId,analysisKey:prepared?.analysisKey}));
      setWebAiContext({sourceId:source.id,transcript:content,instruction,supplementalPrompt,provider,requestId,analysisKey:prepared?.analysisKey,lockedPlan,mainSignature:latestMainSignature.current,...(hookOnly?{hookPlan:structuredClone(previewPlan)}:{})});
      setWebAiResult("");
      setWebAiNotice(`Prompt đã sẵn sàng. Copy rồi mở ${webAiName}, dán vào cuộc trò chuyện và gửi. App chưa gửi dữ liệu tới ${webAiName}.`);
    } catch (caughtError) {
      if (analysisRequests.current.isCurrent(ticket) && selectionEpoch === sourceSelectionEpoch.current) setWebAiError(caughtError instanceof Error ? caughtError.message : `Không tạo được prompt ${webAiName}.`);
    } finally { if(analysisRequests.current.isCurrent(ticket)){setIsAnalyzing(false);analysisRequests.current.finish(ticket);} }
  }


  // Transcript retrieval / editing rules cannot change the identity of a video.
  // The imported JSON's sourceId is validated separately by parseMusePlan.
  const webAiPromptIsCurrent = Boolean(isWebAi && webAiContext && preparedSource && webAiContext.sourceId === preparedSource.id && webAiContext.provider === provider && webAiContext.transcript === transcript && webAiContext.instruction === instruction && webAiContext.supplementalPrompt === supplementalPrompt && webAiContext.mainSignature === mainSignature);


  async function chooseTeasers(nextPlan: EditPlan, source: WorkerSource, force=false,signal?:AbortSignal) {
    if(!force&&nextPlan.parts.every(part=>{try{if(!part.teaser)return false;validateTeaser(part,source.duration);return true;}catch{return false;}}))return nextPlan;
    if (["gemini", "muse"].includes(nextPlan.providerUsed) && nextPlan.teaserPolicy === TEASER_POLICY) {
      if (!await externalHooksCurrent(nextPlan, source, transcript)) throw new Error("Hook import đã cũ sau sửa nội dung/transcript. Tạo prompt mới cho provider này trước khi xuất; không tự thay bằng ChatGPT/fallback.");
      return nextPlan;
    }
    const captionCues = sourceCaptions?.sourceId === source.id ? sourceCaptionTrack(sourceCaptions, source) : nextPlan.captionCues;
    const response = await fetch(`${WORKER_ORIGIN}/api/sources/${source.id}/teaser-hooks`, { method: "POST", signal,headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: transcript.slice(0,100_000), plan: { ...nextPlan, ...(captionCues ? { captionCues } : {}) } }) });
    const result = await response.json() as { plan?: EditPlan; error?: string };
    if (!response.ok || !result.plan) throw new Error(result.error || "Không chọn được teaser hook.");
    return result.plan;
  }

  async function reselectHooks(){
    if(!preparedSource)return;if(isWebAi){await createWebAiPrompt(true);return;}
    const ticket=analysisRequests.current.begin(),signature=latestMainSignature.current;setIsAnalyzing(true);setError('');
    try{const next=await chooseTeasers(previewPlan,preparedSource,true,ticket.controller.signal);if(analysisRequests.current.isCurrent(ticket)&&latestMainSignature.current===signature)setPlan(current=>({...current,parts:next.parts,teaserPolicy:next.teaserPolicy,hookTransition:current.hookTransition??next.hookTransition}));}catch(e){if(analysisRequests.current.isCurrent(ticket))setError(e instanceof Error?e.message:String(e));}finally{if(analysisRequests.current.isCurrent(ticket))setIsAnalyzing(false);}
  }

  useEffect(() => {
    subtitleSourceRef.current = preparedSource?.id;
    subtitleRequestSerial.current += 1;
    subtitleAutoKey.current = "";
    const sourceId = preparedSource?.id;
    queueMicrotask(() => {
      if (subtitleSourceRef.current !== sourceId) return;
      setSubtitleBusy(false); setSubtitleNotice("");
      setSourceCaptions((current) => current?.sourceId === sourceId ? current : null);
    });
  }, [preparedSource?.id]);

  const loadSubtitles = useCallback(async (install = false, regenerate = false) => {
    const source = preparedSource;
    if (!source || subtitleBusy) return;
    const selectionEpoch = sourceSelectionEpoch.current;
    const requestId = ++subtitleRequestSerial.current;
    subtitleAutoKey.current = `${source.id}:${subtitleSettings.source || 'auto'}`;
    const currentRequest = () => isCurrentCaptionRequest({ sourceId: source.id, serial: requestId, selectionEpoch }, { sourceId: subtitleSourceRef.current, serial: subtitleRequestSerial.current, selectionEpoch: sourceSelectionEpoch.current });
    setSubtitleBusy(true); setSubtitleNotice(install ? "Đang tải model Whisper base · 142 MB…" : "Đang tạo phụ đề…");
    try {
      if (install) {
        const response = await fetch(`${WORKER_ORIGIN}/api/speech/model`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || "Không tải được model.");
      }
      const response = await fetch(`${WORKER_ORIGIN}/api/sources/${source.id}/captions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerate, provider: subtitleSettings.source || 'auto' }) });
      const data = await response.json() as Partial<CaptionTrack> & { error?: string };
      if (!currentRequest()) return;
      if (!response.ok || !data.cues) throw new Error(data.error || "Không tạo được phụ đề.");
      const track = sourceCaptionTrack({ ...data, sourceId: data.sourceId || "", cues: data.cues, origin: data.origin || "" }, source);
      setSourceCaptions(track);
      setSubtitleNotice(`${data.cues.length} câu · ${data.origin === "youtube" ? "phụ đề YouTube" : "nhận diện local"}. Có thể sửa chữ trước khi xuất.`);
    } catch (caught) { if (currentRequest()) setSubtitleNotice(caught instanceof Error ? caught.message : "Không tạo được phụ đề."); }
    finally { if (currentRequest()) setSubtitleBusy(false); }
  }, [preparedSource, subtitleBusy, subtitleSettings.source]);

  useEffect(() => {
    if (!subtitleSettings.enabled) { subtitleAutoKey.current = ""; return; }
    if (!preparedSource || subtitleBusy || sourceCaptions?.sourceId === preparedSource.id || subtitleAutoKey.current === `${preparedSource.id}:${subtitleSettings.source || 'auto'}`) return;
    void loadSubtitles();
  }, [preparedSource, subtitleSettings.enabled, subtitleSettings.source, sourceCaptions?.sourceId, subtitleBusy, loadSubtitles]);

  useEffect(() => {
    if (!workerHealth?.ok || !subtitleSettings.enabled) return;
    let disposed = false;
    const refresh = async () => {
      try { const data = await (await fetch(`${WORKER_ORIGIN}/api/speech/status`)).json() as { modelReady: boolean; installing: boolean; downloadedBytes?: number; totalBytes?: number }; if (!disposed) setSpeechModel(data); } catch { /* Worker health already reports connection errors. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), subtitleBusy ? 2000 : 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [workerHealth?.ok, subtitleSettings.enabled, subtitleBusy]);

  function chooseSubtitleSource(source: 'youtube' | 'whisper') {
    subtitleRequestSerial.current += 1;
    subtitleAutoKey.current = '';
    setSourceCaptions(null); setSubtitleNotice('');
    setSubtitleSettings((current) => ({ ...current, source }));
  }

  async function installWhisperModel() {
    setSubtitleBusy(true); setSubtitleNotice('Đang tải Whisper base · 142 MB…');
    try {
      const response = await fetch(`${WORKER_ORIGIN}/api/speech/model`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json() as { modelReady: boolean; installing: boolean; downloadedBytes?: number; totalBytes?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không tải được model.');
      setSpeechModel(data); setSubtitleNotice('Whisper base đã sẵn sàng.'); subtitleAutoKey.current = '';
    } catch (caught) { setSubtitleNotice(caught instanceof Error ? caught.message : 'Không tải được model.'); }
    finally { setSubtitleBusy(false); }
  }

  async function applyWebAiResult() {
    const selectionEpoch = sourceSelectionEpoch.current;
    const ticket=analysisRequests.current.begin();
    setWebAiError(""); setWebAiNotice("");
    setIsAnalyzing(true);
    try {
      if (!preparedSource) throw new Error("Chuẩn bị source của video trước khi nhập JSON.");
      if (!webAiPromptIsCurrent || !webAiContext) throw new Error("Source, transcript, quy tắc hoặc provider đã đổi. Tạo prompt mới trước khi nhập JSON.");
      const context = webAiContext;
      const identity = hookIdentity;
      const imported = context.hookPlan ? null : parseMusePlan(webAiResult, preparedSource, webAiName, { requestId: context.requestId,analysisKey:context.analysisKey,lockedPlan:context.lockedPlan });
      const normalized=context.hookPlan||normalizePlan(imported!,provider);
      const refined=context.hookPlan||{...normalized,parts:normalized.parts.map(p=>({...p,smartCutApplied:true}))};
      const selections = context.hookPlan ? parseExternalHookOnly(webAiResult, preparedSource, context.requestId, context.hookPlan) : imported!.hookSelections || [];
      let nextPlan = await attachExternalHooks(refined, selections, preparedSource, context.transcript, context.provider, sourceCaptions?.cues);
      if(context.analysisKey&&!context.hookPlan){
        const response=await fetch(`${WORKER_ORIGIN}/api/sources/${preparedSource.id}/auto-cut`,{method:"POST",signal:ticket.controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"import",sourceId:preparedSource.id,requestId:context.requestId,analysisKey:context.analysisKey,provider:context.provider,transcript:context.transcript,instruction:context.instruction,supplementalPrompt:context.supplementalPrompt,currentPlan:context.lockedPlan,plan:nextPlan})});
        const data=await response.json() as {plan?:EditPlan;error?:string};if(!response.ok||!data.plan)throw new Error(data.error||"Import context đã thay đổi.");nextPlan=data.plan;
      }
      if (latestHookIdentity.current !== identity) throw new Error("Nội dung/provider đã đổi trong lúc kiểm tra. Tạo prompt mới; kết quả cũ không được áp dụng.");
      if (!analysisRequests.current.isCurrent(ticket) || selectionEpoch !== sourceSelectionEpoch.current) return;
      setCustomTimes(null);
      replacePlan(nextPlan);
      setHasEditPlan(true);
      setActivePartIndex(0);
      setRenderJob(null);
      setError("");
      setWebAiNotice(`Đã áp dụng 2 part từ ${webAiName}, hook external-import đã kiểm tra range, bỏ 1 giây theo contract; giữ nguyên lựa chọn main có chủ ý. Có thể sửa Custom Time trước khi render.`);
    } catch (caughtError) {
      if (analysisRequests.current.isCurrent(ticket) && selectionEpoch === sourceSelectionEpoch.current) setWebAiError(caughtError instanceof Error ? caughtError.message : `Không nhập được JSON ${webAiName}.`);
    }
    finally { if(analysisRequests.current.isCurrent(ticket)){setIsAnalyzing(false);analysisRequests.current.finish(ticket);} }
  }

  function applyManualPlan() {
    setCustomTimes(null);
    setError("");
    try {
      const nextPlan = manualPlan({
        originalTitle: sourceTitle,
        part1Title: manualPart1Title,
        part1Ranges: manualPart1Ranges,
        part2Title: manualPart2Title,
        part2Ranges: manualPart2Ranges,
      });
      replacePlan(nextPlan);
      setHasEditPlan(true);
      setActivePartIndex(0);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Timestamp không hợp lệ.");
    }
  }

  function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    sourceSelectionEpoch.current += 1; invalidateAnalysis();
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
    if (!previewPlayingRef.current) {
      try {
        if (hasEditPlan) {
          const last = playbackSegments.at(-1);
          if (last && previewSegmentIndex.current === playbackSegments.length - 1 && video.currentTime >= last.end - 0.05) {
            previewSegmentIndex.current = 0;
            video.currentTime = playbackSegments[0].start;
          }
          video.playbackRate = PLAYBACK_RATE;
        }
        previewPlayingRef.current = true; setIsPreviewPlaying(true);
        await video.play();
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.currentTime = video.currentTime;
          backgroundVideoRef.current.playbackRate = video.playbackRate;
          await backgroundVideoRef.current.play().catch(() => undefined);
        }
      } catch {
        previewPlayingRef.current = false; setIsPreviewPlaying(false);
        setPreviewError("Trình duyệt chưa phát được video source này.");
      }
    } else {
      previewPlayingRef.current = false; setIsPreviewPlaying(false);
      video.pause();
      backgroundVideoRef.current?.pause();
    }
  }

  const seekPreview = useCallback((value: number) => {
    const video = previewVideoRef.current;
    if (!video || !Number.isFinite(value)) return;
    let sourceTime = value;
    if (hasEditPlan) {
      const position = locateTimelineTime(playbackSegments, value);
      previewSegmentIndex.current = position.index;
      sourceTime = position.sourceTime;
      if (previewPlayingRef.current) { void video.play(); void backgroundVideoRef.current?.play(); }
    }
    video.currentTime = sourceTime;
    if (backgroundVideoRef.current) backgroundVideoRef.current.currentTime = sourceTime;
    setPreviewCurrentTime(value);
  }, [hasEditPlan, playbackSegments]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (workspace !== 'editor' || !previewVideoUrl || event.altKey || event.ctrlKey || event.metaKey || (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="combobox"]')))) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      seekPreview(Math.max(0, Math.min(timelineDuration, previewCurrentTime + (event.key === 'ArrowRight' ? 5 : -5))));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workspace, previewVideoUrl, timelineDuration, previewCurrentTime, seekPreview]);

  function updatePreviewClock() {
    const video = previewVideoRef.current;
    if (!video) return;
    let timelineTime = video.currentTime;
    if (hasEditPlan) {
      timelineTime = timelineTimeForSegment(playbackSegments, previewSegmentIndex.current, video.currentTime);
    }
    setPreviewCurrentTime(timelineTime);
    const background = backgroundVideoRef.current;
    if (background && Math.abs(background.currentTime - video.currentTime) > 0.3) {
      background.currentTime = video.currentTime;
    }
  }

  async function prepareSource(signal?:AbortSignal) {
    const selectionEpoch = sourceSelectionEpoch.current;
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
            method: "POST", signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: sourceUrl.trim() }),
          })
        : await fetch(`${WORKER_ORIGIN}/api/sources/upload?filename=${encodeURIComponent(localFile!.name)}`, {
            method: "POST", signal,
            headers: { "Content-Type": localFile!.type || "application/octet-stream", "X-Filename": encodeURIComponent(localFile!.name) },
            body: localFile,
          });
      const data = (await response.json()) as { source?: WorkerSource; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error || "Không chuẩn bị được source.");
      signal?.throwIfAborted();
      if (selectionEpoch !== sourceSelectionEpoch.current) return null;
      setPreparedSource(data.source);
      setCustomTimes(null);
      try {
        setSourceCaptions(data.source.captions?.length ? sourceCaptionTrack({ sourceId: data.source.id, cues: data.source.captions, origin: "youtube" }, data.source) : null);
      } catch (caught) {
        setSourceCaptions(null);
        setSubtitleNotice(caught instanceof Error ? caught.message : "Dữ liệu phụ đề không hợp lệ.");
      }
      setSourceTitle(data.source.title);
      setPlan((current) => ({ ...current, originalTitle: data.source!.title }));
      if (data.source.transcript) setTranscript(data.source.transcript);
      return data.source;
    } catch (caughtError) {
      if (selectionEpoch === sourceSelectionEpoch.current) setError(caughtError instanceof Error ? caughtError.message : "Không chuẩn bị được source.");
      return null;
    } finally {
      setIsPreparingSource(false);
    }
  }

  async function startRender() {
    if (renderSubmissionPending.current) return;
    const selectionEpoch = sourceSelectionEpoch.current;
    let submittedPlan = structuredClone(previewPlan);
    setError("");
    if (effectiveTiming.error) { setError(effectiveTiming.error); return; }
    if (!submittedPlan.parts.every(isChronological)) {
      setError("Edit plan có timestamp không hợp lệ.");
      return;
    }
    setIsStartingRender(true);
    renderSubmissionPending.current = true;
    try {
      const source = preparedSource || await prepareSource();
      if (!source) return;
      if (submittedPlan.teaserPolicy === TEASER_POLICY) submittedPlan = await chooseTeasers(submittedPlan, source);
      for (const part of submittedPlan.parts) {
        for (const segment of part.segments) {
          if (segment.end > source.duration + 0.05) {
            throw new Error(`Part ${part.id} có timestamp ${formatTime(segment.end)} vượt quá video source (${formatTime(source.duration)}). Hãy sửa timestamp hoặc Generate plan lại.`);
          }
        }
      }
      const response = await fetch(`${WORKER_ORIGIN}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, plan: snapshotPlanVisualStyle({ ...submittedPlan, subtitles: subtitleSettings, ...(subtitleSettings.enabled && sourceCaptions?.sourceId === source.id ? { captionCues: sourceCaptionTrack(sourceCaptions, source) } : {}) }) }),
      });
      const data = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Không thể bắt đầu render.");
      setEditorRenderJobs((jobs) => [data.job!, ...jobs.filter((job) => job.id !== data.job!.id)]);
      if (selectionEpoch === sourceSelectionEpoch.current) {
        setRenderJob(data.job);
        const renderedPlan = data.job.plan;
        if (renderedPlan && submittedPlan.teaserPolicy === TEASER_POLICY && latestMainSignature.current === mainSignature) setPlan((current) => ({ ...current, parts: renderedPlan.parts, teaserPolicy: TEASER_POLICY }));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể bắt đầu render.");
    } finally {
      setIsStartingRender(false);
      renderSubmissionPending.current = false;
    }
  }

  function updatePartTitle(title: string) {
    invalidateAnalysis();
    setPlan((current) => ({
      ...current,
      parts: current.parts.map((part, index) => index === activePartIndex ? { ...part, title } : part),
    }));
  }


  const batchPreviewOutputs = [ ...(batch ? [batch] : []), ...pastBatches.filter((group) => group.id !== batch?.id) ].flatMap((group) => group.items.flatMap((item) => (item.job?.outputs || []).filter((output) => output.url.startsWith("/files/")).map((output) => ({ ...output, key: `${group.id}:${item.id}:${output.part}`, title: item.title || item.url }))));
  const batchPreviewOutput = batchPreviewOutputs.find((output) => output.key === selectedBatchPreviewKey) || batchPreviewOutputs[0];

  return (
    <main className="min-h-screen bg-[#090a0c] text-white">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/8 bg-[#090a0c]/92 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {/* The same vector supplies the favicon, macOS icon and menu-bar mark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg?v=play-3" width={42} height={42} alt="Logo ShortCut Studio" className="size-[42px] shrink-0" />
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

      <nav aria-label="Chế độ làm việc" className="flex flex-wrap gap-2 border-b border-white/8 px-5 py-3">
        <button onClick={() => changeWorkspace("editor")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${workspace === "editor" ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>Chỉnh từng video</button>
        <button onClick={() => changeWorkspace("batch")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${workspace === "batch" ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>Xử lý hàng loạt {batch && !batch.finished ? "· Đang chạy" : ""}</button>
        <button onClick={() => changeWorkspace("storage")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${workspace === "storage" ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}><Trash2 className="size-4" /> Thùng rác</button>
      </nav>
      {workspace === "storage" && <MediaLibraryPanel workerOrigin={WORKER_ORIGIN} ready={Boolean(workerHealth?.ok)} onMoved={libraryMoved} onRestored={libraryRestored} />}
      {workspace === "batch" && <section className="mx-auto max-w-6xl px-5 py-6">
        <h1 className="text-2xl font-semibold">Xử lý hàng loạt</h1>
        <p className="mt-2 text-sm text-zinc-400">Nhập nhiều link. App tự lấy transcript, chia part, tạo title/hashtag và render.</p>
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Select value={provider === "muse" ? "muse" : provider === "gemini" ? "gemini" : "chatgpt"} onValueChange={changeProvider}>
            <SelectTrigger aria-label="AI provider hàng loạt" className="studio-input w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="chatgpt">ChatGPT Plus / Pro</SelectItem><SelectItem value="gemini" disabled>Gemini Pro · chỉ chỉnh từng video</SelectItem><SelectItem value="muse" disabled>Muse · chỉ chỉnh từng video</SelectItem></SelectContent>
          </Select>
          <Badge variant="outline" className={provider === "chatgpt" && chatGPTSession?.sharing ? "text-emerald-300" : "text-zinc-400"}>{isWebAi ? `${webAiName} bán tự động` : chatGPTSession?.sharing ? "ChatGPT đã kết nối" : "Chưa kết nối ChatGPT"}</Badge>
          {provider === "chatgpt" && !chatGPTSession?.sharing && <Button onClick={() => void connectChatGPT()} disabled={isChatGPTConnecting || !workerHealth?.ok} className="bg-white text-black"><LogIn /> Kết nối ChatGPT</Button>}
          {isWebAi && <p className="w-full text-xs leading-5 text-amber-200/80">{webAiName} cần nhập JSON từng video. <button onClick={() => changeWorkspace("editor")} className="underline">Về tab chỉnh từng video</button>, hoặc chọn ChatGPT để chạy hàng loạt tự động.</p>}
        </div>
        <details className="mt-4 rounded-xl border border-white/8 p-4">
          <summary className="cursor-pointer text-sm text-zinc-300">Quy tắc chia part · xem / sửa</summary>
          <Textarea aria-label="Quy tắc chia part hàng loạt" value={instruction} onChange={(event) => {invalidateAnalysis();setInstruction(event.target.value);}} className="studio-textarea studio-transcript mt-3" />
          <p className="mt-2 text-xs text-zinc-500">Dùng chung quy tắc với tab chỉnh từng video. Thay đổi chỉ áp dụng cho lượt chạy mới.</p>
        </details>
        <label htmlFor="batch-extra-prompt" className="field-label mt-4 block">Prompt bổ sung (không bắt buộc)</label>
        <Textarea id="batch-extra-prompt" value={supplementalPrompt} onChange={(event) => {invalidateAnalysis();setSupplementalPrompt(event.target.value);}} className="studio-textarea mt-2 min-h-[80px]" placeholder="Yêu cầu thêm cho các video trong lượt chạy mới…" />
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={subtitleSettings.enabled} onChange={(event) => setSubtitleSettings((current) => ({ ...current, enabled: event.target.checked }))} /> Auto Subtitle cho lượt chạy mới · dùng style ở tab chỉnh từng video</label>
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <label htmlFor="batch-urls" className="field-label">Xử lý nhiều link · {isWebAi ? `${webAiName} · chuẩn bị + import từng item` : "ChatGPT Auto"}</label>
            <Textarea id="batch-urls" value={batchUrls} onChange={(event) => setBatchUrls(event.target.value)} placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."} className="studio-textarea mt-2 min-h-[100px] text-xs leading-6" />
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">Tối đa 20 link mỗi lần thêm, mỗi dòng một link. Ô link tự xoá khi thêm thành công. Có thể thêm link vào cuối hàng đợi đang chạy; chuẩn bị video tiếp theo trong lúc render video trước, chỉ render một video mỗi lần.</p>
            <Button onClick={() => void startBatch()} disabled={!["chatgpt","gemini","muse"].includes(provider) || isStartingBatch || isStoppingBatch || !batchUrls.trim() || !workerHealth?.ok || (provider==="chatgpt"&&!chatGPTSession?.sharing)} className="mt-3 w-full rounded-xl bg-[#ff4d2e] text-white hover:bg-[#ff6247]">
              {isStartingBatch ? <Loader2 className="animate-spin" /> : <Film />} {isStartingBatch ? "Đang thêm link…" : batch && !batch.finished ? "Thêm vào hàng đợi đang chạy" : isWebAi?"Chuẩn bị nguồn · chờ import thủ công":"Chạy hàng đợi tự động"}
            </Button>
            <Button variant="outline" onClick={() => void stopBatch()} disabled={!batch || batch.finished || isStoppingBatch || isStartingBatch} className="mt-2 w-full rounded-xl border-red-400/30 bg-red-400/5 text-red-300 hover:bg-red-400/10">
              {isStoppingBatch ? <Loader2 className="animate-spin" /> : <Square />} {isStoppingBatch ? "Đang dừng…" : "Dừng hàng đợi"}
            </Button>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">Dừng tác vụ đang chạy và các link còn chờ. File đã xuất hoàn tất vẫn được giữ.</p>
            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-200">
              <p className="font-semibold">Tự động tải từng part khi render xong</p>
              <p className="mt-1 text-zinc-400">Giữ trang mở để tự tải. Nếu trình duyệt hỏi, cho phép tải nhiều file. Nút Tải lại luôn có bên dưới; refresh không tự tải trùng những file đã gửi yêu cầu.</p>
              {autoDownloadRequests > 0 && <p className="mt-1">Đã gửi {autoDownloadRequests} yêu cầu tải trong phiên này. Kiểm tra mục Downloads của trình duyệt.</p>}
              {autoDownloadError && <p className="mt-1 text-red-300">{autoDownloadError}</p>}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">Đóng tab không dừng xử lý. Thoát app sẽ tạm dừng. Bấm Tiếp tục/thử lại để dùng source/plan đã lưu; part render hoàn tất không bị render lại. Gemini/Muse chờ import từng item trong editor, không chạy AI unattended.</p>
            {batchError && <p className="mt-3 text-xs leading-5 text-red-300">{batchError}</p>}
            {batchNotice && <p role="status" className="mt-3 text-xs leading-5 text-emerald-300">{batchNotice}</p>}
            {(batch || pastBatches.length > 0) && <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
              {[...(batch ? [batch] : []), ...pastBatches.filter((group) => group.id !== batch?.id)].map((group) => <div key={group.id} className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{group.id === batch?.id ? "Hàng đợi hiện tại" : "Video đã xử lý trước đó"}</p>
              {group.items.filter((item) => !deletedBatchItems.current.has(item.id)).map((item, index) => (
                <div key={item.id || item.url} className="rounded-xl border border-white/8 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-xs font-semibold leading-5">{index + 1}. {item.title || item.url}</p>
                    <Button variant="outline" size="sm" onClick={() => void deleteBatchVideo(group, item)} disabled={!item.id || !["done", "error", "cancelled", "paused", "awaiting-import", "review-required", "render-ready"].includes(item.state) || deletingBatchItems.includes(item.id)} title={["done", "error", "cancelled", "paused", "awaiting-import", "review-required", "render-ready"].includes(item.state) ? "Xoá video và file render" : "Dừng hoặc chờ xử lý xong trước khi xoá"} className="h-8 shrink-0 rounded-lg border-red-400/20 bg-transparent text-xs text-red-300 hover:bg-red-400/10">
                      {deletingBatchItems.includes(item.id) ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Xoá
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-[#ff806a]">{{ paused:"Tạm dừng · có thể tiếp tục", "awaiting-import":"Chờ prompt/import thủ công trong editor", "review-required":"Fallback · cần xem và duyệt trong editor", "render-ready":"Plan đã lưu · chuẩn bị render", submitting:"Đang ghi render submission", pending: "Đang chờ", downloading: "Đang tải video + transcript", analyzing: "AI đang chia part + tạo hashtag", queued: "Đang chờ render", rendering: `Đang render ${item.job?.progress || 0}%`, done: "Hoàn tất", error: "Lỗi", cancelled: "Đã dừng" }[item.state]}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.sourceId&&<Button variant="outline" size="sm" onClick={()=>void openBatchItem(group,item)} className="h-8 text-xs">{["awaiting-import","review-required"].includes(item.state)?"Mở editor · chọn/import/duyệt":"Mở bản sao trong editor"}</Button>}
                    {["error","cancelled","paused","render-ready"].includes(item.state)&&<Button variant="outline" size="sm" onClick={()=>void resumeBatchItem(group,item)} className="h-8 text-xs">Tiếp tục / thử lại item</Button>}
                  </div>
                  {item.error && <p className="mt-2 text-xs leading-5 text-red-300">{item.error}</p>}
                  {item.plan?.parts.map((part) => <div key={part.id} className="mt-3">
                    <p className="text-[10px] text-zinc-500">TITLE SAU CÙNG · Part {part.id}</p>
                    <p className="mt-1 break-words select-text text-xs leading-5">{item.plan!.originalTitle} | {part.title} ({part.id}/{item.plan!.parts.length})</p>
                    <p className="mt-1 break-words select-text text-[11px] leading-5 text-zinc-400">{part.hashtags.join(" ")}</p>
                    <CopyButton text={`${item.plan!.originalTitle} | ${part.title} (${part.id}/${item.plan!.parts.length})\n\n${part.hashtags.join(" ")}`} ariaLabel={`Copy title và hashtag Part ${part.id} trong hàng loạt`} className="mt-2" />
                  </div>)}
                  {item.job?.outputs.map((output) => <div key={output.part} className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedBatchPreviewKey(`${group.id}:${item.id}:${output.part}`); setBatchPreviewError(""); }} className={`h-9 rounded-xl border-white/15 text-xs ${batchPreviewOutput?.key === `${group.id}:${item.id}:${output.part}` ? "bg-white/10 text-white" : "bg-transparent text-zinc-300"}`}><Play className="size-3.5" /> Xem Part {output.part}</Button>
                    <a href={`${WORKER_ORIGIN}${output.url}`} download={output.filename} className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs leading-5 text-emerald-300 hover:bg-emerald-400/10"><Download className="mt-0.5 size-4 shrink-0" /><span className="break-all">Tải lại Part {output.part} · {output.filename}</span></a>
                  </div>)}
                </div>
              ))}
              {!group.items.length && <p className="py-4 text-center text-xs text-zinc-500">Không còn video trong hàng đợi.</p>}
              </div>)}
            </div>}
          </div>
        </div>
        <aside aria-label="Preview hàng loạt" className="mt-4 rounded-2xl border border-white/10 bg-[#111216] p-4 md:sticky md:top-5">
          <p className="eyebrow">PREVIEW RENDER</p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Xem Part đã cắt và render. Có play/pause và thanh tua.</p>
          {batchPreviewOutput ? <>
            <video key={batchPreviewOutput.url} src={`${WORKER_ORIGIN}${batchPreviewOutput.url}?preview=1`} aria-label={`Preview Part ${batchPreviewOutput.part}`} controls playsInline preload="metadata" onLoadedMetadata={() => setBatchPreviewError("")} onError={() => setBatchPreviewError("Không mở được video. Kiểm tra worker hoặc chọn Part khác.")} className="mx-auto mt-3 aspect-[9/16] w-full max-w-[200px] rounded-xl bg-black object-contain" />
            <p className="mt-3 break-words text-xs font-semibold leading-5">{batchPreviewOutput.title}</p>
            <p className="mt-1 break-all text-[11px] text-[#ff806a]">Part {batchPreviewOutput.part} · {batchPreviewOutput.filename}</p>
            {batchPreviewError && <p className="mt-2 text-xs leading-5 text-red-300">{batchPreviewError}</p>}
          </> : <div className="mx-auto mt-3 flex aspect-[9/16] w-full max-w-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/30 px-5 text-center text-xs leading-5 text-zinc-500"><Play className="size-7 text-zinc-600" /><p>Part render xong sẽ hiện ở đây.<br />Chọn Xem Part trong danh sách để đổi video.</p></div>}
        </aside>
        </div>
      </section>}
      <div className={`${workspace !== "editor" ? "hidden" : "grid"} min-h-[calc(100vh-64px)] grid-cols-1 xl:grid-cols-[minmax(340px,1fr)_300px_minmax(380px,1.1fr)]`}>
        <aside className="min-w-0 border-b border-white/8 bg-[#0d0e11] p-5 xl:border-b-0 xl:border-r xl:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">01 / SOURCE</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Create the cut</h1>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[.03] text-zinc-500">
              {editMode === "ai" ? "AI plan" : "Manual cut"}
            </Badge>
          </div>

          <Tabs value={sourceMode} onValueChange={(value) => { sourceSelectionEpoch.current += 1; invalidateAnalysis(); setSourceMode(value as "youtube" | "local"); setPreparedSource(null); setRenderJob(null); setHasEditPlan(false); setTranscript(""); }} className="mt-6">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-white/[.045] p-1" style={{ height: 40 }}>
              <TabsTrigger value="youtube" className="min-w-0 rounded-lg text-xs" style={{ height: 32, paddingBlock: 0, fontSize: 12, lineHeight: '16px' }}>YouTube</TabsTrigger>
              <TabsTrigger value="local" className="min-w-0 rounded-lg text-xs" style={{ height: 32, paddingBlock: 0, fontSize: 12, lineHeight: '16px' }}>Local video</TabsTrigger>
            </TabsList>
            <TabsContent value="youtube" className="pt-3">
              <label htmlFor="youtube-url" className="field-label">YouTube URL</label>
              <div className="relative mt-2">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input id="youtube-url" value={sourceUrl} onChange={(event) => { sourceSelectionEpoch.current += 1; invalidateAnalysis(); setSourceUrl(event.target.value); setPreparedSource(null); setRenderJob(null); setHasEditPlan(false); setTranscript(""); }} placeholder="youtube.com/watch?v=..." className="studio-input pl-10" />
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
                    <SelectItem value="gemini">Gemini Pro · copy / dán JSON</SelectItem>
                    <SelectItem value="muse">Muse · copy / dán JSON</SelectItem>
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
                  {chatGPTSession?.error && <p role="status" className="mt-2 text-xs text-amber-300">{chatGPTSession.error}</p>}
                  <p className="mt-2 text-[10px] leading-4 text-zinc-600">Phiên OAuth được bảo vệ trên máy này (macOS Keychain / Windows DPAPI), không lưu token trong web.</p>
                </div>
              )}
              <details className="rounded-xl border border-white/8 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-300">Transcript · {transcript.length.toLocaleString()} ký tự · xem / sửa</summary>
                <div className="mt-3 flex items-center justify-between">
                  <label htmlFor="transcript" className="field-label">Timestamped transcript</label>
                  <span className="text-[10px] text-zinc-600">{transcript.length.toLocaleString()} chars</span>
                </div>
                <Textarea id="transcript" value={transcript} onChange={(event) => {invalidateAnalysis();setTranscript(event.target.value);}} className="studio-textarea studio-transcript mt-2 font-mono text-[12px] leading-5" placeholder="00:00 Transcript..." />
                <p className="mt-2 text-xs leading-5 text-zinc-500">{transcriptStatus}</p>
              </details>
              <details className="rounded-xl border border-white/8 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-300">Quy tắc chia part · xem / sửa</summary>
                <label htmlFor="instruction" className="field-label mt-3 block">Your instruction</label>
                <Textarea id="instruction" value={instruction} onChange={(event) => {invalidateAnalysis();setInstruction(event.target.value);}} className="studio-textarea studio-transcript mt-2" placeholder="Ví dụ: bỏ intro, Part 2 mở bằng sự cố..." />
              </details>
              <div>
                <label htmlFor="extra-prompt" className="field-label">Prompt bổ sung (không bắt buộc)</label>
                <Textarea id="extra-prompt" value={supplementalPrompt} onChange={(event) => {invalidateAnalysis();setSupplementalPrompt(event.target.value);}} className="studio-textarea mt-2 min-h-[80px]" placeholder="Ví dụ: Bỏ đoạn đầu, tập trung cảnh sửa xe, Part 2 ưu tiên cảnh chạy thử." />
                <p className="mt-2 text-[11px] leading-5 text-zinc-500">Kết hợp với quy tắc mặc định khi tạo prompt mới. Để trống để giữ nguyên quy tắc.</p>
              </div>
              {isWebAi ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">
                <p className="text-sm font-semibold">{webAiName} bán tự động</p>
                <p className="text-xs leading-5 text-zinc-400">Tạo prompt → copy và gửi trong {webAiName} → dán JSON bên dưới. Không API key, không kết nối CLI; app không đọc token hay tài khoản {webAiName}.</p>
                {hasEditPlan && <Button onClick={() => void createWebAiPrompt(true)} disabled={isAnalyzing || !preparedSource || Boolean(effectiveTiming.error)} variant="outline" className="w-full text-xs">Chỉ chọn lại hook · giữ các range hiện tại</Button>}
                {provider === "gemini" && <p className="text-xs leading-5 text-zinc-400">Mở Gemini web bằng tài khoản Google AI Pro và tự chọn model Pro trước khi gửi prompt.</p>}
                <Button onClick={() => void createWebAiPrompt()} disabled={isAnalyzing || isPreparingSource || !workerHealth?.ok} className="w-full rounded-xl bg-white text-xs text-black hover:bg-zinc-200">{isAnalyzing ? <Loader2 className="animate-spin" /> : <WandSparkles />}{isAnalyzing ? "Đang chuẩn bị prompt…" : `1. Tạo prompt cho ${webAiName}`}</Button>
                {webAiPrompt && <>
                  <div className="grid grid-cols-2 gap-2">
                    <CopyButton text={webAiPrompt} label="Copy prompt" disabled={!webAiPromptIsCurrent} className="h-9 rounded-xl border border-white/10 text-xs" onCopied={() => { setWebAiError(""); setWebAiNotice(`Đã copy prompt + transcript. Mở ${webAiName} và dán để phân tích.`); }} onError={() => { setWebAiNotice(""); setWebAiError("Trình duyệt chưa cho copy. Mở mục Prompt bên dưới, chọn toàn bộ và copy bằng tay."); }} />
                    <a href={webAiUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs hover:bg-white/10"><Link2 className="size-4" /> Mở {webAiName} ↗</a>
                  </div>
                  {!webAiPromptIsCurrent && <p className="text-xs leading-5 text-amber-200">Source đã đổi. Tạo prompt mới cho video hiện tại; JSON nhập vào luôn được kiểm tra theo ID source.</p>}
                  <details className="rounded-xl border border-white/8 p-3"><summary className="cursor-pointer text-xs text-zinc-400">Prompt · xem / copy bằng tay</summary><Textarea aria-label={`Prompt cho ${webAiName}`} readOnly value={webAiPrompt} className="studio-textarea studio-transcript mt-2 font-mono text-[11px]" /></details>
                </>}
                <label htmlFor="web-ai-result" className="field-label block">2. JSON kết quả từ {webAiName}</label>
                <Textarea id="web-ai-result" value={webAiResult} onChange={(event) => setWebAiResult(event.target.value)} placeholder={`Dán toàn bộ JSON ${webAiName} trả về, gồm sourceId, originalTitle, language và parts…`} className="studio-textarea studio-transcript min-h-[130px] font-mono text-[11px] leading-5" />
                <Button onClick={applyWebAiResult} disabled={!preparedSource || !webAiPromptIsCurrent || !webAiResult.trim() || isAnalyzing || isPreparingSource} className="w-full rounded-xl bg-[#ff4d2e] text-xs text-white hover:bg-[#ff6247]"><Check /> 3. Kiểm tra và áp dụng 2 part</Button>
                {webAiError && <p role="alert" className="break-words text-xs leading-5 text-red-300">{webAiError}</p>}
                {webAiNotice && <p role="status" className="text-xs leading-5 text-emerald-300">{webAiNotice}</p>}
              </div> : <Button onClick={analyze} disabled={isAnalyzing} className="h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]">
                {isAnalyzing ? <><Loader2 className="animate-spin" /> Building edit plan…</> : <><WandSparkles /> Generate 2-part plan</>}
              </Button>}
              {isAnalyzing&&<Button variant="outline" onClick={()=>{invalidateAnalysis();setAnalysisNotice("Đã dừng phân tích; plan cũ được giữ.");}} className="w-full text-xs">Dừng phân tích</Button>}
              {batchEditing&&preparedSource?.id===batchEditing.sourceId&&hasEditPlan&&<Button variant="outline" disabled={isAnalyzing||isStartingRender||Boolean(effectiveTiming.error)} onClick={()=>void queueEditedBatchItem()} className="w-full text-xs">Lưu plan đã duyệt & tiếp tục item này</Button>}
              {analysisNotice&&<p role="status" className="text-xs leading-5 text-zinc-400">{analysisNotice}</p>}
              {previewPlan.analysis&&<details className="rounded-xl border border-white/10 p-3 text-xs"><summary className="cursor-pointer">Lý do chọn · {previewPlan.analysis.method} · {previewPlan.analysis.provider}</summary><p className="mt-2 text-zinc-400">Điểm heuristic, không phải xác suất. Replay không phải retention/lượt xem.</p>{previewPlan.analysis.parts.map(p=><div key={p.id} className="mt-2"><strong>Part {p.id}</strong><p>{p.reason}</p><p className="text-zinc-400">{Object.entries(p.signals).map(([name,s])=>`${name}: ${s.contribution.toFixed(3)}`).join(" · ")||"Không có tín hiệu nội dung; fallback theo cấu trúc."}</p></div>)}{previewPlan.analysis.limitations.map((line,i)=><p key={i} className="mt-1 text-zinc-500">{line}</p>)}</details>}

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

        <section className="relative flex min-w-0 flex-col items-center overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_50%_38%,rgba(255,77,46,.11),transparent_36%)] px-4 py-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex w-full max-w-[280px] flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">02 / PORTRAIT PREVIEW</p>
              <p className="mt-1 text-xs text-zinc-500">{hasEditPlan ? "Preview các đoạn đã chọn · 1.25×" : "Source preview · native 100%"}</p>
            </div>
            <div className="flex rounded-xl border border-white/8 bg-black/25 p-1">
              {plan.parts.map((part, index) => (
                <button key={part.id} onClick={() => setActivePartIndex(index)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activePartIndex === index ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>Part {part.id}</button>
              ))}
            </div>
          </div>

          <div
            ref={setPreviewElement}
            aria-busy={needsMeasuredTitleFit(previewVisualStyle) && measuredTitlePair?.input !== titleFitInput}
            className="portrait-preview relative aspect-[9/16] shrink-0 overflow-hidden rounded-[20px] border border-white/12 bg-black shadow-[0_20px_60px_rgba(0,0,0,.45)]"
            style={{ width: "min(100%, 240px)" }}
          >
            <VideoFilterDefinition filter={previewVisualStyle.filter} id="studio-preview-video-color" />
            {previewVideoUrl ? (
              <video ref={backgroundVideoRef} className="absolute inset-0 size-full object-cover" style={{ filter: `${videoColorFilter} blur(${40 * previewScale}px)`, opacity: previewVisualStyle.background.mode === "source-blur" ? previewVisualStyle.background.opacity : 0 }} src={previewVideoUrl} muted preload="metadata" playsInline />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_46%,#6c3422,transparent_28%),linear-gradient(145deg,#101114_10%,#292024_48%,#0d0e11_80%)]" />
            )}
            {previewVisualStyle.background.mode !== "source-blur" && <div data-studio-background className="absolute inset-0" style={backgroundCss(previewVisualStyle.background)} />}
            <SceneOverlays overlays={previewVisualStyle.overlays} />
            <CutTransitionVeil value={previewVisualStyle.cutTransition} windows={transitionWindows} time={previewCurrentTime} />
            <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${FOREGROUND_Y / 1920 * 100}%`, height: `${FOREGROUND_HEIGHT / 1920 * 100}%` }}>
              {previewVideoUrl ? (
                <video
                  ref={previewVideoRef}
                  crossOrigin="anonymous"
                  className="native-preview-video cursor-pointer"
                  style={{ width: `${(preparedSource?.width || sourceSize.width) * FOREGROUND_SCALE * previewScale}px`, height: 'auto', filter: videoColorFilter }}
                  src={previewVideoUrl}
                  preload="metadata"
                  playsInline
                  onClick={() => void togglePreview()}
                  onLoadedMetadata={(event) => {
                    const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : preparedSource?.duration || 0;
                    setPreviewDuration(duration);
                    setSourceSize({ width: event.currentTarget.videoWidth || 1920, height: event.currentTarget.videoHeight || 1080 });
                    if (hasEditPlan) {
                      event.currentTarget.currentTime = playbackSegments[0]?.start || 0;
                      event.currentTarget.playbackRate = PLAYBACK_RATE;
                    }
                    setPreviewError("");
                  }}
                  onTimeUpdate={updatePreviewClock}
                  onPlay={() => { previewPlayingRef.current = true; setIsPreviewPlaying(true); }}
                  onPause={() => { if (!hasEditPlan) { previewPlayingRef.current = false; setIsPreviewPlaying(false); } }}
                  onEnded={() => { if (!hasEditPlan) { previewPlayingRef.current = false; setIsPreviewPlaying(false); } backgroundVideoRef.current?.pause(); }}
                  onError={() => setPreviewError("Không phát được source. Hãy bấm Chuẩn bị source lại hoặc thử video MP4/H.264.")}
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(125deg,#111_0%,#572317_42%,#ef6b32_43%,#241716_47%,#0b0c0f_100%)]" />
              )}
              {previewVideoUrl && !isPreviewPlaying && <button type="button" onClick={() => void togglePreview()} aria-label="Play preview" style={{ zIndex: transitionWindows.length ? 30 : undefined }} className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/50 backdrop-blur-md"><Play className="ml-0.5 size-5 fill-white" /></button>}
            </div>
            <div data-title-animation={previewVisualStyle.titleAnimation || "none"} className="pointer-events-none absolute inset-0 z-10" style={titleAnimationPreviewCss(previewVisualStyle.titleAnimation, previewCurrentTime, previewScale)}>
            <div className="absolute inset-x-[8.35%] z-10 flex items-end justify-center text-center" style={{ top: TITLE_LAYOUT.original.top * previewScale, height: (TITLE_LAYOUT.original.bottom - TITLE_LAYOUT.original.top) * previewScale, clipPath: `inset(-${20 * previewScale}px)` }}>
              <p
                className="social-copy overlay-copy-block relative"
                style={{
                  ...textPreviewCss(previewVisualStyle.originalTitle, plan.originalTitle, previewScale),
                  fontSize: `${(originalTitleFit.fontSize * previewScale).toFixed(2)}px`,
                  lineHeight: (originalTitleFit.fontSize + originalTitleFit.lineSpacing) / originalTitleFit.fontSize,
                }}
              >
                {originalTitleFit.text}
                {previewVisualStyle.originalTitle.effect === "current-title-glow-shine" && <span aria-hidden="true" className="title-shine pointer-events-none absolute inset-0" style={titleShineStyle}>{originalTitleFit.text}</span>}
              </p>
            </div>
            <div className="absolute inset-x-[8.35%] z-10 flex items-start justify-center text-center" style={{ top: TITLE_LAYOUT.part.top * previewScale, height: (TITLE_LAYOUT.part.bottom - TITLE_LAYOUT.part.top) * previewScale, clipPath: `inset(-${20 * previewScale}px)` }}>
              <p
                className="social-copy overlay-copy-block relative"
                style={{
                  ...textPreviewCss(previewVisualStyle.partTitle, activePart.title, previewScale),
                  fontSize: `${(partTitleFit.fontSize * previewScale).toFixed(2)}px`,
                  lineHeight: (partTitleFit.fontSize + partTitleFit.lineSpacing) / partTitleFit.fontSize,
                }}
              >
                {partTitleFit.text}
                {previewVisualStyle.partTitle.effect === "current-title-glow-shine" && <span aria-hidden="true" className="title-shine pointer-events-none absolute inset-0" style={titleShineStyle}>{partTitleFit.text}</span>}
              </p>
            </div>
            <div className="absolute inset-x-0 z-10 text-center" style={{ top: 1804 * previewScale, lineHeight: 1 }}><span className="social-copy" style={{ ...textPreviewCss(previewVisualStyle.partIndicator, activePart.title, previewScale, "indicator"), fontSize: `${58 * previewScale}px` }}>{activePart.id}/{plan.parts.length}</span></div>
            </div>
            {hasEditPlan && previewVisualStyle.subtitle.enabled && previewCaption && <div className="pointer-events-none absolute inset-x-[10%] z-20 text-center" style={{ bottom: `${(1920 - subtitleY(previewVisualStyle.subtitle, preparedSource?.height || sourceSize.height)) / 1920 * 100}%` }}>
              <p className="whitespace-pre-line break-words font-bold" style={{ ...subtitlePreviewCss(previewVisualStyle.subtitle, previewCaption.text, previewScale), fontSize: previewVisualStyle.subtitle.size * previewScale, lineHeight: 1.2 }}>{previewCaption.text}</p>
            </div>}
          </div>

          <div className="preview-controls mt-4 w-full max-w-[520px]">
            <button type="button" aria-label="Tua lùi 5 giây" title="← · Lùi 5 giây" disabled={!previewVideoUrl} onClick={() => seekPreview(Math.max(0, previewCurrentTime - 5))}><ArrowLeft className="size-3" /></button>
            <button type="button" onClick={() => void togglePreview()} disabled={!previewVideoUrl} aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}>
              {isPreviewPlaying ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
            </button>
            <button type="button" aria-label="Tua tới 5 giây" title="→ · Tới 5 giây" disabled={!previewVideoUrl} onClick={() => seekPreview(Math.min(timelineDuration, previewCurrentTime + 5))}><ArrowRight className="size-3" /></button>
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
          {activePart.teaser && <details className="mt-3 w-full max-w-[520px] rounded-xl border border-white/10 p-3 text-xs text-zinc-400">
            <summary className="cursor-pointer">Teaser Part {activePart.id} · {activePart.teaser.status === "selected" ? `${((activePart.teaser.end - activePart.teaser.start) / PLAYBACK_RATE).toFixed(1)}s · ${activePart.teaser.selection === "ai" ? "AI API" : activePart.teaser.selection === "external-import" ? "External import · API chưa xác minh" : "Fallback — chưa xác minh AI"}` : "Không có đoạn phù hợp"}</summary>
            <p className="mt-2">{activePart.teaser.reason}</p>
            {activePart.teaser.status === "selected" && <><p className="mt-1">{activePart.teaser.relation}</p><p className="mt-1">{activePart.teaser.provider} / {activePart.teaser.model} · {activePart.teaser.limitations.join(" · ")}</p></>}
          </details>}
        </section>

        <aside className="min-w-0 bg-[#0d0e11] p-5 xl:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">03 / KẾT QUẢ PART</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Part {activePart.id}</h2>
            </div>
            <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/8 text-emerald-300"><Check /> Timeline valid</Badge>
          </div>

          {hasEditPlan && <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <p className="field-label">Custom Time · cả 2 Part</p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">Start AI đã cộng 1 giây, rồi Smart Cut tìm ngắt câu/khoảng lặng gần nhất. Mốc chỉnh tay được dùng nguyên cho preview và export, không cộng/căn lại. Các khoảng quảng cáo đã loại vẫn được giữ ngoài bản cắt.</p>
            {(customTimes || partTimes(effectiveTiming.plan)).map((time, index) => <div key={index} className="mt-3">
              <p className="mb-2 text-xs font-semibold">Part {index + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["start", "end"] as const).map((boundary) => <label key={boundary} className="min-w-0 text-[11px] text-zinc-400">
                  {boundary === "start" ? "Bắt đầu" : "Kết thúc"}
                  <Input aria-label={`Part ${index + 1} ${boundary}`} value={time[boundary]} onChange={(event) => {
                    const value = event.target.value;
                    invalidateAnalysis();
                    setCustomTimes((current) => (current || partTimes(effectiveTiming.plan)).map((item, itemIndex) => itemIndex === index ? { ...item, [boundary]: value } : item));
                    setRenderJob(null);
                  }} className="studio-input mt-1 w-full font-mono text-xs" />
                </label>)}
              </div>
              <Button size="sm" variant="ghost" className="mt-2 h-7 text-[11px]" onClick={()=>{invalidateAnalysis();const locked=lockedParts(previewPlan)[index];setCustomTimes(null);setPlan(current=>({...current,parts:previewPlan.parts.map((p,i)=>i===index?{...p,manualLocked:!locked}:p)}));}}>{lockedParts(previewPlan)[index]?"Mở khóa main để phân tích lại":"Khóa main khi phân tích lại"}</Button>
            </div>)}
            {effectiveTiming.error && <p role="alert" className="mt-3 text-xs leading-5 text-red-300">{effectiveTiming.error} Preview giữ mốc hợp lệ cũ; render bị chặn đến khi sửa đúng.</p>}
          </div>}


          <VisualTemplatePanel style={previewVisualStyle} onTemplate={(id) => setPlan((current) => {
            const visualStyle = applyVisualTemplate(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />
          <VisualCustomizePanel style={previewVisualStyle} controls={{
            overlay: <OverlayPanel overlays={previewVisualStyle.overlays} onPreset={(id) => setPlan((current) => {
            const visualStyle = applyOverlayPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} onOpacity={(opacity) => setPlan((current) => {
            const visualStyle = applyOverlayOpacity(resolvePlanVisualStyle(current), opacity);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            background: <BackgroundPanel background={previewVisualStyle.background} onPreset={(id) => setPlan((current) => {
            const visualStyle = applyBackgroundPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            filter: <VideoFilterPanel filter={previewVisualStyle.filter} onPreset={(id) => setPlan((current) => {
            const visualStyle = applyFilterPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} onIntensity={(intensity) => setPlan((current) => {
            const visualStyle = applyFilterIntensity(resolvePlanVisualStyle(current), intensity);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            animation: <TextAnimationPanel value={previewVisualStyle.titleAnimation} onChange={(id) => setPlan((current) => {
            const visualStyle = normalizeVisualStyle({ ...resolvePlanVisualStyle(current), titleAnimation: id });
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            transition: <CutTransitionPanel value={previewVisualStyle.cutTransition} onChange={(id) => setPlan((current) => {
            const visualStyle = normalizeVisualStyle({ ...resolvePlanVisualStyle(current), cutTransition: id });
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            text: <TextStylePanel style={previewVisualStyle} onPreset={(id) => setPlan((current) => {
            const visualStyle = applyTextPreset(resolvePlanVisualStyle(current), id);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
            font: <TextFontSelector style={previewVisualStyle} onFont={(font) => setPlan((current) => {
            const visualStyle = applyFontOverride(resolvePlanVisualStyle(current), font);
            return { ...current, visualStyle, subtitles: { ...visualStyle.subtitle } };
          })} />,
          }} />
          {hookNeedsReselection(activePart)&&<p role="status" className="mt-3 text-xs text-amber-300">Hook cũ lặp ngay phần mở đầu. Chọn lại hook rõ ràng để áp dụng khoảng cách 10 giây; snapshot đã queue được giữ nguyên.</p>}
          {hasEditPlan&&<button type="button" disabled={!preparedSource||isAnalyzing} onClick={()=>void reselectHooks()} className="mt-3 rounded border border-white/15 px-3 py-2 text-xs disabled:opacity-40">Chọn lại hook · giữ nguyên main</button>}
          <label className="mt-4 block text-xs">Hook → Main<select aria-label="Hook transition" className="studio-input mt-2 w-full" value={previewPlan.hookTransition||'legacy'} onChange={e=>setPlan(current=>({...current,hookTransition:e.target.value==='legacy'?undefined:e.target.value as EditPlan['hookTransition']}))}><option value="legacy">Legacy · theo transition đã lưu</option><option value="rainbow-light-leak">Rainbow Light Leak</option><option value="dip-black">Dip Black</option><option value="flash-white">Flash White</option><option value="none">None</option></select></label>
          <MusicPanel plan={previewPlan} worker={WORKER_ORIGIN} settings={previewPlan.music} activity={previewPlan.musicSpeech} source={preparedSource} part={activePart} duration={timelineDuration} time={previewCurrentTime} playing={workspace==="editor"&&isPreviewPlaying} video={previewVideoRef} onChange={music=>setPlan(current=>({...current,music}))} onSpeech={musicSpeech=>setPlan(current=>({...current,musicSpeech}))} onAudition={()=>{previewPlayingRef.current=false;setIsPreviewPlaying(false);previewVideoRef.current?.pause();backgroundVideoRef.current?.pause();}} />
          <details className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <summary className="cursor-pointer text-sm font-semibold">Auto Subtitle · {subtitleSettings.enabled ? "Bật" : "Tắt"}</summary>
            <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={subtitleSettings.enabled} onChange={(event) => {
              const enabled = event.target.checked;
              setSubtitleSettings((current) => ({ ...current, enabled }));
            }} /> Ghép phụ đề vào video xuất</label>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">Dùng phụ đề YouTube nếu có; nếu không, Whisper nhận diện giọng nói trên máy. Phụ đề tăng tốc cùng video 1.25×. Nhận diện tự động có thể sai; kiểm tra preview trước khi xuất.</p>
            {subtitleSettings.enabled && <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={subtitleSettings.source !== 'whisper'} disabled={subtitleBusy} onClick={() => chooseSubtitleSource('youtube')} className={`rounded-lg border px-2 py-2 text-xs disabled:opacity-50 ${subtitleSettings.source !== 'whisper' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/10 text-zinc-400'}`}>Dùng phụ đề YouTube</button>
                <button type="button" aria-pressed={subtitleSettings.source === 'whisper'} disabled={subtitleBusy} onClick={() => chooseSubtitleSource('whisper')} className={`rounded-lg border px-2 py-2 text-xs disabled:opacity-50 ${subtitleSettings.source === 'whisper' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/10 text-zinc-400'}`}>Dùng phụ đề Whisper</button>
              </div>
              <p className="text-[11px] leading-5 text-zinc-500">Whisper base đa ngôn ngữ · 142 MB · xử lý trên máy. {speechModel?.modelReady ? 'Model đã sẵn sàng.' : speechModel?.installing ? `Đang tải ${Math.round((speechModel.downloadedBytes || 0) / (speechModel.totalBytes || 1) * 100)}%.` : 'Cần tải model một lần.'}</p>
              <p className="text-[11px] leading-5 text-zinc-500">Vị trí dưới chừa 420 px vùng giao diện TikTok. Mô tả mở rộng vẫn có thể che video; kiểm tra màn hình đăng trước khi xuất bản.</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label>Font<select aria-label="Font phụ đề" value={subtitleSettings.font} onChange={(event) => setSubtitleSettings((current) => ({ ...current, font: event.target.value }))} className="studio-input mt-1 w-full">{listFonts().map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
                <label>Vị trí<select aria-label="Vị trí phụ đề" value={subtitleSettings.position} onChange={(event) => setSubtitleSettings((current) => ({ ...current, position: event.target.value }))} className="studio-input mt-1 w-full"><option value="bottom">Dưới khung video</option><option value="center">Giữa khung video</option><option value="top">Trên khung video</option></select></label>
                <label>Cỡ chữ<Input aria-label="Cỡ chữ phụ đề" type="number" min={28} max={72} value={subtitleSettings.size} onChange={(event) => setSubtitleSettings((current) => ({ ...current, size: Math.max(28, Math.min(72, Number(event.target.value) || 48)) }))} className="studio-input mt-1 w-full" /></label>
                <label>Độ dày viền<Input aria-label="Độ dày viền phụ đề" type="number" min={0} max={8} value={subtitleSettings.outline} onChange={(event) => setSubtitleSettings((current) => ({ ...current, outline: Math.max(0, Math.min(8, Number(event.target.value) || 0)) }))} className="studio-input mt-1 w-full" /></label>
                <label>Màu chữ<Input aria-label="Màu chữ phụ đề" type="color" value={subtitleSettings.color} onChange={(event) => setSubtitleSettings((current) => ({ ...current, color: event.target.value }))} className="studio-input mt-1 w-full" /></label>
                <label>Màu viền<Input aria-label="Màu viền phụ đề" type="color" value={subtitleSettings.outlineColor} onChange={(event) => setSubtitleSettings((current) => ({ ...current, outlineColor: event.target.value }))} className="studio-input mt-1 w-full" /></label>
              </div>
              <Button onClick={() => void loadSubtitles(false, true)} disabled={subtitleBusy || !preparedSource} variant="outline" className="w-full text-xs">{subtitleBusy && <Loader2 className="animate-spin" />} Tạo lại / lấy phụ đề</Button>
              <Button onClick={() => void installWhisperModel()} disabled={subtitleBusy || speechModel?.modelReady || !workerHealth?.ok} variant="outline" className="w-full text-xs">{speechModel?.modelReady ? 'Whisper base đã tải' : 'Tải model Whisper base · 142 MB'}</Button>
              {subtitleNotice && <p role="status" className="text-[11px] leading-5 text-zinc-400">{subtitleNotice}</p>}
              {subtitleCues.length > 0 && <details><summary className="cursor-pointer text-xs text-zinc-400">Xem / sửa phụ đề · {subtitleCues.length} câu</summary><div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {subtitleCues.map((cue, index) => <label key={index} className="block text-[10px] text-zinc-500">{formatTime(cue.start)} – {formatTime(cue.end)}<Textarea aria-label={`Câu phụ đề ${index + 1}`} value={cue.text} onChange={(event) => {
                  const text = event.target.value;
                  setSourceCaptions((current) => current ? { ...current, cues: current.cues.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item) } : null);
                }} className="studio-textarea mt-1 min-h-[48px] text-xs" /></label>)}
              </div></details>}
            </div>}
          </details>

          <div className="mt-5">
            <label htmlFor="part-title" className="field-label">New part title</label>
            <Textarea id="part-title" value={activePart.title} onChange={(event) => updatePartTitle(event.target.value.toUpperCase())} className="studio-textarea mt-2 min-h-[72px] text-base font-bold leading-5" />
            <p className="mt-2 text-[11px] leading-5 text-zinc-600">Title trên/dưới cùng cỡ chữ · auto-scale tối đa 3 dòng · nằm ngoài vùng video</p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="final-title" className="field-label">TITLE SAU CÙNG</label>
              <CopyButton text={`${plan.originalTitle} | ${activePart.title} (${activePart.id}/${plan.parts.length})\n\n${activePart.hashtags.join(" ")}`} className="py-1.5" />
            </div>
            <Textarea id="final-title" readOnly value={`${plan.originalTitle} | ${activePart.title} (${activePart.id}/${plan.parts.length})`} className="studio-textarea mt-2 min-h-[64px] text-sm leading-6" />
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">Title dùng để đăng video. File xuất đặt theo mã ngôn ngữ + số part: kr1/kr2, kr11/kr22…</p>
            <p className="mt-4 text-xs font-semibold text-zinc-300">Hashtag của Part {activePart.id} · {activePart.hashtags.length}/10</p>
            {activePart.hashtags.length > 0 ? (
              <Textarea aria-label={`Hashtag Part ${activePart.id}`} readOnly value={activePart.hashtags.join(" ")} className="studio-textarea mt-2 min-h-[88px] text-sm leading-6 [overflow-wrap:anywhere]" />
            ) : (
              <p className="mt-2 text-xs leading-6 text-zinc-500">Chưa có hashtag AI. Generate 2 part bằng ChatGPT để tạo 10 hashtag theo nội dung từng part.</p>
            )}
            {activePart.hashtags.length > 0 && activePart.hashtags.length < 10 && <p className="mt-2 text-[11px] leading-5 text-zinc-500">Plan cũ chưa đủ 10 hashtag. Generate lại bằng ChatGPT để cập nhật.</p>}
          </div>

          <details key={`cut-details-${activePart.id}`} className="mt-5 rounded-xl border border-white/8 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-zinc-400">Chi tiết bản cắt · {activePart.segments.length} đoạn · {formatTime(finalDurationOf(activePart))}</summary>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {activePart.segments.map((segment, index) => (
              <article key={`${index}-${segment.start}-${segment.end}`} className="rounded-lg bg-white/[.025] p-3">
                {segment.isPadding && <p className="mb-2 text-[11px] font-semibold text-amber-200">Footage bổ sung / lặp ở cuối để đủ thời lượng</p>}
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#ff4d2e]/10 text-xs font-bold text-[#ff6b50]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-6 text-zinc-200 [overflow-wrap:anywhere]">{segment.label}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <Clock3 className="size-3 shrink-0" />
                      <span className="whitespace-nowrap tabular-nums">{formatTime(segment.start)} — {formatTime(segment.end)}</span>
                    </div>
                    {segment.reason && <p className="mt-1 break-words text-[11px] leading-5 text-zinc-500 [overflow-wrap:anywhere]">{segment.reason}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 rounded-lg bg-[#15161a] p-3">
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Scissors className="size-3.5" /> Source-timestamp duration</span><strong>{formatTime(durationOf(activePart))}</strong></div>
            <div className="my-3 h-px bg-white/8" />
            <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-400"><Sparkles className="size-3.5 text-[#ff6b50]" /> Final duration at 1.25×</span><strong className="text-[#ff806a]">{formatTime(finalDurationOf(activePart))}</strong></div>
          </div>

          <div className="mt-3 border-t border-white/8 pt-3">
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
          </details>

          {renderJob && (
            <div className={`mt-5 rounded-2xl border p-4 ${renderJob.state === "error" ? "border-red-400/20 bg-red-400/5" : renderJob.state === "done" ? "border-emerald-400/20 bg-emerald-400/5" : "border-[#ff4d2e]/20 bg-[#ff4d2e]/5"}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200">
                  {renderJob.state === "done" ? "Render hoàn tất" : renderJob.state === "error" ? "Render lỗi" : renderJob.state === "cancelled" ? "Đã dừng render" : `Đang render Part ${renderJob.currentPart || 1}`}
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
            disabled={!hasEditPlan || isStartingRender || subtitleBusy || Boolean(effectiveTiming.error) || renderJob?.state === "queued" || renderJob?.state === "rendering" || !workerHealth?.ok}
            className="mt-5 h-12 w-full rounded-xl bg-[#ff4d2e] font-bold text-white shadow-[0_12px_30px_rgba(255,77,46,.18)] hover:bg-[#ff6247]"
          >
            {isStartingRender || renderJob?.state === "queued" ? <><Loader2 className="animate-spin" /> Starting render…</> : renderJob?.state === "rendering" ? <><Loader2 className="animate-spin" /> Rendering {renderJob.progress}%</> : <><Film /> Render 2 MP4 files</>}
          </Button>

          {renderJob && ["queued", "rendering"].includes(renderJob.state) && <Button variant="outline" onClick={() => void stopRender(renderJob)} disabled={stoppingRenderIds.includes(renderJob.id)} className="mt-2 w-full rounded-xl border-red-400/30 text-red-300 hover:bg-red-400/10"><Square /> {stoppingRenderIds.includes(renderJob.id) ? "Đang dừng…" : "Dừng render"}</Button>}
          <button onClick={() => replacePlan(mockPlan({ ...DEFAULT_REQUEST, originalTitle: sourceTitle, transcript, instruction }))} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs text-zinc-600 transition hover:text-zinc-300"><RotateCcw className="size-3.5" /> Reset demo plan</button>
          {!isChronological(activePart) && <p className="mt-3 text-xs text-red-300">Timeline is invalid. Regenerate this plan.</p>}
          <p className="mt-3 text-center text-[10px] leading-5 text-zinc-600">Timestamps luôn giữ theo source gốc. Worker chỉ apply 1.25× sau layout + typography.</p>
        </aside>
      </div>
      {workspace === "editor" && <EditorRenderList jobs={editorRenderJobs} stopping={stoppingRenderIds} deleting={deletingRenderIds} deletingAll={deletingAllRenders} error={editorRenderError} notice={editorRenderNotice} origin={WORKER_ORIGIN} onStop={(job) => void stopRender(job)} onDelete={(job) => void deleteEditorRender(job)} onDeleteAll={() => void deleteAllEditorRenders()} />}
    </main>
  );
}
