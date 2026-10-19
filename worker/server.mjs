import { spawn, spawnSync } from "node:child_process";
import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  statSync,
} from "node:fs";
import {
  mkdir,
  lstat,
  chmod,
  readFile,
  readdir,
  rm,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { homedir } from "node:os";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { titleAnimationFilters } from "./title-animation.mjs";
import { cutTransitionFilters } from "./cut-transition.mjs";
import { normalizeTitleAnimation } from "../lib/visual-style/animations.mjs";
import { renderSceneOverlay } from "./scene-overlays.mjs";
import { removeBatchItem } from "./batch-cleanup.mjs";
import { createBatchSubmissionQueue } from "./batch-queue.mjs";
import { createCommandLifecycle } from "./command-lifecycle.mjs";
import { createMediaLibrary } from "./media-library.mjs";
import { validatePlan } from "./plan-validation.mjs";
import { trimPartStart } from "./part-start.mjs";
import { createExportNameAllocator } from "./export-names.mjs";
import { createSpeechService } from "./speech.mjs";
import { smartCutPlan } from "./smart-cut.mjs";
import { createSourceContextService, sourceContextFor, saveSourceContext } from "./source-context.mjs";
import { createYouTubeDownloader } from "./youtube-downloader.mjs";
import { createAuthAttempts, tokenError, assertTokenResponse, sessionHealth, localAuthOrigin } from "./chatgpt-auth-state.mjs";
import { createChatGPTStore } from './chatgpt-store.mjs';
import { createTeaserSelector } from "./teaser-selection.mjs";
import { TEASER_POLICY, presentationSegments, presentationDuration, partTransitionWindows } from "../lib/teaser-hooks.mjs";
import { detectScript, fontFamilyForStyle, listFonts } from "../lib/visual-style/fonts.mjs";
import { DEFAULT_VISUAL_STYLE } from "../lib/visual-style/defaults.mjs";
import { styledTextSvg } from "../lib/visual-style/text-render.mjs";
import { constrainTitlePair, needsMeasuredTitleFit } from "../lib/visual-style/title-fit.mjs";
import { assertRenderableBackground, gradientRowRgb } from "../lib/visual-style/backgrounds.mjs";
import { currentFilterEnvironment, ffmpegFilterExpression } from "../lib/visual-style/filters.mjs";
import { snapshotPlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { PLAYBACK_RATE, FOREGROUND_SCALE, FOREGROUND_Y, TITLE_LAYOUT, TITLE_SHINE_SECONDS, TITLE_SHINE_WIDTH, foregroundFilter, timelineDuration } from '../lib/render-config.mjs';
import { originalCutPlan } from '../lib/legacy-plan.mjs';
import { parseCaptions, partCaptions, subtitleStyle, subtitleY, sourceCaptionTrack, transcriptCues } from "../lib/subtitles.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataRoot = path.resolve(process.env.MEDIA_WORKER_DATA_DIR || path.join(projectRoot, "worker-data"));
const sourcesRoot = path.join(dataRoot, "sources");
const port = Number(process.env.MEDIA_WORKER_PORT || 8787);
const host = "127.0.0.1";
const jobs = new Map();
const exportNameAllocator = createExportNameAllocator();
const batches = new Map();
const batchControllers = new Map();
const renderControllers = new Map();
const commandLifecycle = createCommandLifecycle();
const batchHistoryPath = path.join(dataRoot, "batch-history.json");
let historyWriteQueue = Promise.resolve();
function persistBatchHistory() {
  const snapshot = JSON.stringify({ batches: [...batches.values()], jobs: [...jobs.values()].filter((job) => job.origin === "editor" || [...batches.values()].some((batch) => batch.items.some((item) => !item.deleted && item.jobId === job.id))) });
  historyWriteQueue = historyWriteQueue.then(async () => {
    await mkdir(dataRoot, { recursive: true });
    const temporary = `${batchHistoryPath}.tmp`;
    await writeFile(temporary, snapshot);
    await rename(temporary, batchHistoryPath);
  }).catch((error) => console.error(`Không lưu được lịch sử hàng đợi: ${error.message}`));
  return historyWriteQueue;
}
async function restoreBatchHistory() {
  try {
    const history = JSON.parse(await readFile(batchHistoryPath, "utf8"));
    for (const job of history.jobs || []) {
      if (!["done", "error", "cancelled"].includes(job.state)) {
        job.state = "cancelled";
        job.error = "App đã đóng trước khi xử lý xong. File đã hoàn tất vẫn được giữ.";
      }
      jobs.set(job.id, job);
    }
    for (const batch of history.batches || []) {
      for (const item of batch.items) {
        item.id ||= randomUUID();
        if (!item.jobId && !["done", "error", "cancelled"].includes(item.state)) {
          item.state = "cancelled";
          item.error = "App đã đóng trước khi xử lý xong.";
        }
      }
      batches.set(batch.id, batch);
    }
    await importLegacyRenderHistory();
  } catch (error) {
    if (error.code === "ENOENT") await importLegacyRenderHistory();
    else console.error(`Không đọc được lịch sử hàng đợi: ${error.message}`);
  }
}
async function importLegacyRenderHistory() {
  // Older personal builds stored files but no history. Recover completed YouTube
  // outputs for download/delete, without touching media or claiming to recover AI plans.
  const recoveredItems = [];
  let directories;
  try { directories = await readdir(sourcesRoot, { withFileTypes: true }); } catch { return; }
  for (const directory of directories) {
    if (!directory.isDirectory() || !/^[a-f0-9-]{16,64}$/i.test(directory.name)) continue;
    const sourceDirectory = path.join(sourcesRoot, directory.name);
    try {
      const source = JSON.parse(await readFile(path.join(sourceDirectory, "source.json"), "utf8"));
      if (source.kind !== "youtube") continue;
      for (const jobId of await readdir(path.join(sourceDirectory, "outputs"))) {
        if (!/^[a-f0-9-]{16,64}$/i.test(jobId)) continue;
        if (jobs.has(jobId) || [...batches.values()].some((batch) => batch.items.some((item) => item.jobId === jobId))) continue;
        const outputs = [];
        for (const part of [1, 2]) {
          const partDirectory = path.join(sourceDirectory, "outputs", jobId, `part-${part}`);
          let files;
          try { files = await readdir(partDirectory); } catch { continue; }
          for (const filename of files.filter((name) => name.endsWith(".mp4"))) {
            const target = path.join(partDirectory, filename);
            try {
              const media = await probeMedia(target);
              if (!media.duration) continue;
              outputs.push({ part, filename, size: (await stat(target)).size, url: `/files/${directory.name}/outputs/${jobId}/part-${part}/${encodeURIComponent(filename)}` });
            } catch { /* Ignore incomplete exports. */ }
          }
        }
        if (!outputs.length) continue;
        jobs.set(jobId, { id: jobId, sourceId: directory.name, state: "done", progress: 100, currentPart: null, outputs, error: null });
        recoveredItems.push({ id: randomUUID(), title: source.title, url: source.sourceUrl || "Video YouTube đã render", sourceId: directory.name, jobId, state: "done", error: null });
      }
    } catch { /* Subtitle-only and incomplete source folders are not history. */ }
  }
  if (recoveredItems.length) {
    const batch = { id: randomUUID(), items: recoveredItems };
    batches.set(batch.id, batch);
    await persistBatchHistory();
  }
}
let renderQueue = Promise.resolve();
const batchPreparationQueue = createBatchSubmissionQueue({
  batches, controllers: batchControllers, prepare: prepareBatch, onChange: persistBatchHistory,
});
const legacyDataRoot = process.env.MEDIA_WORKER_LEGACY_DATA_DIR || path.join(homedir(), "Documents", "tiktok-edit", "short-video-studio", "worker-data");
const mediaLibrary = createMediaLibrary({
  roots: [
    { id: "current", label: "Dữ liệu app hiện tại", root: dataRoot },
    ...(process.env.MEDIA_WORKER_DISABLE_LEGACY === "1" || path.resolve(legacyDataRoot) === dataRoot ? [] : [{ id: "legacy", label: "Dữ liệu cũ trong Documents", root: legacyDataRoot }]),
  ],
  isBusy: ({ storageId, sourceId }) => storageId === "current" && (
    speech.isBusy(sourceId) ||
    [...jobs.values()].some((job) => job.sourceId === sourceId && (["queued", "rendering"].includes(job.state) || renderControllers.has(job.id))) ||
    [...batches.values()].some((batch) => batch.items.some((item) => (item.sourceId || jobs.get(item.jobId)?.sourceId) === sourceId && (item.deleting || ["downloading", "analyzing"].includes(item.state))))
  ),
  onMoved: async (item) => {
    if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
    const job = jobs.get(item.jobId);
    if (job) {
      if (item.kind === "parts") { job.deleted = true; job.outputs = []; }
      else job.outputs = job.outputs.filter((output) => output.url !== item.renderUrl);
    }
    await persistBatchHistory();
  },
  onRestored: async (item) => {
    if (item.storageId !== "current" || !["part", "parts"].includes(item.kind)) return;
    const outputs = [];
    for (const part of [1, 2]) {
      const folder = path.join(sourcesRoot, item.sourceId, "outputs", item.jobId, `part-${part}`);
      let files;
      try {
        const info = await lstat(folder);
        if (!info.isDirectory() || info.isSymbolicLink()) continue;
        files = await readdir(folder, { withFileTypes: true });
      } catch { continue; }
      for (const file of files.filter((file) => file.isFile() && /\.mp4$/i.test(file.name))) {
        outputs.push({ part, filename: file.name, size: (await stat(path.join(folder, file.name))).size, url: `/files/${item.sourceId}/outputs/${item.jobId}/part-${part}/${encodeURIComponent(file.name)}` });
      }
    }
    const job = jobs.get(item.jobId);
    if (job) { job.outputs = outputs; delete job.deleted; }
    else jobs.set(item.jobId, { id: item.jobId, sourceId: item.sourceId, state: "done", progress: 100, currentPart: null, outputs, error: null });
    const restoredItemIds = [];
    for (const batch of batches.values()) for (const candidate of batch.items) {
      if (candidate.jobId === item.jobId && candidate.deleted) { delete candidate.deleted; candidate.state = "done"; candidate.error = null; restoredItemIds.push(candidate.id); }
    }
    await persistBatchHistory();
    return { restoredItemIds, restoredUrls: outputs.map((output) => output.url) };
  },
});
const pendingChatGPTAuth = createAuthAttempts();
const chatGPTRegistrationPath = path.join(dataRoot, "chatgpt-registration.json");
const chatGPTRefreshes = new Map();
const chatGPTRefreshFailures = new Map();
const chatGPTHostPath = path.join(dataRoot, "chatgpt-host.json");
const chatGPTStore = createChatGPTStore({ dataRoot });
const chatGPTResource = "https://api.openai.com/v1";
const chatGPTIssuer = "https://auth.openai.com";
const chatGPTAuthorizeEndpoint = `${chatGPTIssuer}/api/accounts/authorize`;
const chatGPTTokenEndpoint = `${chatGPTIssuer}/api/accounts/oauth/token`;
const chatGPTJwksEndpoint = `${chatGPTIssuer}/.well-known/jwks.json`;
const chatGPTScopes = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

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
const speech = createSpeechService({ dataRoot, sourcesRoot, ffmpeg, whisper, run });
const ytDlp = resolveBinary("YT_DLP_PATH", "yt-dlp", [
  path.join(projectRoot, ".local-tools", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
]);
const youtube = createYouTubeDownloader({ dataRoot, ytDlp, ffmpeg, run, probeMedia, upscaleEncoder: () => preferredVideoEncoder });
const sourceContexts = createSourceContextService({ youtube, cacheRoot: path.join(dataRoot, "cache", "source-context") });

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
const preferredVideoEncoder = process.env.FFMPEG_VIDEO_ENCODER
  || (videoToolboxAvailable ? "h264_videotoolbox" : "libx264");
const { contrast: renderContrast, saturation: renderSaturation } = currentFilterEnvironment(process.env);
const hardwareDecodeCodecs = new Set(["h264", "hevc", "prores"]);

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

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.origin || "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Filename, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
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

function sendHtml(request, response, statusCode, title, message) {
  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  response.writeHead(statusCode, {
    ...corsHeaders(request),
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#090a0c;color:#f4f4f5;font:16px/1.5 system-ui;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;margin:24px;padding:28px;border:1px solid #ffffff18;border-radius:20px;background:#111216}h1{font-size:22px;margin:0 0 10px}p{color:#a1a1aa;margin:0}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main><script>setTimeout(()=>window.close(),1200)</script></body></html>`);
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function readChatGPTCredentials() {
  return chatGPTStore.read();
}

function writeChatGPTCredentials(credentials) {
  chatGPTStore.write(credentials);
}

function deleteChatGPTCredentials() {
  return chatGPTStore.delete();
}

async function getChatGPTHostId() {
  try {
    const saved = JSON.parse(await readFile(chatGPTHostPath, "utf8"));
    if (/^urn:uuid:[a-f0-9-]{36}$/i.test(saved.ext_agent_host_id || "")) return saved.ext_agent_host_id;
  } catch {
    // First launch creates the stable host identifier below.
  }
  const extAgentHostId = `urn:uuid:${randomUUID()}`;
  await mkdir(dataRoot, { recursive: true });
  await writeFile(chatGPTHostPath, JSON.stringify({ ext_agent_host_id: extAgentHostId }, null, 2), { flag: "wx", mode: 0o600 })
    .catch(async (error) => {
      if (error?.code !== "EEXIST") throw error;
    });
  await chmod(chatGPTHostPath, 0o600).catch(() => undefined);
  const saved = JSON.parse(await readFile(chatGPTHostPath, "utf8"));
  return saved.ext_agent_host_id;
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

let cachedChatGPTJwks = null;

async function validateChatGPTIdToken(idToken, { clientId, nonce, subject } = {}) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("OpenAI trả về ID token không hợp lệ.");
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("ID token dùng thuật toán không được hỗ trợ.");

  if (!cachedChatGPTJwks) {
    const response = await fetch(chatGPTJwksEndpoint, { signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Không tải được OpenAI signing keys.");
    cachedChatGPTJwks = await response.json();
  }
  let jwk = cachedChatGPTJwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedChatGPTJwks = null;
    const response = await fetch(chatGPTJwksEndpoint, { signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Không refresh được OpenAI signing keys.");
    cachedChatGPTJwks = await response.json();
    jwk = cachedChatGPTJwks.keys?.find((key) => key.kid === header.kid);
  }
  if (!jwk) throw new Error("Không tìm thấy signing key cho ID token.");
  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(parts[2], "base64url"),
  );
  if (!validSignature) throw new Error("Chữ ký OpenAI ID token không hợp lệ.");

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1_000);
  if (payload.iss !== chatGPTIssuer) throw new Error("OpenAI ID token issuer không hợp lệ.");
  if (!audience.includes(clientId)) throw new Error("OpenAI ID token audience không khớp.");
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw new Error("OpenAI ID token đã hết hạn.");
  if (nonce && payload.nonce !== nonce) throw new Error("OpenAI ID token nonce không khớp.");
  if (!payload.sub || (subject && payload.sub !== subject)) throw new Error("ChatGPT account không khớp với session đã lưu.");
  return payload;
}

function normalizeScope(value) {
  return String(value || "").split(/\s+/).filter(Boolean);
}

function publicChatGPTSession(credentials) {
  if (!credentials) return { available: chatGPTStore.available, connected: false, sharing: false };
  return {
    available: chatGPTStore.available,
    ...sessionHealth(credentials),
    email: credentials.email || null,
    name: credentials.name || null,
    expiresAt: credentials.expires_at || null,
  };
}

async function startChatGPTAuthorization() {
  if (!chatGPTStore.available) throw new Error('Bản app chưa có kho lưu phiên ChatGPT cho hệ điều hành này. Hãy cập nhật app.');
  const existing = readChatGPTCredentials();
  const state = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const redirectUri = `http://${host}:${port}/auth/callback`;
  const extAgentHostId = await getChatGPTHostId();
  let registration;
  try { registration = JSON.parse(await readFile(chatGPTRegistrationPath, 'utf8')); } catch { /* No issued registration yet. */ }
  const clientId = existing?.client_id || (/^oaiapp_[a-zA-Z0-9_-]+$/.test(registration?.clientId || '') ? registration.clientId : "dynamic_agent_client");
  pendingChatGPTAuth.add({
    state,
    nonce,
    verifier,
    redirectUri,
    clientId,
    subject: existing?.subject || null,
    createdAt: Date.now(),
  });


  const url = new URL(chatGPTAuthorizeEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", chatGPTScopes);
  url.searchParams.set("resource", chatGPTResource);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("ext_agent_host_id", extAgentHostId);
  if (clientId === "dynamic_agent_client") {
    url.searchParams.set("agent_name_hint", process.env.CHATGPT_KEYCHAIN_SERVICE?.includes("Dev") ? "ShortCut Studio Dev" : "ShortCut Studio");
  } else {
    if (existing && !existing.scopes?.includes("chatgpt.tokens.use.direct")) url.searchParams.set("prompt", "consent");
    if (existing?.id_token) url.searchParams.set("id_token_hint", existing.id_token);
    if (existing?.email) url.searchParams.set("login_hint", existing.email);
  }
  return { url: url.toString(), attemptId: state };
}

async function exchangeChatGPTCode(attempt, requestUrl) {
  if (requestUrl.searchParams.get("state") !== attempt.state) throw new Error("OAuth state không khớp.");
  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) throw new Error(oauthError === "access_denied" ? "Bạn đã hủy cấp quyền ChatGPT." : "ChatGPT từ chối đăng nhập. Thử lại sau hoặc kiểm tra quyền tài khoản.");
  const code = requestUrl.searchParams.get("code");
  const callbackClientId = requestUrl.searchParams.get("client_id");
  const issuedClientId = attempt.clientId === "dynamic_agent_client" ? callbackClientId : attempt.clientId;
  if (!code || !issuedClientId || issuedClientId === "dynamic_agent_client") throw new Error("ChatGPT registration chưa hoàn tất.");
  if (attempt.clientId !== "dynamic_agent_client" && callbackClientId && callbackClientId !== attempt.clientId) {
    throw new Error("ChatGPT callback trả về client khác với account đã chọn.");
  }

  await mkdir(dataRoot, { recursive: true });
  await writeFile(chatGPTRegistrationPath, JSON.stringify({ clientId: issuedClientId }), { mode: 0o600 });
  const response = await fetch(chatGPTTokenEndpoint, {
    signal: AbortSignal.timeout(20_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: issuedClientId,
      code,
      code_verifier: attempt.verifier,
      redirect_uri: attempt.redirectUri,
      resource: chatGPTResource,
    }),
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok) throw tokenError(token, response.status);
  assertTokenResponse(token);
  if (attempt.status !== "exchanging") throw new Error("Đã hủy đăng nhập; không lưu phiên.");
  const identity = await validateChatGPTIdToken(token.id_token, {
    clientId: issuedClientId,
    nonce: attempt.nonce,
    subject: attempt.subject || undefined,
  });
  const scopes = normalizeScope(token.scope);
  const credentials = {
    client_id: issuedClientId,
    ext_agent_host_id: await getChatGPTHostId(),
    subject: identity.sub,
    email: identity.email || null,
    name: identity.name || identity.preferred_username || null,
    id_token: token.id_token,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type || "Bearer",
    scopes,
    expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1_000).toISOString(),
    earliest_refresh_at: token.earliest_refresh_at || null,
    saved_at: new Date().toISOString(),
  };
  if (!credentials.access_token || !credentials.refresh_token) throw new Error("OpenAI không trả đủ OAuth credentials.");
  if (attempt.status !== "exchanging") throw new Error("Đã hủy đăng nhập; không lưu phiên.");
  writeChatGPTCredentials(credentials);
  chatGPTRefreshFailures.delete(issuedClientId);
  return credentials;
}

async function refreshChatGPTCredentials(credentials) {
  const key = credentials.client_id;
  if (chatGPTRefreshes.has(key)) return chatGPTRefreshes.get(key);
  const failed = chatGPTRefreshFailures.get(key);
  if (failed && Date.now() < failed.until) throw failed.error;
  const refresh = (async () => {
    const response = await fetch(chatGPTTokenEndpoint, {
      signal: AbortSignal.timeout(20_000),
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: credentials.client_id,
        refresh_token: credentials.refresh_token,
        resource: chatGPTResource,
      }),
    });
    const token = await response.json().catch(() => ({}));
    if (!response.ok) throw tokenError(token, response.status);
    assertTokenResponse(token);
    if (readChatGPTCredentials()?.refresh_token !== credentials.refresh_token) throw new Error("Phiên đã thay đổi trong lúc refresh; thử lại.");
    let identity = null;
    if (token.id_token) {
      identity = await validateChatGPTIdToken(token.id_token, {
        clientId: credentials.client_id,
        subject: credentials.subject,
      });
    }
    const next = {
      ...credentials,
      email: identity?.email || credentials.email,
      name: identity?.name || credentials.name,
      id_token: token.id_token || credentials.id_token,
      access_token: token.access_token,
      refresh_token: token.refresh_token || credentials.refresh_token,
      token_type: token.token_type || credentials.token_type || "Bearer",
      scopes: normalizeScope(token.scope).length ? normalizeScope(token.scope) : credentials.scopes,
      expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1_000).toISOString(),
      earliest_refresh_at: token.earliest_refresh_at || null,
      saved_at: new Date().toISOString(),
    };
    if (readChatGPTCredentials()?.refresh_token !== credentials.refresh_token) throw new Error("Phiên đã thay đổi trong lúc refresh; thử lại.");
    writeChatGPTCredentials(next);
    return next;
  })().then(value => { chatGPTRefreshFailures.delete(key); return value; }).catch(error => {
    chatGPTRefreshFailures.set(key, { error, until: Date.now() + (error.status === 401 ? 300_000 : 30_000) }); throw error;
  }).finally(() => chatGPTRefreshes.delete(key));
  chatGPTRefreshes.set(key, refresh);
  return refresh;
}

async function activeChatGPTCredentials() {
  const credentials = readChatGPTCredentials();
  if (!credentials) throw new Error("AUTH_REQUIRED: Hãy bấm Continue with ChatGPT trước.");
  if (!credentials.scopes?.includes("chatgpt.tokens.use.direct")) {
    throw new Error("PLAN_USAGE_DISABLED: ChatGPT plan usage chưa được cấp quyền.");
  }
  const expiresAt = Date.parse(credentials.expires_at || "");
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < 90_000) {
    return refreshChatGPTCredentials(credentials);
  }
  return credentials;
}

async function listChatGPTModels(credentials = null, signal) {
  const session = credentials || await activeChatGPTCredentials();
  const response = await fetch(`${chatGPTResource}/models`, {
    signal,
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.detail || `Không đọc được model ChatGPT (${response.status}).`);
  const models = (body.models || body.data || [])
    .filter((model) => !model.visibility || model.visibility === "list")
    .map((model) => ({ slug: model.slug || model.id, displayName: model.display_name || model.name || model.slug || model.id }))
    .filter((model) => model.slug);
  return models;
}

function parseEventStreamBlock(block) {
  const event = block.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
  if (!data || data === "[DONE]") return { event, data: null };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data: null };
  }
}

function responseTextFromCompleted(response) {
  return (response?.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("");
}

async function analyzeWithChatGPTPlan(body, signal, content) {
  signal?.throwIfAborted();
  const credentials = await activeChatGPTCredentials();
  const models = content && body.model ? [] : await listChatGPTModels(credentials, signal);
  const model = body.model || models[0]?.slug;
  if (!model) throw new Error("MODEL_UNAVAILABLE: ChatGPT account không trả về model khả dụng.");
  const response = await fetch(`${chatGPTResource}/responses`, {
    signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      ...(content ? { max_output_tokens: 1200 } : {}),
      instructions: body.instructions || "You are a precise short-form video editor. Return only the requested edit plan.",
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
  });
  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => ({}));
    const code = errorBody.error?.code;
    if (code === "subscription_sharing_usage_limit_exceeded") throw new Error("PLAN_LIMIT_REACHED: ChatGPT plan đã chạm giới hạn dùng cho app này.");
    const message = response.status === 401 ? "AUTH_EXPIRED: ChatGPT session không còn hợp lệ. Hãy đăng nhập lại."
      : response.status === 429 ? "RATE_LIMITED: ChatGPT đang giới hạn tạm thời."
      : [404, 503].includes(response.status) ? "MODEL_UNAVAILABLE: Model chưa khả dụng."
      : `ChatGPT request failed (${response.status}).`;
    const retry = response.headers.get("retry-after");
    throw Object.assign(new Error(message), { status: response.status, retryAfterMs: retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 1000 });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  let completed = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseEventStreamBlock(block);
      const eventType = parsed.data?.type || parsed.event;
      if (eventType === "response.output_text.delta") outputText += parsed.data?.delta || "";
      if (eventType === "response.output_text.done" && !outputText) outputText = parsed.data?.text || "";
      if (eventType === "response.completed") {
        completed = true;
        if (!outputText) outputText = responseTextFromCompleted(parsed.data?.response);
      }
      if (eventType === "response.failed") {
        const error = parsed.data?.response?.error || parsed.data?.error || {};
        if (error.code === "subscription_sharing_usage_limit_exceeded") throw new Error("PLAN_LIMIT_REACHED: ChatGPT plan đã chạm giới hạn dùng cho app này.");
        throw new Error(error.message || error.code || "ChatGPT response failed.");
      }
    }
    if (done) break;
  }
  if (!completed) throw new Error("INVALID_RESPONSE: ChatGPT stream kết thúc trước response.completed.");
  const cleaned = outputText.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return { plan: JSON.parse(cleaned), model };
  } catch {
    throw new Error("INVALID_RESPONSE: ChatGPT không trả về JSON edit plan hợp lệ.");
  }
}

