import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ANALYSIS_MODEL, ANALYSIS_REASONING, videoReasoning } from "../lib/ai-reasoning.mjs";
import { effectiveCaptionTrack, selectionCaptionTrack } from "../lib/subtitles.mjs";
import { assertTeaserContexts, selectionDigest, teaserEvidenceValue, transcriptValue } from "../lib/teaser-context.mjs";
import { externalHooksCurrent } from "../lib/teaser-import.mjs";
import { VIDEO_TEXT_INSTRUCTIONS, VIDEO_TEXT_VERSION, canonicalVideoInput } from "../lib/video-ai-input.mjs";
import { AI_INPUT_INSTRUCTIONS, compactAiInput } from "./ai-input.mjs";
import { aiMemo, beginAiRequest, measureAiStage, withAiOperation } from "./ai-operation.mjs";
import { requireDiskSpace } from "./analysis-cache.mjs";
import { validatePlan, validateRenderPlan } from "./plan-validation.mjs";
import { providerError, readProviderOutput, safeProviderId } from "./provider-response.mjs";
import { saveSourceContext, sourceContextFor } from "./source-context.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createAnalysisService(read) {
  async function analyzeWithChatGPTPlan(body, signal, content, reasoningPolicy) {
    const { activeChatGPTCredentials, chatGPTResource } = read();

    signal?.throwIfAborted();
    const credentials = await activeChatGPTCredentials();
    const model = body.model || ANALYSIS_MODEL;
    if (model !== ANALYSIS_MODEL)
      throw new Error(`MODEL_UNAVAILABLE: App đã chốt ${model}; không tự chuyển model khác.`);
    const reasoning = reasoningPolicy || videoReasoning();
    if (reasoning.effort !== ANALYSIS_REASONING)
      throw Object.assign(Error("REASONING_CONFIGURATION: Phân tích video chỉ dùng low."), {
        code: "REASONING_CONFIGURATION",
      });
    const finishRequest = beginAiRequest(model, reasoning, { ...body.requestMetrics, requestedServiceTier: "default" }),
      requestStart = performance.now();
    let providerMs;
    const transport = { endpoint: `${chatGPTResource}/responses`, responseKind: "not-received" };
    try {
      const response = await measureAiStage("provider", () =>
        fetch(`${chatGPTResource}/responses`, {
          signal,
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            model,
            reasoning: { effort: reasoning.effort },
            store: false,
            stream: true,
            // SIWC HTTP contract explicitly forbids max_output_tokens. The generic
            // provider's maxTokens hint must not leak onto this OAuth route.
            instructions:
              body.instructions || "You are a precise short-form video editor. Return only the requested edit plan.",
            input: [{ role: "user", content: content || String(body.input || "") }],
            text: {
              format: {
                type: "json_schema",
                name: "edit_plan",
                strict: true,
                schema: body.schema,
              },
            },
          }),
        }),
      );
      providerMs = Math.round(performance.now() - requestStart);
      transport.httpStatus = response.status;
      transport.requestId =
        safeProviderId(response.headers.get("x-request-id")) || safeProviderId(response.headers.get("request-id"));
      // MIME and structural diagnostics are captured by the single body reader.
      finishRequest(transport);
      const readStart = performance.now();
      transport.readStartedAt = readStart;
      const { outputText, actualReasoning, actualServiceTier, usage, responseModel } = await readProviderOutput(
        response,
        transport,
        signal,
      );
      const { readStartedAt: ignoredReadStart, ...safeTransport } = transport;
      void ignoredReadStart;
      finishRequest({
        ...safeTransport,
        providerMs,
        readMs: Math.round(performance.now() - readStart),
        actualReasoning,
        actualServiceTier,
        ...(responseModel ? { responseModel } : {}),
        ...(usage ? { usage } : {}),
      });
      const cleaned = outputText.trim();
      if (actualReasoning && actualReasoning !== reasoning.effort)
        throw providerError("REASONING_CONFIGURATION", transport);
      try {
        const plan = await measureAiStage("validation", () => JSON.parse(cleaned));
        finishRequest({ status: "completed" });
        return {
          plan,
          model,
          reasoning: { requested: reasoning.effort, actual: actualReasoning, source: reasoning.source },
          serviceTier: { requested: "default", actual: actualServiceTier },
          usage,
        };
      } catch {
        throw providerError("PROVIDER_OUTPUT_JSON_INVALID", transport);
      }
    } catch (error) {
      if (
        !signal?.aborted &&
        (!error.code || !/^(PROVIDER_|MODEL_|REASONING_|FAST_|INVALID_RESPONSE_)/.test(error.code))
      ) {
        transport.networkCode = safeProviderId(error.cause?.code || error.code);
        error = providerError(
          error.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK",
          transport,
          error,
        );
      }
      const { readStartedAt, ...safeTransport } = transport;
      finishRequest({
        ...safeTransport,
        ...(readStartedAt !== undefined ? { readMs: Math.round(performance.now() - readStartedAt) } : {}),
        errorCode: error.code || "PROVIDER_CANCELLED",
        status: signal?.aborted ? "cancelled" : "error",
        providerMs: providerMs ?? Math.round(performance.now() - requestStart),
      });
      throw error;
    }
  }

  const sourceDigests = new Map();

  async function hookSourceFingerprint(source, signal) {
    signal?.throwIfAborted();
    const info = await stat(source.mediaPath),
      key = `${source.id}:${info.size}:${info.mtimeMs}`;
    if (sourceDigests.has(key)) return sourceDigests.get(key);
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(source.mediaPath)) {
      signal?.throwIfAborted();
      digest.update(chunk);
    }
    const value = digest.digest("hex");
    if (sourceDigests.size >= 32) sourceDigests.delete(sourceDigests.keys().next().value);
    sourceDigests.set(key, value);
    return value;
  }

  async function resolveEditingProvider(signal, task = "main") {
    const { listChatGPTModels } = read();

    return aiMemo("editing-provider:" + task, async () => {
      signal?.throwIfAborted();
      const model = ANALYSIS_MODEL;
      let reasoning;
      if (task === "teaser") {
        const models = await listChatGPTModels(null, signal),
          entry = models.find((item) => item.slug === model);
        if (!entry)
          throw Object.assign(Error("MODEL_UNAVAILABLE: Catalog tài khoản không có gpt-6.1-sol; không tự đổi model."), {
            code: "MODEL_UNAVAILABLE",
          });
        if (entry.supported_reasoning_efforts && !entry.supported_reasoning_efforts.includes("low"))
          throw Object.assign(Error("REASONING_CONFIGURATION: Catalog không cho phép low cho gpt-6.1-sol."), {
            code: "REASONING_CONFIGURATION",
          });
        reasoning = {
          effort: "low",
          source: entry.supported_reasoning_efforts ? "model-metadata" : "owner-pin-low-catalog-model-confirmed",
          key: videoReasoning().key,
        };
      } else reasoning = videoReasoning();
      // Explicit owner pin: no model-list ordering or extra discovery request.
      // Existing credential checks and provider capability errors occur on the
      // real request. Unsupported/unavailable never falls back to another model.
      return {
        id: "chatgpt",
        model,
        reasoningPolicyKey: reasoning.key,
        reasoning: reasoning.effort,
        analyze: async ({ input, images = [], schema, instructions, signal, maxTokens }) => {
          if (images.length)
            throw Object.assign(Error("VIDEO_TEXT_ONLY: đường phân tích không nhận ảnh."), { code: "VIDEO_TEXT_ONLY" });
          const canonical = canonicalVideoInput(input),
            packed = compactAiInput(canonical.value),
            serializedInput = packed.text;
          const content = [{ type: "input_text", text: serializedInput }];
          const requestMetrics = {
            phase: input.phase || "select-main",
            inputCharacters: serializedInput.length,
            rawInputCharacters: JSON.stringify(input).length,
            inputFormat: packed.format,
            imageCount: 0,
            dataCounts: canonical.counts,
            dataAvailability: canonical.availability,
            textContract: VIDEO_TEXT_VERSION,
            partCount: Array.isArray(input.parts) ? input.parts.length : input.partId ? 1 : 0,
            ...(input.partId ? { partId: input.partId } : {}),
            inputIntegrity: packed.encoded || canonical.encoded ? "roundtrip-verified" : "original-json",
          };
          const result = await analyzeWithChatGPTPlan(
            {
              model,
              schema,
              instructions:
                VIDEO_TEXT_INSTRUCTIONS +
                "\n" +
                (packed.encoded ? AI_INPUT_INSTRUCTIONS + "\n" : "") +
                (instructions || "You are a precise source-accurate video editor."),
              maxTokens,
              requestMetrics,
            },
            signal,
            content,
            reasoning,
          );
          return { value: result.plan };
        },
      };
    });
  }

  function protectedAnalysisKeys() {
    const { batches, jobs } = read();

    const keys = new Set();
    for (const job of jobs.values()) if (job.plan?.musicSpeech?.cacheKey) keys.add(job.plan.musicSpeech.cacheKey);
    for (const batch of batches.values())
      for (const item of batch.items)
        if (!item.deleted && item.plan?.musicSpeech?.cacheKey) keys.add(item.plan.musicSpeech.cacheKey);
    for (const plan of [...jobs.values()]
      .map((j) => j.plan)
      .concat([...batches.values()].flatMap((b) => b.items.filter((i) => !i.deleted).map((i) => i.plan)))) {
      if (plan?.analysis?.cacheKey) keys.add(plan.analysis.cacheKey);
      if (plan?.analysis?.localCacheKey) keys.add(plan.analysis.localCacheKey);
    }
    return keys;
  }

  async function mainAnalysisInputs(source, body, signal) {
    const { dataRoot, localSignals, sourceContexts, speech } = read();

    if (
      (body.transcript !== undefined && typeof body.transcript !== "string") ||
      String(body.transcript ?? source.transcript ?? "").length > 1_000_000
    )
      throw Error("Transcript vượt giới hạn 1 triệu ký tự hoặc sai định dạng; chưa gọi AI, không tự bỏ phần cuối.");
    if (body.currentPlan) {
      if (body.currentPlan.analysis?.sourceId && body.currentPlan.analysis.sourceId !== source.id)
        throw new Error("Plan belongs to another source.");
      validatePlan(body.currentPlan, source, { teasers: false });
    }
    // Independent context network I/O and one bounded local media analysis can
    // overlap. This does not parallelize AI calls or open another heavy lease.
    const preparation = new AbortController(),
      preparing = AbortSignal.any([...(signal ? [signal] : []), preparation.signal]);
    let context, local;
    try {
      [context, local] = await Promise.all([
        measureAiStage("preparation", () => sourceContexts.ensure(source, { signal: preparing, comments: true }), {
          reason: "source-context",
        }),
        measureAiStage("preparation", () => localSignals.forSource(source, preparing), { reason: "local-signals" }),
      ]);
    } finally {
      preparation.abort();
    }
    context.visualSignals = {
      ...local.visual,
      version: local.version,
      timeUnit: local.timeUnit,
      sourceKey: local.sourceKey,
      sampledRanges: local.sampledRanges,
      cacheKey: local.cacheKey,
    };
    context.audioSignals = {
      ...local.audio,
      version: local.version,
      timeUnit: local.timeUnit,
      sourceKey: local.sourceKey,
      sampledRanges: local.sampledRanges,
      cacheKey: local.cacheKey,
    };
    try {
      await saveSourceContext(source.directory, context);
    } catch {
      signal?.throwIfAborted();
    }
    let cues = source.captions || [];
    if (!cues.length) {
      try {
        cues = (await speech.cachedCaptions(source))?.cues || [];
      } catch {
        /* Missing cached speech is normal. */
      }
    }
    if (!cues.length && !body.transcript?.trim() && source.hasAudio && source.duration <= 1800) {
      try {
        const status = await speech.status();
        if (status.binaryReady && status.modelReady) {
          await requireDiskSpace(dataRoot, 256 * 1024 * 1024 + Math.ceil(source.duration * 32000));
          cues = (
            await measureAiStage(
              "preparation",
              () => speech.captions(source, AbortSignal.any([signal, AbortSignal.timeout(60000)])),
              { reason: "source-captions" },
            )
          ).cues;
        }
      } catch {
        signal?.throwIfAborted(); /* Use available local/metadata evidence; no model is downloaded. */
      }
    }
    const track = selectionCaptionTrack(
      { captionCues: body.captionCues || body.currentPlan?.captionCues },
      source,
      body.transcript || source.transcript,
      cues.length ? { sourceId: source.id, cues, origin: "cached-caption" } : undefined,
    );
    return {
      context,
      options: {
        cues: track.cues,
        boundaryCues: track.cues,
        captionTrack: track,
        local,
        currentPlan: body.currentPlan,
        transcript: String(body.transcript ?? source.transcript ?? ""),
        instruction: String(body.instruction || ""),
        supplementalPrompt: String(body.supplementalPrompt || ""),
        signal,
      },
    };
  }

  async function planTeasers(plan, source, signal, transcript, selectionOptions = {}) {
    const { selectTeasers, sourceContexts, speech } = read();

    if (String(transcript ?? source.transcript ?? "").length > 1_000_000)
      throw Error("Transcript vượt giới hạn 1 triệu ký tự; chưa gọi AI, không tự bỏ phần cuối.");
    const sourceContext = await sourceContexts.ensure(source, { signal, comments: true });
    // The shared YouTube metadata cache does not own source-local scene/audio
    // analysis. Preserve those current source-bound signals through enrichment.
    for (const key of ["visualSignals", "audioSignals"])
      if (source.sourceContext?.[key]) sourceContext[key] = structuredClone(source.sourceContext[key]);
    if (source.directory) {
      try {
        await saveSourceContext(source.directory, sourceContext);
      } catch {
        signal?.throwIfAborted(); /* Context persistence failure must not disable hook analysis. */
      }
    }
    source = { ...source, sourceContext };
    let cached;
    if (!plan.captionCues && !source.captions?.length)
      try {
        cached = await speech.cachedCaptions(source);
      } catch {
        /* Optional local cache only. */
      }
    const sourceInput = { ...source, transcript: transcriptValue(transcript ?? source.transcript) };
    const track = selectionCaptionTrack(plan, sourceInput, sourceInput.transcript, cached);
    const cues = track.cues;
    sourceInput.captionProvenance = {
      origin: track.origin,
      timing: track.timing || "cue",
      language: track.language || "unknown",
      trackId: track.trackId || null,
      warning: track.warning || null,
    };
    sourceInput.selectionRequest = {
      instruction: String(selectionOptions.instruction || ""),
      supplementalPrompt: String(selectionOptions.supplementalPrompt || ""),
    };
    plan = { ...plan, captionCues: track };

    const context = source.sourceContext;
    return selectTeasers(plan, sourceInput, {
      ...selectionOptions,
      cues,
      boundaryCues: cues,
      supporting: context
        ? {
            ...context.metadata,
            chapters: context.chapters,
            commentClusters: context.comments?.clusters,
            heatmap: context.heatmap,
            visualSignals: context.visualSignals,
            audioSignals: context.audioSignals,
          }
        : source,
      signal,
    });
  }

  async function repairBatchTeasers(plan, source, signal, transcript, request = {}) {
    return withAiOperation("batch-teaser-repair", () =>
      repairBatchTeasersInner(plan, source, signal, transcript, request),
    );
  }

  async function repairBatchTeasersInner(plan, source, signal, transcript, request = {}) {
    validatePlan(plan, source, { teasers: false });
    let next = structuredClone(plan);
    next.teaserTranscriptKey = await selectionDigest(transcriptValue(transcript));
    for (const part of next.parts) {
      if (part.teaserEnabled === false) continue;
      const isolated = {
        ...next,
        parts: next.parts.map((p) =>
          p.id === part.id ? p : { ...p, teaserEnabled: false, teaser: undefined, customTeaser: undefined },
        ),
      };
      try {
        validateRenderPlan(isolated, source);
        await verifySourceTeasers(isolated, source, signal);
        continue;
      } catch {
        /* Repair this part only, never rerun the main planner. */
      }
      if (part.teaser?.selection === "manual" || part.customTeaser?.mode === "timestamp")
        throw Object.assign(
          Error(`Part ${part.id}: mốc manual cần sửa trong Timeline; batch không tự đổi quyết định người dùng.`),
          { code: "TEASER_REQUIRED", status: 409 },
        );
      next = await planTeasers(next, source, signal, transcript, {
        targetPartId: part.id,
        instruction: request.instruction,
        supplementalPrompt: request.supplementalPrompt,
        customInstruction: part.customTeaser?.mode === "description" ? part.customTeaser.input : undefined,
        forceRefresh: true,
      });
    }
    validateRenderPlan(next, source);
    await verifySourceTeasers(next, source, signal);
    return next;
  }

  async function verifySourceTeasers(plan, source, signal) {
    const selected = plan.parts.filter(
      (p) =>
        p.teaserEnabled !== false &&
        p.teaser?.status === "selected" &&
        ["ai", "external-import"].includes(p.teaser.selection),
    );
    if (!selected.length) return;
    const digest = await hookSourceFingerprint(source, signal);
    const stored = JSON.parse(await readFile(path.join(source.directory, "source.json"), "utf8"));
    const evidenceKey = await selectionDigest(
      teaserEvidenceValue({ ...source, sourceContext: sourceContextFor({ ...source, ...stored }) }),
    );
    if (
      selected.some(
        (p) => p.teaser.binding?.sourceFingerprint !== digest || p.teaser.binding?.evidenceKey !== evidenceKey,
      )
    )
      throw Object.assign(
        Error("Source đã đổi hoặc teaser cũ chưa có bằng chứng source; chọn lại teaser trước khi xuất."),
        { code: "TEASER_REQUIRED", status: 409 },
      );
  }

  async function finalizeImportedTeasers(plan, source, transcript, signal, request) {
    validatePlan(plan, source);
    const cues = effectiveCaptionTrack(plan, source)?.cues || [];
    if (!(await externalHooksCurrent(plan, source, transcript)))
      throw Error("Hook web import đã cũ; tạo prompt/import lại, không tự chuyển provider.");
    await assertTeaserContexts(plan, source, cues, transcript, request);
    const next = structuredClone(plan),
      digest = await hookSourceFingerprint(source, signal);
    for (const p of next.parts)
      if (p.teaserEnabled !== false && p.teaser?.status === "selected" && p.teaser.selection === "external-import") {
        p.teaser.binding.sourceFingerprint = digest;
        p.teaser.binding.evidenceKey = await selectionDigest(teaserEvidenceValue(source));
      }
    next.teaserTranscriptKey = await selectionDigest(transcriptValue(transcript));
    return next;
  }
  return {
    analyzeWithChatGPTPlan,
    finalizeImportedTeasers,
    hookSourceFingerprint,
    mainAnalysisInputs,
    planTeasers,
    protectedAnalysisKeys,
    repairBatchTeasers,
    resolveEditingProvider,
    verifySourceTeasers,
  };
}
