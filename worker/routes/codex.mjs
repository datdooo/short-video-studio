// ChatGPT Auto is the local Codex CLI: no in-app sign-in, tokens or callback routes remain.
export function createCodexRoutes({ analyzeWithChatGPTPlan, codexStatus, readJson, sendJson, serveAiOperation }) {
  /** Legacy session shape kept for the UI and its QA fixtures; `sharing` means "Codex can be used". */
  const publicSession = (state) => ({
    available: state.installed,
    connected: state.loggedIn,
    sharing: state.installed && state.loggedIn,
    installed: state.installed,
    version: state.version,
    model: state.model,
    reasoning: state.reasoning,
    ...(!state.installed
      ? { error: "Chưa tìm thấy Codex CLI. Cài Codex rồi bấm Kiểm tra lại." }
      : !state.loggedIn
        ? { error: "Codex chưa đăng nhập. Chạy `codex login` trong Terminal rồi bấm Kiểm tra lại.", needsSignIn: true }
        : {}),
  });
  return [
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
      condition: 'request.method === "GET" && ["/api/codex/status", "/api/chatgpt/session"].includes(requestUrl.pathname)',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && ["/api/codex/status", "/api/chatgpt/session"].includes(requestUrl.pathname)) {
          const state = await codexStatus({ force: requestUrl.searchParams.get("refresh") === "1" });
          sendJson(request, response, 200, { session: publicSession(state) });
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
