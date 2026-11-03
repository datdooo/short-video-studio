// Extracted route bodies retain their original order and response contracts.
export function createRenderRoutes({ assertId, jobs, readJson, renderSnapshot, sendJson, startRender }) {
  return [
    {
      order: 42,
      condition: 'request.method === "POST" && requestUrl.pathname === "/api/render"',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "POST" && requestUrl.pathname === "/api/render") {
          const body = await readJson(request);
          const job = await startRender(body);
          sendJson(request, response, 202, { job });
          return;
        }
        return false;
      },
    },
    {
      order: 43,
      condition: 'request.method === "GET" && requestUrl.pathname.startsWith("/api/jobs/")',
      matchers: "",
      async handle(request, response, requestUrl) {
        if (request.method === "GET" && requestUrl.pathname.startsWith("/api/jobs/")) {
          const jobId = assertId(requestUrl.pathname.slice("/api/jobs/".length));
          const job = jobs.get(jobId);
          if (!job) {
            sendJson(request, response, 404, { error: "Render job không tồn tại hoặc worker đã restart." });
            return;
          }
          sendJson(request, response, 200, { job: renderSnapshot(job) });
          return;
        }
        return false;
      },
    },
  ];
}
