import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareRuntimeDirectories, resolveRuntime, runtimeEnvironment } from "../desktop/runtime-config.mjs";
import { parseCustomTeaser } from "../lib/custom-teaser.mjs";
import { originalCutPlan } from "../lib/legacy-plan.mjs";
import { MUSIC_CATALOG } from "../lib/music/catalog.mjs";
import { effectiveMusic, normalizeMusic } from "../lib/music/settings.mjs";
import {
  FOREGROUND_SCALE,
  FOREGROUND_Y,
  PLAYBACK_RATE,
  TITLE_LAYOUT,
  TITLE_SHINE_SECONDS,
  TITLE_SHINE_WIDTH,
  foregroundFilter,
} from "../lib/render-config.mjs";
import {
  effectiveCaptionTrack,
  partCaptions,
  sourceCaptionTrack,
  subtitleStyle,
  subtitleY,
} from "../lib/subtitles.mjs";
import { assertTeaserContexts, selectionDigest, transcriptValue } from "../lib/teaser-context.mjs";
import {
  partTransitionWindows,
  presentationDuration,
  presentationSegments,
  validateTeaser,
} from "../lib/teaser-hooks.mjs";
import { normalizeTitleAnimation } from "../lib/visual-style/animations.mjs";
import { assertRenderableBackground, gradientRowRgb } from "../lib/visual-style/backgrounds.mjs";
import { DEFAULT_VISUAL_STYLE } from "../lib/visual-style/defaults.mjs";
import { currentFilterEnvironment, ffmpegFilterExpression } from "../lib/visual-style/filters.mjs";
import { detectScript, fontFamilyForStyle, listFonts } from "../lib/visual-style/fonts.mjs";
import { TRANSITION_SPRITE } from "../lib/visual-style/foreground-transitions.mjs";
import { snapshotPlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { styledTextSvg } from "../lib/visual-style/text-render.mjs";
import { constrainTitlePair, needsMeasuredTitleFit, partOverlayTitle } from "../lib/visual-style/title-fit.mjs";
import { measureAiStage, withAiOperation } from "./ai-operation.mjs";
import { createAnalysisService } from "./analysis-service.mjs";
import { createAutoCutWorkflow } from "./auto-cut-workflow.mjs";
import { removeBatchItem } from "./batch-cleanup.mjs";
import { createBatchProcessor } from "./batch-pipeline.mjs";
import { createBatchSubmissionQueue } from "./batch-queue.mjs";
import { createChatGPTAuth } from "./chatgpt-auth.mjs";
import { createCommandLifecycle } from "./command-lifecycle.mjs";
import { createCommandRunner } from "./command-runner.mjs";
import { cutTransitionFilters } from "./cut-transition.mjs";
import { createEditorSourceLeases } from "./editor-source-leases.mjs";
import { EXPORT_METADATA_ARGS, EXPORT_METADATA_POLICY, requireCurrentExportPolicy } from "./export-metadata.mjs";
import { createExportNameAllocator } from "./export-names.mjs";
import { createExternalPromptSnapshots } from "./external-prompt-snapshot.mjs";
import { createHttpResponses } from "./http-responses.mjs";
import { createLocalSignalAnalyzer } from "./local-signals.mjs";
import { createMainContentSelector } from "./main-content.mjs";
import { createMediaLibrary } from "./media-library.mjs";
import {
  RENDER_FILTER_COMPLEX_THREADS,
  RENDER_RESOURCE_PROFILE,
  createEditorMediaResources,
  createMediaResources,
} from "./media-resources.mjs";
import { musicMixFilters } from "./music-audio.mjs";
import { createMusicLibrary } from "./music-library.mjs";
import { createMusicPreview } from "./music-preview.mjs";
import { createMusicSpeech } from "./music-speech.mjs";
import { effectiveCutPlan } from "./part-start.mjs";
import { validatePlan, validateRenderPlan } from "./plan-validation.mjs";
import { createQueueHistory } from "./queue-history.mjs";
import { prepareRangeInput } from "./range-input.mjs";
import { publishRender, recoverPublication, renderScratch } from "./render-publication.mjs";
import { verifiedRenderOutput } from "./render-resume.mjs";
import { createRequestOriginPolicy } from "./request-origin.mjs";
import { createAuthRoutes } from "./routes/auth.mjs";
import { createBatchRoutes } from "./routes/batch.mjs";
import { createHealthRoutes } from "./routes/health.mjs";
import { createRequestHandler } from "./routes/http-handler.mjs";
import { createMusicRoutes } from "./routes/music.mjs";
import { createRenderRoutes } from "./routes/render.mjs";
import { createRouter } from "./routes/router.mjs";
import { createSourcesRoutes } from "./routes/sources.mjs";
import { createStorageRoutes } from "./routes/storage.mjs";
import { renderSceneOverlay } from "./scene-overlays.mjs";
import { smartCutPlan } from "./smart-cut.mjs";
import { createSourceContextService } from "./source-context.mjs";
import { createSourceReuse } from "./source-reuse.mjs";
import { createSourceService } from "./source-service.mjs";
import { createSpeechService } from "./speech.mjs";
import { createTeaserSelector } from "./teaser-selection.mjs";
import { titleAnimationFilters } from "./title-animation.mjs";
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
  CHATGPT_KEYCHAIN_SERVICE: betaRuntime.credentialService,
})) {
  if (process.env[key] !== undefined && process.env[key] !== expected)
    throw Error(`Beta isolation: invalid ${key}; refusing cross-profile access.`);
}
const inheritedFontConfig = process.env.FONTCONFIG_FILE,
  credentialHelper = process.env.CHATGPT_CREDENTIAL_HELPER;
