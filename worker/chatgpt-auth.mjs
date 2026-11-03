import { createHash, createPublicKey, randomBytes, randomUUID, verify as verifySignature } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { reasoningCapabilities } from "../lib/ai-reasoning.mjs";
import { assertTokenResponse, createAuthAttempts, sessionHealth, tokenError } from "./chatgpt-auth-state.mjs";
import { createChatGPTStore } from "./chatgpt-store.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createChatGPTAuth(read, { createStore = createChatGPTStore } = {}) {
  const { dataRoot } = read();
  const pendingChatGPTAuth = createAuthAttempts();

  const chatGPTRegistrationPath = path.join(dataRoot, "chatgpt-registration.json");

  const chatGPTRefreshes = new Map();

  const chatGPTRefreshFailures = new Map();

  const chatGPTHostPath = path.join(dataRoot, "chatgpt-host.json");

  const chatGPTStore = createStore({ dataRoot });

  const chatGPTResource = "https://api.openai.com/v1";

  const chatGPTIssuer = "https://auth.openai.com";

  const chatGPTAuthorizeEndpoint = `${chatGPTIssuer}/api/accounts/authorize`;

  const chatGPTTokenEndpoint = `${chatGPTIssuer}/api/accounts/oauth/token`;

  const chatGPTJwksEndpoint = `${chatGPTIssuer}/.well-known/jwks.json`;

  const chatGPTScopes = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

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
    const { dataRoot } = read();

    try {
      const saved = JSON.parse(await readFile(chatGPTHostPath, "utf8"));
      if (/^urn:uuid:[a-f0-9-]{36}$/i.test(saved.ext_agent_host_id || "")) return saved.ext_agent_host_id;
    } catch {
      // First launch creates the stable host identifier below.
    }
    const extAgentHostId = `urn:uuid:${randomUUID()}`;
    await mkdir(dataRoot, { recursive: true });
    await writeFile(chatGPTHostPath, JSON.stringify({ ext_agent_host_id: extAgentHostId }, null, 2), {
      flag: "wx",
      mode: 0o600,
    }).catch(async (error) => {
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
      const response = await fetch(chatGPTJwksEndpoint, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Không tải được OpenAI signing keys.");
      cachedChatGPTJwks = await response.json();
    }
    let jwk = cachedChatGPTJwks.keys?.find((key) => key.kid === header.kid);
    if (!jwk) {
      cachedChatGPTJwks = null;
      const response = await fetch(chatGPTJwksEndpoint, {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/json" },
      });
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
    if (!payload.sub || (subject && payload.sub !== subject))
      throw new Error("ChatGPT account không khớp với session đã lưu.");
    return payload;
  }

  function normalizeScope(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean);
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
    const { betaRuntime, host, port } = read();

    if (!chatGPTStore.available)
      throw new Error("Bản app chưa có kho lưu phiên ChatGPT cho hệ điều hành này. Hãy cập nhật app.");
    const existing = readChatGPTCredentials();
    const state = base64Url(randomBytes(32));
    const nonce = base64Url(randomBytes(32));
    const verifier = base64Url(randomBytes(48));
    const challenge = base64Url(createHash("sha256").update(verifier).digest());
    const redirectUri = `http://${host}:${port}/auth/callback`;
    const extAgentHostId = await getChatGPTHostId();
    let registration;
    try {
      registration = JSON.parse(await readFile(chatGPTRegistrationPath, "utf8"));
    } catch {
      /* No issued registration yet. */
    }
    const clientId =
      existing?.client_id ||
      (/^oaiapp_[a-zA-Z0-9_-]+$/.test(registration?.clientId || "") ? registration.clientId : "dynamic_agent_client");
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
      url.searchParams.set("agent_name_hint", betaRuntime.name);
    } else {
      if (existing && !existing.scopes?.includes("chatgpt.tokens.use.direct"))
        url.searchParams.set("prompt", "consent");
      if (existing?.id_token) url.searchParams.set("id_token_hint", existing.id_token);
      if (existing?.email) url.searchParams.set("login_hint", existing.email);
    }
    return { url: url.toString(), attemptId: state };
  }

  async function exchangeChatGPTCode(attempt, requestUrl) {
    const { dataRoot } = read();

    if (requestUrl.searchParams.get("state") !== attempt.state) throw new Error("OAuth state không khớp.");
    const oauthError = requestUrl.searchParams.get("error");
    if (oauthError)
      throw new Error(
        oauthError === "access_denied"
          ? "Bạn đã hủy cấp quyền ChatGPT."
          : "ChatGPT từ chối đăng nhập. Thử lại sau hoặc kiểm tra quyền tài khoản.",
      );
    const code = requestUrl.searchParams.get("code");
    const callbackClientId = requestUrl.searchParams.get("client_id");
    const issuedClientId = attempt.clientId === "dynamic_agent_client" ? callbackClientId : attempt.clientId;
    if (!code || !issuedClientId || issuedClientId === "dynamic_agent_client")
      throw new Error("ChatGPT registration chưa hoàn tất.");
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
    if (!credentials.access_token || !credentials.refresh_token)
      throw new Error("OpenAI không trả đủ OAuth credentials.");
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
      if (readChatGPTCredentials()?.refresh_token !== credentials.refresh_token)
        throw new Error("Phiên đã thay đổi trong lúc refresh; thử lại.");
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
      if (readChatGPTCredentials()?.refresh_token !== credentials.refresh_token)
        throw new Error("Phiên đã thay đổi trong lúc refresh; thử lại.");
      writeChatGPTCredentials(next);
      return next;
    })()
      .then((value) => {
        chatGPTRefreshFailures.delete(key);
        return value;
      })
      .catch((error) => {
        chatGPTRefreshFailures.set(key, { error, until: Date.now() + (error.status === 401 ? 300_000 : 30_000) });
        throw error;
      })
      .finally(() => chatGPTRefreshes.delete(key));
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
    const session = credentials || (await activeChatGPTCredentials());
    const response = await fetch(`${chatGPTResource}/models`, {
      signal,
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Object.assign(new Error(`Không đọc được model ChatGPT (${response.status}).`), { status: response.status });
    const models = (body.models || body.data || [])
      .filter((model) => !model.visibility || model.visibility === "list")
      .map((model) => ({
        slug: model.slug || model.id,
        displayName: model.display_name || model.name || model.slug || model.id,
        ...(reasoningCapabilities(model) !== undefined
          ? { supported_reasoning_efforts: reasoningCapabilities(model) }
          : {}),
      }))
      .filter((model) => model.slug);
    return models;
  }
  return {
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
  };
}
