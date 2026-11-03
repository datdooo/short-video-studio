// Extracted route bodies retain their original order and response contracts.
export function createMusicRoutes({
  MUSIC_CATALOG,
  loadSource,
  mediaLibrary,
  musicLibrary,
  musicPreview,
  readJson,
  sendJson,
  validatePlan,
}) {
  return [
    {
      order: 12,
      condition: "request.method==='POST'&&requestUrl.pathname==='/api/music/preview'",
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/music/preview") {
          const body = await readJson(request),
            source = await loadSource(body.sourceId);
          if (mediaLibrary.isLocked(source.id)) throw Error("Source is busy in Trash.");
          validatePlan(body.plan, source, { teasers: false });
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Audio preview cancelled"));
          response.once("close", abort);
          try {
            sendJson(
              request,
              response,
              200,
              await musicPreview.prepare(source, body.plan, body.partId, body.sessionId, controller.signal),
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
      order: 14,
      condition: "request.method==='GET'&&requestUrl.pathname==='/api/music'",
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname === "/api/music") {
          sendJson(request, response, 200, { assets: await musicLibrary.list(), catalog: MUSIC_CATALOG });
          return;
        }
        return false;
      },
    },
    {
      order: 15,
      condition: "request.method==='POST'&&requestUrl.pathname==='/api/music/import'",
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/music/import") {
          const controller = new AbortController(),
            abort = () => controller.abort(new Error("Music import cancelled"));
          response.once("close", abort);
          try {
            const asset = await musicLibrary.import(request, {
              filename: decodeURIComponent(String(request.headers["x-filename"] || "music.mp3")),
              catalogId: MUSIC_CATALOG.some((t) => t.id === request.headers["x-catalog-id"])
                ? request.headers["x-catalog-id"]
                : undefined,
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
            });
            const { file, ...metadata } = asset;
            void file;
            sendJson(request, response, 201, { asset: metadata });
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
