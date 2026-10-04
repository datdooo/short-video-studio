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
  chmod,
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
const pendingChatGPTAuth = new Map();
const chatGPTRefreshes = new Map();
const chatGPTHostPath = path.join(dataRoot, "chatgpt-host.json");
const chatGPTKeychainService = "ShortCut Studio ChatGPT";
const chatGPTKeychainAccount = "default";
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

function runSecurity(args) {
  if (process.platform !== "darwin" || !existsSync("/usr/bin/security")) {
    throw new Error("ChatGPT sign-in cần macOS Keychain trên máy local này.");
  }
  return spawnSync("/usr/bin/security", args, {
    encoding: "utf8",
    timeout: 8_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

function readChatGPTCredentials() {
  const result = runSecurity([
    "find-generic-password",
    "-a", chatGPTKeychainAccount,
    "-s", chatGPTKeychainService,
    "-w",
  ]);
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Credential ChatGPT trong Keychain bị hỏng. Hãy disconnect rồi đăng nhập lại.");
  }
}

function writeChatGPTCredentials(credentials) {
  const credentialHex = Buffer.from(JSON.stringify(credentials), "utf8").toString("hex");
  const result = runSecurity([
    "add-generic-password",
    "-a", chatGPTKeychainAccount,
    "-s", chatGPTKeychainService,
    "-U",
    "-X", credentialHex,
    "-T", "/usr/bin/security",
  ]);
  if (result.status !== 0) throw new Error("Không lưu được ChatGPT credential vào macOS Keychain.");
}

function deleteChatGPTCredentials() {
  const result = runSecurity([
    "delete-generic-password",
    "-a", chatGPTKeychainAccount,
    "-s", chatGPTKeychainService,
  ]);
  return result.status === 0;
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
    const response = await fetch(chatGPTJwksEndpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Không tải được OpenAI signing keys.");
    cachedChatGPTJwks = await response.json();
  }
  let jwk = cachedChatGPTJwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedChatGPTJwks = null;
    const response = await fetch(chatGPTJwksEndpoint, { headers: { Accept: "application/json" } });
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
  if (!credentials) return { available: process.platform === "darwin", connected: false, sharing: false };
  return {
    available: process.platform === "darwin",
    connected: true,
    sharing: credentials.scopes?.includes("chatgpt.tokens.use.direct") || false,
    email: credentials.email || null,
    name: credentials.name || null,
    expiresAt: credentials.expires_at || null,
  };
}

async function startChatGPTAuthorization() {
  const existing = readChatGPTCredentials();
  const state = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const redirectUri = `http://${host}:${port}/auth/callback`;
  const extAgentHostId = await getChatGPTHostId();
  const clientId = existing?.client_id || "dynamic_agent_client";
  pendingChatGPTAuth.set(state, {
    state,
    nonce,
    verifier,
    redirectUri,
    clientId,
    subject: existing?.subject || null,
    createdAt: Date.now(),
  });
  for (const [key, attempt] of pendingChatGPTAuth) {
    if (Date.now() - attempt.createdAt > 10 * 60_000) pendingChatGPTAuth.delete(key);
  }

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
    url.searchParams.set("agent_name_hint", "ShortCut Studio");
  } else {
    if (existing?.id_token) url.searchParams.set("id_token_hint", existing.id_token);
    if (existing?.email) url.searchParams.set("login_hint", existing.email);
  }
  return url.toString();
}

async function exchangeChatGPTCode(attempt, requestUrl) {
  if (requestUrl.searchParams.get("state") !== attempt.state) throw new Error("OAuth state không khớp.");
  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) throw new Error(oauthError === "access_denied" ? "Bạn đã hủy cấp quyền ChatGPT." : `ChatGPT OAuth lỗi: ${oauthError}`);
  const code = requestUrl.searchParams.get("code");
  const callbackClientId = requestUrl.searchParams.get("client_id");
  const issuedClientId = attempt.clientId === "dynamic_agent_client" ? callbackClientId : attempt.clientId;
  if (!code || !issuedClientId || issuedClientId === "dynamic_agent_client") throw new Error("ChatGPT registration chưa hoàn tất.");
  if (attempt.clientId !== "dynamic_agent_client" && callbackClientId && callbackClientId !== attempt.clientId) {
    throw new Error("ChatGPT callback trả về client khác với account đã chọn.");
  }

  const response = await fetch(chatGPTTokenEndpoint, {
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
  if (!response.ok) throw new Error(token.error_description || token.error || `OpenAI token exchange failed (${response.status}).`);
  const identity = await validateChatGPTIdToken(token.id_token, {
    clientId: issuedClientId,
    nonce: attempt.nonce,
    subject: attempt.subject || undefined,
  });
  const scopes = normalizeScope(token.scope || requestUrl.searchParams.get("scope"));
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
  writeChatGPTCredentials(credentials);
  return credentials;
}

async function refreshChatGPTCredentials(credentials) {
  const key = credentials.client_id;
  if (chatGPTRefreshes.has(key)) return chatGPTRefreshes.get(key);
  const refresh = (async () => {
    const response = await fetch(chatGPTTokenEndpoint, {
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
    if (!response.ok) throw new Error(token.error_description || token.error || `Không refresh được ChatGPT session (${response.status}).`);
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
    writeChatGPTCredentials(next);
    return next;
  })().finally(() => chatGPTRefreshes.delete(key));
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

async function listChatGPTModels(credentials = null) {
  const session = credentials || await activeChatGPTCredentials();
  const response = await fetch(`${chatGPTResource}/models`, {
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

async function analyzeWithChatGPTPlan(body) {
  const credentials = await activeChatGPTCredentials();
  const models = await listChatGPTModels(credentials);
  const model = body.model || models[0]?.slug;
  if (!model) throw new Error("MODEL_UNAVAILABLE: ChatGPT account không trả về model khả dụng.");
  const response = await fetch(`${chatGPTResource}/responses`, {
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
      instructions: body.instructions || "You are a precise short-form video editor. Return only the requested edit plan.",
      input: [{ role: "user", content: String(body.input || "") }],
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
    if (response.status === 401) throw new Error("AUTH_EXPIRED: ChatGPT session không còn hợp lệ. Hãy đăng nhập lại.");
    if (response.status === 429) throw new Error("RATE_LIMITED: ChatGPT đang giới hạn tạm thời.");
    throw new Error(errorBody.error?.message || errorBody.detail || `ChatGPT request failed (${response.status}).`);
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

const overlayFitConfig = {
  original: { maxFontSize: 54, minFontSize: 32, maxLines: 3, maxWidth: 900, maxHeight: 220, lineSpacing: -2 },
  part: { maxFontSize: 82, minFontSize: 44, maxLines: 4, maxWidth: 900, maxHeight: 244, lineSpacing: -4 },
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

function fitOverlayText(value, role) {
  const config = overlayFitConfig[role];
  const normalized = String(value || "").trim().replace(/\s+/g, " ") || "UNTITLED";

  for (let fontSize = config.maxFontSize; fontSize >= config.minFontSize; fontSize -= 2) {
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
  const originalFit = fitOverlayText(originalTitle, "original");
  const partFit = fitOverlayText(partTitle, "part");
  const originalLineHeight = originalFit.fontSize + originalFit.lineSpacing;
  const originalLastBaseline = 332 - originalFit.fontSize * 0.2;
  const originalFirstBaseline = originalLastBaseline - (originalFit.lines.length - 1) * originalLineHeight;
  const partLineHeight = partFit.fontSize + partFit.lineSpacing;
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
      ${svgTextLines(originalFit.lines, { fontFamily: family, fontSize: originalFit.fontSize, firstBaseline: originalFirstBaseline, lineHeight: originalLineHeight, strokeWidth: 5 })}
      ${svgTextLines(partFit.lines, { fontFamily: family, fontSize: partFit.fontSize, firstBaseline: 1472 + partFit.fontSize * 0.82, lineHeight: partLineHeight, strokeWidth: 7 })}
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
    ...(download ? { "Content-Disposition": `attachment; filename="${path.basename(target)}"` } : {}),
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

async function serveFile(request, response, pathname) {
  const relative = decodeURIComponent(pathname.slice("/files/".length));
  const target = path.resolve(sourcesRoot, relative);
  if (!target.startsWith(`${sourcesRoot}${path.sep}`) || !existsSync(target) || !statSync(target).isFile()) {
    sendJson(request, response, 404, { error: "Không tìm thấy output." });
    return;
  }
  await serveMediaPath(request, response, target, { download: true });
}

async function serveSourceMedia(request, response, sourceId) {
  const source = await loadSource(sourceId);
  await serveMediaPath(request, response, source.mediaPath);
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
        chatGPTAuthAvailable: process.platform === "darwin" && existsSync("/usr/bin/security"),
        tools: versions,
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
      pendingChatGPTAuth.delete(state);
      try {
        const credentials = await exchangeChatGPTCode(attempt, requestUrl);
        const sharingMessage = credentials.scopes.includes("chatgpt.tokens.use.direct")
          ? "Đã kết nối ChatGPT plan. Cửa sổ này sẽ tự đóng."
          : "Đã đăng nhập, nhưng ChatGPT plan usage chưa được cấp quyền.";
        sendHtml(request, response, 200, "ChatGPT connected", sharingMessage);
      } catch (error) {
        sendHtml(request, response, 400, "Không kết nối được ChatGPT", error instanceof Error ? error.message : String(error));
      }
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/api/chatgpt/session") {
      sendJson(request, response, 200, { session: publicChatGPTSession(readChatGPTCredentials()) });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt/auth/start") {
      const url = await startChatGPTAuthorization();
      sendJson(request, response, 200, { url });
      return;
    }
    if (request.method === "DELETE" && requestUrl.pathname === "/api/chatgpt/session") {
      deleteChatGPTCredentials();
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
    const sourceMediaMatch = requestUrl.pathname.match(/^\/api\/sources\/([a-f0-9-]{16,64})\/media$/i);
    if (["GET", "HEAD"].includes(request.method || "") && sourceMediaMatch) {
      await serveSourceMedia(request, response, sourceMediaMatch[1]);
      return;
    }
    if (["GET", "HEAD"].includes(request.method || "") && requestUrl.pathname.startsWith("/files/")) {
      await serveFile(request, response, requestUrl.pathname);
      return;
    }
    sendJson(request, response, 404, { error: "Route không tồn tại." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("AUTH_REQUIRED") || message.startsWith("AUTH_EXPIRED") ? 401
      : message.startsWith("PLAN_USAGE_DISABLED") ? 403
        : message.startsWith("PLAN_LIMIT_REACHED") || message.startsWith("RATE_LIMITED") ? 429
          : message.startsWith("MODEL_UNAVAILABLE") ? 503
            : 500;
    sendJson(request, response, status, { error: message });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`\nShortCut media worker listening at http://${host}:${port}\n`);
  process.stdout.write(`FFmpeg: ${ffmpeg || "missing"}\nyt-dlp: ${ytDlp || "missing"}\n\n`);
});
