// Extracted route bodies retain their original order and response contracts.
export function createSourcesRoutes({
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
}) {
  return [
    {
      order: 0,
      condition: "request.method==='POST'&&requestUrl.pathname==='/api/editor/source-lease'",
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/editor/source-lease") {
          const body = await readJson(request, 4096);
          sendJson(
            request,
            response,
            200,
            editorSourceLeases.retain(body, (id) => mediaLibrary.isLocked(id)),
          );
          return;
        }
        return false;
      },
    },
    {
      order: 10,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/youtube/metadata"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/youtube/metadata") {
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Metadata client disconnected"));
          response.once("close", abort);
          try {
            sendJson(
              request,
              response,
              200,
              await youtube.metadata(requestUrl.searchParams.get("url") || "", controller.signal),
            );
          } finally {
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
    {
      order: 11,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/sources/youtube"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/sources/youtube") {
          const body = await readJson(request);
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Source import cancelled"));
          response.once("close", abort);
          let unsubscribe;
          const streamed = body.progress === true;
          const write = (value) => {
            if (response.destroyed || response.writableEnded) return;
            // Progress is optional and bounded; a slow UI must not buffer endlessly.
            if (value.type === "progress" && response.writableLength > 16384) return;
            response.write(JSON.stringify(value) + "\n");
          };
          try {
            if (streamed) {
              unsubscribe = youtube.subscribeProgress(String(body.url || "").trim(), (progress) =>
                write({ type: "progress", ...progress }),
              );
              response.writeHead(200, {
                ...corsHeaders(request),
                "Content-Type": "application/x-ndjson; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Accel-Buffering": "no",
              });
              write({ type: "progress", phase: "metadata", percent: null });
            }
            const source = await importYouTube(String(body.url || "").trim(), controller.signal);
            if (streamed) {
              write({ type: "result", source: publicSource(source) });
              response.end();
            } else sendJson(request, response, 201, { source: publicSource(source) });
          } catch (error) {
            if (!streamed || !response.headersSent) throw error;
            if (!controller.signal.aborted)
              write({ type: "error", error: error instanceof Error ? error.message : "Không chuẩn bị được nguồn." });
            response.end();
          } finally {
            unsubscribe?.();
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
    {
      order: 13,
      condition: "['GET','HEAD'].includes(request.method)&&musicPreviewFile",
      matchers:
        "const musicPreviewFile=requestUrl.pathname.match(/^\\/api\\/music\\/preview\\/([a-f0-9]{64})\\/media$/);",
      async handle(request, response, requestUrl) {
        const musicPreviewFile = requestUrl.pathname.match(/^\/api\/music\/preview\/([a-f0-9]{64})\/media$/);
        if (["GET", "HEAD"].includes(request.method) && musicPreviewFile) {
          await serveMediaPath(request, response, await musicPreview.resolve(musicPreviewFile[1]), { download: false });
          return;
        }
        return false;
      },
    },
    {
      order: 16,
      condition: "['GET','HEAD'].includes(request.method)&&musicFile",
      matchers: "const musicFile=requestUrl.pathname.match(/^\\/api\\/music\\/([a-f0-9]{64})\\/media$/);",
      async handle(request, response, requestUrl) {
        const musicFile = requestUrl.pathname.match(/^\/api\/music\/([a-f0-9]{64})\/media$/);
        if (["GET", "HEAD"].includes(request.method) && musicFile) {
          const asset = await musicLibrary.resolve(musicFile[1]);
          await serveMediaPath(request, response, asset.file, { download: false });
          return;
        }
        return false;
      },
    },
    {
      order: 17,
      condition: "request.method==='POST'&&musicDetect",
      matchers: "const musicDetect=requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]+)\\/music-speech$/i);",
      async handle(request, response, requestUrl) {
        const musicDetect = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]+)\/music-speech$/i);
        if (request.method === "POST" && musicDetect) {
          await readJson(request);
          const source = await loadSource(musicDetect[1]);
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Speech detection cancelled"));
          response.once("close", abort);
          try {
            sendJson(request, response, 200, await musicSpeech.detect(source, controller.signal));
          } finally {
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
    {
      order: 18,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/speech/status"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/speech/status") {
          sendJson(request, response, 200, await speech.status());
          return;
        }
        return false;
      },
    },
    {
      order: 19,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/speech/model"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/speech/model") {
          await readJson(request);
          await speech.installModel();
          sendJson(request, response, 200, await speech.status());
          return;
        }
        return false;
      },
    },
    {
      order: 20,
      condition: "request.method==='GET'&&sourceMetadataMatch",
      matchers: "const sourceMetadataMatch=requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]{16,64})$/i);",
      async handle(request, response, requestUrl) {
        const sourceMetadataMatch = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]{16,64})$/i);
        if (request.method === "GET" && sourceMetadataMatch) {
          sendJson(request, response, 200, { source: publicSource(await loadSource(sourceMetadataMatch[1])) });
          return;
        }
        return false;
      },
    },
    {
      order: 21,
      condition: "['GET','DELETE'].includes(request.method)&&manualStatus",
      matchers:
        "const manualStatus=requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]{16,64})\\/manual-video-status\\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);",
      async handle(request, response, requestUrl) {
        const manualStatus = requestUrl.pathname.match(
          /^\/api\/sources\/([a-f0-9-]{16,64})\/manual-video-status\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
        );
        if (["GET", "DELETE"].includes(request.method) && manualStatus) {
          const [, sourceId, downloadId] = manualStatus,
            key = manualDownloadKey(sourceId, downloadId);
          pruneManualDownloads();
          let item = manualVideoDownloads.get(key);
          if (request.method === "DELETE") {
            // A fast Cancel can arrive before the iframe's GET. A bounded terminal
            // tombstone prevents that later request from starting preparation.
            if (!item)
              item = createManualDownload(sourceId, downloadId, {
                phase: "cancelled",
                state: "cancelled",
                percent: null,
              });
            else if (item.progress.state === "running") item.cancel?.();
            else if (item.progress.interrupted) {
              item.updatedAt = Date.now();
              item.progress = { phase: "cancelled", state: "cancelled", percent: null, updatedAt: item.updatedAt };
            }
            sendJson(request, response, 200, { progress: item.progress });
            return;
          }
          if (!item) {
            sendJson(request, response, 404, { error: "Lượt tải chưa bắt đầu hoặc worker đã khởi động lại." });
            return;
          }
          sendJson(request, response, 200, { progress: item.progress });
          return;
        }
        return false;
      },
    },
    {
      order: 22,
      condition: "['GET','HEAD'].includes(request.method)&&manualMedia",
      matchers:
        "const manualMedia=requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]{16,64})\\/manual-video$/i);",
      async handle(request, response, requestUrl) {
        const manualMedia = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]{16,64})\/manual-video$/i);
        if (["GET", "HEAD"].includes(request.method) && manualMedia) {
          const rendition = requestUrl.searchParams.get("rendition") || "original";
          if (!["original", "480p"].includes(rendition))
            throw Object.assign(Error("Lựa chọn tải video không hợp lệ."), { status: 400 });
          const downloadId = requestUrl.searchParams.get("downloadId");
          if (
            downloadId !== null &&
            (request.method !== "GET" ||
              !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(downloadId))
          )
            throw Object.assign(Error("Định danh lượt tải video không hợp lệ."), { status: 400 });
          let tracked;
          if (downloadId !== null) {
            const key = manualDownloadKey(manualMedia[1], downloadId);
            pruneManualDownloads();
            if (manualVideoDownloads.has(key))
              throw Object.assign(Error("Lượt tải này đã được tạo hoặc dừng; bấm Tải video để bắt đầu lượt mới."), {
                status: 409,
              });
            tracked = createManualDownload(manualMedia[1], downloadId, {
              phase: "identity",
              state: "running",
              percent: null,
            });
          }
          const controller = new AbortController();
          let transferring = false,
            unsubscribe;
          const cancel = () => {
            manualDownloadProgress(tracked, { phase: "cancelled", state: "cancelled", percent: null });
            controller.abort(new DOMException("Đã dừng truyền video web.", "AbortError"));
            if (!response.destroyed && !response.writableFinished) response.destroy();
          };
          if (tracked) tracked.cancel = cancel;
          const abort = () => {
            if (!response.writableFinished) {
              // A browser/network disconnect is observable; its user's intent is not.
              // Explicit DELETE already records cancelled and cannot be overwritten.
              manualDownloadProgress(tracked, {
                phase: "error",
                state: "error",
                percent: null,
                interrupted: true,
                error: "Kết nối tải video đã ngắt. Bấm Tải video để thử lại.",
              });
              controller.abort(new DOMException("Kết nối tải video đã ngắt.", "AbortError"));
            }
          };
          response.once("close", abort);
          try {
            const expectedVariant = requestUrl.searchParams.get("variant");
            if (expectedVariant !== null && !/^[a-f0-9]{64}$/.test(expectedVariant))
              throw Object.assign(Error("Định danh bản video gửi web không hợp lệ."), { status: 400 });
            const expectedSource = requestUrl.searchParams.get("source");
            if (expectedSource !== null && !/^[a-f0-9]{64}$/.test(expectedSource))
              throw Object.assign(Error("Định danh nguồn video gửi web không hợp lệ."), { status: 400 });
            const source = await loadSource(manualMedia[1], controller.signal);
            if (tracked && rendition === "480p")
              unsubscribe = webAiVideos.subscribeProgress(source.id, (event) => {
                if (
                  transferring ||
                  tracked.progress.state !== "running" ||
                  ["error", "cancelled"].includes(event.phase)
                )
                  return;
                const progress = {
                  phase: event.phase === "ready" ? "validating" : event.phase,
                  state: "running",
                  percent: event.phase === "ready" ? null : event.percent,
                };
                for (const key of ["completedSeconds", "totalSeconds", "attempt", "maxAttempts"])
                  if (Number.isFinite(event[key]) && event[key] >= 0) progress[key] = event[key];
                if (typeof event.cacheHit === "boolean") progress.cacheHit = event.cacheHit;
                manualDownloadProgress(tracked, progress);
              });
            const assertDownloadSource = async () => {
              if (
                expectedSource !== null &&
                (await webAiVideos.describe(source, controller.signal)).sourceKey !== expectedSource
              )
                throw Object.assign(Error("Nguồn đã đổi từ lúc tạo TXT; chưa tải video của lượt cũ."), {
                  status: 409,
                  code: "WEB_VIDEO_SOURCE_CHANGED",
                });
            };
            await assertDownloadSource();
            const transferVideo = rendition === "original" ? webAiVideos.usingOriginal : webAiVideos.using;
            await transferVideo(source, controller.signal, async (prepared) => {
              if (rendition === "480p" && expectedVariant !== null && prepared.manifest.variantKey !== expectedVariant)
                throw Object.assign(Error("Bản video hoặc nguồn đã đổi; chưa truyền video của lượt cũ."), {
                  status: 409,
                  code: "WEB_VIDEO_VARIANT_CHANGED",
                });
              await assertDownloadSource();
              transferring = true;
              unsubscribe?.();
              unsubscribe = undefined;
              let lastUpdate = 0,
                latestBytes = 0,
                latestTotal = 0;
              const transferStart = performance.now();
              manualDownloadProgress(tracked, {
                phase: "transferring",
                state: "running",
                percent: 0,
                completedBytes: 0,
                totalBytes: prepared.manifest.bytes,
              });
              await serveMediaPath(request, response, prepared.file, {
                download: true,
                filename: prepared.manifest.filename,
                signal: controller.signal,
                ...(tracked
                  ? {
                      onProgress: (completedBytes, totalBytes) => {
                        latestBytes = completedBytes;
                        latestTotal = totalBytes;
                        const now = performance.now();
                        if (now - lastUpdate < 150 && completedBytes < totalBytes) return;
                        lastUpdate = now;
                        const elapsed = (now - transferStart) / 1000,
                          bytesPerSecond = elapsed >= 0.5 ? completedBytes / elapsed : undefined;
                        manualDownloadProgress(tracked, {
                          phase: "transferring",
                          state: "running",
                          percent: totalBytes > 0 ? Math.min(99, (completedBytes / totalBytes) * 100) : null,
                          completedBytes,
                          totalBytes,
                          ...(bytesPerSecond > 0
                            ? {
                                bytesPerSecond,
                                etaSeconds: Math.max(0, (totalBytes - completedBytes) / bytesPerSecond),
                              }
                            : {}),
                        });
                      },
                    }
                  : {}),
              });
              if (tracked) {
                controller.signal.throwIfAborted();
                manualDownloadProgress(tracked, {
                  phase: "completed",
                  state: "done",
                  percent: 100,
                  completedBytes: latestBytes,
                  totalBytes: latestTotal,
                });
              }
            });
          } catch (error) {
            const errorCode =
              typeof error.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)
                ? error.code
                : Number.isInteger(error.status)
                  ? `HTTP_${error.status}`
                  : "WEB_VIDEO_PREPARATION_FAILED";
            manualDownloadProgress(tracked, {
              phase: controller.signal.aborted ? "cancelled" : "error",
              state: controller.signal.aborted ? "cancelled" : "error",
              percent: null,
              ...(!controller.signal.aborted ? { error: manualDownloadError(error), errorCode } : {}),
            });
            throw error;
          } finally {
            unsubscribe?.();
            response.off("close", abort);
            if (tracked) tracked.cancel = null;
          }
          return;
        }
        return false;
      },
    },
    {
      order: 23,
      condition: 'request.method === "POST" && mainSource',
      matchers: "const mainSource = requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]+)\\/auto-cut$/i);",
      async handle(request, response, requestUrl) {
        const mainSource = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]+)\/auto-cut$/i);
        if (request.method === "POST" && mainSource) {
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Analysis cancelled"));
          response.once("close", abort);
          try {
            const body = await readJson(request);
            const signal = AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(["context", "import"].includes(body.mode) ? 20 * 60_000 : 600000),
            ]);
            await serveAiOperation(request, response, body, "generate", async () => {
              const source = await measureAiStage("preparation", () => loadSource(mainSource[1], signal));
              return analyzeSource(source, body, signal);
            });
          } finally {
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
    {
      order: 24,
      condition: 'request.method === "POST" && speechSource',
      matchers:
        "const speechSource = requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]+)\\/(smart-cut|captions|teaser-hooks)$/i);",
      async handle(request, response, requestUrl) {
        const speechSource = requestUrl.pathname.match(
          /^\/api\/sources\/([a-f0-9-]+)\/(smart-cut|captions|teaser-hooks)$/i,
        );
        if (request.method === "POST" && speechSource) {
          const body = await readJson(request);
          if (mediaLibrary.isLocked(speechSource[1])) throw new Error("Source đang được chuyển vào thùng rác.");
          const loading = new AbortController(),
            abortLoading = () => loading.abort(new Error("Analysis cancelled"));
          response.once("close", abortLoading);
          let source;
          try {
            source = await loadSource(speechSource[1], loading.signal);
          } finally {
            response.removeListener("close", abortLoading);
          }
          if (speechSource[2] === "captions") {
            const controller = new AbortController(),
              abort = () => controller.abort(new Error("Caption client disconnected"));
            response.once("close", abort);
            try {
              sendJson(
                request,
                response,
                200,
                await speech.captions(source, controller.signal, {
                  regenerate: body.regenerate === true,
                  provider: body.provider || "auto",
                  language: body.language || "auto",
                }),
              );
            } finally {
              response.removeListener("close", abort);
            }
            return;
          }
          validatePlan(body.plan, source, { teasers: false });
          if (speechSource[2] === "teaser-hooks") {
            const controller = new AbortController(),
              abort = () => controller.abort(new Error("Hook client disconnected"));
            response.once("close", abort);
            try {
              if (
                body.transcript !== undefined &&
                (typeof body.transcript !== "string" || body.transcript.length > 1_000_000)
              )
                throw new Error(
                  "Transcript vượt giới hạn 1 triệu ký tự hoặc sai định dạng; chưa gọi AI, không tự bỏ phần cuối.",
                );
              if (body.partId !== undefined && !body.plan.parts.some((p) => p.id === body.partId))
                throw Error("Invalid hook part ID.");
              if (
                body.customInstruction !== undefined &&
                (body.partId === undefined || parseCustomTeaser(body.customInstruction).mode !== "description")
              )
                throw Error("Custom description cần part cụ thể và mô tả hợp lệ; timestamp không gọi AI.");
              if (body.mode === "validate-import") {
                const next = await finalizeImportedTeasers(
                  body.plan,
                  source,
                  String(body.transcript || ""),
                  controller.signal,
                  { instruction: body.instruction, supplementalPrompt: body.supplementalPrompt },
                );
                sendJson(request, response, 200, { plan: next });
                return;
              }
              if (body.mode !== undefined) throw Error("Invalid teaser operation.");
              if (
                body.previousRanges !== undefined &&
                (body.partId === undefined ||
                  !Array.isArray(body.previousRanges) ||
                  body.previousRanges.length > 26 ||
                  body.previousRanges.some(
                    (r) =>
                      !r ||
                      !Number.isFinite(r.start) ||
                      !Number.isFinite(r.end) ||
                      r.start < 0 ||
                      r.end <= r.start ||
                      r.end > source.duration,
                  ))
              )
                throw Error("Danh sách teaser trước không đúng source/range.");
              await serveAiOperation(request, response, body, "teaser-retry", async () => {
                const next = await planTeasers(
                  body.plan,
                  source,
                  AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]),
                  body.transcript,
                  {
                    targetPartId: body.partId,
                    maxAttempts: 1,
                    previousRanges: body.previousRanges,
                    customInstruction: body.customInstruction,
                    instruction: body.instruction,
                    supplementalPrompt: body.supplementalPrompt,
                    forceRefresh: true,
                  },
                );
                await measureAiStage("validation", () => {
                  validatePlan(next, source, { teasers: false });
                  for (const part of next.parts)
                    if (body.partId === undefined || part.id === body.partId)
                      if (part.teaserEnabled !== false) validateTeaser(part, source.duration, source.id);
                });
                return { plan: next };
              });
            } finally {
              response.removeListener("close", abort);
            }
            return;
          }
          const next = smartCutPlan(effectiveCutPlan(body.plan), await speech.boundaries(source), source.duration);
          validatePlan(next, source);
          sendJson(request, response, 200, { plan: next });
          return;
        }
        return false;
      },
    },
    {
      order: 25,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/youtube/transcript"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/youtube/transcript") {
          const body = await readJson(request);
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Transcript client disconnected"));
          response.once("close", abort);
          try {
            sendJson(
              request,
              response,
              200,
              await fetchYouTubeTranscript(String(body.url || "").trim(), controller.signal),
            );
          } finally {
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
    {
      order: 26,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/sources/upload"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/sources/upload") {
          const source = await importUpload(request, requestUrl, response);
          sendJson(request, response, 201, { source });
          return;
        }
        return false;
      },
    },
    {
      order: 38,
      condition: 'request.method === "POST" && cancelJobMatch',
      matchers: "const cancelJobMatch = requestUrl.pathname.match(/^\\/api\\/jobs\\/([a-f0-9-]{16,64})\\/cancel$/i);",
      async handle(request, response, requestUrl) {
        const cancelJobMatch = requestUrl.pathname.match(/^\/api\/jobs\/([a-f0-9-]{16,64})\/cancel$/i);
        if (request.method === "POST" && cancelJobMatch) {
          const job = jobs.get(assertId(cancelJobMatch[1]));
          if (!job) {
            sendJson(request, response, 404, { error: "Render job không tồn tại." });
            return;
          }
          cancelRender(job);
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 200, { job: renderSnapshot(job) });
          return;
        }
        return false;
      },
    },
    {
      order: 40,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/editor-renders"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/editor-renders") {
          sendJson(request, response, 200, {
            jobs: [...jobs.values()]
              .filter((job) => job.origin === "editor" && !job.deleted)
              .reverse()
              .map(renderSnapshot),
          });
          return;
        }
        return false;
      },
    },
    {
      order: 41,
      condition: 'request.method === "DELETE" && deleteEditorMatch',
      matchers:
        "const deleteEditorMatch = requestUrl.pathname.match(/^\\/api\\/editor-renders\\/([a-f0-9-]{16,64})$/i);",
      async handle(request, response, requestUrl) {
        const deleteEditorMatch = requestUrl.pathname.match(/^\/api\/editor-renders\/([a-f0-9-]{16,64})$/i);
        if (request.method === "DELETE" && deleteEditorMatch) {
          const job = jobs.get(assertId(deleteEditorMatch[1]));
          if (!job || job.origin !== "editor") {
            sendJson(request, response, 404, { error: "Không tìm thấy render trong tab chỉnh từng video." });
            return;
          }
          if (job.deleted) {
            sendJson(request, response, 200, { removed: true, trashId: null });
            return;
          }
          if (!["done", "error", "cancelled"].includes(job.state) || renderControllers.has(job.id)) {
            sendJson(request, response, 409, { error: "Huỷ render và chờ tác vụ dừng hẳn trước khi xoá." });
            return;
          }
          const result = await mediaLibrary.moveRender({ sourceId: job.sourceId, jobId: job.id });
          job.deleted = true;
          job.outputs = [];
          await persistBatchHistory({ strict: true });
          sendJson(request, response, 200, result);
          return;
        }
        return false;
      },
    },
    {
      order: 44,
      condition: '["GET", "HEAD"].includes(request.method || "") && sourceMediaMatch',
      matchers:
        "const sourceMediaMatch = requestUrl.pathname.match(/^\\/api\\/sources\\/([a-f0-9-]{16,64})\\/media$/i);",
      async handle(request, response, requestUrl) {
        const sourceMediaMatch = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]{16,64})\/media$/i);
        if (["GET", "HEAD"].includes(request.method || "") && sourceMediaMatch) {
          await serveSourceMedia(request, response, sourceMediaMatch[1]);
          return;
        }
        return false;
      },
    },
    {
      order: 45,
      condition: '["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname.startsWith("/files/")',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname.startsWith("/files/")) {
          await serveFile(request, response, requestUrl.pathname, {
            download: requestUrl.searchParams.get("preview") !== "1",
          });
          return;
        }
        return false;
      },
    },
  ];
}