const sourceDigests = new Map();
async function hookSourceFingerprint(source, signal) {
  signal?.throwIfAborted();
  const info = await stat(source.mediaPath), key = `${source.id}:${info.size}:${info.mtimeMs}`;
  if (sourceDigests.has(key)) return sourceDigests.get(key);
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(source.mediaPath)) { signal?.throwIfAborted(); digest.update(chunk); }
  const value = digest.digest("hex");
  if (sourceDigests.size >= 32) sourceDigests.delete(sourceDigests.keys().next().value);
  sourceDigests.set(key, value); return value;
}
async function hookFrames(part, source, signal) {
  const ranges = part.segments.filter((s) => !s.isPadding).slice(0,200), total = timelineDuration(ranges), frames = [];
  const directory = path.join(dataRoot, "cache", "hook-frames");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (let i = 0; i < 6; i++) {
    let offset = (i + 0.5) / 6 * total, range = ranges[0];
    for (const s of ranges) { range = s; if (offset < s.end - s.start) break; offset -= s.end - s.start; }
    const time = Math.min(range.end - 0.001, range.start + offset);
    const file = path.join(directory, `${randomUUID()}.jpg`);
    try {
      await run(ffmpeg, ["-y", "-v", "error", "-ss", String(time), "-i", source.mediaPath, "-frames:v", "1", "-vf", "scale=512:288:force_original_aspect_ratio=decrease", "-q:v", "5", file], { signal });
      const bytes = await readFile(file);
      if (bytes.length > 300_000) throw new Error("Hook frame exceeds budget");
      frames.push({ time, data: bytes.toString("base64") });
    } finally { await rm(file, { force: true }); }
  }
  return frames;
}
const selectTeasers = createTeaserSelector({ cacheRoot: path.join(dataRoot, "cache", "teaser-hooks"), fingerprint: hookSourceFingerprint, frames: hookFrames,
  resolveProvider: async (signal) => {
    const credentials = await activeChatGPTCredentials();
    const models = await listChatGPTModels(credentials, AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20_000)]));
    const model = models.find((m) => /gpt|o[1-9]/i.test(m.slug))?.slug;
    if (!model) throw new Error("MODEL_UNAVAILABLE");
    return { id: "chatgpt", model, analyze: async ({ input, images, schema, instructions, signal }) => {
      const content = [{ type: "input_text", text: JSON.stringify(input) }, ...images.flatMap((f) => [{ type: "input_text", text: `Source frame at ${f.time.toFixed(3)} seconds.` }, { type: "input_image", image_url: `data:image/jpeg;base64,${f.data}`, detail: "low" }])];
      const result = await analyzeWithChatGPTPlan({ model, schema, instructions }, signal, content);
      return { value: result.plan };
    } };
  },
});
async function planTeasers(plan, source, signal, transcript) {
  const sourceContext = await sourceContexts.ensure(source, { signal, comments: true });
  if (source.directory) await saveSourceContext(source.directory, sourceContext);
  source = { ...source, sourceContext };
  let cues = Array.isArray(source.captions) ? source.captions : [];
  if (plan.captionCues) cues = sourceCaptionTrack(plan.captionCues, source).cues;
  else {
    try { const cached = JSON.parse(await readFile(path.join(source.directory, "speech-captions.json"), "utf8")); cues = sourceCaptionTrack(cached, source).cues; } catch { /* No ASR download/recognition is triggered for selection. */ }
  }
  const sourceBoundaryCues = cues;
  const sourceInput = typeof transcript === "string" ? { ...source, transcript: transcript.slice(0, 100_000) } : source;
  if ((typeof transcript === "string" || !cues.length) && sourceInput.transcript) {
    const lines = transcriptCues(sourceInput.transcript).filter((c) => c.at < source.duration).sort((a,b) => a.at-b.at);
    if (lines.length) cues = lines.map((c,i) => ({ start:c.at, end:lines[i+1]?.at ?? source.duration, text:c.text })).filter((c) => c.end > c.start);
  }
  const context = source.sourceContext;
  return selectTeasers(plan, sourceInput, { cues, boundaryCues: sourceBoundaryCues.length ? sourceBoundaryCues : cues, supporting: context ? { ...context.metadata, chapters: context.chapters, commentClusters: context.comments?.clusters } : source, signal });
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
  commandLifecycle.assertRunning();
  options.signal?.throwIfAborted();
  if (!binary) throw new Error(options.missingMessage || "Thiếu binary cần thiết.");
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd || projectRoot,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      detached: Boolean(options.signal) && process.platform !== "win32",
      windowsHide: true,
    });
    commandLifecycle.track(child, Boolean(options.signal) && process.platform !== "win32");
    let killTimer;
    const kill = (signal) => {
      try {
        if (options.signal && process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch { /* The process may already have exited. */ }
    };
    const abort = () => {
      kill("SIGTERM");
      killTimer = setTimeout(() => kill("SIGKILL"), 3000);
      killTimer.unref();
    };
    const cleanup = () => { clearTimeout(killTimer); options.signal?.removeEventListener("abort", abort); };
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-(options.maxStdout || 100_000));
      options.onStdout?.(chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-100_000);
      options.onStderr?.(chunk.toString());
    });
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("close", (code) => {
      cleanup();
      if (options.signal?.aborted) { reject(options.signal.reason); return; }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${path.basename(binary)} exited with ${code}`).trim().slice(-5_000)));
    });
  });
}

async function probeMedia(mediaPath) {
  const result = await run(
    ffprobe,
    [
      "-v", "error",
      "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,pix_fmt,color_range,color_space,color_transfer,color_primaries",
      "-of", "json",
      mediaPath,
    ],
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
  const candidates = entries.filter((name) => name.startsWith("source.") && extensions.has(path.extname(name).toLowerCase()));
  if (!candidates.length) throw new Error("Không tìm thấy media file sau khi chuẩn bị source.");
  candidates.sort((a, b) => (path.extname(a).toLowerCase() === ".mp4" ? -1 : 1) - (path.extname(b).toLowerCase() === ".mp4" ? -1 : 1));
  return path.join(directory, candidates[0]);
}

async function saveSourceMetadata(directory, source) {
  await writeFile(path.join(directory, "source.json"), JSON.stringify(source, null, 2));
  return source;
}

async function fetchYouTubeTranscript(url, signal) {
  const info = await youtube.transcript(url, signal);
  return {
    title: String(info.title || "YouTube video"),
    sourceContext: youtube.peekContext(url),
    transcript: vttToTranscript(info.vtt || ""), captions: parseCaptions(info.vtt || ""),
    language: info.language || "",
    message: info.vtt ? "" : "YouTube không cung cấp phụ đề cho video này. Có thể dùng Manual cut hoặc Auto Subtitle.",
  };
}

async function importYouTube(url, signal) {
  return youtube.download(url, async ({ info, media, mediaPath, parsed, signal: activeSignal }) => {
    const id = randomUUID(), directory = path.join(sourcesRoot, id);
    let captions;
    try { captions = await fetchYouTubeTranscript(parsed.url, activeSignal); }
    catch (error) { activeSignal.throwIfAborted(); captions = { transcript: "", message: error.message }; }
    activeSignal.throwIfAborted();
    await mkdir(directory, { recursive: true });
    try {
      const filename = `source${path.extname(mediaPath)}`;
      await rename(mediaPath, path.join(directory, filename));
      const sourceContext = await sourceContexts.ensure({ id, kind: "youtube", sourceUrl: parsed.url, title: info.title, ...media }, { signal: activeSignal });
      return await saveSourceMetadata(directory, {
        sourceContext, id, kind: "youtube", title: String(info.title || "YouTube video"), sourceUrl: `https://www.youtube.com/watch?v=${parsed.id}`,
        originalFilename: filename, ...media, transcript: captions.transcript || "",
        transcriptMessage: captions.message || "", captions: captions.captions || [],
        language: captions.language || info.language || "", subtitleFound: Boolean(captions.transcript),
        subtitleFile: null, youtubeVideoId: parsed.id, createdAt: new Date().toISOString(),
      });
    } catch (error) {
      await rm(directory, { recursive: true, force: true }); throw error;
    }
  }, signal);
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
  source.sourceContext = sourceContextFor(source);
  return saveSourceMetadata(directory, source);
}

