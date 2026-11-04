import { installFatalHandlers } from "./fatal-errors.mjs";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { userInfo } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareRuntimeDirectories, resolveRuntime, runtimeEnvironment } from "../desktop/runtime-config.mjs";
import { parseCustomTeaser } from "../lib/custom-teaser.mjs";
import { MUSIC_CATALOG } from "../lib/music/catalog.mjs";
import { FOREGROUND_SCALE, PLAYBACK_RATE } from "../lib/render-config.mjs";
import { effectiveCaptionTrack } from "../lib/subtitles.mjs";
import { assertTeaserContexts, selectionDigest, transcriptValue } from "../lib/teaser-context.mjs";
import { validateTeaser } from "../lib/teaser-hooks.mjs";
import { currentFilterEnvironment } from "../lib/visual-style/filters.mjs";
import { snapshotPlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { measureAiStage, withAiOperation } from "./ai-operation.mjs";
import { createAnalysisService } from "./analysis-service.mjs";
import { createAutoCutWorkflow } from "./auto-cut-workflow.mjs";
import { removeBatchItem } from "./batch-cleanup.mjs";
import { createBatchProcessor } from "./batch-pipeline.mjs";
import { createBatchSubmissionQueue } from "./batch-queue.mjs";
import { createBatchService } from "./batch-service.mjs";
import { createCodexCli } from "./codex-cli.mjs";
import { createCoverageFrames } from "./coverage-frames.mjs";
import { createCommandLifecycle } from "./command-lifecycle.mjs";
import { createCommandRunner } from "./command-runner.mjs";
import { createEditorSourceLeases } from "./editor-source-leases.mjs";
import { createExportNameAllocator } from "./export-names.mjs";
import { createExternalPromptSnapshots } from "./external-prompt-snapshot.mjs";
import { createHttpResponses } from "./http-responses.mjs";
import { createLibraryService } from "./library-service.mjs";
import { createLocalSignalAnalyzer } from "./local-signals.mjs";
import { createMainContentSelector } from "./main-content.mjs";
import { createEditorMediaResources, createMediaResources } from "./media-resources.mjs";
import { createMusicLibrary } from "./music-library.mjs";
import { createMusicPreview } from "./music-preview.mjs";
import { createMusicSpeech } from "./music-speech.mjs";
import { effectiveCutPlan } from "./part-start.mjs";
import { validatePlan, validateRenderPlan } from "./plan-validation.mjs";
import { createQueueHistory } from "./queue-history.mjs";
import { createRenderComposition } from "./render/composition.mjs";
import { createRenderCoordinator } from "./render/coordinator.mjs";
import { createRequestOriginPolicy } from "./request-origin.mjs";
import { createRequestHandler } from "./routes/http-handler.mjs";
import { createWorkerRoutes } from "./routes/index.mjs";
import { binaryVersion, resolveBinary, supportsEncoder } from "./runtime-tools.mjs";
import { smartCutPlan } from "./smart-cut.mjs";
import { createSourceContextService } from "./source-context.mjs";
import { createSourceReuse } from "./source-reuse.mjs";
import { createSourceService } from "./source-service.mjs";
import { createSpeechService } from "./speech.mjs";
import { createTeaserSelector } from "./teaser-selection.mjs";
import { createWebAiVideo } from "./web-ai-video.mjs";
import { youtubeUrl } from "./youtube-common.mjs";
import { createYouTubeDownloader } from "./youtube-downloader.mjs";

sharp.concurrency(2);
sharp.cache({ memory: 32, files: 8, items: 32 });

const projectRoot = path.resolve(import.meta.dirname, "..");
const betaRuntime = resolveRuntime({
  profile: process.env.SHORTCUT_RUNTIME_PROFILE || "beta",
  home: userInfo().homedir,
  supportRoot: process.env.SHORTCUT_BETA_SUPPORT_ROOT,
});
for (const [key, expected] of Object.entries({
  MEDIA_WORKER_DATA_DIR: betaRuntime.dataRoot,
  MEDIA_WORKER_PORT: String(betaRuntime.workerPort),
  PORT: String(betaRuntime.webPort),
})) {
  if (process.env[key] !== undefined && process.env[key] !== expected)
    throw Error(`Beta isolation: invalid ${key}; refusing cross-profile access.`);
}
const inheritedFontConfig = process.env.FONTCONFIG_FILE;
const isolatedEnvironment = runtimeEnvironment(betaRuntime);
for (const key of Object.keys(process.env)) if (!(key in isolatedEnvironment)) delete process.env[key];
Object.assign(process.env, isolatedEnvironment);
if (inheritedFontConfig) {
  if (path.resolve(inheritedFontConfig) !== path.join(betaRuntime.dataRoot, "fontconfig.xml"))
    throw Error("Beta fontconfig must be app-local.");
  process.env.FONTCONFIG_FILE = inheritedFontConfig;
}
await prepareRuntimeDirectories(betaRuntime);
const dataRoot = betaRuntime.dataRoot;
const sourcesRoot = path.join(dataRoot, "sources");
const port = betaRuntime.workerPort,
  webPort = betaRuntime.webPort;
const requestOrigins = createRequestOriginPolicy({ webPort, workerPort: port });
const editorSourceLeases = createEditorSourceLeases();
const host = "127.0.0.1";
const {
  assertId,
  downloadYouTubeSource,
  fetchYouTubeTranscript,
  importUpload,
  importYouTube,
  loadSource,
  probeMedia,
  publicSource,
} = createSourceService(() => ({ dataRoot, ffprobe, run, sourceContexts, sourceReuse, sourcesRoot, youtube }));
const { run } = createCommandRunner(() => ({
  commandLifecycle,
  ffmpeg,
  ffprobe,
  mediaResources,
  metadataResources,
  projectRoot,
  whisper,
}));
const {
  corsHeaders,
  createManualDownload,
  manualDownloadError,
  manualDownloadKey,
  manualDownloadProgress,
  manualVideoDownloads,
  pruneManualDownloads,
  readJson,
  sendHtml,
  sendJson,
  serveAiOperation,
  serveFile,
  serveMediaPath,
  serveSourceMedia,
} = createHttpResponses(() => ({ loadSource, requestOrigins, sourcesRoot }));
const jobs = new Map();

const exportNameAllocator = createExportNameAllocator();
const batches = new Map();
const batchControllers = new Map();
const renderControllers = new Map();
const startedRenderControllers = new WeakSet();
const renderParentCleanup = new WeakMap();
const commandLifecycle = createCommandLifecycle();
const mediaResources = createEditorMediaResources();
// Header/stream inspection is serial and bounded, but must not wait for a full
// export. No full-video decode or heavy FFmpeg/ASR lease is needed here.
const metadataResources = createMediaResources({ maxWaiting: 16 });
const pendingRenderSubmissions = new Map();
const { cancelRender, renderSnapshot, resumeRender, startRender } = createRenderCoordinator(() => ({
  assertId,
  exportNameAllocator,
  jobs,
  loadSource,
  mediaLibrary,
  mediaResources,
  musicLibrary,
  musicSpeech,
  pendingRenderSubmissions,
  persistBatchHistory,
  preferredVideoEncoder,
  probeMedia,
  projectRoot,
  renderControllers,
  renderParentCleanup,
  renderPart,
  startedRenderControllers,
  verifySourceTeasers,
}));

const exportBusy = () =>
  pendingRenderSubmissions.size > 0 ||
  [...jobs.values()].some((j) => ["queued", "rendering"].includes(j.state) && renderControllers.has(j.id));
const { persistBatchHistory, restoreBatchHistory } = createQueueHistory(() => ({
  batches,
  dataRoot,
  jobs,
  probeMedia,
  sourcesRoot,
}), {
  maxHistoryJobs: Number(process.env.SHORTCUT_HISTORY_MAX_JOBS || 0),
  confirmed: process.env.SHORTCUT_HISTORY_RETENTION_CONFIRMED === "1",
});

const { batchSnapshot, cancelBatch, prepareBatch } = createBatchService(() => ({
  batchControllers,
  cancelRender,
  jobs,
  processBatch,
  renderSnapshot,
}));
const batchPreparationQueue = createBatchSubmissionQueue({
  batches,
  controllers: batchControllers,
  prepare: prepareBatch,
  onChange: () => persistBatchHistory({ immediate: true }),
});
const mediaLibrary = createLibraryService(dataRoot, () => ({
  dataRoot,
  editorSourceLeases,
  jobs,
  renderControllers,
  batches,
  speech,
  musicSpeech,
  musicPreview,
  localSignals,
  webAiVideos,
  sourceReuse,
  persistBatchHistory,
  sourcesRoot,
}));

// ChatGPT Auto runs through the user's own Codex CLI (installed and signed in outside the app).
const codex = createCodexCli(() => ({ tmp: path.join(betaRuntime.supportRoot, "tmp") }));
const { analyzeWithCodexPlan, ensureCodexReady, peek: codexPeek, status: codexStatus } = codex;

const ffmpeg = resolveBinary("FFMPEG_PATH", "ffmpeg", ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]);
const ffprobe = resolveBinary("FFPROBE_PATH", "ffprobe", ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe"]);
const whisper = resolveBinary("WHISPER_PATH", "whisper-cli", ["/opt/homebrew/bin/whisper-cli"]);
const speech = createSpeechService({ dataRoot, sourcesRoot, ffmpeg, whisper, run, resources: mediaResources });
const coverageFrames = createCoverageFrames({ root: path.join(dataRoot, "cache", "coverage-frames"), ffmpeg, run });
const ytDlp = resolveBinary("YT_DLP_PATH", "yt-dlp", [
  path.join(projectRoot, ".local-tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
]);
const youtube = createYouTubeDownloader({
  dataRoot,
  ytDlp,
  ffmpeg,
  run,
  probeMedia,
  upscaleEncoder: () => preferredVideoEncoder,
});
const sourceContexts = createSourceContextService({
  youtube,
  cacheRoot: path.join(dataRoot, "cache", "source-context"),
});

const videoToolboxAvailable = process.platform === "darwin" && supportsEncoder(ffmpeg, "h264_videotoolbox");
const preferredVideoEncoder = videoToolboxAvailable ? "h264_videotoolbox" : "libx264";
const { contrast: renderContrast, saturation: renderSaturation } = currentFilterEnvironment(process.env);
const { renderPart } = createRenderComposition(() => ({
  ffmpeg,
  musicLibrary,
  preferredVideoEncoder,
  projectRoot,
  renderContrast,
  renderSaturation,
  run,
  speech,
}));

const versions = {
  ffmpeg: binaryVersion(ffmpeg, ["-version"])?.replace(/^ffmpeg version\s+/, "") || null,
  ffprobe: binaryVersion(ffprobe, ["-version"])?.replace(/^ffprobe version\s+/, "") || null,
  ytDlp: binaryVersion(ytDlp),
};
const {
  analyzeWithChatGPTPlan,
  runCodexTxt,
  finalizeImportedTeasers,
  hookSourceFingerprint,
  mainAnalysisInputs,
  planTeasers,
  protectedAnalysisKeys,
  repairBatchTeasers,
  resolveEditingProvider,
  verifySourceTeasers,
} = createAnalysisService(() => ({
  analyzeWithCodexPlan,
  batches,
  coverageFrames,
  dataRoot,
  ensureCodexReady,
  jobs,
  localSignals,
  selectTeasers,
  sourceContexts,
  speech,
}));

const selectTeasers = createTeaserSelector({
  cacheRoot: path.join(dataRoot, "cache", "teaser-hooks"),
  fingerprint: hookSourceFingerprint,
  resolveProvider: (signal) => resolveEditingProvider(signal, "teaser"),
});
const musicLibrary = createMusicLibrary({ root: path.join(dataRoot, "music"), ffmpeg, ffprobe, run });
const musicSpeech = createMusicSpeech({
  root: path.join(dataRoot, "cache", "music-speech"),
  ffmpeg,
  run,
  fingerprint: hookSourceFingerprint,
  protectedKeys: protectedAnalysisKeys,
  resources: mediaResources,
});
const musicPreview = createMusicPreview({
  root: path.join(dataRoot, "cache", "music-preview"),
  ffmpeg,
  run,
  musicLibrary,
  musicSpeech,
  fingerprint: hookSourceFingerprint,
  resources: mediaResources,
});
const localSignals = createLocalSignalAnalyzer({
  ffmpeg,
  run,
  fingerprint: hookSourceFingerprint,
  cacheRoot: path.join(dataRoot, "cache", "local-signals"),
  protectedKeys: protectedAnalysisKeys,
});
const mainContent = createMainContentSelector({
  cacheRoot: path.join(dataRoot, "cache", "main-content"),
  fingerprint: hookSourceFingerprint,
  resolveProvider: resolveEditingProvider,
  protectedKeys: protectedAnalysisKeys,
});

const webAiVideos = createWebAiVideo({
  root: path.join(dataRoot, "cache", "web-ai-video"),
  youtube,
  ffmpeg,
  run,
  probeMedia,
  fingerprint: hookSourceFingerprint,
  isLocked: (id) => mediaLibrary.isLocked(id),
});
const sourceReuse = createSourceReuse({
  sourcesRoot,
  load: loadSource,
  download: downloadYouTubeSource,
  metadata: (url, signal) => youtube.context(url, signal),
  isLocked: (id) => mediaLibrary.isLocked(id),
});

const processBatch = createBatchProcessor({
  acquire: async (url, signal, onProgress) => {
    const stop = youtube.subscribeProgress(url, onProgress);
    try {
      return await importYouTube(url, signal);
    } finally {
      stop();
    }
  },
  load: loadSource,
  analyze: (source, body, signal) => analyzeSource(source, body, signal),
  repairTeasers: repairBatchTeasers,
  render: startRender,
  resumeRender: resumeRender,
  getJob: (id) => jobs.get(id),
  persist: () => persistBatchHistory({ strict: true }),
});
const autoCutWorkflow = createAutoCutWorkflow({
  externalSnapshots: createExternalPromptSnapshots(path.join(dataRoot, "cache", "external-prompt-snapshots")),
  prepareInputs: mainAnalysisInputs,
  runCodexTxt,
  mainContent,
  selectHooks: planTeasers,
  verifyPreservedTeasers: verifySourceTeasers,
  describeWebVideo: (source, signal) => webAiVideos.describe(source, signal),
});
const analyzeSource = (source, body, signal) =>
  withAiOperation("generate", () => autoCutWorkflow(source, body, signal));

await mkdir(sourcesRoot, { recursive: true });
const dispatchRoutes = createWorkerRoutes({
  codexPeek,
  codexStatus,
  ensureCodexReady,
  FOREGROUND_SCALE,
  MUSIC_CATALOG,
  PLAYBACK_RATE,
  analyzeSource,
  analyzeWithChatGPTPlan,
  assertId,
  assertTeaserContexts,
  batchPreparationQueue,
  batchSnapshot,
  batches,
  cancelBatch,
  cancelRender,
  corsHeaders,
  createManualDownload,
  dataRoot,
  editorSourceLeases,
  effectiveCaptionTrack,
  effectiveCutPlan,
  exportBusy,
  fetchYouTubeTranscript,
  ffmpeg,
  ffprobe,
  finalizeImportedTeasers,
  importUpload,
  importYouTube,
  jobs,
  loadSource,
  manualDownloadError,
  manualDownloadKey,
  manualDownloadProgress,
  manualVideoDownloads,
  measureAiStage,
  mediaLibrary,
  mediaResources,
  musicLibrary,
  musicPreview,
  musicSpeech,
  parseCustomTeaser,
  persistBatchHistory,
  planTeasers,
  preferredVideoEncoder,
  pruneManualDownloads,
  publicSource,
  readJson,
  removeBatchItem,
  renderContrast,
  renderControllers,
  renderSaturation,
  renderSnapshot,
  rm,
  selectionDigest,
  sendHtml,
  sendJson,
  serveAiOperation,
  serveFile,
  serveMediaPath,
  serveSourceMedia,
  smartCutPlan,
  snapshotPlanVisualStyle,
  speech,
  startRender,
  transcriptValue,
  validatePlan,
  validateRenderPlan,
  validateTeaser,
  verifySourceTeasers,
  versions,
  webAiVideos,
  youtube,
  youtubeUrl,
});

const server = createServer(
  createRequestHandler({ host, port, requestOrigins, corsHeaders, dispatchRoutes, sendJson }),
);

installFatalHandlers({
  shutdown: () => commandLifecycle.stop({
    onStart() {
      for (const controller of [...batchControllers.values(), ...renderControllers.values()]) controller.abort();
      server.close();
      server.closeAllConnections();
    },
    onStopped: () => persistBatchHistory({ strict: true }),
  }),
});

for (const name of ["SIGTERM", "SIGINT"]) {
  process.once(name, () => {
    console.log(`Media worker shutdown requested (${name}); stopping owned commands.`);
    void commandLifecycle
      .stop({
        onStart() {
          for (const controller of [...batchControllers.values(), ...renderControllers.values()]) controller.abort();
              server.close();
          server.closeAllConnections();
        },
        onStopped: () => persistBatchHistory({ strict: true }),
      })
      .finally(() => process.exit(0));
  });
}
await restoreBatchHistory();
server.listen(port, host, () => {
  process.stdout.write(`\nShortCut media worker listening at http://${host}:${port}\n`);
  process.stdout.write(`FFmpeg: ${ffmpeg || "missing"}\nyt-dlp: ${ytDlp || "missing"}\n\n`);
});
