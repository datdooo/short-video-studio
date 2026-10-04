import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  statSync,
} from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataRoot = path.resolve(process.env.MEDIA_WORKER_DATA_DIR || path.join(projectRoot, "worker-data"));
const sourcesRoot = path.join(dataRoot, "sources");
const port = Number(process.env.MEDIA_WORKER_PORT || 8787);
const host = "127.0.0.1";
const jobs = new Map();

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
const ytDlp = resolveBinary("YT_DLP_PATH", "yt-dlp", [
  path.join(projectRoot, ".local-tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
]);

function binaryVersion(binary, args = ["--version"]) {
  if (!binary) return null;
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim().split("\n")[0] : null;
}

const versions = {
  ffmpeg: binaryVersion(ffmpeg, ["-version"])?.replace(/^ffmpeg version\s+/, "") || null,
  ffprobe: binaryVersion(ffprobe, ["-version"])?.replace(/^ffprobe version\s+/, "") || null,
  ytDlp: binaryVersion(ytDlp),
};

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Filename",
    "Access-Control-Allow-Private-Network": "true",
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
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request JSON quá lớn.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeName(value) {
  return String(value || "source.mp4")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "source.mp4";
}

function assertId(value) {
  if (!/^[a-f0-9-]{16,64}$/i.test(value)) throw new Error("Source/job ID không hợp lệ.");
  return value;
}

async function run(binary, args, options = {}) {
  if (!binary) throw new Error(options.missingMessage || "Thiếu binary cần thiết.");
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd || projectRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-100_000);
      options.onStdout?.(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-100_000);
      options.onStderr?.(chunk.toString());
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${path.basename(binary)} exited with ${code}`).trim().slice(-5_000)));
    });
  });
}

async function probeMedia(mediaPath) {
  const result = await run(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration:stream=index,codec_type,width,height", "-of", "json", mediaPath],
    { missingMessage: "Không tìm thấy ffprobe. Hãy cài FFmpeg trước." },
  );
  const data = JSON.parse(result.stdout);
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("File nguồn không có video stream.");
  return {
    duration: Number(data.format?.duration || 0),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
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
  const match = value.match(/(?:(\d+):)?(\d{2}):(\d{2})[.,]\d{3}/);
  if (!match) return value;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours > 0
    ? [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
    : [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function vttToTranscript(vtt) {
  const blocks = vtt.replace(/^\uFEFF/, "").split(/\r?\n\r?\n+/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const start = lines[timingIndex].split("-->")[0].trim();
    const text = decodeEntities(lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    if (!text || cues.at(-1)?.text === text) continue;
    cues.push({ at: compactTimestamp(start), text });
  }
  return cues.map((cue) => `${cue.at} ${cue.text}`).join("\n");
}

async function findSourceMedia(directory) {
  const entries = await readdir(directory);
  const extensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"]);
  const candidates = entries.filter((name) => name.startsWith("source.") && extensions.has(path.extname(name).toLowerCase()));
  if (!candidates.length) throw new Error("Không tìm thấy media file sau khi chuẩn bị source.");
  candidates.sort((a, b) => (path.extname(a).toLowerCase() === ".mp4" ? -1 : 1) - (path.extname(b).toLowerCase() === ".mp4" ? -1 : 1));
  return path.join(directory, candidates[0]);
}

async function saveSourceMetadata(directory, source) {
  await writeFile(path.join(directory, "source.json"), JSON.stringify(source, null, 2));
  return source;
}

async function importYouTube(url) {
  if (!ytDlp) throw new Error("Chưa có yt-dlp. Chạy `npm run setup:media` rồi thử lại.");
  if (!/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(url)) {
    throw new Error("URL phải thuộc YouTube.");
  }
  const id = randomUUID();
  const directory = path.join(sourcesRoot, id);
  await mkdir(directory, { recursive: true });
  const outputTemplate = path.join(directory, "source.%(ext)s");
  await run(ytDlp, [
    "--no-playlist",
    "--newline",
    "--js-runtimes", `node:${process.execPath}`,
    "--write-info-json",
    "-S", "res:1080,ext:mp4:m4a",
    "--merge-output-format", "mp4",
    "-o", outputTemplate,
    url,
  ], { missingMessage: "Chưa có yt-dlp. Chạy `npm run setup:media`." });

  // Subtitles are best-effort: a throttled subtitle endpoint must never block
  // manual timestamp editing or the downloaded source video.
  await run(ytDlp, [
    "--no-playlist",
    "--js-runtimes", `node:${process.execPath}`,
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs", "de,en,fr,ja,ko",
    "--sub-format", "vtt",
    "--convert-subs", "vtt",
    "-o", outputTemplate,
    url,
  ]).catch(() => undefined);

  const mediaPath = await findSourceMedia(directory);
  const media = await probeMedia(mediaPath);
  const entries = await readdir(directory);
  const infoName = entries.find((name) => name.endsWith(".info.json"));
  const info = infoName ? JSON.parse(await readFile(path.join(directory, infoName), "utf8")) : {};
  const subtitleNames = entries.filter((name) => name.endsWith(".vtt")).sort((a, b) => {
    const priority = (name) => /\.(de|en|fr|ja|ko)(?:[-.]|$)/i.test(name) ? 0 : 1;
    return priority(a) - priority(b);
  });
  const transcript = subtitleNames[0]
    ? vttToTranscript(await readFile(path.join(directory, subtitleNames[0]), "utf8"))
    : "";
  const source = {
    id,
    kind: "youtube",
    title: String(info.title || "YouTube video"),
    originalFilename: path.basename(mediaPath),
    duration: media.duration,
    width: media.width,
    height: media.height,
    hasAudio: media.hasAudio,
    transcript,
    subtitleFound: Boolean(transcript),
    subtitleFile: subtitleNames[0] || null,
    createdAt: new Date().toISOString(),
  };
  return saveSourceMetadata(directory, source);
}

async function importUpload(request, url) {
  const rawFilename = request.headers["x-filename"] || url.searchParams.get("filename") || "source.mp4";
  const filename = safeName(decodeURIComponent(String(rawFilename)));
  const extension = path.extname(filename).toLowerCase() || ".mp4";
  if (![".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"].includes(extension)) {
    throw new Error("Chỉ nhận MP4, MOV, MKV, WebM, M4V hoặc AVI.");
  }
  const id = randomUUID();
  const directory = path.join(sourcesRoot, id);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `upload${extension}.partial`);
  const mediaPath = path.join(directory, `source${extension}`);
  await pipeline(request, createWriteStream(temporaryPath, { flags: "wx" }));
  await rename(temporaryPath, mediaPath);
  const media = await probeMedia(mediaPath);
  const source = {
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
  return saveSourceMetadata(directory, source);
}

function detectScript(text) {
  const japanese = (text.match(/[\u3040-\u30ff]/g) || []).length;
  const korean = (text.match(/[\uac00-\ud7af]/g) || []).length;
  if (japanese > korean && japanese > 0) return "japanese";
  if (korean > 0) return "korean";
  return "latin";
}

function fontFamilyFor(text) {
  const script = detectScript(text);
  const configured = {
    latin: process.env.FONT_LATIN_FAMILY,
    japanese: process.env.FONT_JAPANESE_FAMILY,
    korean: process.env.FONT_KOREAN_FAMILY,
  }[script];
  if (configured) return configured;
  if (script === "japanese") return "Hiragino Kaku Gothic ProN, Hiragino Sans, Noto Sans CJK JP, sans-serif";
  if (script === "korean") return "Apple SD Gothic Neo, Noto Sans CJK KR, Malgun Gothic, sans-serif";
  return "Arial Rounded MT Bold, Arial, DejaVu Sans, sans-serif";
}

function wrapText(value, latinWidth, eastAsianWidth, maxLines) {
  const text = String(value || "").trim();
  const script = detectScript(text);
  const maxWidth = script === "latin" ? latinWidth : eastAsianWidth;
  const tokens = script === "latin" ? text.split(/\s+/) : Array.from(text);
  const separator = script === "latin" ? " " : "";
  const lines = [];
  let current = "";
  for (const token of tokens) {
    const candidate = current ? `${current}${separator}${token}` : token;
    if (candidate.length > maxWidth && current) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxWidth - 1))}…`;
    return kept.join("\n");
  }
  return lines.join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validatePlan(plan, source) {
  if (!plan || !Array.isArray(plan.parts) || plan.parts.length !== 2) throw new Error("Edit plan phải có đúng 2 Part.");
  let previousPartEnd = 0;
  for (const [partIndex, part] of plan.parts.entries()) {
    if (!part.title?.trim() || !Array.isArray(part.segments) || !part.segments.length) {
      throw new Error(`Part ${partIndex + 1} thiếu title hoặc segment.`);
    }
    let previousEnd = partIndex === 0 ? 0 : previousPartEnd;
    for (const segment of part.segments) {
      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < previousEnd || end <= start || end > source.duration + 0.5) {
        throw new Error(`Timestamp Part ${partIndex + 1} không hợp lệ hoặc vượt duration source.`);
      }
      previousEnd = end;
    }
    previousPartEnd = previousEnd;
  }
}

