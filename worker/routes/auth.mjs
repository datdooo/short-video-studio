// Extracted route bodies retain their original order and response contracts.
export function createAuthRoutes({
  activeChatGPTCredentials,
  analyzeWithChatGPTPlan,
  chatGPTRegistrationPath,
  deleteChatGPTCredentials,
  exchangeChatGPTCode,
  listChatGPTModels,
  pendingChatGPTAuth,
  publicChatGPTSession,
  readChatGPTCredentials,
  readJson,
  rm,
  sendHtml,
  sendJson,
  serveAiOperation,
  startChatGPTAuthorization,
}) {
  return [
    {
      order: 2,
      condition: 'request.method === "GET" && requestUrl.pathname === "/auth/callback"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/auth/callback") {
          const state = requestUrl.searchParams.get("state") || "";
          const attempt = pendingChatGPTAuth.get(state);
          if (!attempt) {
            sendHtml(
              request,
              response,
              400,
              "ChatGPT sign-in expired",
              "Quay lại ShortCut Studio và bấm Continue with ChatGPT lần nữa.",
            );
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
        return false;
      },
    },
    {
      order: 3,
      condition: 'requestUrl.pathname.startsWith("/api/gemini/")',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (requestUrl.pathname.startsWith("/api/gemini/")) {
          sendJson(request, response, 400, {
            error:
              "Gemini Pro dùng chế độ copy/dán JSON trong tab chỉnh từng video. Không còn kết nối Antigravity hoặc gọi Gemini CLI/API.",
          });
          return;
        }
        return false;
      },
    },
    {
      order: 4,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/chatgpt/session"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/chatgpt/session") {
          let credentials = readChatGPTCredentials(),
            error;
          if (
            credentials?.scopes?.includes("chatgpt.tokens.use.direct") &&
            Date.parse(credentials.expires_at || "") - Date.now() < 90_000
          ) {
            try {
              credentials = await activeChatGPTCredentials();
            } catch (e) {
              error =
                e.status === 401
                  ? "Phiên đã bị thu hồi/hết hạn. Kết nối lại ChatGPT."
                  : "Không refresh được phiên. Kiểm tra mạng và thử lại sau.";
            }
          }
          sendJson(request, response, 200, {
            session: {
              ...publicChatGPTSession(credentials),
              ...(error ? { sharing: false, error, needsSignIn: true } : {}),
            },
          });
          return;
        }
        return false;
      },
    },
    {
      order: 5,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/chatgpt/auth/start"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt/auth/start") {
          const attempt = await startChatGPTAuthorization();
          sendJson(request, response, 200, attempt);
          return;
        }
        return false;
      },
    },
    {
      order: 6,
      condition: 'requestUrl.pathname === "/api/chatgpt/auth/status" && ["GET", "DELETE"].includes(request.method)',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (requestUrl.pathname === "/api/chatgpt/auth/status" && ["GET", "DELETE"].includes(request.method)) {
          const id = requestUrl.searchParams.get("attemptId");
          if (request.method === "DELETE") pendingChatGPTAuth.cancel(id);
          sendJson(request, response, 200, pendingChatGPTAuth.public(id));
          return;
        }
        return false;
      },
    },
    {
      order: 7,
      condition: 'request.method === "DELETE" && requestUrl.pathname === "/api/chatgpt/session"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "DELETE" && requestUrl.pathname === "/api/chatgpt/session") {
          pendingChatGPTAuth.cancelAll();
          deleteChatGPTCredentials();
          await rm(chatGPTRegistrationPath, { force: true });
          sendJson(request, response, 200, { session: publicChatGPTSession(null) });
          return;
        }
        return false;
      },
    },
    {
      order: 8,
      condition: 'request.method === "GET" && requestUrl.pathname === "/api/chatgpt/models"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/chatgpt/models") {
          const models = await listChatGPTModels();
          sendJson(request, response, 200, { models });
          return;
        }
        return false;
      },
    },
    {
      order: 9,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/chatgpt/analyze"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/chatgpt/analyze") {
          const body = await readJson(request);
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Analysis cancelled"));
          response.once("close", abort);
          try {
            await serveAiOperation(request, response, body, "legacy-analysis", () =>
              analyzeWithChatGPTPlan(body, AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)])),
            );
          } finally {
            response.removeListener("close", abort);
          }
          return;
        }
        return false;
      },
    },
  ];
}
