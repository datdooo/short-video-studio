import { createReadStream, existsSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { withAiOperation } from "./ai-operation.mjs";
import { mediaByteRange } from "./media-http.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createHttpResponses(read) {
  const manualVideoDownloads = new Map();

  const MANUAL_DOWNLOAD_TTL = 5 * 60_000,
    MANUAL_DOWNLOAD_LIMIT = 32;

  const manualDownloadKey = (sourceId, downloadId) => `${sourceId.toLowerCase()}:${downloadId.toLowerCase()}`;

  function pruneManualDownloads() {
    const now = Date.now();
    for (const [key, item] of manualVideoDownloads)
      if (item.progress.state !== "running" && now - item.updatedAt > MANUAL_DOWNLOAD_TTL)
        manualVideoDownloads.delete(key);
  }

  function createManualDownload(sourceId, downloadId, progress) {
    pruneManualDownloads();
    if (manualVideoDownloads.size >= MANUAL_DOWNLOAD_LIMIT)
      throw Object.assign(Error("Có quá nhiều lượt tải đang được theo dõi. Chờ một lát rồi tải lại."), { status: 429 });
    const item = {
      sourceId: sourceId.toLowerCase(),
      downloadId: downloadId.toLowerCase(),
      updatedAt: Date.now(),
      progress: { ...progress, updatedAt: Date.now() },
      cancel: null,
    };
    manualVideoDownloads.set(manualDownloadKey(sourceId, downloadId), item);
    return item;
  }

  function manualDownloadProgress(item, progress) {
    if (!item || item.progress.state !== "running") return;
    item.updatedAt = Date.now();
    item.progress = { ...progress, updatedAt: item.updatedAt };
  }

  function manualDownloadError(error) {
    if (error?.code === "SOURCE_BUSY") return "Nguồn đang được di chuyển. Chờ xong rồi tải lại.";
    if (["WEB_VIDEO_SOURCE_CHANGED", "WEB_VIDEO_VARIANT_CHANGED"].includes(error?.code))
      return "Nguồn hoặc bản video đã đổi. Tải TXT mới rồi tải video lại.";
    if (error?.code === "SOURCE_MEDIA_MISSING" || error?.code === "ENOENT")
      return "Không còn video nguồn. Chuẩn bị hoặc khôi phục nguồn rồi tải lại.";
    if (error?.code === "ENOSPC") return "Không đủ dung lượng để chuẩn bị video.";
    if (error?.code === "WEB_VIDEO_TOO_LONG" || error?.code === "WEB_VIDEO_TOO_LARGE")
      return "Chưa tạo được video đầy đủ trong giới hạn 512 MiB; nguồn và plan vẫn được giữ.";
    return "Không chuẩn bị hoặc truyền được video. Bấm Tải video để thử lại.";
  }

  function corsHeaders(request) {
    const { requestOrigins } = read();

    return {
      ...(requestOrigins.allowsOrigin(request.headers.origin)
        ? { "Access-Control-Allow-Origin": request.headers.origin }
        : {}),
      "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Filename, X-Catalog-Id, Range",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      ...(requestOrigins.allowsOrigin(request.headers.origin)
        ? { "Access-Control-Allow-Private-Network": "true" }
        : {}),
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  }

  function sendJson(request, response, statusCode, value) {
    response.writeHead(statusCode, {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(value));
  }

  async function readJson(request, limit = 6 * 1024 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > limit) {
        request.resume();
        throw Object.assign(new Error("Request JSON quá lớn."), { status: 413 });
      }
      chunks.push(chunk);
    }
    let value;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      throw Object.assign(Error("Request JSON không hợp lệ."), { status: 400 });
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Object.assign(Error("Request cần một JSON object."), { status: 400 });
    return value;
  }

  function sendHtml(request, response, statusCode, title, message) {
    const escapeHtml = (value) =>
      String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    response.writeHead(statusCode, {
      ...corsHeaders(request),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#090a0c;color:#f4f4f5;font:16px/1.5 system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;margin:24px;padding:28px;border:1px solid #ffffff18;border-radius:20px;background:#111216}h1{font-size:22px;margin:0 0 10px}p{color:#a1a1aa;margin:0}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main><script>setTimeout(()=>window.close(),1200)</script></body></html>`,
    );
  }

  async function serveAiOperation(request, response, body, kind, work) {
    const streamed = body.progress === true;
    const write = (value) => {
      if (response.destroyed || response.writableEnded) return;
      if (value.type === "progress" && response.writableLength > 16384) return;
      response.write(JSON.stringify(value) + "\n");
    };
    if (streamed)
      response.writeHead(200, {
        ...corsHeaders(request),
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      });
    try {
      const result = await withAiOperation(
        kind,
        work,
        streamed ? (diagnostics) => write({ type: "progress", diagnostics }) : undefined,
      );
      if (streamed) {
        write({ type: "result", ...result });
        response.end();
      } else sendJson(request, response, 200, result);
    } catch (error) {
      if (streamed) {
        write({ type: "error", error: error.message, diagnostics: error.diagnostics });
        response.end();
      } else sendJson(request, response, error.status || 500, { error: error.message, diagnostics: error.diagnostics });
    }
  }

  function mediaContentType(target) {
    return (
      {
        ".mp4": "video/mp4",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".ogg": "audio/ogg",
        ".opus": "audio/ogg",
        ".m4v": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".avi": "video/x-msvideo",
      }[path.extname(target).toLowerCase()] || "application/octet-stream"
    );
  }

  async function serveMediaPath(
    request,
    response,
    target,
    { download = false, filename = path.basename(target), signal, onProgress } = {},
  ) {
    signal?.throwIfAborted();
    const fileStat = await stat(target);
    if (!fileStat.isFile()) throw Object.assign(Error("Không tìm thấy media."), { status: 404 });
    const transmit = async (start, end, total) => {
      signal?.throwIfAborted();
      const input = createReadStream(target, { start, end });
      if (!onProgress) {
        await pipeline(input, response, { signal });
        return;
      }
      // This counts actual bytes passed through the HTTP pipeline with normal
      // backpressure; it is not a claim that the browser saved a file to disk.
      let completed = 0;
      const report = () => {
        try {
          onProgress(completed, total);
        } catch {
          /* Telemetry cannot own transfer. */
        }
      };
      const meter = new Transform({
        transform(chunk, encoding, callback) {
          completed += chunk.length;
          report();
          callback(null, chunk);
        },
      });
      report();
      await pipeline(input, meter, response, { signal });
    };
    const range = request.headers.range;
    const baseHeaders = {
      ...corsHeaders(request),
      "Content-Type": mediaContentType(target),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=0, must-revalidate",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, "%27")}`,
          }
        : {}),
    };
    if (range) {
      const selected = mediaByteRange(range, fileStat.size);
      if (!selected) {
        if (onProgress) throw Object.assign(Error("Khoảng byte tải video không hợp lệ."), { status: 416 });
        response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${fileStat.size}` });
        response.end();
        return;
      }
      const { start, end } = selected;
      response.writeHead(206, {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        "Content-Length": end - start + 1,
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      await transmit(start, end, end - start + 1);
      return;
    }
    response.writeHead(200, { ...baseHeaders, "Content-Length": fileStat.size });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    await transmit(undefined, undefined, fileStat.size);
  }

  async function serveFile(request, response, pathname, { download = true } = {}) {
    const { sourcesRoot } = read();

    const relative = decodeURIComponent(pathname.slice("/files/".length));
    const target = path.resolve(sourcesRoot, relative);
    if (!target.startsWith(`${sourcesRoot}${path.sep}`) || !existsSync(target) || !statSync(target).isFile()) {
      sendJson(request, response, 404, { error: "Không tìm thấy output." });
      return;
    }
    await serveMediaPath(request, response, target, { download });
  }

  async function serveSourceMedia(request, response, sourceId) {
    const { loadSource } = read();

    const source = await loadSource(sourceId);
    await serveMediaPath(request, response, source.mediaPath);
  }
  return {
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
  };
}