async function loadSource(sourceId) {
  const id = assertId(sourceId);
  const directory = path.join(sourcesRoot, id);
  const metadata = JSON.parse(await readFile(path.join(directory, "source.json"), "utf8"));
  const mediaPath = await findSourceMedia(directory);
  return { ...metadata, directory, mediaPath };
}

function svgTextLines(lines, { fontFamily, fontSize, firstBaseline, lineHeight, strokeWidth }) {
  const textNodes = lines.map((line, index) => {
    const y = Math.round(firstBaseline + index * lineHeight);
    return `<text x="540" y="${y}" text-anchor="middle">${escapeXml(line)}</text>`;
  }).join("");
  return `
    <g font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="900" letter-spacing="-1.2"
       fill="white" stroke="#ff2a20" stroke-width="${strokeWidth + 9}" stroke-linejoin="round" paint-order="stroke fill"
       opacity="0.62" filter="url(#glow)">${textNodes}</g>
    <g font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="900" letter-spacing="-1.2"
       fill="white" stroke="#d52b20" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"
       filter="url(#shadow)">${textNodes}</g>`;
}

async function renderTitleOverlay({ outputPath, originalTitle, partTitle, partId, totalParts }) {
  const originalLines = wrapText(originalTitle, 34, 18, 3).split("\n");
  const partLines = wrapText(partTitle, 24, 13, 4).split("\n");
  const originalFontSize = originalTitle.length > 90 ? 38 : originalTitle.length > 62 ? 44 : 50;
  const partFontSize = partTitle.length > 62 ? 58 : partTitle.length > 42 ? 66 : 76;
  const originalLineHeight = originalFontSize * 1.03;
  const originalFirstBaseline = 345 - (originalLines.length - 1) * originalLineHeight;
  const partLineHeight = partFontSize * 1.03;
  const family = fontFamilyFor(`${originalTitle} ${partTitle}`);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.82" />
        </filter>
      </defs>
      ${svgTextLines(originalLines, { fontFamily: family, fontSize: originalFontSize, firstBaseline: originalFirstBaseline, lineHeight: originalLineHeight, strokeWidth: 5 })}
      ${svgTextLines(partLines, { fontFamily: family, fontSize: partFontSize, firstBaseline: 1450 + partFontSize, lineHeight: partLineHeight, strokeWidth: 7 })}
      ${svgTextLines([`${partId}/${totalParts}`], { fontFamily: family, fontSize: 58, firstBaseline: 1850, lineHeight: 60, strokeWidth: 5 })}
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function renderPart({ source, plan, part, totalParts, outputPath, onProgress }) {
  if (!ffmpeg) throw new Error("Không tìm thấy FFmpeg. macOS: brew install ffmpeg");
  const workDirectory = path.dirname(outputPath);
  const titleOverlayPath = path.join(workDirectory, `part-${part.id}-titles.png`);
  await renderTitleOverlay({
    outputPath: titleOverlayPath,
    originalTitle: plan.originalTitle,
    partTitle: part.title,
    partId: part.id,
    totalParts,
  });

  const audioInput = source.hasAudio ? "0:a" : "1:a";
  const segmentFilters = part.segments.flatMap((segment, index) => [
    `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS,fps=30,setsar=1[v${index}]`,
    `[${audioInput}]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`,
  ]);
  const concatInputs = part.segments.map((_, index) => `[v${index}][a${index}]`).join("");
  const overlayInput = source.hasAudio ? 1 : 2;
  const filters = [
    ...segmentFilters,
    `${concatInputs}concat=n=${part.segments.length}:v=1:a=1[cutv][cuta]`,
    `[cutv]split=2[bgsrc][mainsrc]`,
    `color=c=black:s=1080x1920:r=30[black]`,
    `[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=50:25,format=rgba,colorchannelmixer=aa=0.5[bgvideo]`,
    `[black][bgvideo]overlay=shortest=1[bg]`,
    `[mainsrc]crop=w='min(iw,1080)':h='min(ih,1080)':x='max((iw-1080)/2,0)':y='max((ih-1080)/2,0)',pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black[main]`,
    `[bg][main]overlay=0:360:shortest=1[layout]`,
    `[${overlayInput}:v]format=rgba[titlecard]`,
    `[layout][titlecard]overlay=0:0:shortest=1[titled]`,
    `[titled]setpts=PTS/1.25[vout]`,
    `[cuta]atempo=1.25[aout]`,
  ];

  const args = ["-y", "-i", source.mediaPath];
  if (!source.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push("-loop", "1", "-framerate", "30", "-i", titleOverlayPath);
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    "-map", "[aout]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", process.env.FFMPEG_PRESET || "medium",
    "-crf", process.env.FFMPEG_CRF || "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-shortest",
    "-progress", "pipe:1",
    "-nostats",
    outputPath,
  );

  const expectedMicroseconds = part.segments.reduce((sum, segment) => sum + segment.end - segment.start, 0) / 1.25 * 1_000_000;
  let progressBuffer = "";
  await run(ffmpeg, args, {
    onStdout(chunk) {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("out_time_us=")) continue;
        const current = Number(line.slice("out_time_us=".length));
        if (Number.isFinite(current) && expectedMicroseconds > 0) onProgress(Math.min(1, current / expectedMicroseconds));
      }
    },
  });
  onProgress(1);
}