function fontFamilyFor(text, font = "auto") {
  return fontFamilyForStyle(font, text, { overrides: { latin: process.env.FONT_LATIN_FAMILY, japanese: process.env.FONT_JAPANESE_FAMILY, korean: process.env.FONT_KOREAN_FAMILY } });
}

let overlayFontsReady;
function registerOverlayFonts() {
  overlayFontsReady ||= Promise.all(listFonts().filter((font) => font.bundled).map(({ family, file }) => sharp({ text: {
    text: "A", font: `${family} Bold 12`, fontfile: path.join(projectRoot, "public", file), rgba: true,
  } }).png().toBuffer()));
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
  const normalized = String(value || "").trim().replace(/\s+/g, " ") || "UNTITLED";

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

async function loadSource(sourceId) {
  const id = assertId(sourceId);
  const directory = path.join(sourcesRoot, id);
  const metadata = JSON.parse(await readFile(path.join(directory, "source.json"), "utf8"));
  const mediaPath = await findSourceMedia(directory);
  const media = await probeMedia(mediaPath);
  const source = { ...metadata, ...media, directory, mediaPath };
  return { ...source, sourceContext: sourceContextFor(source) };
}

async function renderTitleOverlay({ outputPath, shineOutputPath, originalTitle, partTitle, partId, totalParts, visualStyle = DEFAULT_VISUAL_STYLE }) {
  await registerOverlayFonts();
  const size = Math.min(fitOverlayText(originalTitle, 'original').fontSize, fitOverlayText(partTitle, 'part').fontSize);
  let pair = { original: fitOverlayText(originalTitle, "original", size), part: fitOverlayText(partTitle, "part", size) };
  if (needsMeasuredTitleFit(visualStyle)) {
    pair = await constrainTitlePair(originalTitle, partTitle, pair, async (text, fontSize, role) => {
      const style = visualStyle[role === "original" ? "originalTitle" : "partTitle"];
      const family = fontFamilyFor(role === "original" ? originalTitle : partTitle, style.font);
      const { width } = await sharp({ text: { text: `<span font_family="${escapeXml(family)}" weight="${style.fontWeight}" size="${fontSize * 1024}">${escapeXml(text)}</span>`, rgba: true } }).metadata();
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
    const shineText = (fit, family, baseline, style) => style.effect !== "current-title-glow-shine" ? "" : `<g font-family="${escapeXml(family)}" font-size="${fit.fontSize}" font-weight="${style.fontWeight}" opacity="${style.opacity}"><g fill="#b4e9ff" filter="url(#shine-glow)">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join('')}</g><g fill="#e8f7ff">${fit.lines.map((line, index) => `<text x="540" y="${baseline + index * (fit.fontSize + fit.lineSpacing)}" text-anchor="middle">${escapeXml(line)}</text>`).join('')}</g></g>`;
    const shineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><filter id="shine-glow"><feGaussianBlur stdDeviation="${originalFit.fontSize * .08}"/></filter><clipPath id="top"><rect width="1080" height="${FOREGROUND_Y}"/></clipPath><clipPath id="bottom"><rect y="${TITLE_LAYOUT.part.top - 24}" width="1080" height="${1800 - TITLE_LAYOUT.part.top + 24}"/></clipPath></defs><g clip-path="url(#top)">${shineText(originalFit, originalFamily, originalFirstBaseline, visualStyle.originalTitle)}</g><g clip-path="url(#bottom)">${shineText(partFit, partFamily, TITLE_LAYOUT.part.top + partFit.fontSize * .82, visualStyle.partTitle)}</g></svg>`;
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
  await sharp({ create: { width: 1080, height: 1920, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(blank);
  const frames = []; let position = 0;
  const add = (file, duration) => { if (duration > 0.001) frames.push(`file '${path.basename(file)}'\nduration ${duration.toFixed(6)}`); };
  for (const [index, cue] of captions.entries()) {
    signal?.throwIfAborted();
    const start = Math.max(position, cue.start), end = Math.min(cue.end, captions[index + 1]?.start ?? Infinity);
    if (end <= start) continue;
    add(blank, start - position);
    const file = path.join(directory, `subtitle-${index}.png`);
    const size = style.size;
    const lines = cue.text.split("\n"), family = fontFamilyFor(cue.text, style.font);
    const y = subtitleY(style, source.height);
    const text = lines.map((line, lineIndex) => `<text x="540" y="${y - (lines.length - lineIndex - 1) * size * 1.2}" text-anchor="middle">${escapeXml(line)}</text>`).join("");
    const legacyGraphic = `<g font-family="${escapeXml(family)}" font-size="${size}" font-weight="700" stroke-linejoin="round" paint-order="stroke fill"><g transform="translate(2,3)" fill="#000" stroke="#000" stroke-width="${style.outline * 2 + 2}" opacity=".6">${text}</g><g fill="${style.color}" stroke="${style.outlineColor}" stroke-width="${style.outline * 2}">${text}</g></g>`;
    const graphic = style.effect === undefined ? legacyGraphic : styledTextSvg(lines, { fontFamily: family, fontSize: size, firstBaseline: y - (lines.length - 1) * size * 1.2, lineHeight: size * 1.2, roundBaseline: false, style: { ...style, fontWeight: style.fontWeight ?? 700, opacity: style.opacity ?? 1 } });
    const svg = (opacity) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><g opacity="${opacity}">${graphic}</g></svg>`;
    await sharp(Buffer.from(svg(1))).png().toFile(file);
    add(file, end - start);
    position = end;
  }
  const duration = presentationDuration(part);
  add(blank, Math.max(0.04, duration - position));
  const list = path.join(directory, "subtitles.ffconcat");
  await writeFile(list, `ffconcat version 1.0\n${frames.join("\n")}\nfile '${path.basename(blank)}'\n`);
  return list;
}


async function renderPart({ source, plan, part, totalParts, outputPath, backgroundAsset, sceneAsset, onProgress, signal }) {
  signal?.throwIfAborted();
  if (!ffmpeg) throw new Error("Không tìm thấy FFmpeg. macOS: brew install ffmpeg");
  const workDirectory = path.dirname(outputPath);
  const titleOverlayPath = path.join(workDirectory, `part-${part.id}-titles.png`);
  const titleShinePath = path.join(workDirectory, `part-${part.id}-shine.png`);
  await renderTitleOverlay({
    outputPath: titleOverlayPath,
    shineOutputPath: titleShinePath,
    originalTitle: plan.originalTitle,
    partTitle: part.title,
    partId: part.id,
    totalParts,
    visualStyle: plan.visualStyle || DEFAULT_VISUAL_STYLE,
  });

  // The existing title-card input carries scene pixels below unchanged text.
  // None reuses the exact original path/graph; static scenes need no extra decoder.
  const animated = normalizeTitleAnimation(plan.visualStyle?.titleAnimation) !== "none";
  const segments = presentationSegments(part), finitePresentation = animated || segments !== part.segments;
  // Fractional hook/cut times cross two fps conversions and image overlays.
  // Bound only hook presentations to their intended output frame count, filling
  // at most three EOF frames without shortening the independently finite audio.
  const hookTail = segments !== part.segments ? `,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=${Math.round(presentationDuration(part) / PLAYBACK_RATE * 30)}` : "";
  const transitionFilters = cutTransitionFilters(plan.visualStyle?.cutTransition, segments, partTransitionWindows(part, plan.visualStyle?.cutTransition));
  let titleInputPath = titleOverlayPath;
  if (sceneAsset && !animated && !transitionFilters) {
    titleInputPath = path.join(workDirectory, `part-${part.id}-scene-titles.png`);
    await sharp(sceneAsset).composite([{ input: titleOverlayPath }]).png().toFile(titleInputPath);
  }
  const audioInput = source.hasAudio ? "0:a" : "1:a";
  const subtitlesPath = await subtitleFrames(source, plan, part, workDirectory, signal);
  const segmentFilters = segments.flatMap((segment, index) => [
    `[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS,fps=30,setsar=1[v${index}]`,
    `[${audioInput}]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`,
  ]);
  const concatInputs = segments.map((_, index) => `[v${index}][a${index}]`).join("");
  const overlayInput = source.hasAudio ? 1 : 2;
  const shineX = `(1080-${TITLE_SHINE_WIDTH})*mod(t/${PLAYBACK_RATE},${TITLE_SHINE_SECONDS})/${TITLE_SHINE_SECONDS}`;
  // New RGB recipes stay RGB through composition, then convert explicitly to
  // Rec.709 limited YUV. Current's historical graph remains byte-for-byte.
  const background = assertRenderableBackground(plan.visualStyle?.background);
  const rgbFilter = Boolean(plan.visualStyle?.filter?.presetId) || background.mode !== "source-blur";
  const overlayFormat = rgbFilter ? ":format=rgb" : "";
  const outputColor = rgbFilter ? "scale=out_color_matrix=bt709:out_range=tv," : "";
  const animatedSceneInput = (animated || transitionFilters) && sceneAsset ? overlayInput + 2 + (subtitlesPath ? 1 : 0) + (backgroundAsset ? 1 : 0) : undefined;
  const animationFilters = titleAnimationFilters({ id: plan.visualStyle?.titleAnimation, titleInput: overlayInput, shineInput: overlayInput + 1, sceneInput: transitionFilters ? undefined : animatedSceneInput, overlayFormat });
  const filters = [
    ...segmentFilters,
    `${concatInputs}concat=n=${segments.length}:v=1:a=1[cutv][cuta]`,
    `[cutv]${ffmpegFilterExpression(plan.visualStyle?.filter, { contrast: renderContrast, saturation: renderSaturation })}[graded]`,
    ...(background.mode === "source-blur" ? [
      `[graded]split=2[bgsrc][mainsrc]`,
      `color=c=black:s=1080x1920:r=30[black]`,
      `[bgsrc]scale=270:480:force_original_aspect_ratio=increase:flags=fast_bilinear,crop=270:480,boxblur=12:2,scale=1080:1920:flags=bilinear,format=rgba,colorchannelmixer=aa=${background.opacity}[bgvideo]`,
      `[black][bgvideo]overlay=shortest=1${overlayFormat}[bg]`,
    ] : [
      `[graded]null[mainsrc]`,
      background.mode === "solid" ? `color=c=black:s=1080x1920:r=30,format=rgb24[bg]` : `[${overlayInput + 2 + (subtitlesPath ? 1 : 0)}:v]format=rgb24[bg]`,
    ]),
    `[mainsrc]${foregroundFilter()}[main]`,
    `[bg][main]overlay=0:${FOREGROUND_Y}:shortest=1${overlayFormat}[${transitionFilters ? "cutScene" : "layout"}]`,
    ...(transitionFilters ? [
      ...(animatedSceneInput !== undefined ? [`[${animatedSceneInput}:v]format=rgba[cutDecoration]`, `[cutScene][cutDecoration]overlay=0:0:shortest=1${overlayFormat}[decoratedCutScene]`] : []),
      `[${animatedSceneInput !== undefined ? "decoratedCutScene" : "cutScene"}]${transitionFilters}[layout]`,
    ] : []),
    ...(animationFilters || [
    `[${overlayInput}:v]format=rgba[titlecard]`,
    `[layout][titlecard]overlay=0:0:shortest=1${overlayFormat}[baseTitles]`,
    `[${overlayInput + 1}:v]format=rgba,crop=${TITLE_SHINE_WIDTH}:1920:x='${shineX}':y=0,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*max(0,1-abs(X-${TITLE_SHINE_WIDTH / 2})/${TITLE_SHINE_WIDTH / 2})'[shine]`,
    `[baseTitles][shine]overlay=x='${shineX}':y=0:shortest=1${overlayFormat}[titled]`,
    ]),
    ...(subtitlesPath ? [`[${overlayInput + 2}:v]fps=30,format=rgba[subcard]`, `[titled][subcard]overlay=0:0:eof_action=pass:repeatlast=0${overlayFormat}[subtitled]`] : []),
    `[${subtitlesPath ? "subtitled" : "titled"}]${outputColor}format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,${finitePresentation ? "settb=AVTB," : ""}setpts=PTS/${PLAYBACK_RATE}${finitePresentation ? ",fps=30:start_time=0:eof_action=pass" : ""}${hookTail}[vout]`,
    `[cuta]atempo=${PLAYBACK_RATE}[aout]`,
  ];

  const buildArgs = (videoEncoder) => {
    const hardwareRender = videoEncoder === "h264_videotoolbox";
    const args = ["-y"];
    if (hardwareRender && hardwareDecodeCodecs.has(source.videoCodec)) {
      args.push("-hwaccel", "videotoolbox");
    }
    args.push("-i", source.mediaPath);
    if (!source.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    args.push("-loop", "1", "-framerate", "30", "-i", titleInputPath);
    args.push("-loop", "1", "-framerate", "30", "-i", titleShinePath);
    if (subtitlesPath) args.push("-f", "concat", "-safe", "0", "-i", subtitlesPath);
    if (backgroundAsset) args.push("-loop", "1", "-framerate", "30", "-i", backgroundAsset);
    if (animatedSceneInput !== undefined) args.push("-loop", "1", "-framerate", "30", "-i", sceneAsset);
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[vout]",
      "-map", "[aout]",
      "-r", "30",
      "-pix_fmt", "yuv420p",
      "-color_range", "tv",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
    );
    if (hardwareRender) {
      args.push(
        "-c:v", "h264_videotoolbox",
        "-profile:v", "high",
        "-level:v", "4.2",
        "-b:v", process.env.FFMPEG_VIDEO_BITRATE || "16M",
        "-maxrate", process.env.FFMPEG_VIDEO_MAXRATE || "20M",
        "-bufsize", process.env.FFMPEG_VIDEO_BUFSIZE || "32M",
        "-spatial_aq", "1",
        "-realtime", "0",
        "-allow_sw", "0",
      );
    } else {
      args.push(
        "-c:v", videoEncoder,
        "-preset", process.env.FFMPEG_PRESET || "medium",
        "-crf", process.env.FFMPEG_CRF || "17",
      );
    }
    args.push(
      "-tag:v", "avc1",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart+write_colr",
      // Animated video/audio are already finite. Do not truncate the audio tail
      // to the final fps filter's EOF; None retains its historical options.
      ...(!finitePresentation ? ["-shortest"] : []),
      "-progress", "pipe:1",
      "-nostats",
      outputPath,
    );
    return args;
  };

  const expectedMicroseconds = presentationDuration(part) / PLAYBACK_RATE * 1_000_000;
  let progressBuffer = "";
  const renderOptions = {
    signal,
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
  };
  let encoderUsed = preferredVideoEncoder;
  try {
    await run(ffmpeg, buildArgs(encoderUsed), renderOptions);
  } catch (error) {
    signal?.throwIfAborted();
    if (encoderUsed !== "h264_videotoolbox") throw error;
    encoderUsed = "libx264";
    progressBuffer = "";
    await run(ffmpeg, buildArgs(encoderUsed), renderOptions);
  }
  onProgress(1);
  return encoderUsed;
}

function exportPrefixFor(plan, source) {
  const aliases = { de: "de", fr: "fr", ja: "jp", jp: "jp", ko: "kr", kr: "kr", en: "us", us: "us", vi: "vn", zh: "cn", es: "es", it: "it", pt: "pt", ru: "ru" };
  const sourceLanguage = String(source.language || "").toLowerCase().split(/[-_]/)[0];
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
  try {
    signal?.throwIfAborted();
    job.state = "rendering";
    job.startedAt = new Date().toISOString();
    const outputDirectory = path.join(source.directory, "outputs", job.id);
    await mkdir(outputDirectory, { recursive: true });
    const exportNames = job.exportNames || await reserveExportNames(plan, source);
    job.exportNames = exportNames;
    const sceneAsset = await renderSceneOverlay({ overlays: plan.visualStyle?.overlays || [], publicRoot: path.join(projectRoot, "public"), outputPath: path.join(outputDirectory, "scene-overlays.png") });
    // One static gradient per job, shared by all parts; never rasterize per frame.
    const background = assertRenderableBackground(plan.visualStyle?.background);
    let backgroundAsset;
    if (background.mode === "gradient") {
      backgroundAsset = path.join(outputDirectory, "background.png");
      const pixels = Buffer.alloc(1080 * 1920 * 3);
      for (let y = 0; y < 1920; y++) {
        const row = Buffer.from(gradientRowRgb(background, y, 1920));
        pixels.fill(row, y * 1080 * 3, (y + 1) * 1080 * 3);
      }
      await sharp(pixels, { raw: { width: 1080, height: 1920, channels: 3 } }).png().toFile(backgroundAsset);
    }
    for (const [index, part] of plan.parts.entries()) {
      signal?.throwIfAborted();
      job.currentPart = part.id;
      const filename = exportNames[index];
      const partDirectory = path.join(outputDirectory, `part-${part.id}`);
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
        onProgress: (partProgress) => {
          job.progress = Math.round(((index + partProgress) / plan.parts.length) * 100);
        },
      });
      const outputStat = await stat(outputPath);
      job.outputs.push({
        part: part.id,
        filename,
        size: outputStat.size,
        url: `/files/${source.id}/outputs/${job.id}/part-${part.id}/${encodeURIComponent(filename)}`,
      });
    }
    job.progress = 100;
    job.state = "done";
    job.finishedAt = new Date().toISOString();
  } catch (error) {
    job.state = signal?.aborted ? "cancelled" : "error";
    job.error = signal?.aborted ? null : error instanceof Error ? error.message : String(error);
    job.finishedAt = new Date().toISOString();
  }
}

async function startRender(body, parentSignal) {
  if (mediaLibrary.isLocked(body.sourceId)) throw Object.assign(new Error("Video đang được chuyển/xoá trong Thùng rác. Thử lại sau."), { status: 409 });
  const source = await loadSource(body.sourceId);
  parentSignal?.throwIfAborted();
  body.plan = originalCutPlan(body.plan, source.id);
  validatePlan(body.plan, source);
  let originalPlan = structuredClone({ ...body.plan, originalTitle: source.title, parts: body.plan.parts.map(trimPartStart) });
  if (!["manual", "mock"].includes(originalPlan.providerUsed) && originalPlan.parts.some((part) => !part.smartCutApplied)) {
    originalPlan = smartCutPlan(originalPlan, await speech.boundaries(source), source.duration);
  }
  if (body.selectTeasers === true || (originalPlan.teaserPolicy === TEASER_POLICY && originalPlan.parts.some((p) => !p.teaser || p.teaser.inputKey === "0".repeat(64)))) originalPlan = await planTeasers(originalPlan, source, parentSignal);
  originalPlan = snapshotPlanVisualStyle(originalPlan);
  if (originalPlan.subtitles.enabled && originalPlan.captionCues) originalPlan.captionCues = sourceCaptionTrack(originalPlan.captionCues, source);
  const renderPlan = originalPlan;
  validatePlan(renderPlan, source);
  if (mediaLibrary.isLocked(source.id)) throw Object.assign(new Error("Video đang được chuyển/xoá trong Thùng rác. Thử lại sau."), { status: 409 });
  const job = {
    id: randomUUID(),
    sourceId: source.id,
    origin: parentSignal ? "batch" : "editor",
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
  void persistBatchHistory();
  const controller = new AbortController();
  renderControllers.set(job.id, controller);
  const abort = () => cancelRender(job);
  parentSignal?.addEventListener("abort", abort, { once: true });
  if (parentSignal?.aborted) abort();
  renderQueue = renderQueue.then(() => executeRender(job, source, renderPlan, controller.signal)).catch((error) => {
    job.state = "error";
    job.error = error instanceof Error ? error.message : String(error);
  }).finally(() => {
    renderControllers.delete(job.id);
    parentSignal?.removeEventListener("abort", abort);
    void persistBatchHistory();
  });
  return job;
}

function cancelRender(job) {
  if (!job) return;
  if (["done", "error", "cancelled"].includes(job.state)) return;
  job.state = "cancelled";
  job.error = null;
  job.finishedAt = new Date().toISOString();
  renderControllers.get(job.id)?.abort();
  void persistBatchHistory();
}

function renderSnapshot(job) {
  return { ...job, stopping: job.state === "cancelled" && renderControllers.has(job.id) };
}

function cancelBatch(batch) {
  batchControllers.get(batch.id)?.abort();
  for (const item of batch.items) {
    if (item.jobId) cancelRender(jobs.get(item.jobId));
    if (!["done", "error"].includes(item.state)) { item.state = "cancelled"; item.error = null; }
  }
}

async function prepareBatch(batch, body, items) {
  const signal = batchControllers.get(batch.id).signal;
  for (const item of items) {
    if (item.deleted) continue;
    if (signal.aborted) break;
    try {
      item.state = "downloading";
      const source = await importYouTube(item.url, signal);
      signal.throwIfAborted();
      item.title = source.title;
      item.sourceId = source.id;
      if (!source.transcript?.trim()) throw new Error("Video không có transcript. Hãy dùng Manual cut cho video này.");
      item.state = "analyzing";
      const input = body.promptTemplate
        .replace("__BATCH_TITLE__", source.title)
        .replace("__BATCH_DURATION__", String(source.duration))
        .replace("__BATCH_TRANSCRIPT__", source.transcript);
      const result = await analyzeWithChatGPTPlan({ input, schema: body.schema }, signal);
      signal.throwIfAborted();
      item.plan = snapshotPlanVisualStyle({ ...result.plan, originalTitle: source.title, providerUsed: "chatgpt", visualStyle: body.visualStyle, subtitles: body.subtitles });
      item.plan.parts?.forEach((part, index) => { part.id = index + 1; });
      if (item.plan.parts?.length !== 2 || item.plan.parts.some((part) => !Array.isArray(part.hashtags) || new Set(part.hashtags).size !== 10)) {
        throw new Error("AI phải trả về đúng 2 part và 10 hashtag khác nhau cho mỗi part. Thử lại video này.");
      }
      validatePlan(item.plan, source);
      const job = await startRender({ sourceId: source.id, plan: item.plan, selectTeasers: true }, signal);
      item.plan = structuredClone(job.plan);
      item.jobId = job.id;
      item.state = "queued";
    } catch (error) {
      item.state = signal.aborted ? "cancelled" : "error";
      item.error = signal.aborted ? null : error instanceof Error ? error.message : String(error);
    }
  }
}

function batchSnapshot(batch) {
  const items = batch.items.filter((item) => !item.deleted).map((item) => {
    const job = item.jobId ? jobs.get(item.jobId) : null;
    return { ...item, state: job?.state || item.state, error: job?.error || item.error, job };
  });
  void persistBatchHistory();
  return { id: batch.id, items, finished: items.every((item) => ["done", "error", "cancelled"].includes(item.state)) };
}

function mediaContentType(target) {
  return {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
  }[path.extname(target).toLowerCase()] || "application/octet-stream";
}

async function serveMediaPath(request, response, target, { download = false } = {}) {
  const fileStat = statSync(target);
  const range = request.headers.range;
  const baseHeaders = {
    ...corsHeaders(request),
    "Content-Type": mediaContentType(target),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    ...(download ? { "Content-Disposition": `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(path.basename(target)).replace(/'/g, "%27")}` } : {}),
  };
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      response.writeHead(416, baseHeaders);
      response.end();
      return;
    }
    const start = Number(match[1]);
    const end = Math.min(match[2] ? Number(match[2]) : fileStat.size - 1, fileStat.size - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= fileStat.size) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${fileStat.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Content-Length": end - start + 1,
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(target, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, { ...baseHeaders, "Content-Length": fileStat.size });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(target).pipe(response);
}

async function serveFile(request, response, pathname, { download = true } = {}) {
  const relative = decodeURIComponent(pathname.slice("/files/".length));
  const target = path.resolve(sourcesRoot, relative);
  if (!target.startsWith(`${sourcesRoot}${path.sep}`) || !existsSync(target) || !statSync(target).isFile()) {
    sendJson(request, response, 404, { error: "Không tìm thấy output." });
    return;
  }
  await serveMediaPath(request, response, target, { download });
}

async function serveSourceMedia(request, response, sourceId) {
  const source = await loadSource(sourceId);
  await serveMediaPath(request, response, source.mediaPath);
}

await mkdir(sourcesRoot, { recursive: true });

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  try {
    if (requestUrl.pathname.startsWith("/api/chatgpt/") && !localAuthOrigin(request.headers.origin)) {
      sendJson(request, response, 403, { error: "Phiên ChatGPT chỉ dùng từ app local." }); return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }
    if (requestUrl.pathname.startsWith("/api/storage") || requestUrl.pathname.startsWith("/api/speech") || /^\/api\/sources\/[^/]+\/(captions|smart-cut|teaser-hooks)$/.test(requestUrl.pathname) || (request.method === "DELETE" && requestUrl.pathname.startsWith("/api/editor-renders/"))) {
      const origin = request.headers.origin;
      let local = !origin;
      try { const url = new URL(origin); local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname); } catch { /* Missing/native origin only. */ }
      if (!local) { sendJson(request, response, 403, { error: "Kho video chỉ cho phép thao tác từ app local trên máy này." }); return; }
      if (["POST", "DELETE"].includes(request.method) && request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
        sendJson(request, response, 415, { error: "Thao tác kho video yêu cầu JSON từ app." }); return;
      }
    }
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(request, response, 200, {
        ok: Boolean(ffmpeg && ffprobe),
        readyForYouTube: Boolean(ffmpeg && ffprobe),
        chatGPTAuthAvailable: chatGPTStore.available,
        tools: versions,
        render: {
          playbackRate: PLAYBACK_RATE, foregroundScale: FOREGROUND_SCALE,
          contrast: renderContrast, saturation: renderSaturation,
          encoder: preferredVideoEncoder,
          hardwareAccelerated: preferredVideoEncoder === "h264_videotoolbox",
          label: preferredVideoEncoder === "h264_videotoolbox" ? "Apple VideoToolbox" : preferredVideoEncoder,
          colorSpace: "Rec.709",
        },
        dataRoot,
      });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/auth/callback") {
      const state = requestUrl.searchParams.get("state") || "";
      const attempt = pendingChatGPTAuth.get(state);
      if (!attempt) {
        sendHtml(request, response, 400, "ChatGPT sign-in expired", "Quay lại ShortCut Studio và bấm Continue with ChatGPT lần nữa.");
        return;
      }
      try {
        pendingChatGPTAuth.take(state);
        const credentials = await exchangeChatGPTCode(attempt, requestUrl);
        pendingChatGPTAuth.finish(state, "connected");
        const sharingMessage = credentials.scopes.includes("chatgpt.tokens.use.direct")
          ? "Đã kết nối ChatGPT plan. Cửa sổ này sẽ tự đóng."
          : "Đã đăng nhập, nhưng ChatGPT plan usage chưa được cấp quyền.";
        sendHtml(request, response, 200, "ChatGPT connected", sharingMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không đăng nhập được ChatGPT.";
        pendingChatGPTAuth.finish(state, "failed", message);
        sendHtml(request, response, 400, "Không kết nối được ChatGPT", message);
      }
      return;
    }
    if (requestUrl.pathname.startsWith("/api/gemini/")) {
      sendJson(request, response, 400, { error: "Gemini Pro dùng chế độ copy/dán JSON trong tab chỉnh từng video. Không còn kết nối Antigravity hoặc gọi Gemini CLI/API." }); return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/chatgpt/session") {
      let credentials = readChatGPTCredentials(), error;
      if (credentials?.scopes?.includes("chatgpt.tokens.use.direct") && Date.parse(credentials.expires_at || "") - Date.now() < 90_000) {
        try { credentials = await activeChatGPTCredentials(); } catch (e) { error = e.status === 401 ? "Phiên đã bị thu hồi/hết hạn. Kết nối lại ChatGPT." : "Không refresh được phiên. Kiểm tra mạng và thử lại sau."; }
      }
      sendJson(request, response, 200, { session: { ...publicChatGPTSession(credentials), ...(error ? { sharing: false, error, needsSignIn: true } : {}) } });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt/auth/start") {
      const attempt = await startChatGPTAuthorization();
      sendJson(request, response, 200, attempt);
      return;
    }
    if (requestUrl.pathname === "/api/chatgpt/auth/status" && ["GET", "DELETE"].includes(request.method)) {
      const id = requestUrl.searchParams.get("attemptId");
      if (request.method === "DELETE") pendingChatGPTAuth.cancel(id);
      sendJson(request, response, 200, pendingChatGPTAuth.public(id)); return;
    }
    if (request.method === "DELETE" && requestUrl.pathname === "/api/chatgpt/session") {
      pendingChatGPTAuth.cancelAll();
      deleteChatGPTCredentials();
      await rm(chatGPTRegistrationPath, { force: true });
      sendJson(request, response, 200, { session: publicChatGPTSession(null) });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/chatgpt/models") {
      const models = await listChatGPTModels();
      sendJson(request, response, 200, { models });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt/analyze") {
      const body = await readJson(request);
      const result = await analyzeWithChatGPTPlan(body);
      sendJson(request, response, 200, result);
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/youtube/metadata") {
      sendJson(request, response, 200, await youtube.metadata(requestUrl.searchParams.get("url") || "")); return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/sources/youtube") {
      const body = await readJson(request);
      const source = await importYouTube(String(body.url || "").trim());
      sendJson(request, response, 201, { source });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/speech/status") {
      sendJson(request, response, 200, await speech.status()); return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/speech/model") {
      await readJson(request); await speech.installModel();
      sendJson(request, response, 200, await speech.status()); return;
    }
    const speechSource = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]+)\/(smart-cut|captions|teaser-hooks)$/i);
    if (request.method === "POST" && speechSource) {
      const body = await readJson(request);
      if (mediaLibrary.isLocked(speechSource[1])) throw new Error("Source đang được chuyển vào thùng rác.");
      const source = await loadSource(speechSource[1]);
      if (speechSource[2] === "captions") {
        sendJson(request, response, 200, await speech.captions(source, undefined, { regenerate: body.regenerate === true, provider: body.provider || 'auto' })); return;
      }
      validatePlan(body.plan, source);
      if (speechSource[2] === "teaser-hooks") {
        const controller = new AbortController(), abort = () => controller.abort(new Error("Hook client disconnected"));
        response.once("close", abort);
        try {
          if (body.transcript !== undefined && (typeof body.transcript !== "string" || body.transcript.length > 100_000)) throw new Error("Invalid hook transcript.");
          const next = await planTeasers(body.plan, source, AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]), body.transcript);
          validatePlan(next, source); sendJson(request, response, 200, { plan: next });
        } finally { response.removeListener("close", abort); }
        return;
      }
      const next = smartCutPlan({ ...body.plan, parts: body.plan.parts.map(trimPartStart) }, await speech.boundaries(source), source.duration);
      validatePlan(next, source); sendJson(request, response, 200, { plan: next }); return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/youtube/transcript") {
      const body = await readJson(request);
      sendJson(request, response, 200, await fetchYouTubeTranscript(String(body.url || "").trim()));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/sources/upload") {
      const source = await importUpload(request, requestUrl);
      sendJson(request, response, 201, { source });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/batches") {
      sendJson(request, response, 200, { batches: [...batches.values()].reverse().map(batchSnapshot).filter((batch) => batch.items.length) });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/storage") {
      sendJson(request, response, 200, { library: await mediaLibrary.list() });
      return;
    }
    const storageMediaMatch = requestUrl.pathname.match(/^\/api\/storage\/media\/([^/]+)$/);
    if (["GET", "HEAD"].includes(request.method || "") && storageMediaMatch) {
      const target = await mediaLibrary.media(decodeURIComponent(storageMediaMatch[1]));
      await serveMediaPath(request, response, target, { download: requestUrl.searchParams.get("download") === "1" });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/storage/trash") {
      const body = await readJson(request);
      sendJson(request, response, 200, await mediaLibrary.move(body.id));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/storage/restore") {
      const body = await readJson(request);
      sendJson(request, response, 200, await mediaLibrary.restore(body.id));
      return;
    }
    if (request.method === "DELETE" && requestUrl.pathname === "/api/storage/trash") {
      const body = await readJson(request);
      sendJson(request, response, 200, await mediaLibrary.purge(body.ids));
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/batches") {
      const body = await readJson(request);
      if (body.provider && body.provider !== "chatgpt") {
        sendJson(request, response, 400, { error: "Hàng loạt tự động chỉ dùng ChatGPT. Gemini Pro và Muse cần copy/dán JSON từng video." });
        return;
      }
      if (!Array.isArray(body.urls) || body.urls.length < 1 || body.urls.length > 20 || !body.schema || typeof body.promptTemplate !== "string") {
        sendJson(request, response, 400, { error: "Nhập từ 1 đến 20 link YouTube cùng cấu hình chia part." });
        return;
      }
      const urls = [...new Set(body.urls.map((value) => String(value).trim()))];
      for (const value of urls) {
        const url = new URL(value);
        if (!["https:", "http:"].includes(url.protocol) || !/^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(url.hostname)) {
          sendJson(request, response, 400, { error: `Không phải link YouTube: ${value}` });
          return;
        }
      }
      if (body.batchId !== undefined) body.batchId = assertId(body.batchId);
      await activeChatGPTCredentials();
      let batch;
      try {
        batch = batchPreparationQueue.submit({ ...body, urls });
      } catch (error) {
        if (!error.status) throw error;
        sendJson(request, response, error.status, { error: error.message });
        return;
      }
      sendJson(request, response, 202, { batch: batchSnapshot(batch) });
      return;
    }
    const deleteBatchItemMatch = requestUrl.pathname.match(/^\/api\/batches\/([a-f0-9-]{16,64})\/items\/([a-f0-9-]{16,64})$/i);
    if (request.method === "DELETE" && deleteBatchItemMatch) {
      const batch = batches.get(assertId(deleteBatchItemMatch[1]));
      if (!batch) { sendJson(request, response, 404, { error: "Hàng đợi không tồn tại." }); return; }
      try {
        const item = batch.items.find((item) => item.id === deleteBatchItemMatch[2]);
        if (mediaLibrary.isLocked(item?.sourceId || jobs.get(item?.jobId)?.sourceId)) throw Object.assign(new Error("Video đang được xử lý trong Thùng rác. Thử lại sau."), { status: 409 });
        const result = await removeBatchItem({ batch, itemId: assertId(deleteBatchItemMatch[2]), jobs, renderControllers, dataRoot });
        sendJson(request, response, 200, { batch: batchSnapshot(batch), ...result });
      } catch (error) {
        sendJson(request, response, error.status || 500, { error: error.message });
      }
      return;
    }
    const cancelBatchMatch = requestUrl.pathname.match(/^\/api\/batches\/([a-f0-9-]{16,64})\/cancel$/i);
    if (request.method === "POST" && cancelBatchMatch) {
      const batch = batches.get(assertId(cancelBatchMatch[1]));
      if (!batch) { sendJson(request, response, 404, { error: "Hàng đợi không tồn tại." }); return; }
      cancelBatch(batch);
      sendJson(request, response, 200, { batch: batchSnapshot(batch) });
      return;
    }
    const cancelJobMatch = requestUrl.pathname.match(/^\/api\/jobs\/([a-f0-9-]{16,64})\/cancel$/i);
    if (request.method === "POST" && cancelJobMatch) {
      const job = jobs.get(assertId(cancelJobMatch[1]));
      if (!job) { sendJson(request, response, 404, { error: "Render job không tồn tại." }); return; }
      cancelRender(job);
      sendJson(request, response, 200, { job: renderSnapshot(job) });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname.startsWith("/api/batches/")) {
      const batch = batches.get(assertId(requestUrl.pathname.slice("/api/batches/".length)));
      sendJson(request, response, batch ? 200 : 404, batch ? { batch: batchSnapshot(batch) } : { error: "Hàng đợi không còn tồn tại (worker đã restart)." });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/editor-renders") {
      sendJson(request, response, 200, { jobs: [...jobs.values()].filter((job) => job.origin === "editor" && !job.deleted).reverse().map(renderSnapshot) });
      return;
    }
    const deleteEditorMatch = requestUrl.pathname.match(/^\/api\/editor-renders\/([a-f0-9-]{16,64})$/i);
    if (request.method === "DELETE" && deleteEditorMatch) {
      const job = jobs.get(assertId(deleteEditorMatch[1]));
      if (!job || job.origin !== "editor") { sendJson(request, response, 404, { error: "Không tìm thấy render trong tab chỉnh từng video." }); return; }
      if (job.deleted) { sendJson(request, response, 200, { removed: true, trashId: null }); return; }
      if (!["done", "error", "cancelled"].includes(job.state) || renderControllers.has(job.id)) {
        sendJson(request, response, 409, { error: "Huỷ render và chờ tác vụ dừng hẳn trước khi xoá." }); return;
      }
      const result = await mediaLibrary.moveRender({ sourceId: job.sourceId, jobId: job.id });
      job.deleted = true; job.outputs = [];
      await persistBatchHistory();
      sendJson(request, response, 200, result);
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
    const sourceMediaMatch = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]{16,64})\/media$/i);
    if (["GET", "HEAD"].includes(request.method || "") && sourceMediaMatch) {
      await serveSourceMedia(request, response, sourceMediaMatch[1]);
      return;
    }
    if (["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname.startsWith("/files/")) {
      await serveFile(request, response, requestUrl.pathname, { download: requestUrl.searchParams.get("preview") !== "1" });
      return;
    }
    sendJson(request, response, 404, { error: "Route không tồn tại." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error.status || (message.startsWith("AUTH_REQUIRED") || message.startsWith("AUTH_EXPIRED") ? 401
      : message.startsWith("PLAN_USAGE_DISABLED") ? 403
        : message.startsWith("PLAN_LIMIT_REACHED") || message.startsWith("RATE_LIMITED") ? 429
          : message.startsWith("MODEL_UNAVAILABLE") ? 503
            : error.code === "ENOENT" ? 404 : 500);
    sendJson(request, response, status, { error: message });
  }
});

for (const name of ["SIGTERM", "SIGINT"]) {
  process.once(name, () => {
    console.log(`Media worker shutdown requested (${name}); stopping owned commands.`);
    void commandLifecycle.stop({
      onStart() {
        for (const controller of [...batchControllers.values(), ...renderControllers.values()]) controller.abort();
        pendingChatGPTAuth.cancelAll();
        server.close();
        server.closeAllConnections();
      },
      onStopped: persistBatchHistory,
    }).finally(() => process.exit(0));
  });
}
await restoreBatchHistory();
server.listen(port, host, () => {
  process.stdout.write(`\nShortCut media worker listening at http://${host}:${port}\n`);
  process.stdout.write(`FFmpeg: ${ffmpeg || "missing"}\nyt-dlp: ${ytDlp || "missing"}\n\n`);
});