const isolatedEnvironment = runtimeEnvironment(betaRuntime);
for (const key of Object.keys(process.env)) if (!(key in isolatedEnvironment)) delete process.env[key];
Object.assign(process.env, isolatedEnvironment);
if (inheritedFontConfig) {
  if (path.resolve(inheritedFontConfig) !== path.join(betaRuntime.dataRoot, "fontconfig.xml"))
    throw Error("Beta fontconfig must be app-local.");
  process.env.FONTCONFIG_FILE = inheritedFontConfig;
}
if (credentialHelper) {
  if (
    process.platform !== "win32" ||
    path.resolve(credentialHelper) !== path.resolve(projectRoot, "../runtime/bin/chatgpt-credential-store.exe")
  )
    throw Error("Beta credential helper must be bundled.");
  process.env.CHATGPT_CREDENTIAL_HELPER = credentialHelper;
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
let renderQueue = Promise.resolve();

function exportPrefixFor(plan, source) {
  const aliases = {
    de: "de",
    fr: "fr",
    ja: "jp",
    jp: "jp",
    ko: "kr",
    kr: "kr",
    en: "us",
    us: "us",
    vi: "vn",
    zh: "cn",
    es: "es",
    it: "it",
    pt: "pt",
    ru: "ru",
  };
  const sourceLanguage = String(source.language || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  if (aliases[sourceLanguage]) return aliases[sourceLanguage];
  const script = detectScript(`${plan.originalTitle} ${plan.parts.map((part) => part.title).join(" ")}`);
  if (script === "korean") return "kr";
  if (script === "japanese") return "jp";
  return aliases[String(plan.language || "").toLowerCase()] || "us";
}

function reserveExportNames(plan, source) {
  return exportNameAllocator.reserve(exportPrefixFor(plan, source), plan.parts.length);
}

async function executeRender(job, source, plan, signal) {
  let scratch;
  try {
    signal?.throwIfAborted();
    requireCurrentExportPolicy(job);
    validateRenderPlan(plan, source);
    await verifySourceTeasers(plan, source, signal);
    job.plan = structuredClone(plan);
    job.state = "rendering";
    job.startedAt = new Date().toISOString();
    const outputDirectory = path.join(source.directory, "outputs", job.id);
    await mkdir(outputDirectory, { recursive: true });
    scratch = await renderScratch(outputDirectory, { sourceId: source.id, jobId: job.id });
    const exportNames = job.exportNames || (await reserveExportNames(plan, source));
    job.exportNames = exportNames;
    await persistBatchHistory({ strict: true });
    const sceneAsset = await renderSceneOverlay({
      overlays: plan.visualStyle?.overlays || [],
      publicRoot: path.join(projectRoot, "public"),
      outputPath: path.join(scratch.root, "scene-overlays.png"),
    });
    // One static gradient per job, shared by all parts; never rasterize per frame.
    const background = assertRenderableBackground(plan.visualStyle?.background);
    let backgroundAsset;
    if (background.mode === "gradient") {
      backgroundAsset = path.join(scratch.root, "background.png");
      const pixels = Buffer.alloc(1080 * 1920 * 3);
      for (let y = 0; y < 1920; y++) {
        const row = Buffer.from(gradientRowRgb(background, y, 1920));
        pixels.fill(row, y * 1080 * 3, (y + 1) * 1080 * 3);
      }
      await sharp(pixels, { raw: { width: 1080, height: 1920, channels: 3 } })
        .png()
        .toFile(backgroundAsset);
    }
    const outputDurations = plan.parts.map((part) => presentationDuration(part) / PLAYBACK_RATE),
      totalOutputSeconds = outputDurations.reduce((a, b) => a + b, 0);
    let completedSeconds = 0;
    job.totalOutputSeconds = totalOutputSeconds;
    for (const [index, part] of plan.parts.entries()) {
      signal?.throwIfAborted();
      const finalDirectory = path.join(outputDirectory, `part-${part.id}`);
      const prior =
        job.outputs.find((o) => o.part === part.id) ||
        (await recoverPublication({
          directory: finalDirectory,
          filename: exportNames[index],
          sourceId: source.id,
          jobId: job.id,
          partId: part.id,
          metadataPolicy: EXPORT_METADATA_POLICY,
        }));
      const completed = await verifiedRenderOutput({
        file: path.join(outputDirectory, `part-${part.id}`, exportNames[index]),
        filename: exportNames[index],
        record: prior,
        sourceId: source.id,
        jobId: job.id,
        partId: part.id,
        duration: presentationDuration(part) / PLAYBACK_RATE,
        probe: probeMedia,
      });
      if (completed) {
        if (!job.outputs.some((o) => o.part === part.id)) job.outputs.push(completed);
        completedSeconds += outputDurations[index];
        job.outputSeconds = completedSeconds;
        job.progress = Math.min(99, Math.floor((completedSeconds / totalOutputSeconds) * 100));
        await persistBatchHistory({ strict: true });
        continue;
      }
      // An existing unrecorded/legacy/corrupt file is never overwritten or
      // adopted as a clean export. Keep it and require a separate new job.
      const existingFile = path.join(outputDirectory, `part-${part.id}`, exportNames[index]);
      const existingOutput = await lstat(existingFile).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (existingOutput)
        throw new Error(
          "MP4 đã tồn tại nhưng không đủ bằng chứng chính sách metadata hiện tại. Xuất thành job mới; không ghi đè/xóa file cũ.",
        );
      job.outputs = job.outputs.filter((o) => o.part !== part.id);
      job.currentPart = part.id;
      job.phase = "rendering";
      const filename = exportNames[index];
      const partDirectory = path.join(scratch.root, `part-${part.id}`);
      await mkdir(partDirectory, { recursive: true });
      const outputPath = path.join(partDirectory, filename);
      job.encoder = await renderPart({
        source,
        plan,
        part,
        totalParts: plan.parts.length,
        backgroundAsset,
        sceneAsset,
        outputPath,
        signal,
        onEncoder: (encoder, fallback) => {
          job.encoder = encoder;
          job.encoderFallback = fallback;
          job.resourceNotice =
            encoder === "libx264"
              ? fallback
                ? "VideoToolbox lỗi; chuyển CPU · giới hạn 2 luồng."
                : "CPU · giới hạn 2 luồng (VideoToolbox chưa khả dụng)."
              : "Apple VideoToolbox · Balanced M2";
          void persistBatchHistory();
        },
        onProgress: (partProgress) => {
          job.outputSeconds = completedSeconds + partProgress * outputDurations[index];
          job.progress = Math.max(
            job.progress || 0,
            Math.min(99, Math.floor((job.outputSeconds / totalOutputSeconds) * 100)),
          );
        },
      });
      signal?.throwIfAborted();
      job.phase = "validating";
      const outputStat = await stat(outputPath);
      const checked = await verifiedRenderOutput({
        file: outputPath,
        filename,
        record: { filename, size: outputStat.size, metadataPolicy: EXPORT_METADATA_POLICY },
        sourceId: source.id,
        jobId: job.id,
        partId: part.id,
        duration: presentationDuration(part) / PLAYBACK_RATE,
        probe: probeMedia,
      });
      if (!checked) throw Error("MP4 chưa đạt geometry/duration/audio contract; chưa publish, có thể Resume part này.");
      job.phase = "publishing";
      await publishRender({
        staging: outputPath,
        directory: finalDirectory,
        filename,
        sourceId: source.id,
        jobId: job.id,
        partId: part.id,
        metadataPolicy: EXPORT_METADATA_POLICY,
        signal,
      });
      job.outputs.push({
        part: part.id,
        filename,
        size: outputStat.size,
        metadataPolicy: EXPORT_METADATA_POLICY,
        url: `/files/${source.id}/outputs/${job.id}/part-${part.id}/${encodeURIComponent(filename)}`,
      });
      await persistBatchHistory({ strict: true });
      completedSeconds += outputDurations[index];
    }
    job.progress = 100;
    job.state = "done";
    job.finishedAt = new Date().toISOString();
  } catch (error) {
    job.state = signal?.aborted ? "cancelled" : "error";
    job.error = signal?.aborted ? null : error instanceof Error ? error.message : String(error);
    job.finishedAt = new Date().toISOString();
  } finally {
    if (scratch) await scratch.dispose().catch(() => {});
  }
}

function startRender(body, parentSignal) {
  // Pending HTTP calls and already queued/running editor jobs share this key.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([body.sourceId, body.plan], (_key, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, v[k]]),
            )
          : v,
      ),
    )
    .digest("hex");
  const key = body.submissionId ? `id:${assertId(body.submissionId)}` : `editor:${fingerprint}`;
  if (pendingRenderSubmissions.has(key)) {
    const pending = pendingRenderSubmissions.get(key);
    if (pending.sourceId !== body.sourceId)
      throw Object.assign(new Error("Submission belongs to another source"), { status: 409 });
    return pending.promise;
  }
  if (!body.submissionId) {
    const active = [...jobs.values()].find(
      (j) =>
        j.origin === "editor" &&
        j.submissionFingerprint === fingerprint &&
        ["queued", "rendering"].includes(j.state) &&
        !j.deleted,
    );
    if (active) return Promise.resolve(active);
  }
  const task = prepareRenderSubmission(body, parentSignal, fingerprint).finally(() => {
    if (pendingRenderSubmissions.get(key)?.promise === task) pendingRenderSubmissions.delete(key);
  });
  pendingRenderSubmissions.set(key, { sourceId: body.sourceId, promise: task });
  return task;
}