async function executeRender(job, source, plan) {
  try {
    job.state = "rendering";
    job.startedAt = new Date().toISOString();
    const outputDirectory = path.join(source.directory, "outputs", job.id);
    await mkdir(outputDirectory, { recursive: true });
    for (const [index, part] of plan.parts.entries()) {
      job.currentPart = part.id;
      const outputPath = path.join(outputDirectory, `part-${part.id}.mp4`);
      await renderPart({
        source,
        plan,
        part,
        totalParts: plan.parts.length,
        outputPath,
        onProgress: (partProgress) => {
          job.progress = Math.round(((index + partProgress) / plan.parts.length) * 100);
        },
      });
      const outputStat = await stat(outputPath);
      job.outputs.push({
        part: part.id,
        filename: `part-${part.id}.mp4`,
        size: outputStat.size,
        url: `/files/${source.id}/outputs/${job.id}/part-${part.id}.mp4`,
      });
    }
    job.progress = 100;
    job.state = "done";
    job.finishedAt = new Date().toISOString();
  } catch (error) {
    job.state = "error";
    job.error = error instanceof Error ? error.message : String(error);
    job.finishedAt = new Date().toISOString();
  }
}

async function startRender(body) {
  const source = await loadSource(body.sourceId);
  validatePlan(body.plan, source);
  const job = {
    id: randomUUID(),
    sourceId: source.id,
    state: "queued",
    progress: 0,
    currentPart: null,
    outputs: [],
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  void executeRender(job, source, body.plan);
  return job;
}

async function serveFile(request, response, pathname) {
  const relative = decodeURIComponent(pathname.slice("/files/".length));
  const target = path.resolve(sourcesRoot, relative);
  if (!target.startsWith(`${sourcesRoot}${path.sep}`) || !existsSync(target) || !statSync(target).isFile()) {
    sendJson(request, response, 404, { error: "Không tìm thấy output." });
    return;
  }
  const fileStat = statSync(target);
  const range = request.headers.range;
  const baseHeaders = {
    ...corsHeaders(request),
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `attachment; filename="${path.basename(target)}"`,
  };
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      response.writeHead(416, baseHeaders);
      response.end();
      return;
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : fileStat.size - 1;
    response.writeHead(206, {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Content-Length": end - start + 1,
    });
    createReadStream(target, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, { ...baseHeaders, "Content-Length": fileStat.size });
  createReadStream(target).pipe(response);
}

await mkdir(sourcesRoot, { recursive: true });

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(request, response, 200, {
        ok: Boolean(ffmpeg && ffprobe),
        readyForYouTube: Boolean(ffmpeg && ffprobe && ytDlp),
        tools: versions,
        dataRoot,
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/sources/youtube") {
      const body = await readJson(request);
      const source = await importYouTube(String(body.url || "").trim());
      sendJson(request, response, 201, { source });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/sources/upload") {
      const source = await importUpload(request, requestUrl);
      sendJson(request, response, 201, { source });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/render") {
      const body = await readJson(request);
      const job = await startRender(body);
      sendJson(request, response, 202, { job });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname.startsWith("/api/jobs/")) {
      const jobId = assertId(requestUrl.pathname.slice("/api/jobs/".length));
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(request, response, 404, { error: "Render job không tồn tại hoặc worker đã restart." });
        return;
      }
      sendJson(request, response, 200, { job });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname.startsWith("/files/")) {
      await serveFile(request, response, requestUrl.pathname);
      return;
    }
    sendJson(request, response, 404, { error: "Route không tồn tại." });
  } catch (error) {
    sendJson(request, response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`\nShortCut media worker listening at http://${host}:${port}\n`);
  process.stdout.write(`FFmpeg: ${ffmpeg || "missing"}\nyt-dlp: ${ytDlp || "missing"}\n\n`);
});
