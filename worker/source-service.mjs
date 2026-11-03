import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { parseCaptions } from "../lib/subtitles.mjs";
import { requireDiskSpace } from "./analysis-cache.mjs";
import { sourceContextFor } from "./source-context.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createSourceService(read) {
  function publicSource(source) {
    const { directory, mediaPath, ...metadata } = source;
    void directory;
    void mediaPath;
    return metadata;
  }

  function safeName(value) {
    return (
      String(value || "source.mp4")
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || "source.mp4"
    );
  }

  function assertId(value) {
    if (!/^[a-f0-9-]{16,64}$/i.test(value)) throw new Error("Source/job ID không hợp lệ.");
    return value;
  }

  async function probeMedia(mediaPath, signal) {
    const { ffprobe, run } = read();

    const result = await run(
      ffprobe,
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-probesize",
        "5000000",
        "-analyzeduration",
        "5000000",
        "-show_entries",
        "format=duration,start_time:stream=index,codec_type,codec_name,width,height,sample_aspect_ratio,start_time,duration,pix_fmt,color_range,color_space,color_transfer,color_primaries:stream_tags=rotate:stream_side_data=rotation",
        "-of",
        "json",
        mediaPath,
      ],
      { signal, missingMessage: "Không tìm thấy ffprobe. Hãy cài FFmpeg trước." },
    );
    const data = JSON.parse(result.stdout);
    const video = data.streams?.find((stream) => stream.codec_type === "video");
    if (!video) throw new Error("File nguồn không có video stream.");
    const audio = data.streams?.find((stream) => stream.codec_type === "audio");
    const sourceStart = Number(data.format?.start_time || 0);
    const [sarN, sarD] = String(video.sample_aspect_ratio || "1:1")
      .split(":")
      .map(Number);
    const sar = Number.isFinite(sarN / sarD) && sarN / sarD > 0 ? sarN / sarD : 1;
    const rotation = Number(
      video.side_data_list?.find((item) => Number.isFinite(Number(item.rotation)))?.rotation ?? video.tags?.rotate ?? 0,
    );
    const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
    const displayWidth = Number(video.width || 0) * sar,
      displayHeight = Number(video.height || 0);
    const audioStart =
      audio && Number.isFinite(Number(audio.start_time)) ? Number(audio.start_time) - sourceStart : undefined;
    const audioEnd =
      audioStart !== undefined && audio?.duration !== undefined && Number.isFinite(Number(audio.duration))
        ? audioStart + Number(audio.duration)
        : undefined;
    return {
      duration: Number(data.format?.duration || 0),
      sourceStart,
      sampleAspectRatio: sar,
      rotation,
      codedWidth: Number(video.width || 0),
      codedHeight: Number(video.height || 0),
      width: quarterTurn ? displayHeight : displayWidth,
      height: quarterTurn ? displayWidth : displayHeight,
      ...(audioStart !== undefined ? { audioStart } : {}),
      ...(audioEnd !== undefined ? { audioEnd } : {}),
      videoStart: video.start_time !== undefined ? Number(video.start_time) - sourceStart : 0,
      videoDuration: video.duration !== undefined ? Number(video.duration) : null,
      hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
      videoCodec: String(video.codec_name || ""),
      pixelFormat: String(video.pix_fmt || ""),
      colorRange: String(video.color_range || "unknown"),
      colorSpace: String(video.color_space || "unknown"),
      colorTransfer: String(video.color_transfer || "unknown"),
      colorPrimaries: String(video.color_primaries || "unknown"),
    };
  }

  function decodeEntities(value) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  function compactTimestamp(value) {
    const match = value.match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/);
    if (!match) return value;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours > 0
      ? [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":") + `.${match[4]}`
      : [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":") + `.${match[4]}`;
  }

  function vttToTranscript(vtt) {
    const blocks = vtt.replace(/^\uFEFF/, "").split(/\r?\n\r?\n+/);
    const cues = [];
    for (const block of blocks) {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) continue;
      const start = lines[timingIndex].split("-->")[0].trim();
      const text = decodeEntities(
        lines
          .slice(timingIndex + 1)
          .join(" ")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      if (!text || cues.at(-1)?.text === text) continue;
      const previous = cues.at(-1);
      if (previous && text.startsWith(previous.text)) {
        previous.text = text;
        continue;
      }
      if (previous && previous.text.endsWith(text)) continue;
      cues.push({ at: compactTimestamp(start), text });
    }
    return cues.map((cue) => `${cue.at} ${cue.text}`).join("\n");
  }

  async function findSourceMedia(directory) {
    const entries = await readdir(directory);
    const extensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"]);
    const candidates = entries.filter(
      (name) => name.startsWith("source.") && extensions.has(path.extname(name).toLowerCase()),
    );
    if (!candidates.length)
      throw Object.assign(
        new Error("Nguồn đã lưu không còn tệp video. Chọn lại nguồn hoặc khôi phục từ Thùng rác nếu đã chuyển."),
        { code: "SOURCE_MEDIA_MISSING", status: 404 },
      );
    candidates.sort(
      (a, b) =>
        (path.extname(a).toLowerCase() === ".mp4" ? -1 : 1) - (path.extname(b).toLowerCase() === ".mp4" ? -1 : 1),
    );
    return path.join(directory, candidates[0]);
  }

  async function saveSourceMetadata(directory, source) {
    await writeFile(path.join(directory, "source.json"), JSON.stringify(source, null, 2));
    return source;
  }

  async function fetchYouTubeTranscript(url, signal) {
    const { youtube } = read();

    const info = await youtube.transcript(url, signal);
    return {
      title: String(info.title || "YouTube video"),
      sourceContext: youtube.peekContext(url),
      transcript: vttToTranscript(info.vtt || ""),
      captions: parseCaptions(info.vtt || ""),
      language: info.spokenLanguage || "",
      captionLanguage: info.captionLanguage || "",
      captionTrackId: info.captionTrackId || "",
      captionTranslated: info.captionTranslated === true,
      captionWarning: info.captionWarning || "",
      message:
        info.captionWarning || (info.vtt ? "" : "YouTube không cung cấp phụ đề gốc phù hợp; có thể chọn Whisper."),
    };
  }

  async function importYouTube(url, signal) {
    const { sourceReuse } = read();
    return sourceReuse.get(url, signal);
  }

  async function downloadYouTubeSource(url, signal) {
    const { sourceContexts, sourcesRoot, youtube } = read();

    return youtube.download(
      url,
      async ({ info, media, mediaPath, parsed, signal: activeSignal }) => {
        const id = randomUUID(),
          directory = path.join(sourcesRoot, id);
        let captions;
        try {
          captions = await fetchYouTubeTranscript(parsed.url, activeSignal);
        } catch (error) {
          activeSignal.throwIfAborted();
          captions = { transcript: "", message: error.message };
        }
        activeSignal.throwIfAborted();
        await mkdir(directory, { recursive: true });
        try {
          const filename = `source${path.extname(mediaPath)}`;
          await rename(mediaPath, path.join(directory, filename));
          const sourceContext = await sourceContexts.ensure(
            { id, kind: "youtube", sourceUrl: parsed.url, title: info.title, ...media },
            { signal: activeSignal },
          );
          return await saveSourceMetadata(directory, {
            sourceContext,
            id,
            kind: "youtube",
            title: String(info.title || "YouTube video"),
            sourceUrl: `https://www.youtube.com/watch?v=${parsed.id}`,
            originalFilename: filename,
            ...media,
            transcript: captions.transcript || "",
            transcriptMessage: captions.message || "",
            captions: captions.captions || [],
            language: captions.language || info.language || "",
            captionLanguage: captions.captionLanguage || "",
            captionTrackId: captions.captionTrackId || "",
            captionTranslated: captions.captionTranslated === true,
            captionWarning: captions.captionWarning || "",
            subtitleFound: Boolean(captions.transcript),
            subtitleFile: null,
            youtubeVideoId: parsed.id,
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          await rm(directory, { recursive: true, force: true });
          throw error;
        }
      },
      signal,
    );
  }

  async function importUpload(request, url, response) {
    const { dataRoot, sourcesRoot } = read();

    const rawFilename = request.headers["x-filename"] || url.searchParams.get("filename") || "source.mp4";
    const filename = safeName(decodeURIComponent(String(rawFilename))),
      extension = path.extname(filename).toLowerCase() || ".mp4";
    if (![".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"].includes(extension))
      throw Error("Chỉ nhận MP4, MOV, MKV, WebM, M4V hoặc AVI.");
    const controller = new AbortController(),
      signal = controller.signal;
    const abort = () => controller.abort(new Error("Đã dừng import video."));
    const disconnected = () => {
      if (!response.writableEnded) abort();
    };
    request.once("aborted", abort);
    response.once("close", disconnected);
    if (request.aborted || response.destroyed) abort();
    let directory,
      owner,
      published = false;
    try {
      const uploadBytes = Number(request.headers["content-length"]);
      await requireDiskSpace(
        dataRoot,
        (Number.isFinite(uploadBytes) && uploadBytes > 0 ? uploadBytes : 512 * 1024 * 1024) + 256 * 1024 * 1024,
      );
      signal.throwIfAborted();
      // Catalog/reuse only accepts UUID directories. An unfinished upload is never
      // visible as a usable source, even after its media file has been renamed.
      directory = await mkdtemp(path.join(sourcesRoot, ".upload-work-"));
      owner = await lstat(directory);
      signal.throwIfAborted();
      const temporaryPath = path.join(directory, `upload${extension}.partial`),
        mediaPath = path.join(directory, `source${extension}`);
      await pipeline(request, createWriteStream(temporaryPath, { flags: "wx" }), { signal });
      signal.throwIfAborted();
      await rename(temporaryPath, mediaPath);
      signal.throwIfAborted();
      const media = await probeMedia(mediaPath, signal);
      signal.throwIfAborted();
      const id = randomUUID(),
        source = {
          id,
          kind: "upload",
          title: path.basename(filename, extension),
          originalFilename: filename,
          duration: media.duration,
          width: media.width,
          height: media.height,
          hasAudio: media.hasAudio,
          transcript: "",
          subtitleFound: false,
          subtitleFile: null,
          createdAt: new Date().toISOString(),
        };
      source.sourceContext = sourceContextFor(source);
      await saveSourceMetadata(directory, source);
      signal.throwIfAborted();
      const destination = path.join(sourcesRoot, id);
      try {
        await lstat(destination);
        throw Object.assign(Error("Source ID đã tồn tại; không ghi đè."), { status: 409 });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      signal.throwIfAborted();
      await rename(directory, destination);
      // Publication is the commit point. A disconnect after this atomic rename
      // must not delete a complete source another operation may already open.
      published = true;
      return source;
    } finally {
      request.removeListener("aborted", abort);
      response.removeListener("close", disconnected);
      if (directory && owner && !published)
        try {
          const current = await lstat(directory);
          if (
            current.isDirectory() &&
            !current.isSymbolicLink() &&
            current.dev === owner.dev &&
            current.ino === owner.ino
          )
            await rm(directory, { recursive: true, force: false });
        } catch (error) {
          if (error.code !== "ENOENT") console.error(`Upload scratch cleanup failed: ${error.code || "IO_ERROR"}`);
        }
    }
  }

  async function loadSource(sourceId, signal) {
    const { sourcesRoot } = read();

    signal?.throwIfAborted();
    const id = assertId(sourceId);
    const directory = path.join(sourcesRoot, id);
    const metadata = JSON.parse(await readFile(path.join(directory, "source.json"), "utf8"));
    const mediaPath = await findSourceMedia(directory);
    const media = await probeMedia(mediaPath, signal);
    const source = {
      ...metadata,
      ...media,
      directory,
      mediaPath,
      ...(metadata.captions?.length && !metadata.captionTrackId
        ? { captionWarning: "Phụ đề nguồn cũ chưa xác minh ngôn ngữ; chọn Whisper nếu không đúng tiếng nguồn." }
        : {}),
    };
    return { ...source, sourceContext: sourceContextFor(source) };
  }
  return {
    assertId,
    downloadYouTubeSource,
    fetchYouTubeTranscript,
    importUpload,
    importYouTube,
    loadSource,
    probeMedia,
    publicSource,
  };
}
