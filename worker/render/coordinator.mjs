import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { originalCutPlan } from "../../lib/legacy-plan.mjs";
import { effectiveMusic, normalizeMusic } from "../../lib/music/settings.mjs";
import { PLAYBACK_RATE } from "../../lib/render-config.mjs";
import { effectiveCaptionTrack, sourceCaptionTrack } from "../../lib/subtitles.mjs";
import { assertTeaserContexts, selectionDigest, transcriptValue } from "../../lib/teaser-context.mjs";
import { presentationDuration } from "../../lib/teaser-hooks.mjs";
import { assertRenderableBackground, gradientRowRgb } from "../../lib/visual-style/backgrounds.mjs";
import { detectScript } from "../../lib/visual-style/fonts.mjs";
import { snapshotPlanVisualStyle } from "../../lib/visual-style/normalize.mjs";
import { EXPORT_METADATA_POLICY, requireCurrentExportPolicy } from "../export-metadata.mjs";
import { RENDER_RESOURCE_PROFILE } from "../media-resources.mjs";
import { effectiveCutPlan } from "../part-start.mjs";
import { validateRenderPlan } from "../plan-validation.mjs";
import { publishRender, recoverPublication, renderScratch } from "../render-publication.mjs";
import { verifiedRenderOutput } from "../render-resume.mjs";
import { renderSceneOverlay } from "../scene-overlays.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createRenderCoordinator(read) {
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
    const { exportNameAllocator } = read();

    return exportNameAllocator.reserve(exportPrefixFor(plan, source), plan.parts.length);
  }

  async function executeRender(job, source, plan, signal) {
    const { persistBatchHistory, probeMedia, projectRoot, renderPart, verifySourceTeasers } = read();

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
        if (!checked)
          throw Error("MP4 chưa đạt geometry/duration/audio contract; chưa publish, có thể Resume part này.");
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
    const { assertId, jobs, pendingRenderSubmissions } = read();

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
    const {
      assertId,
      jobs,
      loadSource,
      mediaLibrary,
      musicLibrary,
      persistBatchHistory,
      preferredVideoEncoder,
      verifySourceTeasers,
    } = read();

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
      await assertTeaserContexts(
        originalPlan,
        source,
        captions?.cues || [],
        body.transcript || source.transcript || "",
        {
          instruction: body.instruction,
          supplementalPrompt: body.supplementalPrompt,
        },
      );
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
    const {
      mediaResources,
      musicSpeech,
      persistBatchHistory,
      renderControllers,
      renderParentCleanup,
      startedRenderControllers,
    } = read();

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
    renderQueue = task.catch((error) =>
      console.error(`Render final history write failed: ${error.code || "IO_ERROR"}`),
    );
  }

  async function resumeRender(job, parentSignal) {
    const { loadSource, mediaLibrary, persistBatchHistory, renderControllers, verifySourceTeasers } = read();

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
    const { persistBatchHistory, renderControllers, renderParentCleanup, startedRenderControllers } = read();

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
    const { renderControllers } = read();

    return { ...job, stopping: job.state === "cancelled" && renderControllers.has(job.id) };
  }
  return { cancelRender, renderSnapshot, resumeRender, startRender };
}