async function prepareRenderSubmission(body, parentSignal, fingerprint) {
  if (mediaLibrary.isLocked(body.sourceId))
    throw Object.assign(new Error("Video đang được chuyển/xoá trong Thùng rác. Thử lại sau."), { status: 409 });
  const source = await loadSource(body.sourceId, parentSignal);
  parentSignal?.throwIfAborted();
  body.plan = originalCutPlan(body.plan, source.id);
  if (body.transcript !== undefined) {
    if (typeof body.transcript !== "string" || body.transcript.length > 1_000_000)
      throw Error("Transcript vượt giới hạn 1 triệu ký tự hoặc sai định dạng; không tự bỏ phần cuối.");
    body.plan = { ...body.plan, teaserTranscriptKey: await selectionDigest(transcriptValue(body.transcript)) };
  }
  const captions = effectiveCaptionTrack(body.plan, source);
  let originalPlan = structuredClone(
    effectiveCutPlan({ ...body.plan, originalTitle: source.title, ...(captions ? { captionCues: captions } : {}) }),
  );
  validateRenderPlan(originalPlan, source);
  if (body.instruction !== undefined || body.supplementalPrompt !== undefined)
    await assertTeaserContexts(originalPlan, source, captions?.cues || [], body.transcript || source.transcript || "", {
      instruction: body.instruction,
      supplementalPrompt: body.supplementalPrompt,
    });
  await verifySourceTeasers(originalPlan, source, parentSignal);
  // Rendering never selects/fills hooks. Explicit selection must finish first.
  validateRenderPlan(originalPlan, source);
  originalPlan = snapshotPlanVisualStyle(originalPlan);
  if (originalPlan.subtitles.enabled && !originalPlan.captionCues)
    throw Error("Tạo/duyệt phụ đề trong editor trước khi xuất; không tự thay caption track của job đã gửi.");
  if (originalPlan.subtitles.enabled && originalPlan.captionCues)
    originalPlan.captionCues = sourceCaptionTrack(originalPlan.captionCues, source);
  originalPlan.music = normalizeMusic(originalPlan.music);
  if (originalPlan.music.enabled) {
    for (const part of originalPlan.parts) {
      const m = effectiveMusic(originalPlan.music, part.id);
      if (m.enabled) await musicLibrary.resolve(m.assetId);
    }
  }
  const renderPlan = originalPlan;
  validateRenderPlan(renderPlan, source);
  if (mediaLibrary.isLocked(source.id))
    throw Object.assign(new Error("Video đang được chuyển/xoá trong Thùng rác. Thử lại sau."), { status: 409 });
  if (body.submissionId) {
    assertId(body.submissionId);
    const existing = jobs.get(body.submissionId);
    if (existing) {
      if (existing.sourceId !== source.id) throw new Error("Submission belongs to another source");
      requireCurrentExportPolicy(existing);
      validateRenderPlan(existing.plan, source);
      return existing;
    }
    if (existsSync(path.join(source.directory, "outputs", body.submissionId)))
      throw new Error("Render output exists without its history; inspect it before another submission.");
  }
  const job = {
    id: body.submissionId || randomUUID(),
    sourceId: source.id,
    origin: parentSignal ? "batch" : "editor",
    metadataPolicy: EXPORT_METADATA_POLICY,
    submissionFingerprint: fingerprint,
    resourceProfile: RENDER_RESOURCE_PROFILE,
    plan: originalPlan,
    startTrimSeconds: 1,
    state: "queued",
    progress: 0,
    currentPart: null,
    outputs: [],
    encoder: preferredVideoEncoder,
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  try {
    await persistBatchHistory({ strict: true });
  } catch (error) {
    job.state = "error";
    job.error = "Không lưu được lịch sử job; chưa bắt đầu render.";
    job.finishedAt = new Date().toISOString();
    throw error;
  }
  enqueueRender(job, source, renderPlan, parentSignal);
  return job;
}

function enqueueRender(job, source, renderPlan, parentSignal) {
  const controller = new AbortController();
  renderControllers.set(job.id, controller);
  const abort = () => cancelRender(job);
  const detachParent = () => parentSignal?.removeEventListener("abort", abort);
  renderParentCleanup.set(controller, detachParent);
  parentSignal?.addEventListener("abort", abort, { once: true });
  if (parentSignal?.aborted) abort();
  const task = renderQueue
    .then(async () => {
      // A queued cancellation is already final. Its old promise must not touch a
      // resumed job or reacquire resources when the preceding export completes.
      if (controller.signal.aborted || renderControllers.get(job.id) !== controller) return;
      startedRenderControllers.add(controller);
      const signal = controller.signal;
      signal.throwIfAborted();
      job.phase = "preparing";
      let prepared = structuredClone(renderPlan);
      // Cut compatibility was resolved before job creation; snapshots never run a second Smart Cut here.
      if (prepared.parts.some((p) => !p.startTrimApplied || !p.smartCutApplied))
        throw Error("Snapshot cũ chưa chốt cut; mở trong editor và gửi job mới, không tự sửa job đã lưu.");
      if (prepared.music?.enabled && prepared.music.ducking)
        prepared.musicSpeech = await musicSpeech.detect(source, signal);
      if (prepared.subtitles?.enabled && !prepared.captionCues)
        throw Error("Tạo/duyệt phụ đề trong editor trước khi gửi job mới; không đổi track sau khi snapshot.");
      signal.throwIfAborted();
      validateRenderPlan(prepared, source);
      job.plan = structuredClone(prepared);
      job.phase = "rendering";
      await mediaResources.use("render", (active) => executeRender(job, source, prepared, active), signal);
    })
    .catch((error) => {
      if (renderControllers.get(job.id) !== controller) return;
      job.state = controller.signal.aborted ? "cancelled" : "error";
      job.error = controller.signal.aborted ? null : error instanceof Error ? error.message : String(error);
      job.finishedAt = new Date().toISOString();
    })
    .finally(async () => {
      try {
        if (renderControllers.get(job.id) === controller) {
          renderControllers.delete(job.id);
          job.phase = null;
          await persistBatchHistory({ strict: true });
        }
      } finally {
        detachParent();
        renderParentCleanup.delete(controller);
        startedRenderControllers.delete(controller);
      }
    });
  renderQueue = task.catch((error) => console.error(`Render final history write failed: ${error.code || "IO_ERROR"}`));
}

async function resumeRender(job, parentSignal) {
  requireCurrentExportPolicy(job);
  if (!["error", "cancelled"].includes(job.state) || renderControllers.has(job.id))
    throw new Error("Render still active or already complete; no duplicate submission.");
  if (mediaLibrary.isLocked(job.sourceId)) throw new Error("Source is in use/trash.");
  const source = await loadSource(job.sourceId, parentSignal);
  validateRenderPlan(job.plan, source);
  await verifySourceTeasers(job.plan, source, parentSignal);
  const previous = {
    state: job.state,
    error: job.error,
    attempt: job.attempt,
    progress: job.progress,
    outputSeconds: job.outputSeconds,
  };
  job.state = "queued";
  job.error = null;
  job.attempt = (job.attempt || 1) + 1;
  job.progress = 0;
  job.outputSeconds = 0;
  try {
    await persistBatchHistory({ strict: true });
  } catch (error) {
    Object.assign(job, previous);
    throw error;
  }
  enqueueRender(job, source, structuredClone(job.plan), parentSignal);
  return job;
}

function cancelRender(job) {
  if (!job) return;
  if (["done", "error", "cancelled"].includes(job.state)) return;
  job.state = "cancelled";
  job.error = null;
  job.finishedAt = new Date().toISOString();
  const controller = renderControllers.get(job.id);
  controller?.abort();
  // Nothing has started for this controller: no process, resource lease or
  // output cleanup needs waiting. Do not wait for unrelated earlier exports.
  if (controller && !startedRenderControllers.has(controller) && renderControllers.get(job.id) === controller) {
    renderControllers.delete(job.id);
    job.phase = null;
    renderParentCleanup.get(controller)?.();
    renderParentCleanup.delete(controller);
  }
  void persistBatchHistory({ immediate: true });
}

function renderSnapshot(job) {
  return { ...job, stopping: job.state === "cancelled" && renderControllers.has(job.id) };
}

const exportBusy = () =>
  pendingRenderSubmissions.size > 0 ||
  [...jobs.values()].some((j) => ["queued", "rendering"].includes(j.state) && renderControllers.has(j.id));
const { persistBatchHistory, restoreBatchHistory } = createQueueHistory(() => ({
  batches,
  dataRoot,
  jobs,
  probeMedia,
  sourcesRoot,
}));

const batchPreparationQueue = createBatchSubmissionQueue({
  batches,
  controllers: batchControllers,
  prepare: prepareBatch,
  onChange: () => persistBatchHistory({ immediate: true }),
});
const legacyDataRoot =
  process.env.MEDIA_WORKER_LEGACY_DATA_DIR ||
  path.join(homedir(), "Documents", "tiktok-edit", "short-video-studio", "worker-data");
const mediaLibrary = createMediaLibrary({
  editorInUse: ({ storageId, sourceId, kind }) =>
    storageId === "current" && kind === "original" && editorSourceLeases.has(sourceId),
  roots: [
    { id: "current", label: "Dữ liệu app hiện tại", root: dataRoot },
    // Beta never mounts another profile's library.
  ],
  isBusy: ({ storageId, sourceId, jobId, kind }) =>
    storageId === "current" &&
    (["part", "parts"].includes(kind)
      ? // Outputs belong to a specific job directory. Playback/analysis of the
        // source, or a different export of that source, cannot mutate these files.
        [...jobs.values()].some(
          (job) => job.id === jobId && (["queued", "rendering"].includes(job.state) || renderControllers.has(job.id)),
        ) ||
        [...batches.values()].some((batch) =>
          batch.items.some(
            (item) => !item.deleted && item.jobId === jobId && (item.deleting || item.state === "submitting"),
          ),
        )
      : speech.isBusy(sourceId) ||
        musicSpeech.isBusy(sourceId) ||
        musicPreview.isBusy(sourceId) ||
        localSignals.isBusy(sourceId) ||
        webAiVideos.isBusy(sourceId) ||
        [...jobs.values()].some(
          (job) =>
            job.sourceId === sourceId && (["queued", "rendering"].includes(job.state) || renderControllers.has(job.id)),
        ) ||
        [...batches.values()].some((batch) =>
          batch.items.some(
            (item) =>
              !item.deleted &&
              (item.sourceId || jobs.get(item.jobId)?.sourceId) === sourceId &&
              (item.deleting ||
                [
                  "downloading",
                  "analyzing",
                  "paused",
                  "awaiting-import",
                  "review-required",
                  "render-ready",
                  "submitting",
                ].includes(item.state)),
          ),
        )),
  onMoved: async (item) => {
    if (item.storageId === "current" && item.kind === "original") {
      await sourceReuse.forget(item.sourceId);
      return;
    }
    if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
    const job = jobs.get(item.jobId);
    if (job) {
      if (item.kind === "parts") {
        job.deleted = true;
        job.outputs = [];
      } else job.outputs = job.outputs.filter((output) => output.url !== item.renderUrl);
    }
    await persistBatchHistory({ strict: true });
  },
  onRestored: async (item) => {
    if (item.storageId === "current" && item.kind === "original") {
      await sourceReuse.restored(item.sourceId);
      return;
    }
    if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
    const outputs = [];
    for (const part of [1, 2]) {
      const folder = path.join(sourcesRoot, item.sourceId, "outputs", item.jobId, `part-${part}`);
      let files;
      try {
        const info = await lstat(folder);
        if (!info.isDirectory() || info.isSymbolicLink()) continue;
        files = await readdir(folder, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const file of files.filter((file) => file.isFile() && /\.mp4$/i.test(file.name))) {
        outputs.push({
          part,
          filename: file.name,
          size: (await stat(path.join(folder, file.name))).size,
          url: `/files/${item.sourceId}/outputs/${item.jobId}/part-${part}/${encodeURIComponent(file.name)}`,
        });
      }
    }
    const job = jobs.get(item.jobId);
    if (job) {
      job.outputs = outputs;
      delete job.deleted;
    } else
      jobs.set(item.jobId, {
        id: item.jobId,
        sourceId: item.sourceId,
        state: "done",
        progress: 100,
        currentPart: null,
        outputs,
        error: null,
      });
    const restoredItemIds = [];
    for (const batch of batches.values())
      for (const candidate of batch.items) {
        if (candidate.jobId === item.jobId && candidate.deleted) {
          delete candidate.deleted;
          candidate.state = "done";
          candidate.error = null;
          restoredItemIds.push(candidate.id);
        }
      }
    await persistBatchHistory({ strict: true });
    return { restoredItemIds, restoredUrls: outputs.map((output) => output.url) };
  },
});
const {
  activeChatGPTCredentials,
  chatGPTRegistrationPath,
  chatGPTResource,
  chatGPTStore,
  deleteChatGPTCredentials,
  exchangeChatGPTCode,
  listChatGPTModels,
  pendingChatGPTAuth,
  publicChatGPTSession,
  readChatGPTCredentials,
  startChatGPTAuthorization,
} = createChatGPTAuth(() => ({ betaRuntime, dataRoot, host, port }));

function findOnPath(name) {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function resolveBinary(environmentName, name, fallbacks = []) {
  const configured = process.env[environmentName];
  const candidates = [configured, findOnPath(name), ...fallbacks].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

const ffmpeg = resolveBinary("FFMPEG_PATH", "ffmpeg", ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]);
const ffprobe = resolveBinary("FFPROBE_PATH", "ffprobe", ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe"]);
const whisper = resolveBinary("WHISPER_PATH", "whisper-cli", ["/opt/homebrew/bin/whisper-cli"]);
const speech = createSpeechService({ dataRoot, sourcesRoot, ffmpeg, whisper, run, resources: mediaResources });
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

function supportsEncoder(binary, encoder) {
  if (!binary) return false;
  const result = spawnSync(binary, ["-hide_banner", "-h", `encoder=${encoder}`], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  return result.status === 0 && !result.stderr.includes("not recognized");
}

const videoToolboxAvailable = process.platform === "darwin" && supportsEncoder(ffmpeg, "h264_videotoolbox");
const preferredVideoEncoder = videoToolboxAvailable ? "h264_videotoolbox" : "libx264";
const { contrast: renderContrast, saturation: renderSaturation } = currentFilterEnvironment(process.env);
const hardwareDecodeCodecs = new Set(["h264", "hevc", "prores"]);

function fontFamilyFor(text, font = "auto") {
  return fontFamilyForStyle(font, text, {
    overrides: {
      latin: process.env.FONT_LATIN_FAMILY,
      japanese: process.env.FONT_JAPANESE_FAMILY,
      korean: process.env.FONT_KOREAN_FAMILY,
    },
  });
}

let overlayFontsReady;

function registerOverlayFonts() {
  overlayFontsReady ||= Promise.all(
    listFonts()
      .filter((font) => font.bundled)
      .map(({ family, file }) =>
        sharp({
          text: {
            text: "A",
            font: `${family} Bold 12`,
            fontfile: path.join(projectRoot, "public", file),
            rgba: true,
          },
        })
          .png()
          .toBuffer(),
      ),
  );
  return overlayFontsReady;
}

const overlayFitConfig = {
  original: { ...TITLE_LAYOUT, maxHeight: TITLE_LAYOUT.original.bottom - TITLE_LAYOUT.original.top },
  part: { ...TITLE_LAYOUT, maxHeight: TITLE_LAYOUT.part.bottom - TITLE_LAYOUT.part.top },
};

function characterWidthEm(character) {
  if (/\s/.test(character)) return 0.32;
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(character)) return 1;
  if (/[A-Z0-9]/.test(character)) return 0.9;
  if (/[a-z\u00c0-\u024f]/.test(character)) return 0.62;
  if (/[-–—.,:;!?()[\]{}'"/\\]/.test(character)) return 0.34;
  return 0.62;
}

function textWidthEm(value) {
  return Array.from(value).reduce((width, character) => width + characterWidthEm(character), 0);
}

function splitLongToken(token, maxWidthEm) {
  const chunks = [];
  let current = "";
  for (const character of Array.from(token)) {
    if (current && textWidthEm(`${current}${character}`) > maxWidthEm) {
      chunks.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapByVisualWidth(value, maxWidthEm) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidthEm(candidate) <= maxWidthEm) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    const chunks = splitLongToken(word, maxWidthEm);
    if (chunks.length > 1) {
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) || "";
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function ellipsizeLine(value, maxWidthEm) {
  let result = value.trimEnd();
  while (result && textWidthEm(`${result}…`) > maxWidthEm) {
    result = Array.from(result).slice(0, -1).join("").trimEnd();
  }
  return `${result}…`;
}

function fitOverlayText(value, role, fontCap = TITLE_LAYOUT.maxFontSize) {
  const config = overlayFitConfig[role];
  const normalized =
    String(value || "")
      .trim()
      .replace(/\s+/g, " ") || "UNTITLED";

  for (let fontSize = Math.min(config.maxFontSize, fontCap); fontSize >= config.minFontSize; fontSize -= 2) {
    const lines = wrapByVisualWidth(normalized, config.maxWidth / fontSize);
    const textHeight = lines.length * fontSize + Math.max(0, lines.length - 1) * config.lineSpacing;
    if (lines.length <= config.maxLines && textHeight <= config.maxHeight) {
      return { lines, fontSize, lineSpacing: config.lineSpacing, truncated: false };
    }
  }

  const maxWidthEm = config.maxWidth / config.minFontSize;
  const lines = wrapByVisualWidth(normalized, maxWidthEm).slice(0, config.maxLines);
  lines[lines.length - 1] = ellipsizeLine(lines[lines.length - 1], maxWidthEm);
  return { lines, fontSize: config.minFontSize, lineSpacing: config.lineSpacing, truncated: true };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function renderTitleOverlay({
  outputPath,
  shineOutputPath,
  originalTitle,
  partTitle,
  partId,
  totalParts,
  visualStyle = DEFAULT_VISUAL_STYLE,
}) {
  partTitle = partOverlayTitle(partTitle);
  await registerOverlayFonts();
  const size = Math.min(fitOverlayText(originalTitle, "original").fontSize, fitOverlayText(partTitle, "part").fontSize);
  let pair = {
    original: fitOverlayText(originalTitle, "original", size),
    part: fitOverlayText(partTitle, "part", size),
  };
  if (needsMeasuredTitleFit(visualStyle)) {
    pair = await constrainTitlePair(originalTitle, partTitle, pair, async (text, fontSize, role) => {
      const style = visualStyle[role === "original" ? "originalTitle" : "partTitle"];
      const family = fontFamilyFor(role === "original" ? originalTitle : partTitle, style.font);
      const { width } = await sharp({
        text: {
          text: `<span font_family="${escapeXml(family)}" weight="${style.fontWeight}" size="${fontSize * 1024}">${escapeXml(text)}</span>`,
          rgba: true,
        },
      }).metadata();
      return width + style.outline * 2 + 2;
    });
  }
  const { original: originalFit, part: partFit } = pair;
  const originalLineHeight = originalFit.fontSize + originalFit.lineSpacing;
  const originalLastBaseline = TITLE_LAYOUT.original.bottom - originalFit.fontSize * 0.2;
  const originalFirstBaseline = originalLastBaseline - (originalFit.lines.length - 1) * originalLineHeight;
  const partLineHeight = partFit.fontSize + partFit.lineSpacing;
  const originalFamily = fontFamilyFor(originalTitle, visualStyle.originalTitle.font);
  const partFamily = fontFamilyFor(partTitle, visualStyle.partTitle.font);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs><clipPath id="top-title-zone"><rect x="0" y="0" width="1080" height="${FOREGROUND_Y}" /></clipPath><clipPath id="bottom-title-zone"><rect x="0" y="${TITLE_LAYOUT.part.top - 24}" width="1080" height="${1800 - (TITLE_LAYOUT.part.top - 24)}" /></clipPath></defs>
      <g clip-path="url(#top-title-zone)">${styledTextSvg(originalFit.lines, { fontFamily: originalFamily, fontSize: originalFit.fontSize, firstBaseline: originalFirstBaseline, lineHeight: originalLineHeight, style: visualStyle.originalTitle })}</g>
      <g clip-path="url(#bottom-title-zone)">${styledTextSvg(partFit.lines, { fontFamily: partFamily, fontSize: partFit.fontSize, firstBaseline: TITLE_LAYOUT.part.top + partFit.fontSize * 0.82, lineHeight: partLineHeight, style: visualStyle.partTitle })}</g>
      ${styledTextSvg([`${partId}/${totalParts}`], { fontFamily: visualStyle.partIndicator.font === "auto" ? partFamily : fontFamilyFor(partTitle, visualStyle.partIndicator.font), fontSize: 58, firstBaseline: 1850, lineHeight: 60, style: visualStyle.partIndicator })}
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  if (shineOutputPath) {
    const shineText = (fit, family, baseline, style) =>
      style.effect !== "current-title-glow-shine"
        ? ""
        : `<g font-family="${escapeXml(family)}" font-size="${fit.fontSize}" font-weight="${style.fontWeight}" opacity="${style.opacity}"><g fill="#b4e9ff" filter="url(#shine-glow)">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join("")}</g><g fill="#e8f7ff">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join("")}</g></g>`;
    const shineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="shine-glow"><feGaussianBlur stdDeviation="${originalFit.fontSize * 0.08}"/></filter><clipPath id="top"><rect width="1080" height="${FOREGROUND_Y}"/></clipPath><clipPath id="bottom"><rect y="${TITLE_LAYOUT.part.top - 24}" width="1080" height="${1800 - TITLE_LAYOUT.part.top + 24}"/></clipPath></defs><g clip-path="url(#top)">${shineText(originalFit, originalFamily, originalFirstBaseline, visualStyle.originalTitle)}</g><g clip-path="url(#bottom)">${shineText(partFit, partFamily, TITLE_LAYOUT.part.top + partFit.fontSize * 0.82, visualStyle.partTitle)}</g></svg>`;
    await sharp(Buffer.from(shineSvg)).png().toFile(shineOutputPath);
  }
}

async function subtitleFrames(source, plan, part, directory, signal) {
  const style = subtitleStyle(plan.subtitles);
  if (!style.enabled) return null;
  const supplied = plan.captionCues;
  let cues;
  if (!style.enabled) cues = [];
  else if (supplied) {
    cues = sourceCaptionTrack(supplied, source).cues;
  } else cues = (await speech.captions(source, signal, { provider: style.source })).cues;
  if (style.enabled && !cues.length) {
    if (!source.hasAudio) return null;
    throw new Error("Không nhận diện được lời nói để tạo phụ đề. Kiểm tra audio hoặc tắt Auto Subtitle.");
  }
  await registerOverlayFonts();
  const captions = partCaptions(cues, part, style);
  const blank = path.join(directory, "subtitle-blank.png");
  await sharp({ create: { width: 1080, height: 1920, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toFile(blank);
  const frames = [];
  let position = 0;
  // Replayed teaser/main captions can share exact bitmaps within this part.
  const subtitleImages = new Map();
  const add = (file, duration) => {
    if (duration > 0.001)
      frames.push(`file '${path.basename(file)}'\nduration ${(duration / PLAYBACK_RATE).toFixed(6)}`);
  };
  for (const [index, cue] of captions.entries()) {
    signal?.throwIfAborted();
    const start = Math.max(position, cue.start),
      end = Math.min(cue.end, captions[index + 1]?.start ?? Infinity);
    if (end <= start) continue;
    add(blank, start - position);
    const size = style.size;
    const lines = cue.text.split("\n"),
      family = fontFamilyFor(cue.text, style.font);
    const y = subtitleY(style, source.height);
    const text = lines
      .map(
        (line, lineIndex) =>
          `<text x="540" y="${y - (lines.length - lineIndex - 1) * size * 1.2}" text-anchor="middle">${escapeXml(line)}</text>`,
      )
      .join("");
    const legacyGraphic = `<g font-family="${escapeXml(family)}" font-size="${size}" font-weight="700" stroke-linejoin="round" paint-order="stroke fill"><g transform="translate(2,3)" fill="#000" stroke="#000" stroke-width="${style.outline * 2 + 2}" opacity=".6">${text}</g><g fill="${style.color}" stroke="${style.outlineColor}" stroke-width="${style.outline * 2}">${text}</g></g>`;
    const graphic =
      style.effect === undefined
        ? legacyGraphic
        : styledTextSvg(lines, {
            fontFamily: family,
            fontSize: size,
            firstBaseline: y - (lines.length - 1) * size * 1.2,
            lineHeight: size * 1.2,
            roundBaseline: false,
            style: { ...style, fontWeight: style.fontWeight ?? 700, opacity: style.opacity ?? 1 },
          });
    const svg = (opacity) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><g opacity="${opacity}">${graphic}</g></svg>`;
    const image = svg(1);
    let file = subtitleImages.get(image);
    if (!file) {
      file = path.join(directory, `subtitle-${index}.png`);
      await sharp(Buffer.from(image)).png().toFile(file);
      if (subtitleImages.size < 256) subtitleImages.set(image, file);
    }
    add(file, end - start);
    position = end;
  }
  const duration = presentationDuration(part);
  add(blank, Math.max(0.04, duration - position));
  const list = path.join(directory, "subtitles.ffconcat");
  await writeFile(list, `ffconcat version 1.0\n${frames.join("\n")}\nfile '${path.basename(blank)}'\n`);
  return list;
}

async function renderPart({
  source,
  plan,
  part,
  totalParts,
  outputPath,
  backgroundAsset,
  sceneAsset,
  onProgress,
  onEncoder = () => {},
  signal,
}) {
  signal?.throwIfAborted();
  if (!ffmpeg) throw new Error("Không tìm thấy FFmpeg. macOS: brew install ffmpeg");
  const workDirectory = path.dirname(outputPath);
  const titleOverlayPath = path.join(workDirectory, `part-${part.id}-titles.png`);
  const visualStyle = plan.visualStyle || DEFAULT_VISUAL_STYLE;
  const animated = normalizeTitleAnimation(visualStyle.titleAnimation) !== "none";
  // Static non-shine titles previously decoded an entirely transparent PNG and
  // ran crop/geq/overlay on it every frame. Keep the existing animated grouping
  // (including its format conversions) and actual shine effects untouched.
  const needsShineInput =
    animated ||
    [visualStyle.originalTitle, visualStyle.partTitle].some((style) => style.effect === "current-title-glow-shine");
  const titleShinePath = needsShineInput ? path.join(workDirectory, `part-${part.id}-shine.png`) : null;
  await renderTitleOverlay({
    outputPath: titleOverlayPath,
    shineOutputPath: titleShinePath,
    originalTitle: plan.originalTitle,
    partTitle: part.title,
    partId: part.id,
    totalParts,
    visualStyle,
  });

  // Scene decorations stay outside the foreground transition, under text.
  const musicSettings = effectiveMusic(plan.music, part.id);
  const musicAsset = musicSettings.enabled ? await musicLibrary.resolve(musicSettings.assetId) : null;
  const segments = presentationSegments(part);
  // One output clock before composition. Do not use AV-concat's longest-stream
  // padding, per-segment fps conversion or cloned EOF frames to conceal cuts.
  const outputFrames = Math.round((presentationDuration(part) / PLAYBACK_RATE) * 30);
  const transitionWindows = partTransitionWindows(part, plan.visualStyle?.cutTransition, plan.hookTransition).map(
    (w) => ({ ...w, presetId: w.presetId || plan.visualStyle?.cutTransition || "none" }),
  );
  const hasTransitions = transitionWindows.length > 0;
  let titleInputPath = titleOverlayPath;
  if (sceneAsset && !animated) {
    titleInputPath = path.join(workDirectory, `part-${part.id}-scene-titles.png`);
    await sharp(sceneAsset)
      .composite([{ input: titleOverlayPath }])
      .png()
      .toFile(titleInputPath);
  }

  const subtitlesPath = await subtitleFrames(source, plan, part, workDirectory, signal);
  const rangeInput = await prepareRangeInput({ source, segments, directory: workDirectory, ffmpeg, run, signal });
  const filterGraphPath = path.join(workDirectory, `part-${part.id}-filters.ffgraph`);
  try {
    const overlayInput = 2; // sequential source video + finite, sample-trimmed PCM
    // Allocate optional inputs in precisely the same order as buildArgs below.
    let nextInput = overlayInput + 1;
    const shineInput = needsShineInput ? nextInput++ : undefined;
    const subtitleInput = subtitlesPath ? nextInput++ : undefined;
    const backgroundInput = backgroundAsset ? nextInput++ : undefined;
    const animatedSceneInput = animated && sceneAsset ? nextInput++ : undefined;
    const vrInput = nextInput;
    // Decode each static PNG once, then repeat that one decoded frame on the same
    // 30fps output clock. Never use this for source video or caption sequences.
    const staticInputFilter = "loop=loop=-1:size=1:start=0,setpts=N/(30*TB),";
    const shineX = `(1080-${TITLE_SHINE_WIDTH})*mod(t,${TITLE_SHINE_SECONDS})/${TITLE_SHINE_SECONDS}`;
    // Keep the existing Rec.709 limited output contract after composition.
    const background = assertRenderableBackground(plan.visualStyle?.background);
    const rgbFilter = Boolean(plan.visualStyle?.filter?.presetId) || background.mode !== "source-blur";
    const overlayFormat = rgbFilter ? ":format=rgb" : "";
    const outputColor = rgbFilter ? "scale=out_color_matrix=bt709:out_range=tv," : "";
    const animationFilters = titleAnimationFilters({
      id: plan.visualStyle?.titleAnimation,
      titleInput: overlayInput,
      shineInput,
      sceneInput: animatedSceneInput,
      overlayFormat,
      clockRate: 1,
      staticInputFilter,
    });
    const filters = [
      `[0:v]select=concatdec_select,settb=AVTB,setpts=PTS/${PLAYBACK_RATE},fps=30:start_time=0:round=near:eof_action=round,trim=end_frame=${outputFrames}[cutv]`,
      "[1:a]asetpts=N/SR/TB[cuta]",
      `[cutv]${ffmpegFilterExpression(plan.visualStyle?.filter, { contrast: renderContrast, saturation: renderSaturation })}[graded]`,
      ...(background.mode === "source-blur"
        ? [
            `[graded]split=2[bgsrc][mainsrc]`,
            `color=c=black:s=1080x1920:r=30[black]`,
            `[bgsrc]scale=270:480:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=270:480,boxblur=12:2,scale=1080:1920:flags=bilinear,format=rgba,colorchannelmixer=aa=${background.opacity}[bgvideo]`,
            `[black][bgvideo]overlay=shortest=1${overlayFormat}[bg]`,
          ]
        : [
            `[graded]null[mainsrc]`,
            background.mode === "solid"
              ? `color=c=black:s=1080x1920:r=30,format=rgb24[bg]`
              : `[${backgroundInput}:v]${staticInputFilter}format=rgb24[bg]`,
          ]),
      `[mainsrc]${foregroundFilter()}[mainUnlit]`,
      ...(cutTransitionFilters(plan.visualStyle?.cutTransition, segments, transitionWindows, {
        spriteInput: vrInput,
        staticInputFilter,
      }) || ["[mainUnlit]null[main]"]),
      `[bg][main]overlay=0:${FOREGROUND_Y}:shortest=1${overlayFormat}[layout]`,
      ...(animationFilters || [
        `[${overlayInput}:v]${staticInputFilter}format=rgba[titlecard]`,
        `[layout][titlecard]overlay=0:0:shortest=1${overlayFormat}[baseTitles]`,
        ...(needsShineInput
          ? [
              `[${shineInput}:v]${staticInputFilter}format=rgba,crop=${TITLE_SHINE_WIDTH}:1920:x='${shineX}':y=0,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*max(0,1-abs(X-${TITLE_SHINE_WIDTH / 2})/${TITLE_SHINE_WIDTH / 2})'[shine]`,
              `[baseTitles][shine]overlay=x='${shineX}':y=0:shortest=1${overlayFormat}[titled]`,
            ]
          : [`[baseTitles]null[titled]`]),
      ]),
      ...(subtitlesPath
        ? [
            `[${subtitleInput}:v]fps=30,format=rgba[subcard]`,
            `[titled][subcard]overlay=0:0:eof_action=pass:repeatlast=0${overlayFormat}[subtitled]`,
          ]
        : []),
      `[${subtitlesPath ? "subtitled" : "titled"}]${outputColor}format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,trim=end_frame=${outputFrames}[vout]`,
      `[cuta]atempo=${PLAYBACK_RATE}[${musicAsset ? "originalaudio" : "aout"}]`,
    ];

    const buildArgs = async (videoEncoder) => {
      const hardwareRender = videoEncoder === "h264_videotoolbox";
      const args = ["-y", "-copyts"];
      if (hardwareRender && hardwareDecodeCodecs.has(source.videoCodec)) {
        args.push("-hwaccel", "videotoolbox");
      }
      args.push(
        "-an",
        "-sn",
        "-dn",
        "-f",
        "concat",
        "-safe",
        "0",
        "-segment_time_metadata",
        "1",
        "-i",
        rangeInput.list,
      );
      args.push("-f", "f32le", "-ar", "48000", "-ac", "2", "-i", rangeInput.audio);
      args.push("-framerate", "30", "-i", titleInputPath);
      if (needsShineInput) args.push("-framerate", "30", "-i", titleShinePath);
      if (subtitlesPath) args.push("-f", "concat", "-safe", "0", "-i", subtitlesPath);
      if (backgroundAsset) args.push("-framerate", "30", "-i", backgroundAsset);
      if (animatedSceneInput !== undefined) args.push("-framerate", "30", "-i", sceneAsset);
      if (hasTransitions)
        args.push("-framerate", "30", "-i", path.join(projectRoot, "public", TRANSITION_SPRITE.slice(1)));
      const renderFilters = [...filters];
      if (musicAsset) {
        const input = args.filter((a) => a === "-i").length;
        args.push("-stream_loop", "-1", "-i", musicAsset.file);
        renderFilters.push(
          ...musicMixFilters({
            input,
            settings: musicSettings,
            part,
            activity: plan.musicSpeech,
            duration: presentationDuration(part) / PLAYBACK_RATE,
          }),
        );
      }
      await writeFile(filterGraphPath, renderFilters.join(";"), { mode: 0o600 });
      args.push(
        // FFmpeg 9 reads argument files with -/option; keep large graphs off argv.
        "-/filter_complex",
        filterGraphPath,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        // OUTPUT scope, after all -i inputs and before the output filename.
        // Only rendered A/V: no source tags, chapters, subtitles/data/attachments.
        ...EXPORT_METADATA_ARGS,
        "-r",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-color_range",
        "tv",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
      );
      if (hardwareRender) {
        args.push(
          "-c:v",
          "h264_videotoolbox",
          "-profile:v",
          "high",
          "-level:v",
          "4.2",
          "-b:v",
          process.env.FFMPEG_VIDEO_BITRATE || "12M",
          "-maxrate",
          process.env.FFMPEG_VIDEO_MAXRATE || "14M",
          "-bufsize",
          process.env.FFMPEG_VIDEO_BUFSIZE || "24M",
          "-spatial_aq",
          "1",
          "-realtime",
          "0",
          "-allow_sw",
          "0",
        );
      } else {
        args.push(
          "-c:v",
          videoEncoder,
          "-preset",
          process.env.FFMPEG_PRESET || "medium",
          ...(process.env.FFMPEG_CRF
            ? ["-crf", process.env.FFMPEG_CRF]
            : ["-b:v", process.env.FFMPEG_VIDEO_BITRATE || "12M"]),
          "-maxrate",
          process.env.FFMPEG_VIDEO_MAXRATE || "14M",
          "-bufsize",
          process.env.FFMPEG_VIDEO_BUFSIZE || "24M",
          "-x264-params",
          "threads=2:lookahead-threads=1",
        );
      }
      args.push(
        "-threads:v",
        "2",
        "-threads:a",
        "1",
        "-max_muxing_queue_size",
        "128",
        "-tag:v",
        "avc1",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart+write_colr",
        // Both streams are finite. Let independently concatenated source audio
        // finish rather than truncating its tail to the video frame grid.
        "-progress",
        "pipe:1",
        "-nostats",
        outputPath,
      );
      return args;
    };

    const expectedMicroseconds = (presentationDuration(part) / PLAYBACK_RATE) * 1_000_000;
    let progressBuffer = "";
    const renderOptions = {
      signal,
      filterComplexThreads: RENDER_FILTER_COMPLEX_THREADS,
      onStdout(chunk) {
        progressBuffer += chunk;
        const lines = progressBuffer.split(/\r?\n/);
        progressBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("out_time_us=")) continue;
          const current = Number(line.slice("out_time_us=".length));
          if (Number.isFinite(current) && expectedMicroseconds > 0)
            onProgress(Math.min(1, current / expectedMicroseconds));
        }
      },
    };
    let encoderUsed = preferredVideoEncoder;
    onEncoder(encoderUsed, false);
    try {
      await run(ffmpeg, await buildArgs(encoderUsed), renderOptions);
    } catch (error) {
      signal?.throwIfAborted();
      if (encoderUsed !== "h264_videotoolbox") throw error;
      encoderUsed = "libx264";
      onEncoder(encoderUsed, true);
      progressBuffer = "";
      await run(ffmpeg, await buildArgs(encoderUsed), renderOptions);
    }
    onProgress(1);
    return encoderUsed;
  } finally {
    await rangeInput.dispose();
    await rm(filterGraphPath, { force: true });
  }
}

function binaryVersion(binary, args = ["--version"]) {
  if (!binary) return null;
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 5_000, windowsHide: true });
  return result.status === 0 ? result.stdout.trim().split("\n")[0] : null;
}

const versions = {
  ffmpeg: binaryVersion(ffmpeg, ["-version"])?.replace(/^ffmpeg version\s+/, "") || null,
  ffprobe: binaryVersion(ffprobe, ["-version"])?.replace(/^ffprobe version\s+/, "") || null,
  ytDlp: binaryVersion(ytDlp),
};
const {
  analyzeWithChatGPTPlan,
  finalizeImportedTeasers,
  hookSourceFingerprint,
  mainAnalysisInputs,
  planTeasers,
  protectedAnalysisKeys,
  repairBatchTeasers,
  resolveEditingProvider,
  verifySourceTeasers,
} = createAnalysisService(() => ({
  activeChatGPTCredentials,
  batches,
  chatGPTResource,
  dataRoot,
  jobs,
  listChatGPTModels,
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
  mainContent,
  selectHooks: planTeasers,
  verifyPreservedTeasers: verifySourceTeasers,
  describeWebVideo: (source, signal) => webAiVideos.describe(source, signal),
});
const analyzeSource = (source, body, signal) =>
  withAiOperation("generate", () => autoCutWorkflow(source, body, signal));

function cancelBatch(batch) {
  batchControllers.get(batch.id)?.abort();
  for (const item of batch.items) {
    if (item.jobId) cancelRender(jobs.get(item.jobId));
    if (!["done", "error"].includes(item.state)) {
      item.state = "cancelled";
      item.error = null;
    }
  }
}

async function prepareBatch(batch, body, items) {
  return processBatch(batch, body, items, batchControllers.get(batch.id).signal);
}

function batchSnapshot(batch) {
  const items = batch.items
    .filter((item) => !item.deleted)
    .map((item) => {
      const storedJob = item.jobId ? jobs.get(item.jobId) : null;
      const job = storedJob ? renderSnapshot(storedJob) : null;
      return { ...item, state: job?.state || item.state, error: job?.error || item.error, job };
    });
  return {
    id: batch.id,
    items,
    finished: items.every((item) =>
      ["done", "error", "cancelled", "paused", "awaiting-import", "review-required"].includes(item.state),
    ),
  };
}

await mkdir(sourcesRoot, { recursive: true });

const dispatchRoutes = createRouter(
  [
    createSourcesRoutes({
      analyzeSource,
      assertId,
      cancelRender,
      corsHeaders,
      createManualDownload,
      editorSourceLeases,
      effectiveCutPlan,
      fetchYouTubeTranscript,
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
      musicLibrary,
      musicPreview,
      musicSpeech,
      parseCustomTeaser,
      persistBatchHistory,
      planTeasers,
      pruneManualDownloads,
      publicSource,
      readJson,
      renderControllers,
      renderSnapshot,
      sendJson,
      serveAiOperation,
      serveFile,
      serveMediaPath,
      serveSourceMedia,
      smartCutPlan,
      speech,
      validatePlan,
      validateTeaser,
      webAiVideos,
      youtube,
    }),
    createHealthRoutes({
      FOREGROUND_SCALE,
      PLAYBACK_RATE,
      chatGPTStore,
      dataRoot,
      exportBusy,
      ffmpeg,
      ffprobe,
      mediaResources,
      preferredVideoEncoder,
      renderContrast,
      renderSaturation,
      sendJson,
      versions,
    }),
    createAuthRoutes({
      activeChatGPTCredentials,
      analyzeWithChatGPTPlan,
      chatGPTRegistrationPath,
      deleteChatGPTCredentials,
      exchangeChatGPTCode,
      listChatGPTModels,
      pendingChatGPTAuth,
      publicChatGPTSession,
      readChatGPTCredentials,
      readJson,
      rm,
      sendHtml,
      sendJson,
      serveAiOperation,
      startChatGPTAuthorization,
    }),
    createMusicRoutes({
      MUSIC_CATALOG,
      loadSource,
      mediaLibrary,
      musicLibrary,
      musicPreview,
      readJson,
      sendJson,
      validatePlan,
    }),
    createBatchRoutes({
      activeChatGPTCredentials,
      assertId,
      assertTeaserContexts,
      batchPreparationQueue,
      batchSnapshot,
      batches,
      cancelBatch,
      dataRoot,
      effectiveCaptionTrack,
      finalizeImportedTeasers,
      jobs,
      loadSource,
      mediaLibrary,
      persistBatchHistory,
      readJson,
      removeBatchItem,
      renderControllers,
      selectionDigest,
      sendJson,
      snapshotPlanVisualStyle,
      transcriptValue,
      validatePlan,
      validateRenderPlan,
      verifySourceTeasers,
      youtubeUrl,
    }),
    createStorageRoutes({ mediaLibrary, readJson, sendJson, serveMediaPath }),
    createRenderRoutes({ assertId, jobs, readJson, renderSnapshot, sendJson, startRender }),
  ].flat(),
);
const server = createServer(
  createRequestHandler({ host, port, requestOrigins, corsHeaders, dispatchRoutes, sendJson }),
);

for (const name of ["SIGTERM", "SIGINT"]) {
  process.once(name, () => {
    console.log(`Media worker shutdown requested (${name}); stopping owned commands.`);
    void commandLifecycle
      .stop({
        onStart() {
          for (const controller of [...batchControllers.values(), ...renderControllers.values()]) controller.abort();
          pendingChatGPTAuth.cancelAll();
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
