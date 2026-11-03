// Extracted route bodies retain their original order and response contracts.
export function createBatchRoutes({
  ensureCodexReady,
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
}) {
  return [
    {
      order: 27,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/batches"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/batches") {
          sendJson(request, response, 200, {
            batches: [...batches.values()]
              .reverse()
              .map(batchSnapshot)
              .filter((batch) => batch.items.length),
          });
          return;
        }
        return false;
      },
    },
    {
      order: 33,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/batches"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/batches") {
          const body = await readJson(request);
          if (body.provider && !["chatgpt", "gemini", "muse", "chatgpt-web"].includes(body.provider)) {
            sendJson(request, response, 400, {
              error: "Hàng loạt tự động chỉ dùng ChatGPT Auto. Các provider web thủ công cần copy/dán JSON từng video.",
            });
            return;
          }
          if (!Array.isArray(body.urls) || body.urls.length < 1 || body.urls.length > 20) {
            sendJson(request, response, 400, { error: "Nhập từ 1 đến 20 link YouTube cùng cấu hình chia part." });
            return;
          }
          const urls = [...new Set(body.urls.map((value) => String(value).trim()))];
          for (const value of urls) {
            youtubeUrl(value);
            const url = new URL(value);
            if (
              !["https:", "http:"].includes(url.protocol) ||
              !/^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(url.hostname)
            ) {
              sendJson(request, response, 400, { error: `Không phải link YouTube: ${value}` });
              return;
            }
          }
          if (body.batchId !== undefined) body.batchId = assertId(body.batchId);
          if (!body.provider || body.provider === "chatgpt") await ensureCodexReady();
          let batch;
          try {
            batch = batchPreparationQueue.submit({
              ...body,
              urls,
              provider: body.provider || "chatgpt",
              resumeVersion: 1,
            });
          } catch (error) {
            if (!error.status) throw error;
            sendJson(request, response, error.status, { error: error.message });
            return;
          }
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 202, { batch: batchSnapshot(batch) });
          return;
        }
        return false;
      },
    },
    {
      order: 34,
      condition: "request.method==='POST'&&resumeBatchMatch",
      matchers:
        "const resumeBatchMatch=requestUrl.pathname.match(/^\\/api\\/batches\\/([a-f0-9-]{16,64})\\/resume$/i);",
      async handle(request, response, requestUrl) {
        const resumeBatchMatch = requestUrl.pathname.match(/^\/api\/batches\/([a-f0-9-]{16,64})\/resume$/i);
        if (request.method === "POST" && resumeBatchMatch) {
          const body = await readJson(request),
            id = assertId(resumeBatchMatch[1]),
            batch = batches.get(id);
          if (!batch) throw new Error("Queue not found");
          const targets = batch.items.filter((i) => !i.deleted && (!body.itemIds || body.itemIds.includes(i.id)));
          if (targets.some((i) => i.jobId && renderControllers.has(i.jobId)))
            throw new Error("Wait for stopping renders before resume.");
          for (const item of targets) {
            const saved = item.jobId ? jobs.get(item.jobId) : null;
            if (saved?.state === "done") continue;
            const plan = saved?.plan || item.plan;
            if (plan) {
              const source = await loadSource(saved?.sourceId || item.sourceId);
              if (!saved && (item.needsAnalysis || item.needsTeasers)) validatePlan(plan, source, { teasers: false });
              else {
                validateRenderPlan(plan, source);
                await verifySourceTeasers(plan, source);
              }
            }
          }
          if (targets.some((i) => (i.needsAnalysis || i.needsTeasers) && i.settings?.provider === "chatgpt"))
            await ensureCodexReady();
          const resumed = batchPreparationQueue.resume(id, body.itemIds);
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 202, { batch: batchSnapshot(resumed) });
          return;
        }
        return false;
      },
    },
    {
      order: 35,
      condition: "request.method==='POST'&&batchPlanMatch",
      matchers:
        "const batchPlanMatch=requestUrl.pathname.match(/^\\/api\\/batches\\/([a-f0-9-]{16,64})\\/items\\/([a-f0-9-]{16,64})\\/plan$/i);",
      async handle(request, response, requestUrl) {
        const batchPlanMatch = requestUrl.pathname.match(
          /^\/api\/batches\/([a-f0-9-]{16,64})\/items\/([a-f0-9-]{16,64})\/plan$/i,
        );
        if (request.method === "POST" && batchPlanMatch) {
          const body = await readJson(request),
            batch = batches.get(assertId(batchPlanMatch[1])),
            item = batch?.items.find((i) => i.id === assertId(batchPlanMatch[2]) && !i.deleted);
          if (
            body.transcript !== undefined &&
            (typeof body.transcript !== "string" || body.transcript.length > 1_000_000)
          )
            throw Error("Transcript vượt giới hạn 1 triệu ký tự hoặc sai định dạng; không tự bỏ phần cuối.");
          if (!item || !item.sourceId) throw new Error("Prepared item not found");
          if (
            item.jobId ||
            !["awaiting-import", "review-required", "paused", "error", "cancelled"].includes(item.state)
          )
            throw new Error("Render/preparation snapshot is immutable while submitted; finish/stop it first.");
          if (body.sourceId !== item.sourceId) throw new Error("Plan belongs to another source");
          const source = await loadSource(item.sourceId);
          if (body.plan.parts?.some((p) => p.teaserEnabled !== false && p.teaser?.selection === "external-import"))
            body.plan = await finalizeImportedTeasers(body.plan, source, String(body.transcript || ""), undefined, {
              instruction: body.instruction,
              supplementalPrompt: body.supplementalPrompt,
            });
          if (body.transcript !== undefined) {
            body.plan.teaserTranscriptKey = await selectionDigest(transcriptValue(body.transcript));
            await assertTeaserContexts(
              body.plan,
              source,
              effectiveCaptionTrack(body.plan, source)?.cues || [],
              body.transcript,
              { instruction: body.instruction, supplementalPrompt: body.supplementalPrompt },
            );
          }
          validateRenderPlan(body.plan, source);
          await verifySourceTeasers(body.plan, source);

          item.plan = snapshotPlanVisualStyle(body.plan);
          item.settings = {
            ...item.settings,
            ...(["gemini", "muse", "chatgpt-web", "chatgpt"].includes(item.plan.providerUsed)
              ? { provider: item.plan.providerUsed }
              : {}),
            instruction: String(body.instruction || ""),
            supplementalPrompt: String(body.supplementalPrompt || ""),
            visualStyle: item.plan.visualStyle,
            subtitles: item.plan.subtitles,
          };
          item.transcript = String(body.transcript || source.transcript || "");
          item.approved = true;
          item.needsAnalysis = false;
          item.needsTeasers = false;
          item.state = "render-ready";
          item.checkpoint = "plan";
          item.error = null;
          await persistBatchHistory({ strict: true });
          const resumed = batchPreparationQueue.resume(batch.id, [item.id]);
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 202, { batch: batchSnapshot(resumed) });
          return;
        }
        return false;
      },
    },
    {
      order: 36,
      condition: 'request.method === "DELETE" && deleteBatchItemMatch',
      matchers:
        "const deleteBatchItemMatch = requestUrl.pathname.match(/^\\/api\\/batches\\/([a-f0-9-]{16,64})\\/items\\/([a-f0-9-]{16,64})$/i);",
      async handle(request, response, requestUrl) {
        const deleteBatchItemMatch = requestUrl.pathname.match(
          /^\/api\/batches\/([a-f0-9-]{16,64})\/items\/([a-f0-9-]{16,64})$/i,
        );
        if (request.method === "DELETE" && deleteBatchItemMatch) {
          const batch = batches.get(assertId(deleteBatchItemMatch[1]));
          if (!batch) {
            sendJson(request, response, 404, { error: "Hàng đợi không tồn tại." });
            return;
          }
          try {
            const item = batch.items.find((item) => item.id === deleteBatchItemMatch[2]);
            if (mediaLibrary.isLocked(item?.sourceId || jobs.get(item?.jobId)?.sourceId))
              throw Object.assign(new Error("Video đang được xử lý trong Thùng rác. Thử lại sau."), { status: 409 });
            const result = await removeBatchItem({
              batch,
              itemId: assertId(deleteBatchItemMatch[2]),
              jobs,
              renderControllers,
              dataRoot,
            });
            await persistBatchHistory({ strict: true });
            sendJson(request, response, 200, { batch: batchSnapshot(batch), ...result });
          } catch (error) {
            sendJson(request, response, error.status || 500, { error: error.message });
          }
          return;
        }
        return false;
      },
    },
    {
      order: 37,
      condition: 'request.method === "POST" && cancelBatchMatch',
      matchers:
        "const cancelBatchMatch = requestUrl.pathname.match(/^\\/api\\/batches\\/([a-f0-9-]{16,64})\\/cancel$/i);",
      async handle(request, response, requestUrl) {
        const cancelBatchMatch = requestUrl.pathname.match(/^\/api\/batches\/([a-f0-9-]{16,64})\/cancel$/i);
        if (request.method === "POST" && cancelBatchMatch) {
          const batch = batches.get(assertId(cancelBatchMatch[1]));
          if (!batch) {
            sendJson(request, response, 404, { error: "Hàng đợi không tồn tại." });
            return;
          }
          cancelBatch(batch);
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 200, { batch: batchSnapshot(batch) });
          return;
        }
        return false;
      },
    },
    {
      order: 39,
      condition: 'request.method === "GET" && requestUrl.pathname.startsWith("/api/batches/")',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname.startsWith("/api/batches/")) {
          const batch = batches.get(assertId(requestUrl.pathname.slice("/api/batches/".length)));
          sendJson(
            request,
            response,
            batch ? 200 : 404,
            batch ? { batch: batchSnapshot(batch) } : { error: "Hàng đợi không còn tồn tại (worker đã restart)." },
          );
          return;
        }
        return false;
      },
    },
  ];
}
