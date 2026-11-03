// Origin/Host, OPTIONS and content-type guards always run before dispatch.
export function createRequestHandler({ host, port, requestOrigins, corsHeaders, dispatchRoutes, sendJson }) {
  return async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
      requestOrigins.assert(request, requestUrl.pathname);
      if (request.method === "OPTIONS") {
        response.writeHead(204, corsHeaders(request));
        response.end();
        return;
      }
      const rawUpload = ["/api/sources/upload", "/api/music/import"].includes(requestUrl.pathname);
      const bodyPresent =
        Number(request.headers["content-length"]) > 0 || Boolean(request.headers["transfer-encoding"]);
      if (
        !rawUpload &&
        !["GET", "HEAD"].includes(request.method) &&
        bodyPresent &&
        request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json"
      ) {
        sendJson(request, response, 415, { error: "Thao tác này yêu cầu JSON từ app." });
        return;
      }
      if (await dispatchRoutes(request, response, requestUrl)) return;

      sendJson(request, response, 404, { error: "Route không tồn tại." });
    } catch (error) {
      // Streaming may already have sent headers or the client may have gone away.
      // Never attempt a second JSON response; pipeline has closed owned streams.
      if (response.destroyed || response.writableEnded) return;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const status =
        error.status ||
        (message.startsWith("AUTH_REQUIRED") || message.startsWith("AUTH_EXPIRED")
          ? 401
          : message.startsWith("PLAN_USAGE_DISABLED")
            ? 403
            : message.startsWith("PLAN_LIMIT_REACHED") || message.startsWith("RATE_LIMITED")
              ? 429
              : message.startsWith("MODEL_UNAVAILABLE")
                ? 503
                : error.code === "ENOENT"
                  ? 404
                  : error.code === "ERR_INVALID_URL" || error instanceof URIError
                    ? 400
                    : 500);
      sendJson(request, response, status, { error: message });
    }
  };
}
